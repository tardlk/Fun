// 爱电影 · TVBoxOS / Fongmi 旧版 QuickJS Spider
// ext 可选：{"host":"https://ivdy.com","token":"自己的登录 token","maxResolution":1080}
// 使用站点公开接口，默认选择返回地址中的最高画质；不缓存临时播放地址。

var ENTRY = 'https://ivdy.com';
var SIGN_KEY = 'cb808529bae6b6be45ecfab29a4889bc';
var API_PREFIX = '/api/mw-movie';
var UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
var CONFIG = {};
var ACTIVE_HOST = '';
var HOST_TIME = 0;
var DEVICE_ID = '';
var FILTER_CACHE = null;
var PAGE_SIZE = 20;
var CLASSES = [
    { type_id: '1', type_name: '电影' },
    { type_id: '2', type_name: '电视剧' },
    { type_id: '3', type_name: '综艺' },
    { type_id: '4', type_name: '动漫' },
    { type_id: '88', type_name: '短剧' }
];

function message(error) {
    return error && error.message ? error.message : String(error);
}

function log(error) {
    if (typeof console !== 'undefined' && console.log) console.log('[ivdy] ' + message(error));
}

function originOf(url) {
    var match = String(url || '').match(/^(https?:\/\/[^\/?#]+)/i);
    if (!match) throw new Error('host 必须是完整的 http/https 地址');
    return match[1];
}

function absoluteUrl(url, base) {
    if (/^https?:\/\//i.test(url)) return url;
    if (url.indexOf('//') === 0) return base.split(':')[0] + ':' + url;
    if (typeof joinUrl === 'function') return joinUrl(base, url);
    if (url.charAt(0) === '/') return originOf(base) + url;
    return base.replace(/[^/]*$/, '') + url;
}

function headerValue(headers, name) {
    for (var key in (headers || {})) {
        if (key.toLowerCase() === name.toLowerCase()) {
            var value = headers[key];
            return Array.isArray(value) ? String(value[0] || '') : String(value || '');
        }
    }
    return '';
}

async function request(url, options) {
    var response = await req(url, options || {});
    if (!response || !Number(response.code)) throw new Error('网络请求失败');
    return response;
}

// 入口域名有多级 HTTP 跳转，逐级读取 Location，避免把跳转后的首页当成 API 响应。
async function discoverHost(force) {
    if (!force && ACTIVE_HOST && Date.now() - HOST_TIME < 15 * 60 * 1000) return ACTIVE_HOST;
    var url = originOf(CONFIG.host || ENTRY) + '/';
    for (var i = 0; i < 6; i++) {
        var response = await request(url, {
            headers: { 'User-Agent': UA }, redirect: 0, timeout: 15000
        });
        var code = Number(response.code);
        var location = headerValue(response.headers, 'location');
        if (code >= 300 && code < 400 && location) {
            url = absoluteUrl(location, url);
            continue;
        }
        if (code < 200 || code >= 300) throw new Error('入口访问失败 HTTP ' + code);
        ACTIVE_HOST = originOf(url);
        HOST_TIME = Date.now();
        return ACTIVE_HOST;
    }
    throw new Error('入口重定向次数过多');
}

function newDeviceId() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (char) {
        var n = Math.floor(Math.random() * 16);
        return (char === 'x' ? n : (n & 3) | 8).toString(16);
    });
}

function getDeviceId() {
    if (DEVICE_ID) return DEVICE_ID;
    DEVICE_ID = CONFIG.deviceId ? String(CONFIG.deviceId) : '';
    try {
        if (!DEVICE_ID && typeof local !== 'undefined') DEVICE_ID = local.get('ivdy', 'deviceId') || '';
    } catch (e) {}
    if (!DEVICE_ID) DEVICE_ID = newDeviceId();
    try {
        if (typeof local !== 'undefined') local.set('ivdy', 'deviceId', DEVICE_ID);
    } catch (e) {}
    return DEVICE_ID;
}

// 小型纯 JS MD5 / SHA-1，脚本无需导入额外库或依赖宿主加密扩展。
function utf8Bytes(text) {
    var out = [];
    for (var i = 0; i < text.length; i++) {
        var c = text.charCodeAt(i);
        if (c >= 0xd800 && c <= 0xdbff) {
            var next = text.charCodeAt(i + 1);
            if (next >= 0xdc00 && next <= 0xdfff) {
                c = 0x10000 + ((c - 0xd800) << 10) + next - 0xdc00;
                i++;
            } else c = 0xfffd;
        } else if (c >= 0xdc00 && c <= 0xdfff) c = 0xfffd;
        if (c < 0x80) out.push(c);
        else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 63));
        else if (c < 0x10000) out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
        else out.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    }
    return out;
}

function rotateLeft(value, n) {
    return (value << n) | (value >>> (32 - n));
}

function hexWord(value, littleEndian) {
    var out = '';
    for (var i = 0; i < 4; i++) {
        var shift = littleEndian ? i * 8 : (3 - i) * 8;
        out += ('0' + ((value >>> shift) & 255).toString(16)).slice(-2);
    }
    return out;
}

function paddedBytes(text, littleEndian) {
    var bytes = utf8Bytes(String(text));
    var bits = bytes.length * 8;
    var low = bits >>> 0;
    var high = Math.floor(bits / 4294967296);
    bytes.push(128);
    while (bytes.length % 64 !== 56) bytes.push(0);
    var words = littleEndian ? [low, high] : [high, low];
    for (var j = 0; j < 2; j++) {
        for (var i = 0; i < 4; i++) bytes.push((words[j] >>> (littleEndian ? i * 8 : (3 - i) * 8)) & 255);
    }
    return bytes;
}

function md5(text) {
    var bytes = paddedBytes(text, true);
    var state = [0x67452301, 0xefcdab89, 0x98badcfe, 0x10325476];
    var shifts = [7, 12, 17, 22, 5, 9, 14, 20, 4, 11, 16, 23, 6, 10, 15, 21];
    for (var offset = 0; offset < bytes.length; offset += 64) {
        var words = [];
        for (var j = 0; j < 16; j++) {
            var pos = offset + j * 4;
            words[j] = bytes[pos] | (bytes[pos + 1] << 8) | (bytes[pos + 2] << 16) | (bytes[pos + 3] << 24);
        }
        var a = state[0], b = state[1], c = state[2], d = state[3];
        for (var i = 0; i < 64; i++) {
            var f, g;
            if (i < 16) { f = (b & c) | (~b & d); g = i; }
            else if (i < 32) { f = (d & b) | (~d & c); g = (5 * i + 1) % 16; }
            else if (i < 48) { f = b ^ c ^ d; g = (3 * i + 5) % 16; }
            else { f = c ^ (b | ~d); g = (7 * i) % 16; }
            var k = Math.floor(Math.abs(Math.sin(i + 1)) * 4294967296) | 0;
            var next = (b + rotateLeft((a + f + k + words[g]) | 0, shifts[Math.floor(i / 16) * 4 + i % 4])) | 0;
            a = d; d = c; c = b; b = next;
        }
        state[0] = (state[0] + a) | 0; state[1] = (state[1] + b) | 0;
        state[2] = (state[2] + c) | 0; state[3] = (state[3] + d) | 0;
    }
    return state.map(function (word) { return hexWord(word, true); }).join('');
}

function sha1(text) {
    var bytes = paddedBytes(text, false);
    var state = [0x67452301, 0xefcdab89, 0x98badcfe, 0x10325476, 0xc3d2e1f0];
    for (var offset = 0; offset < bytes.length; offset += 64) {
        var words = [];
        for (var i = 0; i < 80; i++) {
            if (i < 16) {
                var pos = offset + i * 4;
                words[i] = (bytes[pos] << 24) | (bytes[pos + 1] << 16) | (bytes[pos + 2] << 8) | bytes[pos + 3];
            } else words[i] = rotateLeft(words[i - 3] ^ words[i - 8] ^ words[i - 14] ^ words[i - 16], 1);
        }
        var a = state[0], b = state[1], c = state[2], d = state[3], e = state[4];
        for (var j = 0; j < 80; j++) {
            var f, k;
            if (j < 20) { f = (b & c) | (~b & d); k = 0x5a827999; }
            else if (j < 40) { f = b ^ c ^ d; k = 0x6ed9eba1; }
            else if (j < 60) { f = (b & c) | (b & d) | (c & d); k = 0x8f1bbcdc; }
            else { f = b ^ c ^ d; k = 0xca62c1d6; }
            var next = (rotateLeft(a, 5) + f + e + k + words[j]) | 0;
            e = d; d = c; c = rotateLeft(b, 30); b = a; a = next;
        }
        state[0] = (state[0] + a) | 0; state[1] = (state[1] + b) | 0;
        state[2] = (state[2] + c) | 0; state[3] = (state[3] + d) | 0; state[4] = (state[4] + e) | 0;
    }
    return state.map(function (word) { return hexWord(word, false); }).join('');
}

function cleanParams(params) {
    var out = {};
    Object.keys(params || {}).sort().forEach(function (key) {
        var value = params[key];
        if (value !== undefined && value !== null && value !== '' && value !== 'all') out[key] = String(value);
    });
    return out;
}

function signParams(params, timestamp) {
    var text = Object.keys(params).sort().map(function (key) { return key + '=' + params[key]; }).join('&');
    return sha1(md5((text ? text + '&' : '') + 'key=' + SIGN_KEY + '&t=' + timestamp));
}

async function apiGet(path, params) {
    var data = cleanParams(params);
    for (var attempt = 0; attempt < 2; attempt++) {
        try {
            var host = await discoverHost(attempt > 0);
            var timestamp = String(Date.now());
            var query = Object.keys(data).map(function (key) { return encodeURIComponent(key) + '=' + encodeURIComponent(data[key]); }).join('&');
            var headers = {
                'User-Agent': UA, 'Accept': 'application/json', 'Referer': host + '/',
                'client-type': '1', 'deviceId': getDeviceId(), 't': timestamp, 'sign': signParams(data, timestamp)
            };
            if (CONFIG.token) headers.authorization = String(CONFIG.token);
            var response = await request(host + API_PREFIX + path + (query ? '?' + query : ''), {
                headers: headers, redirect: 0, timeout: 15000
            });
            var code = Number(response.code);
            if (code < 200 || code >= 300) {
                if (attempt === 0 && (code >= 500 || (code >= 300 && code < 400))) continue;
                throw new Error('接口请求失败 HTTP ' + code);
            }
            var json;
            try { json = JSON.parse(response.content); }
            catch (e) {
                if (attempt === 0) continue;
                throw new Error('接口未返回 JSON，请检查域名或网络');
            }
            if (Number(json.code) !== 200) throw new Error('接口错误 ' + json.code + '：' + (json.msg || '未知错误'));
            return json.data;
        } catch (error) {
            // 业务错误和 HTTP 4xx 不重复请求，网络异常允许刷新入口后重试一次。
            if (attempt === 1 || /^接口错误|^接口请求失败 HTTP 4/.test(message(error))) throw error;
        }
    }
    throw new Error('接口请求失败');
}

function text(value) {
    return value === undefined || value === null ? '' : String(value);
}

function safeName(value) {
    return text(value).replace(/[$#]/g, ' ').replace(/\s+/g, ' ').trim();
}

function stripHtml(value) {
    return text(value).replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').trim();
}

function toVod(item) {
    return {
        vod_id: text(item.vodId), vod_name: text(item.vodName), vod_pic: text(item.vodPic),
        vod_remarks: text(item.vodRemarks || item.vodVersion),
        vod_year: text(item.vodYear || (item.vodPubdate || '').slice(0, 4)),
        vod_area: text(item.vodArea), vod_actor: text(item.vodActor),
        vod_director: text(item.vodDirector), vod_content: stripHtml(item.vodContent || item.vodBlurb)
    };
}

function pageResult(data, page) {
    data = data || {};
    var items = Array.isArray(data.list) ? data.list : [];
    return {
        page: Number(data.pageNum) || page,
        pagecount: Number(data.totalPage) || (Number(data.totalCount) ? Math.ceil(Number(data.totalCount) / PAGE_SIZE) : page),
        limit: Number(data.pageSize) || PAGE_SIZE, total: Number(data.totalCount) || 0,
        list: items.filter(function (item) { return item && item.vodId; }).map(toVod)
    };
}

function failure(error, result) {
    log(error);
    result.msg = message(error);
    return JSON.stringify(result);
}

async function init(ext) {
    var cfg = ext || {};
    if (typeof cfg === 'string') cfg = JSON.parse(cfg || '{}');
    if (cfg && (cfg.stype !== undefined || cfg.skey !== undefined) && cfg.ext !== undefined) {
        cfg = typeof cfg.ext === 'string' ? JSON.parse(cfg.ext || '{}') : cfg.ext;
    }
    if (!cfg || typeof cfg !== 'object' || Array.isArray(cfg)) throw new Error('ext 必须是 JSON 对象');
    CONFIG = cfg;
    ACTIVE_HOST = ''; HOST_TIME = 0; DEVICE_ID = ''; FILTER_CACHE = null;
    await discoverHost(false);
}

async function home(filter) {
    var filters = {};
    if (filter !== false) {
        try {
            if (!FILTER_CACHE) FILTER_CACHE = await apiGet('/anonymous/v1/get/filer/list', {});
            CLASSES.forEach(function (category) {
                var source = FILTER_CACHE[category.type_id] || {};
                var rows = [];
                // 电影页面隐藏 typeList，剧情 / 地区 / 年份 / 语言均提交 itemText。
                [['plotList', 'v_class', '剧情'], ['districtList', 'area', '地区'], ['yearList', 'year', '年份'], ['languageList', 'lang', '语言']].forEach(function (definition) {
                    var options = source[definition[0]];
                    if (!Array.isArray(options) || !options.length) return;
                    rows.push({ key: definition[1], name: definition[2], init: '', value: [{ n: '全部', v: '' }].concat(options.map(function (item) {
                        return { n: text(item.itemText), v: text(item.itemText) };
                    })) });
                });
                rows.push({ key: 'sort', name: '排序', init: '1', value: [
                    { n: category.type_id === '1' ? '上映时间' : '最近更新', v: '1' },
                    { n: '人气', v: '3' }, { n: '评分', v: '4' }
                ] });
                filters[category.type_id] = rows;
            });
        } catch (error) { log(error); }
    }
    return JSON.stringify({ class: CLASSES, filters: filters });
}

async function homeVod() {
    try {
        var data = await apiGet('/anonymous/v1/home/all/list', { clientType: 1, pageNum: 1 });
        var keys = ['homeBroadcastPageData', 'homeNewMoviePageData', 'newestTvPageData', 'newestVarietyPageData', 'newestCartoonPageData', 'newestShortTvPageData'];
        var groups = keys.map(function (key) { return data && data[key] && data[key].list || []; });
        var list = [], seen = {};
        for (var i = 0; list.length < 60; i++) {
            var found = false;
            for (var j = 0; j < groups.length && list.length < 60; j++) {
                var item = groups[j][i];
                if (!item) continue;
                found = true;
                if (item.vodId && !seen[item.vodId]) { seen[item.vodId] = true; list.push(toVod(item)); }
            }
            if (!found) break;
        }
        return JSON.stringify({ list: list });
    } catch (error) { return failure(error, { list: [] }); }
}

async function category(tid, pg, filter, extend) {
    var page = Math.max(1, parseInt(pg, 10) || 1);
    var ext = extend || {};
    try {
        var data = await apiGet('/anonymous/video/list', {
            type1: tid, pageNum: page, pageSize: PAGE_SIZE,
            v_class: ext.v_class, area: ext.area, year: ext.year, lang: ext.lang,
            sort: ext.sort || '1', sortBy: '1'
        });
        return JSON.stringify(pageResult(data, page));
    } catch (error) { return failure(error, { page: page, pagecount: page, list: [] }); }
}

async function detail(id) {
    var videoId = Array.isArray(id) ? text(id[0]) : text(id);
    var match = videoId.match(/(?:\/detail\/|\/vod\/play\/)(\d+)/);
    if (match) videoId = match[1];
    if (!/^\d+$/.test(videoId)) return JSON.stringify({ list: [] });
    try {
        var data = await apiGet('/anonymous/video/detail', { id: videoId });
        if (!data || !data.vodId) return JSON.stringify({ list: [] });
        var vod = toVod(data);
        var episodes = (data.episodeList || []).slice().sort(function (a, b) { return Number(a.sort || 0) - Number(b.sort || 0); });
        var urls = [], seen = {};
        episodes.forEach(function (episode) {
            if (!episode.nid || seen[episode.nid]) return;
            seen[episode.nid] = true;
            var name = safeName(episode.name) || '正片';
            if (/^\d+$/.test(name)) name = '第' + name + '集';
            urls.push(name + '$' + videoId + '|' + episode.nid);
        });
        vod.vod_play_from = urls.length ? '爱电影' : '';
        vod.vod_play_url = urls.join('#');
        return JSON.stringify({ list: [vod] });
    } catch (error) { return failure(error, { list: [] }); }
}

async function search(wd, quick, pg) {
    var page = Math.max(1, parseInt(pg, 10) || 1);
    if (!text(wd).trim()) return JSON.stringify({ page: page, pagecount: page, list: [] });
    try {
        var data = await apiGet('/anonymous/video/searchByWordPageable', { keyword: text(wd).trim(), pageNum: page, pageSize: PAGE_SIZE });
        return JSON.stringify(pageResult(data, page));
    } catch (error) { return failure(error, { page: page, pagecount: page, list: [] }); }
}

async function play(flag, id, vipFlags) {
    var parts = text(Array.isArray(id) ? id[0] : id).split('|');
    if (parts.length !== 2 || !/^\d+$/.test(parts[0]) || !/^\d+$/.test(parts[1])) {
        return JSON.stringify({ parse: 0, url: '', msg: '无效的剧集标识' });
    }
    try {
        var data = await apiGet('/anonymous/v2/video/episode/url', { clientType: 1, id: parts[0], nid: parts[1] });
        var available = (data && data.list || []).filter(function (line) {
            // flag / needLogin 影响站点前端的画质选择，不代表返回的媒体 URL 不可访问。
            return line && /^https?:\/\//i.test(line.url || '');
        }).sort(function (a, b) { return Number(b.resolution || 0) - Number(a.resolution || 0); });
        if (!available.length) return JSON.stringify({ parse: 0, url: '', msg: '站点暂未返回可用的播放地址' });
        var max = Number(CONFIG.maxResolution) || 0;
        var preferred = max > 0 ? available.filter(function (line) { return Number(line.resolution || 0) <= max; }) : available;
        var selected = preferred[0] || available[available.length - 1];
        return JSON.stringify({ parse: 0, url: selected.url, header: { 'User-Agent': UA, 'Referer': ACTIVE_HOST + '/' } });
    } catch (error) { return failure(error, { parse: 0, url: '' }); }
}

export default { init: init, home: home, homeVod: homeVod, category: category, detail: detail, search: search, play: play };
