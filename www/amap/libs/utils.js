//定义一些常量
var x_PI = (3.14159265358979324 * 3000.0) / 180.0;
var PI = 3.1415926535897932384626;
var offset_a = 6378245.0;
var offset_ee = 0.00669342162296594323;

/**
 * 百度坐标系 (BD-09) 与 火星坐标系 (GCJ-02)的转换
 * 即 百度 转 谷歌、高德
 * @param bd_lon
 * @param bd_lat
 * @returns {*[]}
 */
export function bd09togcj02(bd_lon, bd_lat) {
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
 * 火星坐标系 (GCJ-02) 与百度坐标系 (BD-09) 的转换
 * 即谷歌、高德 转 百度
 * @param lng
 * @param lat
 * @returns {*[]}
 */
export function gcj02tobd09(lng, lat) {
    var z = Math.sqrt(lng * lng + lat * lat) + 0.00002 * Math.sin(lat * x_PI);
    var theta = Math.atan2(lat, lng) + 0.000003 * Math.cos(lng * x_PI);
    var bd_lng = z * Math.cos(theta) + 0.0065;
    var bd_lat = z * Math.sin(theta) + 0.006;
    return [bd_lng, bd_lat];
}

/**
 * WGS84转GCj02
 * @param lng
 * @param lat
 * @returns {*[]}
 */
export function wgs84togcj02(lng, lat) {
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
        dlng =
            (dlng * 180.0) / ((offset_a / sqrtmagic) * Math.cos(radlat) * PI);
        var mglat = lat + dlat;
        var mglng = lng + dlng;
        return [mglng, mglat];
    }
}

/**
 * GCJ02 转换为 WGS84
 * @param lng
 * @param lat
 * @returns {*[]}
 */
export function gcj02towgs84(lng, lat) {
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
        dlng =
            (dlng * 180.0) / ((offset_a / sqrtmagic) * Math.cos(radlat) * PI);
        mglat = lat + dlat;
        mglng = lng + dlng;
        return [lng * 2 - mglng, lat * 2 - mglat];
    }
}

export function transformlat(lng, lat) {
    var ret =
        -100.0 +
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
        ((20.0 * Math.sin(lat * PI) + 40.0 * Math.sin((lat / 3.0) * PI)) *
            2.0) /
        3.0;
    ret +=
        ((160.0 * Math.sin((lat / 12.0) * PI) +
            320 * Math.sin((lat * PI) / 30.0)) *
            2.0) /
        3.0;
    return ret;
}

export function transformlng(lng, lat) {
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
        ((20.0 * Math.sin(lng * PI) + 40.0 * Math.sin((lng / 3.0) * PI)) *
            2.0) /
        3.0;
    ret +=
        ((150.0 * Math.sin((lng / 12.0) * PI) +
            300.0 * Math.sin((lng / 30.0) * PI)) *
            2.0) /
        3.0;
    return ret;
}

/**
 * 判断是否在国内，不在国内则不做偏移
 * @param lng
 * @param lat
 * @returns {boolean}
 */
export function out_of_china(lng, lat) {
    return (
        lng < 72.004 || lng > 137.8347 || lat < 0.8293 || lat > 55.8271 || false
    );
}

/**
 * ISO时间转成时间戳
 */
export function getTimeIsoToTs(ms) {
    // 把时间的中的T和Z 替换成空字符串
    let date = ms.replace("T", " ");
    let data = date.replace("Z", "");
    // 声明一个变量赋值给：日期时间字符串，并返回 1970/1/1 午夜距离该日期时间的毫秒数
    let datime = Date.parse(data);
    let time = new Date();
    let msi = time.getTime();
    return msi;
}

/**
 * 时间戳转换ISO
 * @param {*} tm
 */
export function getTimeTsToIso(tm) {
    let _tm = tm;
    let date = new Date(tm);
    date.getTime(_tm * 1000);
    // console.log(date.toDateString());//Mon Mar 11 2019
    // console.log(date.toGMTString()); //Mon, 11 Mar 2019 06:55:07 GMT
    // console.log(date.toISOString()); //2019-03-11T06:55:07.622Z
    return date.toISOString();
}

/**
 * 获取实体类型
 */
export function getEntityDomain(entity) {
    if (!entity) return "";
    const { entity_id } = entity;
    return entity_id.substr(0, entity_id.indexOf("."));
}

/**
 * 获取实体对象Id
 * @param {*} entity
 */
export function getEntityObjectId(entity) {
    if (!entity) return "";
    const { entity_id } = entity;
    return entity_id.substr(entity_id.indexOf(".") + 1);
}

/**
 * 获取实体别名
 */
export function getEntityName(entity) {
    if (!entity) return "";
    const friendly_name = entity.attributes.friendly_name || "";
    const object_name = getEntityObjectId(entity).replace(/_/g, " ");
    return friendly_name || object_name;
}

/**
 * 获取实体别名简化
 * @param {*} entity
 */
export function getEntityShortName(entity) {
    if (!entity) return "";
    const entity_name = getEntityName(entity);
    const short_name = entity_name
        .split(" ")
        .map((part) => part[0])
        .join("")
        .substr(0, 3);
    return short_name;
}
