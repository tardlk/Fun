var REXXAR = 'https://m.douban.com/rexxar/api/v2';
var SUGGEST = 'https://movie.douban.com/j/subject_suggest';
var HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Referer': 'https://movie.douban.com/'
};

var CLASSES = [
    { type_id: 'movie', type_name: '热门电影' },
    { type_id: 'tv', type_name: '热播剧集' },
    { type_id: 'show', type_name: '热播综艺' }
];

var FILTERS = {
    movie: [
        { key: 'category', name: '排序', init: '热门', value: [
            { n: '热门', v: '热门' }, { n: '最新', v: '最新' },
            { n: '豆瓣高分', v: '豆瓣高分' }, { n: '冷门佳片', v: '冷门佳片' }
        ]},
        { key: 'type', name: '地区', init: '全部', value: [
            { n: '全部', v: '全部' }, { n: '华语', v: '华语' },
            { n: '欧美', v: '欧美' }, { n: '韩国', v: '韩国' }, { n: '日本', v: '日本' }
        ]}
    ],
    tv: [
        { key: 'type', name: '类型', init: 'tv', value: [
            { n: '综合', v: 'tv' }, { n: '国产剧', v: 'tv_domestic' },
            { n: '欧美剧', v: 'tv_american' }, { n: '日剧', v: 'tv_japanese' },
            { n: '韩剧', v: 'tv_korean' }, { n: '动漫', v: 'tv_animation' },
            { n: '纪录片', v: 'tv_documentary' }
        ]}
    ],
    show: [
        { key: 'type', name: '类型', init: 'show', value: [
            { n: '综合', v: 'show' }, { n: '国内', v: 'show_domestic' },
            { n: '国外', v: 'show_foreign' }
        ]}
    ]
};

function getJSON(url) {
    try {
        var res = req(url, { headers: HEADERS });
        if (!res || !res.content) return null;
        return JSON.parse(res.content);
    } catch (e) {
        return null;
    }
}

function fixPic(url) {
    return url ? url + '@Referer=https://movie.douban.com' : '';
}

function getPic(item) {
    if (!item) return '';
    if (item.pic) return item.pic.large || item.pic.normal || item.pic.medium || item.pic.small || '';
    return item.cover_url || item.tile_cover && item.tile_cover.url || item.img || '';
}

function yearOf(subtitle) {
    var m = (subtitle || '').match(/(\d{4})/);
    return m ? m[1] : '';
}

function toVod(item) {
    var subtitle = item.card_subtitle || '';
    var rating = item.rating && item.rating.value ? String(item.rating.value) : '';
    var episodes = item.episodes_info ? item.episodes_info.trim() : '';
    var remarks = rating ? rating + '分' : '';
    if (episodes) remarks = remarks ? remarks + ' | ' + episodes : episodes;
    return {
        vod_id: 'msearch:' + (item.title || ''),
        vod_name: item.title || '',
        vod_pic: fixPic(getPic(item)),
        vod_remarks: remarks,
        vod_year: yearOf(subtitle),
        vod_content: subtitle
    };
}

async function init(ext) {
}

async function home(filter) {
    return JSON.stringify({ class: CLASSES, filters: FILTERS });
}

async function homeVod() {
    var url = REXXAR + '/subject/recent_hot/movie?start=0&limit=20&category='
        + encodeURIComponent('热门') + '&type=' + encodeURIComponent('全部');
    var data = getJSON(url);
    var list = data && Array.isArray(data.items) ? data.items.map(toVod) : [];
    return JSON.stringify({ list: list });
}

async function category(tid, pg, filter, extend) {
    var page = parseInt(pg) || 1;
    var limit = 20;
    var start = (page - 1) * limit;
    var ext = extend || {};
    var url = '';
    if (tid === 'movie') {
        url = REXXAR + '/subject/recent_hot/movie?start=' + start + '&limit=' + limit
            + '&category=' + encodeURIComponent(ext.category || '热门')
            + '&type=' + encodeURIComponent(ext.type || '全部');
    } else if (tid === 'tv' || tid === 'show') {
        url = REXXAR + '/subject/recent_hot/tv?start=' + start + '&limit=' + limit
            + '&category=' + tid
            + '&type=' + encodeURIComponent(ext.type || (tid === 'tv' ? 'tv' : 'show'));
    } else {
        return JSON.stringify({ page: page, pagecount: 0, total: 0, list: [] });
    }
    var data = getJSON(url);
    if (!data || !Array.isArray(data.items)) {
        return JSON.stringify({ page: page, pagecount: 0, total: 0, list: [] });
    }
    var total = data.total || 0;
    return JSON.stringify({
        page: page,
        pagecount: total ? Math.ceil(total / limit) : 0,
        limit: limit,
        total: total,
        list: data.items.map(toVod)
    });
}

async function detail(id) {
    var text = typeof id === 'string' ? id : (id && id[0]) || '';
    if (!text) return JSON.stringify({ list: [] });
    if (text.indexOf('msearch:') === 0) {
        return JSON.stringify({ list: [] });
    }
    var data = getJSON(REXXAR + '/subject/' + text);
    if (!data) return JSON.stringify({ list: [] });
    var rating = data.rating && data.rating.value ? data.rating.value : '';
    var vod = {
        vod_id: text,
        vod_name: data.title || '',
        vod_pic: fixPic(data.cover_url || getPic(data)),
        vod_year: String(data.year || ''),
        vod_area: (data.countries || []).join(' / '),
        vod_actor: (data.actors || []).map(function (a) { return a.name || ''; }).join(' / '),
        vod_director: (data.directors || []).map(function (d) { return d.name || ''; }).join(' / '),
        vod_content: data.intro || data.card_subtitle || '',
        vod_remarks: rating ? '评分: ' + rating : ''
    };
    return JSON.stringify({ list: [vod] });
}

async function search(key, quick, pg) {
    var page = parseInt(pg) || 1;
    var limit = 20;
    var data = getJSON(SUGGEST + '?q=' + encodeURIComponent(key));
    var arr = Array.isArray(data) ? data : [];
    var total = arr.length;
    var list = arr.slice((page - 1) * limit, page * limit).map(function (it) {
        return {
            vod_id: 'msearch:' + (it.title || ''),
            vod_name: it.title || '',
            vod_pic: fixPic(it.img || ''),
            vod_remarks: it.year || '',
            vod_year: it.year || ''
        };
    });
    return JSON.stringify({
        page: page,
        pagecount: Math.max(1, Math.ceil(total / limit)),
        total: total,
        list: list
    });
}

async function play(flag, id, vipFlags) {
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
