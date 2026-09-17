var HOST = 'https://kanju.ai';
var PLAYER = 'https://player.baipiaozhe.com';
var KEY = '557d0e4ae929f438da6bd84412374e6086b8af09b3fed54bf22601d5bf8c54a0';
var UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

var K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
];

function rotr(x, n) {
    return (x >>> n) | (x << (32 - n));
}

function utf8(str) {
    var out = [];
    for (var i = 0; i < str.length; i++) {
        var c = str.charCodeAt(i);
        if (c < 0x80) {
            out.push(c);
        } else if (c < 0x800) {
            out.push(0xc0 | (c >> 6), 0x80 | (c & 63));
        } else if (c >= 0xd800 && c <= 0xdbff && i + 1 < str.length) {
            var c2 = str.charCodeAt(i + 1);
            var cp = 0x10000 + ((c - 0xd800) << 10) + (c2 - 0xdc00);
            i++;
            out.push(0xf0 | (cp >> 18), 0x80 | ((cp >> 12) & 63), 0x80 | ((cp >> 6) & 63), 0x80 | (cp & 63));
        } else {
            out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
        }
    }
    return out;
}

function toHex(x) {
    return ('00000000' + ((x >>> 0).toString(16))).slice(-8);
}

function hexToBytes(hex) {
    var a = [];
    for (var i = 0; i < hex.length; i += 2) a.push(parseInt(hex.substr(i, 2), 16));
    return a;
}

function sha256Bytes(bytes) {
    var H = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
    var b = bytes.slice();
    var len = b.length * 8;
    b.push(0x80);
    while (b.length % 64 !== 56) b.push(0);
    var hi = Math.floor(len / 4294967296);
    b.push((hi >>> 24) & 0xff, (hi >>> 16) & 0xff, (hi >>> 8) & 0xff, hi & 0xff);
    b.push((len >>> 24) & 0xff, (len >>> 16) & 0xff, (len >>> 8) & 0xff, len & 0xff);
    var w = new Array(64);
    for (var i = 0; i < b.length; i += 64) {
        for (var j = 0; j < 16; j++) w[j] = (b[i + j * 4] << 24) | (b[i + j * 4 + 1] << 16) | (b[i + j * 4 + 2] << 8) | b[i + j * 4 + 3];
        for (j = 16; j < 64; j++) {
            var s0 = rotr(w[j - 15], 7) ^ rotr(w[j - 15], 18) ^ (w[j - 15] >>> 3);
            var s1 = rotr(w[j - 2], 17) ^ rotr(w[j - 2], 19) ^ (w[j - 2] >>> 10);
            w[j] = (w[j - 16] + s0 + w[j - 7] + s1) | 0;
        }
        var a = H[0], bb = H[1], c = H[2], d = H[3], e = H[4], f = H[5], g = H[6], h = H[7];
        for (j = 0; j < 64; j++) {
            var S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
            var ch = (e & f) ^ ((~e) & g);
            var t1 = (h + S1 + ch + K[j] + w[j]) | 0;
            var S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
            var maj = (a & bb) ^ (a & c) ^ (bb & c);
            var t2 = (S0 + maj) | 0;
            h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = bb; bb = a; a = (t1 + t2) | 0;
        }
        H[0] = (H[0] + a) | 0; H[1] = (H[1] + bb) | 0; H[2] = (H[2] + c) | 0; H[3] = (H[3] + d) | 0;
        H[4] = (H[4] + e) | 0; H[5] = (H[5] + f) | 0; H[6] = (H[6] + g) | 0; H[7] = (H[7] + h) | 0;
    }
    var out = '';
    for (i = 0; i < 8; i++) out += toHex(H[i]);
    return out;
}

function hmacSha256(key, msg) {
    var k = utf8(key);
    if (k.length > 64) k = hexToBytes(sha256Bytes(k));
    while (k.length < 64) k.push(0);
    var ip = [], op = [];
    for (var i = 0; i < 64; i++) {
        ip.push(k[i] ^ 0x36);
        op.push(k[i] ^ 0x5c);
    }
    var inner = sha256Bytes(ip.concat(utf8(msg)));
    return sha256Bytes(op.concat(hexToBytes(inner)));
}

function randomHex(n) {
    var s = '';
    for (var i = 0; i < n; i++) s += ('0' + Math.floor(Math.random() * 256).toString(16)).slice(-2);
    return s;
}

function apiGet(path) {
    for (var i = 0; i < 3; i++) {
        try {
            var ts = String(Date.now());
            var nonce = randomHex(16);
            var sig = hmacSha256(KEY, 'GET\n' + path + '\n' + ts + '\n' + nonce);
            var res = req(HOST + path, { headers: {
                'User-Agent': UA,
                'Accept': 'application/json',
                'Referer': HOST + '/',
                'x-ai-movie-timestamp': ts,
                'x-ai-movie-nonce': nonce,
                'x-ai-movie-signature': sig
            }});
            if (!res || !res.content) continue;
            var data = JSON.parse(res.content);
            if (data && data.error) continue;
            return data;
        } catch (e) {
        }
    }
    return null;
}

function playerResolve(token) {
    for (var i = 0; i < 2; i++) {
        try {
            var res = req(PLAYER + '/v1/playback/resolve/' + encodeURIComponent(token), { headers: {
                'User-Agent': UA,
                'Accept': 'application/json',
                'Referer': PLAYER + '/yjplayer.html'
            }});
            if (res && res.content) return JSON.parse(res.content);
        } catch (e) {
        }
    }
    return null;
}

function toVod(card) {
    return {
        vod_id: card.id || '',
        vod_name: card.title || '',
        vod_pic: card.poster_url || card.carousel_url || '',
        vod_remarks: card.remarks || '',
        vod_year: card.year ? String(card.year) : '',
        vod_area: card.area || '',
        vod_actor: (card.actors || []).join(' / '),
        vod_director: (card.directors || []).join(' / '),
        vod_content: card.description || (card.genres || []).join(' / ')
    };
}

function valueList(pairs) {
    return pairs.map(function (p) { return { n: p[0], v: p[1] }; });
}

var AREAS = valueList([['全部', ''], ['中国大陆', '中国大陆'], ['美国', '美国'], ['韩国', '韩国'], ['日本', '日本'],
    ['中国香港', '香港'], ['中国台湾', '台湾'], ['英国', '英国'], ['泰国', '泰国'], ['法国', '法国']]);
var YEARS = valueList([['全部', ''], ['2026', '2026'], ['2025', '2025'], ['2024', '2024'], ['2023', '2023'],
    ['2022', '2022'], ['2021', '2021'], ['2020', '2020'], ['2019', '2019'], ['2018', '2018'], ['2017', '2017'], ['2016', '2016']]);

function genreFilter(list) {
    return { key: 'genre', name: '类型', init: '', value: valueList([['全部', '']].concat(list.map(function (x) { return [x, x]; }))) };
}

var CLASSES = [
    { type_id: 'movie', type_name: '电影' },
    { type_id: 'series', type_name: '剧集' },
    { type_id: 'short_drama', type_name: '短剧' },
    { type_id: 'anime', type_name: '动漫' },
    { type_id: 'variety', type_name: '综艺' },
    { type_id: 'documentary', type_name: '纪录片' }
];

var FILTERS = {
    movie: [
        { key: 'area', name: '地区', init: '', value: AREAS },
        { key: 'year', name: '年代', init: '', value: YEARS },
        genreFilter(['动作片', '喜剧片', '爱情片', '科幻片', '恐怖片', '剧情片', '战争片', '纪录片', '动画片', '犯罪片', '悬疑片', '奇幻片', '冒险片'])
    ],
    series: [
        { key: 'area', name: '地区', init: '', value: AREAS },
        { key: 'year', name: '年代', init: '', value: YEARS },
        genreFilter(['国产剧', '欧美剧', '韩剧', '日剧', '港台剧', '泰国剧', '海外剧'])
    ],
    short_drama: [
        { key: 'area', name: '地区', init: '', value: AREAS },
        { key: 'year', name: '年代', init: '', value: YEARS }
    ],
    anime: [
        { key: 'area', name: '地区', init: '', value: AREAS },
        { key: 'year', name: '年代', init: '', value: YEARS },
        genreFilter(['国产动漫', '日韩动漫', '欧美动漫'])
    ],
    variety: [
        { key: 'area', name: '地区', init: '', value: AREAS },
        { key: 'year', name: '年代', init: '', value: YEARS }
    ],
    documentary: [
        { key: 'area', name: '地区', init: '', value: AREAS },
        { key: 'year', name: '年代', init: '', value: YEARS }
    ]
};

async function init(ext) {
}

async function home(filter) {
    return JSON.stringify({ class: CLASSES, filters: FILTERS });
}

async function homeVod() {
    var data = apiGet('/v1/feed/home');
    var list = [];
    var seen = {};
    if (data && data.sections) {
        for (var i = 0; i < data.sections.length && list.length < 60; i++) {
            var cards = data.sections[i].cards || [];
            for (var j = 0; j < cards.length && list.length < 60; j++) {
                var card = cards[j];
                if (!card.id || seen[card.id]) continue;
                seen[card.id] = 1;
                list.push(toVod(card));
            }
        }
    }
    return JSON.stringify({ list: list });
}

async function category(tid, pg, filter, extend) {
    var page = parseInt(pg) || 1;
    var ext = extend || {};
    var path = '/v1/browse/catalog?kind=' + encodeURIComponent(tid) + '&page=' + page + '&limit=20';
    if (ext.area) path += '&area=' + encodeURIComponent(ext.area);
    if (ext.year) path += '&year=' + encodeURIComponent(ext.year);
    if (ext.genre) path += '&genre=' + encodeURIComponent(ext.genre);
    var data = apiGet(path);
    if (!data || !data.cards) return JSON.stringify({ page: page, pagecount: 0, list: [] });
    var pag = data.pagination || {};
    return JSON.stringify({
        page: page,
        pagecount: pag.has_more ? page + 1 : page,
        total: pag.total || 0,
        list: data.cards.map(toVod)
    });
}

async function detail(id) {
    var text = typeof id === 'string' ? id : (id && id[0]) || '';
    if (!text) return JSON.stringify({ list: [] });
    var data = apiGet('/v1/catalog/' + encodeURIComponent(text));
    if (!data) return JSON.stringify({ list: [] });
    var vod = toVod(data);
    vod.vod_id = text;
    vod.vod_pic = data.poster_url || data.carousel_url || vod.vod_pic;
    vod.vod_content = data.description || vod.vod_content;
    var eps = [];
    var episodes = data.episodes || [];
    for (var i = 0; i < episodes.length; i++) {
        var ep = episodes[i];
        if (!ep.token) continue;
        var name = ep.title || ('第' + (i + 1) + '集');
        eps.push(name + '$' + ep.token);
    }
    if (eps.length) {
        vod.vod_play_from = '在线';
        vod.vod_play_url = eps.join('#');
    }
    return JSON.stringify({ list: [vod] });
}

async function search(wd, quick, pg) {
    var page = parseInt(pg) || 1;
    var data = apiGet('/v1/browse/catalog?q=' + encodeURIComponent(wd) + '&page=' + page + '&limit=20');
    if (!data || !data.cards) return JSON.stringify({ page: page, pagecount: 0, list: [] });
    var pag = data.pagination || {};
    return JSON.stringify({
        page: page,
        pagecount: pag.has_more ? page + 1 : page,
        total: pag.total || 0,
        list: data.cards.map(toVod)
    });
}

async function play(flag, id, vipFlags) {
    var token = typeof id === 'string' ? id : (id && id[0]) || '';
    if (!token) return JSON.stringify({ parse: 0, url: '' });
    var res = playerResolve(token);
    if (!res) return JSON.stringify({ parse: 0, url: '' });
    var header = { 'User-Agent': UA, 'Referer': PLAYER + '/' };
    var lines = [];
    var options = res.line_options || [];
    for (var i = 0; i < options.length; i++) {
        var line = options[i];
        if (line.url && (!line.url_kind || line.url_kind === 'm3u8')) lines.push(line);
    }
    if (lines.length > 1) {
        var urls = [];
        for (var j = 0; j < lines.length && j < 8; j++) {
            urls.push(lines[j].label || lines[j].play_from || ('线路' + (j + 1)));
            urls.push(lines[j].url);
        }
        return JSON.stringify({ parse: 0, url: urls, header: header });
    }
    var url = res.url || (lines[0] && lines[0].url) || '';
    return JSON.stringify({ parse: 0, url: url, header: header });
}

export default {
    init: init,
    home: home,
    homeVod: homeVod,
    category: category,
    detail: detail,
    search: search,
    play: play
};
