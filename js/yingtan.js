// @name 影探4K
// @version 1.0.0
// @downloadURL https://raw.githubusercontent.com/tardlk/Fun/main/js/yingtan.js
// 改写自 tardlk/OmniBox-Spider 的 影视/采集/影探4K.py。
// TVBoxOS / Fongmi 旧版 QuickJS；无需 OmniBox、Node 或第三方依赖。
// ext 可选：{"host":"http://cms.lyyytv.cn","parseHost":"http://fys.lyyytv.cn","parseIds":[5,6,7,1,2,3,4]}

var CONFIG = {};
var CMS_KEY = 'wP5bvxoc3yv7FoBQENFZuAF0EUYr4LTy';
var UA = 'okhttp/4.12.0';
var PAGE_LIMIT = 18;
var HOME_CACHE = null;
var HOME_TIME = 0;
var PARSE_HITS = [];
var PLAY_CACHE = {};
var FILTER_NAMES = { 'class': '类型', area: '地区', lang: '语言', year: '年份', letter: '字母', by: '排序', sort: '顺序' };
var DEC_PREFIX = 'https://baidu.con/';
var B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function text(value) { return value == null ? '' : String(value).trim(); }
function object(value) {
    try { if (typeof value === 'string') value = JSON.parse(value); } catch (_) { return {}; }
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}
function array(value) { return Array.isArray(value) ? value : []; }
function number(value, fallback) { var n = parseInt(value, 10); return isFinite(n) ? n : fallback; }
function log(message) { if (typeof console !== 'undefined' && console.log) console.log('[影探4K] ' + text(message && message.message || message)); }
function clean(value) { return text(value).replace(/[$#]/g, ' '); }
function isHttp(value) { return /^https?:\/\/[^\s/]+(?:\/|$)/i.test(text(value)); }
function utf8(value) {
    var s = unescape(encodeURIComponent(value)), out = [];
    for (var i = 0; i < s.length; i++) out.push(s.charCodeAt(i));
    return out;
}
function fromUtf8(bytes) {
    var s = '';
    for (var i = 0; i < bytes.length; i++) s += '%' + ('0' + bytes[i].toString(16)).slice(-2);
    return decodeURIComponent(s);
}
function b64encode(bytes) {
    var result = '';
    for (var i = 0; i < bytes.length; i += 3) {
        var n = (bytes[i] << 16) | ((bytes[i + 1] || 0) << 8) | (bytes[i + 2] || 0);
        result += B64[n >>> 18] + B64[(n >>> 12) & 63] + (i + 1 < bytes.length ? B64[(n >>> 6) & 63] : '=') + (i + 2 < bytes.length ? B64[n & 63] : '=');
    }
    return result;
}
function b64decode(value) {
    var s = text(value).replace(/\s/g, '').replace(/-/g, '+').replace(/_/g, '/');
    if (!s || !/^[A-Za-z0-9+/]*={0,2}$/.test(s) || s.replace(/=/g, '').length % 4 === 1) throw new Error('无效 Base64');
    var out = [], bits = 0, n = 0;
    for (var i = 0; i < s.length && s[i] !== '='; i++) {
        n = (n << 6) | B64.indexOf(s[i]); bits += 6;
        if (bits >= 8) { bits -= 8; out.push((n >>> bits) & 255); }
    }
    return out;
}
// Base64URL 避免 TVBox 的 $ / # 分集分隔符破坏地址中的参数。
function encodeId(meta) { return b64encode(utf8(JSON.stringify(meta))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
function decodeId(id) { try { return object(fromUtf8(b64decode(id))); } catch (_) { return {}; } }

// AES-128-CBC / PKCS7。沿用 Python 源的协议，避免依赖各客户端不同的 crypto 模块。
function mul(a, b) {
    var n = 0;
    while (b) { if (b & 1) n ^= a; a = ((a << 1) ^ (a & 128 ? 283 : 0)) & 255; b >>>= 1; }
    return n;
}
var SBOX = [], INV_SBOX = [];
(function () {
    for (var a = 0; a < 256; a++) {
        var b = 0;
        if (a) { b = 1; for (var k = 0; k < 254; k++) b = mul(b, a); }
        var s = b, r = b;
        for (var j = 0; j < 4; j++) { r = ((r << 1) | (r >>> 7)) & 255; s ^= r; }
        SBOX[a] = s ^ 99; INV_SBOX[SBOX[a]] = a;
    }
})();
function aesDecrypt(keyText, ivText, data) {
    var key = utf8(keyText), iv = utf8(ivText);
    if (key.length !== 16 || iv.length !== 16 || !data.length || data.length % 16) throw new Error('AES 参数无效');
    var w = key.slice(), rcon = 1, t, i, j;
    while (w.length < 176) {
        t = w.slice(-4);
        if (w.length % 16 === 0) { t.push(t.shift()); t = t.map(function (x) { return SBOX[x]; }); t[0] ^= rcon; rcon = mul(rcon, 2); }
        for (j = 0; j < 4; j++) w.push(w[w.length - 16] ^ t[j]);
    }
    var result = [], previous = iv;
    for (var pos = 0; pos < data.length; pos += 16) {
        var block = data.slice(pos, pos + 16), state = block.slice();
        for (i = 0; i < 16; i++) state[i] ^= w[160 + i];
        for (var round = 9; round >= 0; round--) {
            var copy = state.slice();
            for (var c = 0; c < 4; c++) for (var row = 0; row < 4; row++) state[4 * c + row] = INV_SBOX[copy[4 * ((c - row + 4) % 4) + row]];
            for (i = 0; i < 16; i++) state[i] ^= w[16 * round + i];
            if (round) for (c = 0; c < 4; c++) {
                var p = state.slice(4 * c, 4 * c + 4);
                for (row = 0; row < 4; row++) state[4 * c + row] = mul(p[row], 14) ^ mul(p[(row + 1) % 4], 11) ^ mul(p[(row + 2) % 4], 13) ^ mul(p[(row + 3) % 4], 9);
            }
        }
        for (i = 0; i < 16; i++) result.push(state[i] ^ previous[i]);
        previous = block;
    }
    var pad = result[result.length - 1];
    if (pad < 1 || pad > 16) throw new Error('AES 填充无效');
    for (i = result.length - pad; i < result.length; i++) if (result[i] !== pad) throw new Error('AES 填充无效');
    return fromUtf8(result.slice(0, -pad)).trim();
}
function decryptLvdou(value) {
    var raw = text(value);
    if (raw.indexOf('lvdou+') !== 0) return raw;
    try { var url = aesDecrypt(CMS_KEY.slice(0, 16), CMS_KEY.slice(16, 32), b64decode(raw.slice(6))); return isHttp(url) ? url : raw; }
    catch (_) { return raw; }
}
function decryptLdmax(value, depth) {
    if ((depth || 0) > 5) return '';
    var url = text(value);
    try { if (!isHttp(url)) url = fromUtf8(b64decode(url)).replace(/\s/g, ''); } catch (_) {}
    if (!/^https?:\/\/ldmax\.cooom\//i.test(url)) return url;
    try {
        var path = url.replace(/^https?:\/\/ldmax\.cooom\//i, ''), key = path.slice(0, 16).split('').reverse().join('');
        return decryptLdmax(aesDecrypt(key, key, b64decode(path.slice(16))), (depth || 0) + 1);
    } catch (_) { return ''; }
}
function findUrl(data) { return text(data.url || data.playUrl || data.link) || (data.data && typeof data.data === 'object' ? findUrl(data.data) : ''); }
function resolveParse(body) {
    var candidate = text(body);
    if (!candidate || candidate[0] === '<') return '';
    if (candidate[0] === '{') candidate = findUrl(object(candidate));
    if (candidate.indexOf(DEC_PREFIX) === 0) {
        var rest = candidate.slice(DEC_PREFIX.length), key = rest.slice(0, 16), raw = rest.slice(16);
        try { candidate = aesDecrypt(key, key, b64decode(raw)); }
        catch (_) {
            try { candidate = aesDecrypt(key, key, raw.split('').map(function (x) { return x.charCodeAt(0) & 255; })); }
            catch (_) { return ''; }
        }
    }
    return isHttp(candidate) && candidate.indexOf(DEC_PREFIX) !== 0 ? candidate : '';
}

async function request(url, timeout) {
    var response = await req(url, { headers: { 'User-Agent': UA, 'Accept-Encoding': 'identity' }, timeout: timeout || 15000 });
    if (!response || Number(response.code) !== 200) throw new Error('HTTP ' + (response && response.code || 0));
    return text(response.content);
}
function query(params) { return Object.keys(params).map(function (key) { return encodeURIComponent(key) + '=' + encodeURIComponent(params[key]); }).join('&'); }
async function cms(path, params) {
    var host = text(CONFIG.host || 'http://cms.lyyytv.cn').replace(/\/+$/, '');
    var data = object(await request(host + '/api.php/app/' + path + '?' + query(params || {})));
    if (!Object.keys(data).length || data.code != null && [1, 200].indexOf(Number(data.code)) < 0) throw new Error('CMS ' + text(data.msg || data.code || '无效 JSON'));
    return data;
}
function mapVod(v) {
    var out = {};
    ['vod_id', 'vod_name', 'vod_pic', 'type_id', 'type_name', 'vod_remarks', 'vod_year', 'vod_douban_score'].forEach(function (key) { out[key] = text(v[key]); });
    return out;
}
async function init(ext) {
    CONFIG = object(ext);
    if (CONFIG.ext != null) CONFIG = object(CONFIG.ext);
    HOME_CACHE = null; HOME_TIME = 0; PARSE_HITS = []; PLAY_CACHE = {};
}
async function loadHome() {
    if (HOME_CACHE && Date.now() - HOME_TIME < 6 * 3600000) return HOME_CACHE;
    var data = await cms('nav', { token: '' }), classes = [], filters = {}, list = [];
    array(data.list).forEach(function (item) {
        if (!item || item.type_id == null || !text(item.type_name)) return;
        var tid = text(item.type_id), ext = object(item.type_extend), groups = [];
        classes.push({ type_id: tid, type_name: text(item.type_name) });
        Object.keys(FILTER_NAMES).forEach(function (key) {
            var values = text(ext[key]).split(',').map(text).filter(function (x, i, all) { return x && all.indexOf(x) === i; });
            if (values.length) groups.push({ key: key, name: FILTER_NAMES[key], init: '', value: [{ n: '全部', v: '' }].concat(values.map(function (x) { return { n: x, v: x }; })) });
        });
        if (groups.length) filters[tid] = groups;
    });
    try {
        var index = await cms('index_video', { token: '' }), seen = {};
        array(index.list).forEach(function (block) { array(block && block.vlist).forEach(function (v) { if (v && v.vod_id != null && !seen[v.vod_id]) { seen[v.vod_id] = true; list.push(mapVod(v)); } }); });
    } catch (error) { log('首页推荐失败: ' + error.message); }
    // 推荐接口偶发为空时，取首个真实分类的第一页，兼容 TVBox 只调用 home() 的行为。
    if (!list.length && classes.length) {
        try { list = array((await cms('video', { tid: classes[0].type_id, pg: '1', limit: PAGE_LIMIT })).list).filter(Boolean).map(mapVod); }
        catch (error) { log('首页分类回退失败: ' + error.message); }
    }
    var result = { 'class': classes, filters: filters, list: list };
    if (classes.length && list.length) { HOME_CACHE = result; HOME_TIME = Date.now(); }
    return result;
}
async function home(filter) { try { return JSON.stringify(await loadHome()); } catch (error) { log(error); return JSON.stringify({ 'class': [], filters: {}, list: [] }); } }
async function homeVod() { try { return JSON.stringify({ list: (await loadHome()).list }); } catch (error) { log(error); return JSON.stringify({ list: [] }); } }
function pageResult(data, pg) {
    var list = array(data.list).filter(Boolean).map(mapVod), pagecount = number(data.pagecount, 0);
    if (pagecount <= 0) pagecount = pg + (list.length >= PAGE_LIMIT ? 1 : 0);
    return { page: pg, pagecount: pagecount, limit: PAGE_LIMIT, total: number(data.total, (pg - 1) * PAGE_LIMIT + list.length), list: list };
}
async function category(tid, pg, filter, extend) {
    pg = Math.max(1, number(pg, 1));
    try {
        if (!text(tid)) return JSON.stringify({ page: pg, pagecount: 0, total: 0, list: [] });
        var params = { tid: text(tid), pg: String(pg), limit: String(PAGE_LIMIT) }; extend = object(extend);
        Object.keys(FILTER_NAMES).forEach(function (key) { var v = text(extend[key]); if (v && v !== 'all') params[key] = v; });
        return JSON.stringify(pageResult(await cms('video', params), pg));
    } catch (error) { log(error); return JSON.stringify({ page: pg, pagecount: 0, total: 0, list: [] }); }
}
async function search(wd, quick, pg) {
    pg = Math.max(1, number(pg, 1));
    try {
        if (!text(wd)) return JSON.stringify({ page: pg, pagecount: 0, total: 0, list: [] });
        return JSON.stringify(pageResult(await cms('search', { text: text(wd), pg: String(pg) }), pg));
    } catch (error) { log(error); return JSON.stringify({ page: pg, pagecount: 0, total: 0, list: [] }); }
}
async function detail(id) {
    try {
        id = text(Array.isArray(id) ? id[0] : id);
        if (!id) return JSON.stringify({ list: [] });
        var data = object((await cms('video_detail', { id: id })).data);
        if (!Object.keys(data).length) return JSON.stringify({ list: [] });
        var sources = data.vod_url_with_player;
        if (!Array.isArray(sources)) {
            var names = text(data.vod_play_from).split('$$$');
            sources = text(data.vod_play_url).split('$$$').map(function (url, i) { return { name: names[i], url: url }; });
        }
        var from = [], urls = [];
        sources.forEach(function (source, i) {
            if (!source || typeof source !== 'object') return;
            var name = clean(source.name || source.code || ('线路' + (i + 1))), episodes = [];
            text(source.url).split('#').forEach(function (entry) {
                var sep = entry.indexOf('$');
                if (sep <= 0) return;
                var epName = clean(entry.slice(0, sep)), url = decryptLvdou(entry.slice(sep + 1));
                if (epName && url) episodes.push(epName + '$' + encodeId({ u: url, f: name, n: epName }));
            });
            if (episodes.length) { from.push(name); urls.push(episodes.join('#')); }
        });
        var vod = mapVod(data);
        ['vod_content', 'vod_actor', 'vod_director', 'vod_area', 'vod_lang'].forEach(function (key) { vod[key] = text(data[key]); });
        vod.vod_play_from = from.join('$$$'); vod.vod_play_url = urls.join('$$$');
        log('详情 ' + id + ': ' + from.length + ' 条线路');
        return JSON.stringify({ list: [vod] });
    } catch (error) { log(error); return JSON.stringify({ list: [] }); }
}
async function parseUrl(raw) {
    var ids = array(CONFIG.parseIds).length ? CONFIG.parseIds : [5, 6, 7, 1, 2, 3, 4];
    var order = PARSE_HITS.concat(ids).filter(function (x, i, all) { return all.indexOf(x) === i; });
    var host = text(CONFIG.parseHost || 'http://fys.lyyytv.cn').replace(/\/+$/, '');
    for (var i = 0; i < order.length; i++) {
        try {
            var url = resolveParse(await request(host + '/api/index?parsesId=' + encodeURIComponent(order[i]) + '&appid=10001&videoUrl=' + encodeURIComponent(raw), 10000));
            if (url) { PARSE_HITS = [order[i]].concat(PARSE_HITS.filter(function (x) { return x !== order[i]; })); return url; }
            log('解析通道 ' + order[i] + ' 未返回地址');
        } catch (error) { log('解析通道 ' + order[i] + ': ' + error.message); }
    }
    return '';
}
function playResult(url) {
    var header = { 'User-Agent': UA, 'Accept-Encoding': 'identity' };
    var result = { parse: 0, jx: 0, playUrl: '', url: url, header: header };
    if (/\.m3u8?(?:[?#]|$)/i.test(url)) { result.format = 'application/vnd.apple.mpegurl'; header['TVBox-Format'] = 'hls'; }
    return result;
}
async function play(flag, id, vipFlags) {
    try {
        var meta = decodeId(id), raw = text(meta.u) || (isHttp(id) ? text(id) : '');
        raw = decryptLdmax(decryptLvdou(raw));
        if (!isHttp(raw)) throw new Error('播放地址为空或解密失败');
        var key = text(flag || meta.f) + '|' + raw, cached = PLAY_CACHE[key];
        if (cached && cached.time > Date.now()) return JSON.stringify(playResult(cached.url));
        var url = await parseUrl(raw);
        if (!url) throw new Error('所有解析通道均失败');
        Object.keys(PLAY_CACHE).forEach(function (k) { if (PLAY_CACHE[k].time <= Date.now()) delete PLAY_CACHE[k]; });
        if (Object.keys(PLAY_CACHE).length >= 32) delete PLAY_CACHE[Object.keys(PLAY_CACHE)[0]];
        PLAY_CACHE[key] = { time: Date.now() + 120000, url: url };
        log('播放解析成功: ' + text(flag || meta.f));
        return JSON.stringify(playResult(url));
    } catch (error) { log(error); return JSON.stringify(playResult('')); }
}

export default { init: init, home: home, homeVod: homeVod, category: category, detail: detail, search: search, play: play };
