import {
    wgs84togcj02,
} from "./libs/utils.js?module";

const {
    Element,
    html
} = Polymer;

class AmapPanel extends Element {
    static get properties() {
        return {
            hass: {
                type: Object,
                observer: "observerHass"
            },
            narrow: {
                type: Boolean
            },
            route: {
                type: Object
            },
            panel: {
                type: Object
            },
        };
    }

    constructor() {
        super();
        // this.observerHassDebounced = debounce(
        //     this.observerHass.bind(this),
        //     500
        // );
        this.iframe = null;
    }

    connectedCallback() {
        super.connectedCallback();
        window.panel = this.panel;
        window.hass = this.hass;
        window.fire = this.fire.bind(this);
        window.iframeReady = this.iframeReady.bind(this);
        const iframe = this.getIframe();
        iframe && iframe.location.reload();
    }

    disconnectedCallback() {
        super.disconnectedCallback();
    }

    ready() {
        console.log("panel ready");
        super.ready();
    }

    iframeReady() {
        console.log("iframe ready");
        // 写入CSS变量
        const globalCssVars = window.getComputedStyle(document.documentElement);
        const styles = document.documentElement.style;
        const iframe = this.getIframe();
        if (iframe) {
            for (const k of styles) {
                iframe.setGlobalCssVars(k, globalCssVars.getPropertyValue(k));
            }
            iframe.drawZonesDebounced(this.hass);
        }
    }

    observerHass() {
        const iframe = this.getIframe();
        if (iframe && iframe.ready) {
            iframe.drawEntitiesDebounced(this.hass);
        }
    }

    getIframe() {
        if (this.iframe) return this.iframe;
        this.iframe = this.shadowRoot.querySelector("iframe").contentWindow;
        return this.iframe;
    }

    async fetchHistoryPath(start_time, end_time, entity_id) {
        const [
            [history]
        ] = await this.hass.callApi(
            "GET",
            `history/period/${start_time}?end_time=${end_time}&minimal_response${entity_id ? `&filter_entity_id=${entity_id}` : ``
            }`
        );
        let path = [];
        for (let state of history) {
            const {
                latitude,
                longitude
            } = state.attributes;
            const lnglat = wgs84togcj02(longitude, latitude);
            path.push(lnglat);
        }
        return path;
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

    static get template() {
        return html `
            <meta
                name="viewport"
                content="initial-scale=1.0, user-scalable=no, width=device-width"
            />
            <style include="ha-style">
                iframe {
                    position: relative;
                    width: 100%;
                    height: calc(100vh - 68px);
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
                <iframe src="local/amap/iframe/amap.html" frameborder="no" border="0" marginwidth="0" marginheight="0" scrolling="no">
                </iframe>
            </ha-app-layout>
        `;
    }
}
customElements.define("amap-panel", AmapPanel);