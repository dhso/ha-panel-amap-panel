import "./libs/style-element.js";
import "https://webapi.amap.com/loader.js";
import { wgs84togcj02 } from "./libs/map-util.js?module";

const { Element, html } = Polymer;

class AmapPanel extends Element {
    static get properties() {
        return {
            hass: { type: Object, observer: "drawDevicesDebounced" },
            narrow: { type: Boolean },
            route: { type: Object },
            panel: { type: Object },
        };
    }

    constructor() {
        super();
        this.amapMap = null;
        this.drawDevicesDebounced = this.debounce(
            this.drawDevices.bind(this),
            500
        );
        this.fitMapDebounced = this.debounce(this.fitMap, 500);
    }

    connectedCallback() {
        super.connectedCallback();
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        this.amapMap && this.amapMap.destroy();
    }

    ready() {
        console.log("ready");
        super.ready();
        this.initAmap();
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
                    this.drawDevicesDebounced(this.hass);
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

    toggleTrafffic(e) {
        if (e.target.checked) {
            this.amapMapTrafficLayer.show();
        } else {
            this.amapMapTrafficLayer.hide();
        }
    }

    drawZones(hass) {
        if (!this.amapMap || !hass) return;
        let keys = Object.keys(hass.states).filter(
            (state) => state.indexOf("zone") === 0
        );
        for (let key of keys) {
            const { attributes } = hass.states[key];
            if (
                "longitude" in attributes &&
                "latitude" in attributes &&
                !attributes.passive
            ) {
                const {
                    longitude,
                    latitude,
                    friendly_name,
                    icon,
                    radius,
                } = attributes;
                const lnglat = wgs84togcj02(longitude, latitude);
                // 添加图标
                const marker = new AMap.Marker({
                    position: lnglat,
                    offset: new AMap.Pixel(-12, -12),
                    title: friendly_name,
                    extData: key,
                    content: `<ha-icon icon=${icon}></ha-icon>`,
                });
                marker.on("click", () => {
                    this.fire("hass-more-info", { entityId: key });
                });
                this.amapMap.add(marker);
                // 添加圆形区域
                const circle = new AMap.Circle({
                    center: lnglat,
                    radius: radius,
                    extData: key,
                    strokeColor: "#3366FF",
                    strokeOpacity: 0.3,
                    strokeWeight: 3,
                    fillColor: "#FFA500",
                    fillOpacity: 0.35,
                });
                this.amapMap.add(circle);
                this.fitMapDebounced();
            }
        }
    }

    drawDevices(hass) {
        if (!this.amapMap || !hass) return;
        const newKeys = this.filterDevices(hass);
        const lastKeys = [];
        const lastKeyMarkers = {};
        const markers = this.amapMap.getAllOverlays("marker");
        var gcj02Devices = [];
        if (this.panel.config.hasOwnProperty("gcj02_devices")) {
            gcj02Devices = this.panel.config.gcj02_devices;
        }
        for (let marker of markers) {
            const extData = marker.getExtData();
            if (extData.indexOf("device_tracker") === 0) {
                lastKeys.push(extData);
                lastKeyMarkers[extData] = marker;
            }
        }
        for (let key of lastKeys) {
            if (newKeys.indexOf(key) === -1) {
                // 需要删除的点
                console.log(`Del:${key}`);
                this.amapMap.remove(lastKeyMarkers[key]);
            }
        }
        for (let key of newKeys) {
            const { attributes, state } = hass.states[key];
            const {
                longitude,
                latitude,
                friendly_name,
                entity_picture,
            } = attributes;
            var lnglat = wgs84togcj02(longitude, latitude);
            if (gcj02Devices.indexOf(key) > -1) {
                lnglat = [longitude, latitude];
            }
            if (lastKeys.indexOf(key) === -1) {
                // 需要增加的点
                console.log(`Add:${key}`);
                const display_name =
                    friendly_name
                        .split(" ")
                        .map((part) => part[0])
                        .join("")
                        .substr(0, 3) || "";
                const content = entity_picture
                    ? `<iron-image sizing="cover" class="fit" src="${entity_picture}" ></iron-image>`
                    : `<div class="device-marker"> ${display_name}</div>`;
                const marker = new AMap.Marker({
                    position: lnglat,
                    offset: new AMap.Pixel(-20, -20),
                    extData: key,
                    title: friendly_name,
                    content: content,
                });
                marker.on("click", () => {
                    this.fire("hass-more-info", { entityId: key });
                });
                this.amapMap.add(marker);
                this.fitMapDebounced();
            } else {
                // 需要移动的点
                console.log(`Move:${key}`);
                lastKeyMarkers[key].setPosition(
                    new AMap.LngLat(lnglat[0], lnglat[1])
                );
            }
        }
    }

    filterDevices(hass) {
        if (!hass || !hass.states) return [];
        return Object.keys(hass.states).filter((state) => {
            const { attributes } = hass.states[state];
            return (
                state.indexOf("device_tracker") === 0 &&
                // attributes.source_type === "gps" &&
                "longitude" in attributes &&
                "latitude" in attributes &&
                hass.states[state].state != "home"
            );
        });
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
                    height: calc(100% - 64px);
                    overflow: hidden;
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
            <app-toolbar>
                <ha-menu-button
                    hass="[[hass]]"
                    narrow="[[narrow]]"
                ></ha-menu-button>
                <div main-title>[[panel.title]]</div>
            </app-toolbar>

            <div id="AmapMap"></div>
            <div class="input-card">
                <div class="input-item">
                    <label>
                        <input type="checkbox" on-click="toggleTrafffic" />
                        实时路况
                    </label>
                </div>
            </div>
        `;
    }
}
customElements.define("amap-panel", AmapPanel);
