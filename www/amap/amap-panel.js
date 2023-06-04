import {
    wgs84togcj02,
} from "./libs/utils.js?module";

import {
  LitElement,
  html,
  css,
} from "https://unpkg.com/lit-element@2.4.0/lit-element.js?module";

class AmapPanel extends LitElement {
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
        window.iframeReady = this.iframeReady.bind(this);;
    }

    connectedCallback() {
        console.warn('::ConnectedCallback');
        super.connectedCallback();
        this.allReady && this.iframe.init();
    }

    disconnectedCallback() {
        console.warn('::DisconnectedCallback');
        super.disconnectedCallback();
    }

    ready() {
        console.warn("::PanelReady");
        super.ready();
    }

    iframeReady() {
        console.warn("::IframeReady");
    }

    observerHass() {
        this.allReady && this.iframe.drawEntitiesDebounced(this.hass);
    }

    get iframe() {
        return this.shadowRoot.querySelector("iframe").contentWindow;
    }

    get allReady() {
        return this.iframe && this.iframe.ready;
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

    render() {
        return html `
            <meta
                name="viewport"
                content="initial-scale=1.0, user-scalable=no, width=device-width"
            />
            <style include="ha-style">
                iframe {
                    position: relative;
                    width: 100%;
                    height: calc(100vh - 60px);
                }
                app-toolbar {
                    height: 56px;
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
