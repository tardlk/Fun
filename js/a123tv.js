var HOST = 'https://a123tv.com';
var UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
var HEADERS = { 'User-Agent': UA, 'Referer': HOST + '/' };
var PLAY_HEADERS = { 'User-Agent': UA, 'Referer': HOST + '/' };
var MAX_LINES = 20;

var CLASSES = [
    { type_id: '10', type_name: '电影' },
    { type_id: '11', type_name: '连续剧' },
    { type_id: '12', type_name: '综艺' },
    { type_id: '13', type_name: '动漫' },
    { type_id: '15', type_name: '福利' }
];

function f(key, name, init, arr) {
    return { key: key, name: name, init: init, value: arr.map(function (x) { return { n: x[0], v: x[1] }; }) };
}

var FILTERS = {
    '10': [f('cat', '类型', '10', [
        ['全部电影', '10'], ['动作片', '1001'], ['喜剧片', '1002'], ['爱情片', '1003'], ['科幻片', '1004'],
        ['恐怖片', '1005'], ['剧情片', '1006'], ['战争片', '1007'], ['纪录片', '1008'], ['动漫电影', '1010'],
        ['奇幻片', '1011'], ['动画片', '1013'], ['犯罪片', '1014'], ['悬疑片', '1016'], ['邵氏电影', '1019'],
        ['歌舞片', '1022'], ['家庭片', '1024'], ['古装片', '1025'], ['历史片', '1026'], ['4K电影', '1027']
    ])],
    '11': [f('cat', '类型', '11', [
        ['全部连续剧', '11'], ['国产剧', '1101'], ['香港剧', '1102'], ['台湾剧', '1105'], ['韩国剧', '1103'],
        ['欧美剧', '1104'], ['日本剧', '1106'], ['泰国剧', '1108'], ['港台剧', '1110'], ['日韩剧', '1111'], ['海外剧', '1107']
    ])],
    '12': [f('cat', '类型', '12', [
        ['全部综艺', '12'], ['内地综艺', '1201'], ['港台综艺', '1202'], ['日韩综艺', '1203'],
        ['欧美综艺', '1204'], ['国外综艺', '1205']
    ])],
    '13': [f('cat', '类型', '13', [
        ['全部动漫', '13'], ['国产动漫', '1301'], ['日韩动漫', '1302'], ['欧美动漫', '1303'],
        ['海外动漫', '1305'], ['里番', '1307']
    ])],
    '15': [f('cat', '类型', '15', [
        ['全部福利', '15'], ['韩国情色片', '1551'], ['日本情色片', '1552'], ['大陆情色片', '1555'],
        ['香港情色片', '1553'], ['台湾情色片', '1554'], ['美国情色片', '1556'], ['欧洲情色片', '1557'],
        ['印度情色片', '1558'], ['东南亚情色片', '1559'], ['其它情色片', '1550']
    ])]
};

function getHtml(url) {
    try {
        var res = req(url, { headers: HEADERS });
        if (!res || !res.content) return '';
        return res.content;
    } catch (e) {
        return '';
    }
}

function picUrl(url) {
    if (!url) return '';
    if (url.indexOf('//') === 0) return 'https:' + url;
    return url;
}

function pad(n) {
    return n < 10 ? '0' + n : '' + n;
}

function slugOf(href) {
    return (href || '').replace(/^.*\/v\//, '').replace(/\.html.*$/, '');
}

function parseList(html) {
    var list = [];
    if (!html) return list;
    var parts = html.split('<a class="w4-item"');
    for (var i = 1; i < parts.length; i++) {
        var seg = parts[i];
        var href = (seg.match(/href="([^"]+)"/) || [])[1] || '';
        if (href.indexOf('/v/') !== 0) continue;
        var title = (seg.match(/<div class="t" title="([^"]*)"/) || [])[1]
            || (seg.match(/alt="([^"]*)"/) || [])[1] || '';
        var info = (seg.match(/<div class="i">([^<]*)</) || [])[1] || '';
        var remark = (seg.match(/<div class="r">([^<]*)</) || [])[1] || '';
        var pic = (seg.match(/data-src="([^"]+)"/) || [])[1] || '';
        list.push({
            vod_id: slugOf(href),
            vod_name: title,
            vod_pic: picUrl(pic),
            vod_remarks: remark,
            vod_year: (info.match(/(\d{4})/) || [])[1] || ''
        });
    }
    return list;
}

function hasNextPage(html, page) {
    return new RegExp('/p' + (page + 1) + '\\.html').test(html);
}

async function init(ext) {
}

async function home(filter) {
    return JSON.stringify({ class: CLASSES, filters: FILTERS });
}

async function homeVod() {
    var html = getHtml(HOST + '/');
    return JSON.stringify({ list: parseList(html).slice(0, 60) });
}

async function category(tid, pg, filter, extend) {
    var ext = extend || {};
    var cat = ext.cat || tid;
    var page = parseInt(pg) || 1;
    var url = page > 1
        ? HOST + '/t/' + cat + '/p' + page + '.html'
        : HOST + '/t/' + cat + '.html';
    var html = getHtml(url);
    var list = parseList(html);
    return JSON.stringify({
        page: page,
        pagecount: hasNextPage(html, page) ? page + 1 : page,
        limit: list.length,
        list: list
    });
}

async function detail(id) {
    var text = typeof id === 'string' ? id : (id && id[0]) || '';
    var slug = text.replace(/^.*\/v\//, '').replace(/\.html.*$/, '');
    if (!slug) return JSON.stringify({ list: [] });
    var html = getHtml(HOST + '/v/' + slug + '.html');
    if (!html) return JSON.stringify({ list: [] });

    var title = (html.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || '';
    var name = (title.match(/《([\s\S]*?)》/) || [])[1] || title.split(' - ')[0];
    var meta = (html.match(/<meta name="description" content="([^"]*)"/) || [])[1] || '';
    var poster = (html.match(/<div id="awp1"[^>]*data-poster="([^"]+)"/) || [])[1] || '';

    var froms = [];
    var urls = [];
    var seen = {};
    var pp = null;
    var pm = html.match(/var pp=(\{[\s\S]*?\});<\/script>/);
    if (pm) {
        try { pp = JSON.parse(pm[1]); } catch (e) { pp = null; }
    }

    if (pp && pp.la && pp.la.length) {
        var lines = pp.la;
        for (var i = 0; i < lines.length && froms.length < MAX_LINES; i++) {
            var code = lines[i][0];
            var lname = lines[i][1] || ('线路' + (i + 1));
            var count = parseInt(lines[i][2]) || 0;
            if (!code || count <= 0 || seen[lname]) continue;
            seen[lname] = 1;
            var eps = [];
            for (var j = 0; j < count && j < 500; j++) {
                var ename = count === 1 ? '正片' : ('第' + pad(j + 1) + '集');
                eps.push(ename + '$' + [pp.no, code, j].join('|'));
            }
            froms.push(lname);
            urls.push(eps.join('#'));
        }
    }

    if (!froms.length) {
        var cur = (html.match(/<div id="awp1"[^>]*data-src="([^"]+)"/) || [])[1];
        if (cur) {
            froms.push('默认');
            urls.push('正片$' + cur);
        }
    }

    var vod = {
        vod_id: slug,
        vod_name: name,
        vod_pic: picUrl(poster),
        vod_year: (title.match(/(\d{4})年/) || [])[1] || '',
        vod_area: (meta.match(/地区：([^。]*)/) || [])[1] || '',
        vod_actor: (meta.match(/演员：([^。]*)/) || [])[1] || '',
        vod_director: (meta.match(/导演：([^。]*)/) || [])[1] || '',
        vod_content: (meta.match(/剧情：([\s\S]*)/) || [])[1] || '',
        vod_play_from: froms.join('$$$'),
        vod_play_url: urls.join('$$$')
    };
    return JSON.stringify({ list: [vod] });
}

async function search(wd, quick, pg) {
    var page = parseInt(pg) || 1;
    var key = encodeURIComponent(wd);
    var url = page > 1
        ? HOST + '/s/' + key + '/p' + page + '.html'
        : HOST + '/s/' + key + '.html';
    var html = getHtml(url);
    var list = parseList(html);
    return JSON.stringify({
        page: page,
        pagecount: hasNextPage(html, page) ? page + 1 : page,
        limit: list.length,
        list: list
    });
}

async function play(flag, id, vipFlags) {
    var text = typeof id === 'string' ? id : (id && id[0]) || '';
    if (text.indexOf('://') > -1) {
        return JSON.stringify({ parse: 0, url: text, header: PLAY_HEADERS });
    }
    var p = text.split('|');
    if (p.length === 3) {
        var url = HOST + '/v/' + p[0] + '/' + p[1] + 'z' + p[2] + '.html';
        var html = getHtml(url);
        var m = html.match(/<div id="awp1"[^>]*data-src="([^"]+)"/)
            || html.match(/class="w4-player"[^>]*data-src="([^"]+)"/);
        if (m && m[1]) {
            return JSON.stringify({ parse: 0, url: m[1], header: PLAY_HEADERS });
        }
    }
    return JSON.stringify({ parse: 0, url: '' });
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
