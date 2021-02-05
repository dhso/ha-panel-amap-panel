import "./libs/style-element.js";
import "https://webapi.amap.com/loader.js";
import {
    wgs84togcj02,
    getEntityName,
    getEntityShortName,
} from "./libs/utils.js?module";

const { Element, html } = Polymer;

class AmapPanel extends Element {
    static get properties() {
        return {
            hass: { type: Object, observer: "drawEntitiesDebounced" },
            narrow: { type: Boolean },
            route: { type: Object },
            panel: { type: Object },
        };
    }

    constructor() {
        super();
        this.amapMap = null;
        this.drawEntitiesDebounced = this.debounce(
            this.drawEntities.bind(this),
            500
        );
        this.fitMapDebounced = this.debounce(this.fitMap, 500);
        this.zones = [];
        this.trackers = [];
    }

    connectedCallback() {
        super.connectedCallback();
        this.initAmap();
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        this.amapMap && this.amapMap.destroy();
    }

    ready() {
        console.log("ready");
        super.ready();
    }

    initAmap() {
        const { longitude, latitude } = this.hass.config;
        const { darkMode } = this.hass.themes;
        const { key } = this.panel.config;
        AMapLoader.load({
            key, // 申请好的Web端开发者Key，首次调用 load 时必填
            plugins: ["AMap.Scale", "AMap.ToolBar"], // 需要使用的的插件列表，如比例尺'AMap.Scale'等
        })
            .then((AMap) => {
                const amapMapId = this.shadowRoot.querySelector("#AmapMap");
                const amapMapOption = {
                    resizeEnable: true,
                    center: wgs84togcj02(longitude, latitude),
                    zoom: 13,
                    defaultCursor: "pointer",
                    mapStyle: darkMode
                        ? "amap://styles/dark"
                        : "amap://styles/normal",
                };
                const toolBar = new AMap.ToolBar({
                    liteStyle: true,
                });
                const scale = new AMap.Scale();

                this.amapMap = new AMap.Map(amapMapId, amapMapOption);
                this.amapMap.addControl(toolBar);
                this.amapMap.addControl(scale);
                this.amapMap.on("complete", () => {
                    console.log("amap complete");
                    this.amapMapTrafficLayer = new AMap.TileLayer.Traffic({
                        autoRefresh: true,
                    });
                    this.amapMapTrafficLayer.hide();
                    this.amapMapTrafficLayer.setMap(this.amapMap);

                    this.drawZones(this.hass);
                    this.drawEntitiesDebounced(this.hass);
                    this.fitMapDebounced();
                });
            })
            .catch((e) => {
                console.error(e); //加载错误提示
            });
    }

    clearMap() {
        this.amapMap && this.amapMap.clearMap();
    }

    fitMap() {
        this.amapMap && this.amapMap.setFitView();
    }

    async fetchHistoryPath(start_time, end_time, entity_id) {
        const [[history]] = await this.hass.callApi(
            "GET",
            `history/period/${start_time}?end_time=${end_time}&minimal_response${
                entity_id ? `&filter_entity_id=${entity_id}` : ``
            }`
        );
        let path = [];
        for (let state of history) {
            const { latitude, longitude } = state.attributes;
            const lnglat = wgs84togcj02(longitude, latitude);
            path.push(lnglat);
        }
        return path;
    }

    toggleTrafffic(e) {
        if (e.target.checked) {
            this.amapMapTrafficLayer && this.amapMapTrafficLayer.show();
        } else {
            this.amapMapTrafficLayer && this.amapMapTrafficLayer.hide();
        }
    }

    toggleTrack(e) {
        if (e.target.checked) {
            const originPath = fetchHistoryPath(
                new Date(new Date().setHours(0, 0, 0)).toISOString(),
                new Date(new Date().setHours(23, 59, 59)).toISOString(),
                e.target.data
            );
            const polyline = new AMap.Polyline({
                path: originPath,
                showDir: true,
                strokeColor: "#28F", //线颜色
                strokeWeight: 6, //线宽
                extData: `track:${e.target.data}`,
                // strokeOpacity: 1,     //线透明度
                // strokeStyle: "solid"  //线样式
            });
            this.amapMap.add(polyline);
            this.fitMapDebounced();
        } else {
            const polylines = this.amapMap.getAllOverlays("polyline");
            for (let polyline of polylines) {
                const extData = polyline.getExtData();
                if (extData === `track:${e.target.data}`) {
                    this.amapMap.remove(polyline);
                }
            }
        }
    }

    drawZones(hass) {
        if (!this.amapMap || !hass || !hass.states) return;
        this.zones = Object.keys(hass.states).filter((state) => {
            const { attributes } = hass.states[state];
            return (
                state.indexOf("zone") === 0 &&
                "longitude" in attributes &&
                "latitude" in attributes
            );
        });
        for (let zone of this.zones) {
            this.drawZone(hass.states[zone]);
        }
    }

    drawEntities(hass) {
        if (!this.amapMap || !hass || !hass.states) return;
        this.trackers = Object.keys(hass.states).filter((state) => {
            const { attributes } = hass.states[state];
            return (
                // attributes.source_type === "gps" &&
                state.indexOf("device_tracker") === 0 &&
                "longitude" in attributes &&
                "latitude" in attributes
            );
        });
        const _trackers = this.trackers.slice();

        const markers = this.amapMap.getAllOverlays("marker");
        for (let marker of markers) {
            // entity_id
            const state = marker.getExtData();
            // 排除zone
            if (state.indexOf("zone") === 0) continue;
            if (!this.trackers.includes(state)) {
                // 移除点
                this.amapMap.remove(marker);
                console.log(`Del:${state}`);
                continue;
            }
            // 更新点
            const { longitude, latitude } = hass.states[state].attributes;
            const lnglat = wgs84togcj02(longitude, latitude);
            marker.setPosition(new AMap.LngLat(lnglat[0], lnglat[1]));
            console.log(`Mov:${state}`);
            // 剩余部分
            if (_trackers.includes(state)) {
                _trackers.splice(_trackers.indexOf(state), 1);
            }
        }
        // 添加点
        for (let tracker of _trackers) {
            this.drawTracker(hass.states[tracker]);
        }
    }

    drawZone(state) {
        if (!this.amapMap || !state) return;
        const { longitude, latitude, icon, radius, passive } = state.attributes;
        if (passive) return;
        const title = getEntityName(state);
        const lnglat = wgs84togcj02(longitude, latitude);
        // 添加图标
        const marker = new AMap.Marker({
            position: lnglat,
            offset: new AMap.Pixel(-12, -12),
            title,
            extData: state.entity_id,
            content: `<ha-icon icon=${icon}></ha-icon>`,
        });
        marker.on("click", () => {
            this.fire("hass-more-info", { entityId: state.entity_id });
        });
        this.amapMap.add(marker);
        // 添加圆形区域
        const circle = new AMap.Circle({
            center: lnglat,
            radius: radius,
            extData: state.entity_id,
            strokeColor: "#3366FF",
            strokeOpacity: 0.3,
            strokeWeight: 3,
            fillColor: "#FFA500",
            fillOpacity: 0.35,
        });
        this.amapMap.add(circle);
        console.log(`Add:${state.entity_id}`);
        this.fitMapDebounced();
    }

    drawTracker(state) {
        if (!this.amapMap || !state) return;
        if (state.state === "home") return;
        const { attributes } = state;
        const { longitude, latitude, entity_picture } = attributes;
        const lnglat = wgs84togcj02(longitude, latitude);
        const title = getEntityName(state);
        const short_title = getEntityShortName(state);

        const content = entity_picture
            ? `<iron-image sizing="cover" class="fit" src="${entity_picture}" ></iron-image>`
            : `<div class="device-marker"> ${short_title}</div>`;
        const marker = new AMap.Marker({
            position: lnglat,
            offset: new AMap.Pixel(-20, -20),
            extData: state.entity_id,
            title,
            content: content,
        });
        marker.on("click", () => {
            this.fire("hass-more-info", { entityId: state.entity_id });
        });
        this.amapMap.add(marker);
        console.log(`Add:${state.entity_id}`);
        this.fitMapDebounced();
    }

    debounce(func, wait, immediate) {
        let timeout;
        return function (...args) {
            const context = this;
            const later = () => {
                timeout = null;
                if (!immediate) func.apply(context, args);
            };
            const callNow = immediate && !timeout;
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
            if (callNow) func.apply(context, args);
        };
    }

    fire(type, data) {
        const event = new Event(type, {
            bubbles: true,
            cancelable: false,
            composed: true,
        });
        event.detail = data;
        this.dispatchEvent(event);
    }

    // _attachDom(dom) {
    //     this.appendChild(dom);
    // }

    static get template() {
        return html`
            <meta
                name="viewport"
                content="initial-scale=1.0, user-scalable=no, width=device-width"
            />
            <style include="ha-style style-element">
                #AmapMap {
                    position: relative;
                    width: 100%;
                    height: calc(100vh - 64px);
                    overflow: hidden;
                    z-index: 0;
                }
                .input-card {
                    display: flex;
                    flex-direction: column;
                    word-wrap: break-word;
                    background-color: var(--primary-background-color);
                    background-clip: border-box;
                    color: var(--primary-text-color);
                    border-radius: 5px;
                    border-width: 0;
                    box-shadow: 0 2px 6px 0 var(--primary-background-color);
                    position: fixed;
                    flex: 1 1 auto;
                    padding: 10px;
                    width: auto;
                    top: 74px;
                    right: 10px;
                    bottom: auto;
                }
                .input-item {
                    position: relative;
                    display: flex;
                    flex-wrap: wrap;
                    align-items: center;
                    width: 100%;
                    height: 24px;
                }
                .device-marker {
                    position: relative;
                    display: block;
                    margin: 0 auto;
                    width: 38px;
                    text-align: center;
                    height: 38px;
                    line-height: 38px;
                    font-size: 14px;
                    border-radius: 50%;
                    border: 1px solid
                        var(--ha-marker-color, var(--default-primary-color));
                    color: var(--primary-text-color);
                    background-color: var(--primary-background-color);
                }
                iron-image {
                    position: relative;
                    display: block;
                    margin: 0 auto;
                    width: 38px;
                    text-align: center;
                    height: 38px;
                    border: 1px solid
                        var(--ha-marker-color, var(--default-primary-color));
                    border-radius: 50%;
                }
                ha-icon {
                    color: var(--primary-text-color);
                    width: 24px;
                    height: 24px;
                }
            </style>
            <ha-app-layout>
                <app-header fixed slot="header">
                    <app-toolbar>
                        <ha-menu-button
                            hass="[[hass]]"
                            narrow="[[narrow]]"
                        ></ha-menu-button>
                        <div main-title>[[panel.title]]</div>
                    </app-toolbar>
                </app-header>
                <div id="AmapMap"></div>
                <div class="input-card">
                    <div class="input-item">
                        <label>
                            <input type="checkbox" on-click="toggleTrafffic" />
                            实时路况
                        </label>
                    </div>
                </div>
            </ha-app-layout>
        `;
    }
}
customElements.define("amap-panel", AmapPanel);
