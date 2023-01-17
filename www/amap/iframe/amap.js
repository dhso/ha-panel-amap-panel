//定义一些常量
const x_PI = (3.14159265358979324 * 3000.0) / 180.0;
const PI = 3.1415926535897932384626;
const offset_a = 6378245.0;
const offset_ee = 0.00669342162296594323;

window.zones = [];
window.trackers = [];
window.drawZonesDebounced = debounce(drawZones, 500);
window.drawEntitiesDebounced = debounce(drawEntities, 500);
window.fitMapDebounced = debounce(fitMap, 500);
window.ready = false;

window.addEventListener('load', function () {
    window.ready = true;
    parent.iframeReady();
    createMap();
});

function createMap() {
    if (window.amapMap) return;
    AMapLoader.load({
        key, // 申请好的Web端开发者Key，首次调用 load 时必填
        version: jscode ? '2.0': '',
        plugins: ['AMap.Scale', 'AMap.ToolBar'], // 需要使用的的插件列表，如比例尺'AMap.Scale'等
    })
        .then(AMap => {
            const {
                longitude,
                latitude
            } = parent.hass.config;
            const {
                darkMode
            } = parent.hass.themes;
            const amapMapId = document.querySelector('#AmapMap');
            const amapMapOption = {
                resizeEnable: true,
                center: transformTo('', longitude, latitude),
                zoom: 13,
                defaultCursor: 'pointer',
                mapStyle: darkMode ? 'amap://styles/dark' : 'amap://styles/normal'
            };
            const toolBar = new AMap.ToolBar({
                liteStyle: true
            });
            const scale = new AMap.Scale();

            window.amapMap = new AMap.Map(amapMapId, amapMapOption);
            window.amapMap.addControl(toolBar);
            window.amapMap.addControl(scale);
            window.amapMap.on('complete', () => {
                console.log('amap complete');
                window.amapMapTrafficLayer = new AMap.TileLayer.Traffic({
                    autoRefresh: true
                });
                window.amapMapTrafficLayer.hide();
                window.amapMapTrafficLayer.setMap(window.amapMap);

                drawZonesDebounced(parent.hass);
                drawEntitiesDebounced(parent.hass);
                fitMapDebounced();
            });
        })
        .catch(e => {
            console.error(e); //加载错误提示
        });
}



/**
 * WGS84转GCj02
 * @param lng
 * @param lat
 * @returns {*[]}
 */
function wgs84togcj02(lng, lat) {
    if (out_of_china(lng, lat)) {
        return [lng, lat];
    } else {
        var dlat = transformlat(lng - 105.0, lat - 35.0);
        var dlng = transformlng(lng - 105.0, lat - 35.0);
        var radlat = (lat / 180.0) * PI;
        var magic = Math.sin(radlat);
        magic = 1 - offset_ee * magic * magic;
        var sqrtmagic = Math.sqrt(magic);
        dlat =
            (dlat * 180.0) /
            (((offset_a * (1 - offset_ee)) / (magic * sqrtmagic)) * PI);
        dlng = (dlng * 180.0) / ((offset_a / sqrtmagic) * Math.cos(radlat) * PI);
        var mglat = lat + dlat;
        var mglng = lng + dlng;
        return [mglng, mglat];
    }
}

/**
 * 百度坐标系 (BD-09) 与 火星坐标系 (GCJ-02)的转换
 * 即 百度 转 谷歌、高德
 * @param bd_lon
 * @param bd_lat
 * @returns {*[]}
 */
function bd09togcj02(bd_lon, bd_lat) {
    var x_pi = (3.14159265358979324 * 3000.0) / 180.0;
    var x = bd_lon - 0.0065;
    var y = bd_lat - 0.006;
    var z = Math.sqrt(x * x + y * y) - 0.00002 * Math.sin(y * x_pi);
    var theta = Math.atan2(y, x) - 0.000003 * Math.cos(x * x_pi);
    var gg_lng = z * Math.cos(theta);
    var gg_lat = z * Math.sin(theta);
    return [gg_lng, gg_lat];
}

/**
 * 判断是否在国内，不在国内则不做偏移
 * @param lng
 * @param lat
 * @returns {boolean}
 */
function out_of_china(lng, lat) {
    return (
        lng < 72.004 || lng > 137.8347 || lat < 0.8293 || lat > 55.8271 || false
    );
}

/**
 * 转换lat
 */
function transformlat(lng, lat) {
    var ret = -100.0 +
        2.0 * lng +
        3.0 * lat +
        0.2 * lat * lat +
        0.1 * lng * lat +
        0.2 * Math.sqrt(Math.abs(lng));
    ret +=
        ((20.0 * Math.sin(6.0 * lng * PI) + 20.0 * Math.sin(2.0 * lng * PI)) *
            2.0) /
        3.0;
    ret +=
        ((20.0 * Math.sin(lat * PI) + 40.0 * Math.sin((lat / 3.0) * PI)) * 2.0) /
        3.0;
    ret +=
        ((160.0 * Math.sin((lat / 12.0) * PI) + 320 * Math.sin((lat * PI) / 30.0)) *
            2.0) /
        3.0;
    return ret;
}

/**
 * 转换lng
 */
function transformlng(lng, lat) {
    var ret =
        300.0 +
        lng +
        2.0 * lat +
        0.1 * lng * lng +
        0.1 * lng * lat +
        0.1 * Math.sqrt(Math.abs(lng));
    ret +=
        ((20.0 * Math.sin(6.0 * lng * PI) + 20.0 * Math.sin(2.0 * lng * PI)) *
            2.0) /
        3.0;
    ret +=
        ((20.0 * Math.sin(lng * PI) + 40.0 * Math.sin((lng / 3.0) * PI)) * 2.0) /
        3.0;
    ret +=
        ((150.0 * Math.sin((lng / 12.0) * PI) +
            300.0 * Math.sin((lng / 30.0) * PI)) *
            2.0) /
        3.0;
    return ret;
}

function drawZones(hass) {
    if (!window.amapMap || !hass || !hass.states) return;
    window.zones = Object.keys(hass.states).filter(state => {
        const {
            attributes
        } = hass.states[state];
        return (
            state.indexOf('zone.') === 0 &&
            'longitude' in attributes &&
            'latitude' in attributes
        );
    });
    for (let zone of window.zones) {
        drawZone(hass.states[zone]);
    }
}

function drawZone(state) {
    if (!window.amapMap || !state) return;
    const {
        longitude,
        latitude,
        icon,
        radius,
        passive
    } = state.attributes;
    if (passive) return;
    const title = getEntityName(state);
    const lnglat = transformTo(state.entity_id, longitude, latitude);
    // 添加图标
    const marker = new AMap.Marker({
        position: lnglat,
        offset: new AMap.Pixel(-12, -12),
        title,
        extData: state.entity_id,
        content: `<div class="mdi-icon"><i class="mdi ${icon.replace(':', '-')}"></i></div>`
    });
    marker.on('click', () => {
        parent.fire('hass-more-info', {
            entityId: state.entity_id
        });
    });
    marker.setLabel({
        offset: new AMap.Pixel(0, -20),
        content: `<div class='device-marker-info'>${title}</div>`,
        direction: 'center'
    });
    window.amapMap.add(marker);
    // 添加圆形区域
    const circle = new AMap.Circle({
        center: lnglat,
        radius: radius,
        extData: state.entity_id,
        strokeColor: '#3366FF',
        strokeOpacity: 0.3,
        strokeWeight: 3,
        fillColor: '#FFA500',
        fillOpacity: 0.35
    });
    window.amapMap.add(circle);
    console.log(`Add:${state.entity_id}`);
    fitMapDebounced();
}

function drawEntities(hass) {
    if (!window.amapMap || !hass || !hass.states) return;
    window.trackers = Object.keys(hass.states).filter(state => {
        const {
            attributes
        } = hass.states[state];
        return (
            // attributes.source_type === "gps" &&
            (state.indexOf('device_tracker.') === 0 || state.indexOf('person.') === 0) &&
            !ignore_devices.includes(state) &&
            'longitude' in attributes &&
            'latitude' in attributes
        );
    });
    const _trackers = window.trackers.slice();

    const markers = window.amapMap.getAllOverlays('marker');
    for (let marker of markers) {
        // entity_id
        const state = marker.getExtData();
        // 排除zone
        if (state.indexOf('zone.') === 0) continue;
        if (!window.trackers.includes(state)) {
            // 移除点
            window.amapMap.remove(marker);
            console.log(`Del:${state}`);
            continue;
        }
        // 更新点
        const {
            longitude,
            latitude
        } = hass.states[state].attributes;
        const lnglat = transformTo(state, longitude, latitude);
        marker.setPosition(new AMap.LngLat(lnglat[0], lnglat[1]));
        console.log(`Mov:${state}`);
        // 剩余部分
        if (_trackers.includes(state)) {
            _trackers.splice(_trackers.indexOf(state), 1);
        }
    }
    // 添加点
    for (let tracker of _trackers) {
        drawTracker(hass.states[tracker]);
    }
}

function drawTracker(state) {
    if (!window.amapMap || !state) return;
    if (state.state === 'home') return;
    const {
        attributes
    } = state;
    const {
        longitude,
        latitude,
        entity_picture,
        icon,
    } = attributes;
    const lnglat = transformTo(state.entity_id, longitude, latitude);
    const title = getEntityName(state);
    const short_title = getEntityShortName(state);

    const content = entity_picture ?
        `<div class="device-marker" style="background-image: url(${entity_picture});" ></div>` :
        icon ? `<div class="device-marker"><i class="mdi ${icon.replace(':', '-')}"></i></div>` :
            `<div class="device-marker"> ${short_title}</div>`;
    const marker = new AMap.Marker({
        position: lnglat,
        offset: new AMap.Pixel(-20, -20),
        extData: state.entity_id,
        title,
        content: content
    });
    marker.on('click', () => {
        parent.fire('hass-more-info', {
            entityId: state.entity_id
        });
    });
    marker.setLabel({
        offset: new AMap.Pixel(0, -34),
        content: `<div class='device-marker-info'>${title}</div>`,
        direction: 'center'
    });
    window.amapMap.add(marker);
    console.log(`Add:${state.entity_id}`);
    fitMapDebounced();
}

/**
 * 获取实体对象Id
 * @param {*} entity
 */
function getEntityObjectId(entity) {
    if (!entity) return '';
    const {
        entity_id
    } = entity;
    return entity_id.substr(entity_id.indexOf('.') + 1);
}

/**
 * 获取实体别名
 */
function getEntityName(entity) {
    if (!entity) return '';
    const friendly_name = entity.attributes.friendly_name || '';
    const object_name = getEntityObjectId(entity).replace(/_/g, ' ');
    return friendly_name || object_name;
}

/**
 * 获取实体别名简化
 * @param {*} entity
 */
function getEntityShortName(entity) {
    if (!entity) return '';
    const entity_name = getEntityName(entity);
    const short_name = entity_name
        .split(' ')
        .map(part => part[0])
        .join('')
        .substr(0, 3);
    return short_name;
}

/**
 * debounce
 * @param {*} func
 * @param {*} wait
 * @param {*} immediate
 * @returns
 */
function debounce(func, wait, immediate) {
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

function clearMap() {
    window.amapMap && window.amapMap.clearMap();
}

function fitMap() {
    window.amapMap && window.amapMap.setFitView();
}

function destroyMap() {
    window.amapMap && window.amapMap.destroy();
    window.amapMap = null;
}

function toggleTraffic(e) {
    if (!window.amapMapTrafficLayer) return;
    e.checked ? window.amapMapTrafficLayer.show() : window.amapMapTrafficLayer.hide();
}

function setGlobalCssVars(key, val) {
    document.documentElement.style.setProperty(key, val);
}

function transformTo(entity_id, longitude, latitude) {
    if (amap_devices.includes(entity_id)) {
        return [longitude, latitude];
    } else if (baidu_devices.includes(entity_id)) {
        return bd09togcj02[longitude, latitude];
    } else {
        return wgs84togcj02(longitude, latitude);
    }
}
