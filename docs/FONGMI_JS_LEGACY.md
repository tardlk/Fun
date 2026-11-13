# Fongmi / TVBox 旧版 JavaScript Spider 开发文档

本文合并旧版 JS 编写指南及三份上游历史文档，作为本项目保留旧接口的维护参考。先阅读 JS 指南；附录中的 Java 抽象层方法名请按指南中的对应表转换为旧版 JS 入口。

历史基准：[FongMi/TV `c11a721`](https://github.com/FongMi/TV/commit/c11a721186c6092e1941e50fdea17df2d09f2593)。上游文档合并时仅调整标题层级与内部链接，版权与许可沿用 [上游 GPL-3.0 许可](https://github.com/FongMi/TV/blob/c11a721186c6092e1941e50fdea17df2d09f2593/LICENSE.md)。

## 目录

- [旧版 JavaScript 编写指南](#legacy-guide)
- [附录 A：上游 Spider API 历史文档](#legacy-spider)
- [附录 B：上游配置历史文档](#legacy-config)
- [附录 C：上游本地 HTTP API 历史文档](#legacy-local)


---

<a id="legacy-guide"></a>

## 旧版 JavaScript 编写指南

本项目保留现有旧版 JavaScript 接口，以继续适配用户正在使用的 Fongmi / TVBox 客户端。后续维护这些源时，沿用对象导出、短方法名、JSON 字符串返回、同步 req 和旧版 local 签名。

本文是根据历史运行时源码整理的 JS 对照说明，不是上游原始文档。不同 TVBox 分支的 JS 引擎和扩展能力可能不同；以目标客户端验证结果为准，不能仅凭 type=3 判断兼容性。

<a id="guide-001"></a>

### 版本与来源

- 固定上游：FongMi/TV，提交 [c11a721186c6092e1941e50fdea17df2d09f2593](https://github.com/FongMi/TV/commit/c11a721186c6092e1941e50fdea17df2d09f2593)。
- [上游 Spider 历史文档](#legacy-spider)：完整收录该提交的 docs/SPIDER.md，合并时仅调整标题层级与内部链接。
- 同时收录原文引用的 [站点配置文档](#legacy-config) 和 [本地 HTTP API 文档](#legacy-local)，均来自同一历史提交，交叉引用已改为本文内部链接。
- 原文主要按 Java Spider 抽象层描述方法；编写本项目的 JS 时，使用下表的 JS 入口。
- 合并前的上游 SPIDER.md Git blob SHA-1：`1bf0f89dbd44dff1d211665e4ad442f7318ea23e`。
- 上游原文及源码的版权与许可沿用 [FongMi/TV LICENSE.md](https://github.com/FongMi/TV/blob/c11a721186c6092e1941e50fdea17df2d09f2593/LICENSE.md)。
- 最新版的 Spider 子类、完整方法名及 this.net API 属于另一套接口，不作为本目录脚本的编写基准。

<a id="guide-002"></a>

### 1. 站点配置与模块导出

站点放入主配置的 sites 数组，type 为 3，api 指向 JS 文件：

```json
{
  "sites": [
    {
      "key": "demo",
      "name": "示例源",
      "type": 3,
      "api": "./js/demo.js",
      "searchable": 1,
      "quickSearch": 1,
      "filterable": 1,
      "ext": {
        "host": "https://example.com"
      }
    }
  ]
}
```

相对路径的解析、筛选开关等配置支持以目标客户端为准。现有仓库使用绝对脚本 URL，同样属于此入口。

默认导出普通对象：

```javascript
export default { init, home, homeVod, category, detail, search, play };
```

该版加载器也支持默认导出工厂函数，以及 __jsEvalReturn 兼容分支；本项目采用上面的普通对象形式。不要将兼容分支的初始化参数或网络行为直接套到普通模式。

<a id="guide-003"></a>

### 2. 方法与参数

| Java 抽象层方法 | 普通 JS 入口 | 规则 |
| --- | --- | --- |
| init(context, extend) | init(ext) | 配置初始化；JS 不接收 Android context |
| homeContent(filter) | home(filter) | 分类和筛选，返回 JSON 字符串 |
| homeVideoContent() | homeVod() | 推荐列表，返回 JSON 字符串 |
| categoryContent(tid, pg, filter, extend) | category(tid, pg, filter, extend) | 分类列表与分页，返回 JSON 字符串 |
| detailContent(ids) | detail(id) | JS 接收 ids[0]，即单个 ID |
| searchContent(key, quick[, pg]) | search(key, quick, pg) | pg 可能省略，自行设置默认页码 |
| playerContent(flag, id, vipFlags) | play(flag, id, vipFlags) | flag 是线路名，id 是该集播放值 |
| liveContent(url) | live(url) | 按需要提供直播内容 |
| manualVideoCheck() | sniffer() | 按需要提供，返回布尔值 |
| isVideoFormat(url) | isVideo(url) | 按需要提供，返回布尔值 |
| proxy(params) | proxy(params) | 普通模式接收参数对象，返回代理数组 |
| action(action) | action(action) | 按需要提供自定义操作 |
| destroy() | destroy() | 按需要清理资源 |

列表、详情和播放等数据入口使用 JSON.stringify()。可以将入口写为 async function；这不会自动让内部的同步 req 变成异步请求。

页码通常以字符串传入：

```javascript
var page = Math.max(1, parseInt(pg, 10) || 1);
```

普通模式下，宿主会尝试把 JSON 对象形式的 ext 解析成对象；其他情况保留字符串。为适配不同客户端，可以同时处理两种情况：

```javascript
var config = {};

async function init(ext) {
    config = typeof ext === 'string' ? JSON.parse(ext || '{}') : (ext || {});
}
```

上例假定字符串 ext 是 JSON。如果来源约定 ext 为 URL 或普通文本，应按该来源约定处理。

<a id="guide-004"></a>

### 3. 分类、筛选和列表

首页分类示例：

```javascript
return JSON.stringify({
    class: [{ type_id: 'movie', type_name: '电影' }],
    filters: {
        movie: [{
            key: 'area',
            name: '地区',
            init: '',
            value: [
                { n: '全部', v: '' },
                { n: '大陆', v: '大陆' }
            ]
        }]
    }
});
```

filters 的第一层键对应 type_id。选项中的 n 用于展示，v 是提交值；上例选择后通过 category 的 extend.area 读取。

推荐、分类和搜索中的影片条目常用字段：

| 字段 | 含义 |
| --- | --- |
| vod_id | 稳定的影片标识，传给 detail |
| vod_name | 展示名称 |
| vod_pic | 封面地址 |
| vod_remarks | 更新状态、评分或其他角标 |
| vod_year | 年份，可选 |

分页示例：

```javascript
return JSON.stringify({
    page: page,
    pagecount: Math.ceil(total / pageSize),
    limit: pageSize,
    total: total,
    list: videos
});
```

没有总数但能判断下一页时，可使用“还有下一页则 pagecount=page+1，否则 pagecount=page”的方式。请求失败与合法空列表应在日志中区分。

<a id="guide-005"></a>

### 4. 详情、线路和集数

详情返回 { list: [vod] }。除了基本字段，常用 vod_content、vod_actor、vod_director、vod_area、vod_play_from 和 vod_play_url。

```json
{
  "list": [
    {
      "vod_id": "movie-1",
      "vod_name": "示例影片",
      "vod_play_from": "主线$$$备用",
      "vod_play_url": "第1集$ep-1#第2集$ep-2$$$正片$backup-1"
    }
  ]
}
```

- $$$ 分隔线路；vod_play_from 与 vod_play_url 中的线路顺序对应。
- # 分隔同一线路的剧集。
- $ 分隔集名与播放值。
- 播放值可以是 URL、ID 或自定义 token，在 play 中转换为实际地址。
- 线路名、集名中的 $ 和 # 应先清理；无需清理的原始 ID、token 和 URL 不应被随意改写。
- 季可以映射成播放线路，这是现有 Emby / Plex 脚本的组织方式。

<a id="guide-006"></a>

### 5. 播放结果

直链播放：

```javascript
return JSON.stringify({
    parse: 0,
    url: mediaUrl,
    header: {
        'User-Agent': userAgent,
        'Referer': referer
    }
});
```

parse=0 表示直接播放，parse=1 表示交给客户端进一步解析；header 是播放请求使用的请求头。播放值不必在 detail 阶段就解析为直链，临时地址宜在 play 中获取。

脚本取数据时使用的请求头与播放请求头是两次独立配置；play 中应返回媒体请求实际需要的头。结果还可包含 playUrl、flag、subs、danmaku 等字段，详见附录历史文档；具体扩展支持仍需在目标客户端确认。

<a id="guide-007"></a>

### 6. 网络请求：旧版 req / http

普通对象模式下：

```javascript
var res = req(url, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
    timeout: 10000
});

if (!res || Number(res.code) < 200 || Number(res.code) >= 300) {
    throw new Error('请求失败：' + (res ? res.code : '无响应'));
}
var data = JSON.parse(res.content);
```

req 默认同步返回对象；http 默认返回 Promise，可 await http(url, options)。req 的同步默认值可被显式 options.async 覆盖，普通采集代码应保持默认行为。__jsEvalReturn 兼容分支会重绑定 req，需另行核对。

| options 字段 | 历史实现 |
| --- | --- |
| headers | 请求头对象 |
| method | 默认 get；post 发送 POST；该历史实现用 header 表示 HEAD，其余值走 GET |
| timeout | 默认 10000，毫秒 |
| redirect | 默认 1 跟随跳转，0 不跟随 |
| data / postType | data 为提交数据；postType 支持 json（默认）、form、form-data |
| body | 原始字符串正文；需要同时提供 Content-Type，且不要与 data 混用 |
| buffer | 0 文本；1 数组；2 Base64；3 原生字节数据，跨客户端先验证 |

响应结构为 { code, headers, content }。网络异常时该历史实现返回空 content 和空字符串 code；不能仅凭 content 非空判定成功，因为 HTTP 4xx/5xx 也可能有正文。

JSON POST 示例：

```javascript
var res = req(url, {
    method: 'post',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ keyword: '示例' })
});
```

这些工具由播放器注入，不是 Node.js 或浏览器标准接口。脚本无需为普通 HTTP 请求自行启动服务器。

<a id="guide-008"></a>

### 7. 本地存储与代理

旧版 Local 使用命名空间和键：

```javascript
var token = local.get('demo', 'token');
local.set('demo', 'token', 'token-value');
local.delete('demo', 'token');
```

历史实现存储字符串，命名空间由脚本提供。多服务、多账号的缓存键需要区分 host 和账号；配置变更、token 失效时应清理相应认证缓存。

普通模式代理返回：

```javascript
return [
    200,
    'text/plain; charset=utf-8',
    'response body',
    { 'Cache-Control': 'no-store' },
    0
];
```

第 5 项为 1 表示正文按 Base64 解码。getProxy(local) 提供本地代理基础地址；__jsEvalReturn 兼容模式的代理签名不同，按需查看历史调用源码。

<a id="guide-009"></a>

### 8. 最小接口骨架

下面只演示接口形状，尚未接入真实站点：

```javascript
var config = {};

async function init(ext) {
    config = typeof ext === 'string' ? JSON.parse(ext || '{}') : (ext || {});
}

async function home(filter) {
    return JSON.stringify({
        class: [{ type_id: 'movie', type_name: '电影' }],
        filters: {}
    });
}

async function homeVod() {
    return JSON.stringify({ list: [] });
}

async function category(tid, pg, filter, extend) {
    var page = Math.max(1, parseInt(pg, 10) || 1);
    return JSON.stringify({ page: page, pagecount: page, list: [] });
}

async function detail(id) {
    return JSON.stringify({ list: [] });
}

async function search(key, quick, pg) {
    var page = Math.max(1, parseInt(pg, 10) || 1);
    return JSON.stringify({ page: page, pagecount: page, list: [] });
}

async function play(flag, id, vipFlags) {
    return JSON.stringify({ parse: 0, url: '' });
}

export default { init, home, homeVod, category, detail, search, play };
```

<a id="guide-010"></a>

### 9. 维护约定

1. 保留旧接口；新源优先沿用同目录现有脚本的导出和返回方式。
2. 账号、密码、token 和可变 host 通过 ext 配置；示例只用占位值。
3. 检查 HTTP 状态码、JSON 解析和空结果；只对适合重试的失败执行有限重试。
4. 配置变更时重建认证状态；缓存身份应包含对应服务与账号。
5. 先验证分类、筛选、分页、搜索、详情、选集，再在目标 Fongmi / TVBox 客户端确认播放。
6. 现代 JS 环境中的语法检查只能说明代码可解析；客户端注入 API 和实际媒体播放仍需单独验证。

<a id="guide-011"></a>

### 10. 固定版本源码依据

以下链接均固定到同一个历史提交，避免上游 main / fongmi 分支更新后发生规范漂移。

- [上游原始 SPIDER.md](https://github.com/FongMi/TV/blob/c11a721186c6092e1941e50fdea17df2d09f2593/docs/SPIDER.md)
- [JS 方法调用及 ext 转换](https://github.com/FongMi/TV/blob/c11a721186c6092e1941e50fdea17df2d09f2593/quickjs/src/main/java/com/fongmi/quickjs/crawler/Spider.java)
- [对象导出与兼容分支加载](https://github.com/FongMi/TV/blob/c11a721186c6092e1941e50fdea17df2d09f2593/quickjs/src/main/assets/js/lib/spider.js)
- [req / http 同步与异步封装](https://github.com/FongMi/TV/blob/c11a721186c6092e1941e50fdea17df2d09f2593/quickjs/src/main/assets/js/lib/http.js)
- [请求参数及默认值](https://github.com/FongMi/TV/blob/c11a721186c6092e1941e50fdea17df2d09f2593/quickjs/src/main/java/com/fongmi/quickjs/bean/Req.java)
- [请求正文、响应及错误处理](https://github.com/FongMi/TV/blob/c11a721186c6092e1941e50fdea17df2d09f2593/quickjs/src/main/java/com/fongmi/quickjs/utils/Connect.java)
- [旧版 local 存储](https://github.com/FongMi/TV/blob/c11a721186c6092e1941e50fdea17df2d09f2593/quickjs/src/main/java/com/fongmi/quickjs/method/Local.java)


---

<a id="legacy-spider"></a>

## 附录 A：上游 Spider API 历史文档

本文件說明如何實作一個 Spider 爬蟲，包含所有方法的參數、回傳格式及 JSON 結構定義。

---

<a id="spider-001"></a>

### 目錄

- [概覽](#spider-002)
- [爬蟲類型與載入方式](#spider-003)
- [Spider 抽象類別](#spider-004)
    - [init — 初始化](#spider-005)
    - [homeContent — 首頁分類](#spider-006)
    - [homeVideoContent — 首頁推薦影片](#spider-007)
    - [categoryContent — 分類列表](#spider-008)
    - [detailContent — 影片詳情](#spider-009)
    - [searchContent — 搜尋](#spider-010)
    - [playerContent — 播放解析](#spider-011)
    - [liveContent — 直播頻道列表](#spider-012)
    - [proxy — 本地代理](#spider-013)
    - [action — 自定義動作](#spider-014)
    - [manualVideoCheck / isVideoFormat — 影片格式判斷](#spider-015)
    - [destroy — 銷毀](#spider-016)
- [回傳資料結構](#spider-017)
    - [Result — 通用回傳物件](#spider-018)
    - [Vod — 影片卡片物件](#spider-019)
    - [Class — 分類物件](#spider-020)
    - [Filter — 篩選器物件](#spider-021)
    - [Danmaku — 彈幕物件](#spider-022)
    - [Sub — 字幕物件](#spider-023)
    - [Drm — DRM 設定物件](#spider-024)
    - [播放集數格式（vod_play_from / vod_play_url）](#spider-025)
- [完整 JSON 範例](#spider-026)
    - [homeContent 回傳範例](#spider-027)
    - [homeVideoContent / categoryContent 回傳範例](#spider-028)
    - [detailContent 回傳範例](#spider-029)
    - [playerContent 回傳範例](#spider-030)
    - [searchContent 回傳範例](#spider-031)
    - [liveContent 回傳範例](#spider-032)
- [爬蟲本地代理 URL](#spider-033)

---

<a id="spider-002"></a>

### 概覽

Spider 是應用程式爬蟲的抽象基底類別，位於 `com.github.catvod.crawler.Spider`。每個影片來源（`Site`）對應一個 Spider 實例。

**生命週期：**

```
init(context, ext)
    │
    ├─► homeContent(filter)          首頁分類
    ├─► homeVideoContent()           首頁推薦
    ├─► categoryContent(...)         分類瀏覽
    ├─► detailContent(ids)           影片詳情
    ├─► searchContent(key, quick)    搜尋
    ├─► playerContent(flag, id, ...) 播放解析
    ├─► liveContent(url)             直播解析
    └─► destroy()                    清理資源
```

**欄位：**

| 欄位        | 類型       | 說明                             |
|-----------|----------|--------------------------------|
| `siteKey` | `String` | 由載入器注入，標識此 Spider 服務的來源 `key`。 |

---

<a id="spider-003"></a>

### 爬蟲類型與載入方式

在 `sites` 配置中，`type` 欄位決定呼叫方式，`api` 欄位決定載入哪種引擎：

| `type` | `api` 格式        | 引擎                  | 說明                                                         |
|--------|-----------------|---------------------|------------------------------------------------------------|
| `0`    | HTTP URL        | 內建 XML 解析           | 直接 GET 請求，回傳 XML 格式。                                       |
| `1`    | HTTP URL        | 內建 JSON+Filter      | 直接 GET 請求，回傳 JSON 格式，篩選參數以 `f=` 傳遞。                        |
| `3`    | `csp_ClassName` | JAR（DexClassLoader） | 從 `jar` 指定的 .jar 檔載入 `com.github.catvod.spider.ClassName`。 |
| `3`    | `xxx.js`        | JavaScript（QuickJS） | 載入 `.js` 檔作為 Spider。                                       |
| `3`    | `xxx.py`        | Python（Chaquopy）    | 載入 `.py` 檔作為 Spider。                                       |
| `4`    | HTTP URL        | 內建 JSON+Base64 ext  | 同 `1`，擴充參數以 Base64 編碼傳遞（`ext=`）。                           |

> 本文件主要說明 `type=3`（Spider 直接呼叫）的情境。

---

<a id="spider-004"></a>

### Spider 抽象類別

所有方法預設回傳空字串 `""`，子類別僅需覆寫所需功能。

---

<a id="spider-005"></a>

#### init — 初始化

```java
public void init(Context context, String extend) throws Exception
```

**觸發時機：** Spider 實例建立後呼叫一次，用於初始化連線、載入設定等。

| 參數        | 類型        | 說明                                                    |
|-----------|-----------|-------------------------------------------------------|
| `context` | `Context` | Android Context，可取得應用資源、路徑等。                          |
| `extend`  | `String`  | 對應 `Site.ext` 欄位的額外擴充資料，內容由爬蟲自行定義（可為 URL、JSON 字串或路徑）。 |

**回傳：** 無（`void`）

---

<a id="spider-006"></a>

#### homeContent — 首頁分類

```java
public String homeContent(boolean filter) throws Exception
```

**觸發時機：** 使用者進入首頁時呼叫，取得分類列表（及可選的篩選器）。

| 參數       | 類型        | 說明                                |
|----------|-----------|-----------------------------------|
| `filter` | `boolean` | `true` 表示需要回傳篩選器資料（`filters` 欄位）。 |

**回傳：** JSON 字串，結構為 [Result](#spider-018)。

`class`（分類列表）為主要回傳欄位，`filters`（各分類的篩選器定義）為選填。

---

<a id="spider-007"></a>

#### homeVideoContent — 首頁推薦影片

```java
public String homeVideoContent() throws Exception
```

**觸發時機：** 首頁分類載入完成後呼叫，取得首頁推薦影片列表。

**回傳：** JSON 字串，結構為 [Result](#spider-018)。

主要回傳欄位為 `list`（推薦影片列表）。

---

<a id="spider-008"></a>

#### categoryContent — 分類列表

```java
public String categoryContent(String tid, String pg, boolean filter, HashMap<String, String> extend) throws Exception
```

**觸發時機：** 使用者點擊分類或切換篩選條件時呼叫。

| 參數       | 類型                        | 說明                                                   |
|----------|---------------------------|------------------------------------------------------|
| `tid`    | `String`                  | 分類 ID，對應 `Class.typeId`。                             |
| `pg`     | `String`                  | 頁碼，從 `"1"` 開始。                                       |
| `filter` | `boolean`                 | 是否啟用篩選器。                                             |
| `extend` | `HashMap<String, String>` | 使用者選擇的篩選條件，key 為篩選器 ID，value 為選項 key。為空 `{}` 時表示無篩選。 |

**回傳：** JSON 字串，結構為 [Result](#spider-018)。

主要回傳欄位為 `list`（影片列表），選填 `pagecount`（總頁數，用於分頁控制）。

---

<a id="spider-009"></a>

#### detailContent — 影片詳情

```java
public String detailContent(List<String> ids) throws Exception
```

**觸發時機：** 使用者點擊影片卡片時呼叫，取得完整詳情與播放集數。

| 參數    | 類型             | 說明                                |
|-------|----------------|-----------------------------------|
| `ids` | `List<String>` | 影片 ID 清單，通常只含一個元素，對應 `Vod.vodId`。 |

**回傳：** JSON 字串，結構為 [Result](#spider-018)，`list` 陣列中有一個完整的 `Vod` 物件。

主要 Vod 欄位：`vod_id`、`vod_name`、`vod_play_from`、`vod_play_url`。

---

<a id="spider-010"></a>

#### searchContent — 搜尋

```java
public String searchContent(String key, boolean quick) throws Exception

public String searchContent(String key, boolean quick, String pg) throws Exception
```

**觸發時機：** 使用者輸入關鍵字搜尋時呼叫。

| 參數      | 類型        | 說明                                     |
|---------|-----------|----------------------------------------|
| `key`   | `String`  | 搜尋關鍵字。框架會自動進行繁→簡轉換以提升相容性。              |
| `quick` | `boolean` | `true` 表示快速搜尋（只傳回基本資訊），`false` 表示完整搜尋。 |
| `pg`    | `String`  | 頁碼（僅分頁版本），從 `"1"` 開始。                  |

**回傳：** JSON 字串，結構為 [Result](#spider-018)。

主要回傳欄位為 `list`（搜尋結果影片列表）。

> 若 `Site.quickSearch = 0`，快速搜尋會被跳過，直接回傳空結果。

---

<a id="spider-011"></a>

#### playerContent — 播放解析

```java
public String playerContent(String flag, String id, List<String> vipFlags) throws Exception
```

**觸發時機：** 使用者選擇集數準備播放時呼叫，需解析出實際的媒體 URL。

| 參數         | 類型             | 說明                                                     |
|------------|----------------|--------------------------------------------------------|
| `flag`     | `String`       | 播放來源名稱，對應 `vod_play_from` 中的一項（如 `"youku"`、`"iqiyi"`）。 |
| `id`       | `String`       | 集數 URL 或 ID，對應 `vod_play_url` 中某集數的 value 部分。          |
| `vipFlags` | `List<String>` | 全局 VIP 平台旗標清單，對應配置中的 `flags` 欄位（如 `["qq", "youku"]`）。  |

**回傳：** JSON 字串，結構為 [Result](#spider-018)（播放解析結果）。

主要回傳欄位為 `url`（實際可播放的媒體 URL）。

選填欄位：

| 欄位         | 說明                                                                  |
|------------|---------------------------------------------------------------------|
| `parse`    | `0` = 直接播放，`1` = 需進一步解析（預設 `0`）。`jx=1` 效果相同。                        |
| `jx`       | 同 `parse=1`，需進一步解析。                                                 |
| `playUrl`  | 解析器前綴或指定。`json:…` 傳入 JSON 解析器，`parse:解析器名稱` 指定具名解析器，其他值作為解析 URL 前綴。 | |
| `click`    | 點擊攔截處理 URL，傳遞給解析器 WebView。                                          |
| `code`     | 非零時抑制 `msg` 顯示。                                                     |
| `header`   | 播放請求所需的 HTTP 標頭（鍵值對）。                                               |
| `flag`     | 覆蓋來源旗標，傳入 VIP 解析器時使用。                                               |
| `jxFrom`   | 強制指定解析器旗標（覆蓋 `flag` 的解析器比對結果）。                                      |
| `format`   | 媒體 MIME type（如 `"application/x-mpegURL"`），指定後播放器跳過格式自動偵測。           |
| `danmaku`  | 彈幕資料列表，詳見 [Danmaku](#spider-022)。                                |
| `subs`     | 字幕列表，詳見 [Sub](#spider-023)。                                          |
| `drm`      | DRM 版權保護設定，詳見 [Drm](#spider-024)。                                |
| `artwork`  | 播放頁面封面圖 URL。                                                        |
| `desc`     | 播放頁面描述文字。                                                           |
| `position` | 播放恢復位置（毫秒）。                                                         |

---

<a id="spider-012"></a>

#### liveContent — 直播頻道列表

```java
public String liveContent(String url) throws Exception
```

**觸發時機：** 載入直播來源時呼叫，爬蟲回傳頻道列表的原始文字，框架再依格式解析（支援 TXT、M3U、JSON）。

| 參數    | 類型       | 說明                     |
|-------|----------|------------------------|
| `url` | `String` | 來源配置中的 `Live.url` 欄位值。 |

**回傳：** 頻道列表的原始文字字串（非 JSON Result），格式可為：

| 格式   | 說明                                    |
|------|---------------------------------------|
| TXT  | 每行 `頻道名稱,URL#URL2...`，以 `#genre#` 分組。 |
| M3U  | 標準 `#EXTM3U`/`#EXTINF` 格式。            |
| JSON | `Group` 物件陣列，結構與配置的 `groups` 欄位相同。    |

---

<a id="spider-013"></a>

#### proxy — 本地代理

```java
public Object[] proxy(Map<String, String> params) throws Exception
```

**觸發時機：** 應用程式內建本地 HTTP 代理伺服器收到請求時呼叫。

| 參數       | 類型                    | 說明                                                           |
|----------|-----------------------|--------------------------------------------------------------|
| `params` | `Map<String, String>` | 代理請求參數，從本地代理 URL 的 query string 解析而來。通常含有 `do`、`url` 等自定義參數。 |

**回傳：** `Object[]`（注意：非 JSON 字串），格式為：

```
// 200 正常回應
Object[] {
  Integer    statusCode,   // HTTP 狀態碼（200）
  String     mimeType,     // Content-Type（如 "video/mp2t"）
  InputStream body         // 回應內容
}

// 302 重定向
Object[] {
  Integer              statusCode,   // 302
  String               mimeType,     // "text/plain"
  InputStream          body,         // 通常為空或提示文字
  Map<String, String>  headers       // 含 "Location" key 的重定向標頭
}
```

---

<a id="spider-014"></a>

#### action — 自定義動作

```java
public String action(String action) throws Exception
```

**觸發時機：** UI 層呼叫特定自定義指令時呼叫（如登入、重新整理 Token 等）。`action` 字串格式由爬蟲自行定義，框架不解析其內容。

| 參數       | 類型       | 說明                |
|----------|----------|-------------------|
| `action` | `String` | 動作指令字串，格式由爬蟲自行定義。 |

**回傳：** JSON 字串，結構為 [Result](#spider-018)。

---

<a id="spider-015"></a>

#### manualVideoCheck / isVideoFormat — 影片格式判斷

```java
public boolean manualVideoCheck() throws Exception

public boolean isVideoFormat(String url) throws Exception
```

| 方法                   | 說明                                                             |
|----------------------|----------------------------------------------------------------|
| `manualVideoCheck()` | 回傳 `true` 時，框架在 WebView 中攔截 URL 後會呼叫 `isVideoFormat()` 進行人工判斷。 |
| `isVideoFormat(url)` | 判斷指定 URL 是否為有效的直接媒體 URL。回傳 `true` 表示可直接播放。                     |

| 參數（`isVideoFormat`） | 類型       | 說明        |
|---------------------|----------|-----------|
| `url`               | `String` | 待判斷的 URL。 |

---

<a id="spider-016"></a>

#### destroy — 銷毀

```java
public void destroy()
```

**觸發時機：** 配置重新載入或應用程式清理快取時呼叫，釋放資源（連線、執行緒等）。

**回傳：** 無（`void`）

---

<a id="spider-017"></a>

### 回傳資料結構

所有方法（`proxy` 除外）的回傳值均為 JSON 字串，解析後對應以下物件。

---

<a id="spider-018"></a>

#### Result — 通用回傳物件

不同方法使用的欄位不同，以下按方法分組說明。

**homeContent：**

| JSON 欄位   | 類型             | 說明                                                                     |
|-----------|----------------|------------------------------------------------------------------------|
| `class`   | `array<Class>` | 分類列表。詳見 [Class](#spider-020)。                                         |
| `filters` | `object`       | 篩選器定義，key 為 `type_id`，value 為 `Filter` 陣列。詳見 [Filter](#spider-021)。 |

**homeVideoContent / categoryContent / detailContent / searchContent：**

| JSON 欄位     | 類型           | 說明                                         |
|-------------|--------------|--------------------------------------------|
| `list`      | `array<Vod>` | 影片卡片列表。詳見 [Vod](#spider-019)。             |
| `pagecount` | `integer`    | 總頁數（`categoryContent`、`searchContent` 使用）。 |

**playerContent：**

| JSON 欄位    | 類型               | 說明                                                                                 |
|------------|------------------|------------------------------------------------------------------------------------|
| `url`      | `string`         | 實際播放媒體 URL。                                                                        |
| `parse`    | `integer`        | `0` = 直接播放，`1` = 需進一步解析（預設 `0`）。`jx=1` 效果相同。                                       |
| `jx`       | `integer`        | 同 `parse=1`，需進一步解析（兩者任一為 `1` 即觸發解析流程）。                                             |
| `playUrl`  | `string`         | 解析器前綴或指定。`json:…` 傳入 JSON 解析器，`parse:解析器名稱` 指定具名解析器，其他值作為解析 URL 前綴。                |
| `key`      | `string`         | 來源 `key`，用於從配置查找對應 `Site.click`。當爬蟲未回傳 `click` 時，框架以此 key 從 VodConfig 取得 click。    |
| `click`    | `string`         | 點擊攔截處理 URL，傳遞給解析器 WebView 執行點擊動作。                                                  |
| `code`     | `integer`        | 非零時抑制 `msg` 顯示（通常用於錯誤狀態碼）。                                                         |
| `header`   | `object`         | 播放請求的額外 HTTP 標頭，鍵值對格式。                                                             |
| `flag`     | `string`         | 播放來源旗標名稱，覆蓋原始 `flag` 參數。                                                           |
| `jxFrom`   | `string`         | 強制指定解析器旗標（覆蓋 `flag` 的解析器比對結果）。                                                     |
| `format`   | `string`         | 媒體 MIME type（如 `"application/x-mpegURL"`、`"application/dash+xml"`），指定後播放器跳過格式自動偵測。 |
| `danmaku`  | `array<Danmaku>` | 彈幕資料列表，詳見 [Danmaku](#spider-022)。                                               |
| `subs`     | `array<Sub>`     | 字幕列表，詳見 [Sub](#spider-023)。                                                         |
| `drm`      | `Drm`            | DRM 版權保護設定，詳見 [Drm](#spider-024)。                                               |
| `artwork`  | `string`         | 播放頁面封面圖 URL。                                                                       |
| `desc`     | `string`         | 播放頁面描述文字。                                                                          |
| `position` | `long`           | 播放恢復位置（毫秒）。                                                                        |
| `lrc`      | `string`         | 歌詞 URL（音樂類來源使用）。                                                                   |

**通用欄位（所有 JSON 回傳方法）：**

| JSON 欄位 | 類型       | 說明       |
|---------|----------|----------|
| `msg`   | `string` | 錯誤或提示訊息。 |

---

<a id="spider-019"></a>

#### Vod — 影片卡片物件

`list` 陣列中的每個元素。

| JSON 欄位         | 類型        | 說明                                                                                            |
|-----------------|-----------|-----------------------------------------------------------------------------------------------|
| `vod_id`        | `string`  | **影片唯一 ID**，傳入 `detailContent` 的 `ids` 參數。                                                    |
| `vod_name`      | `string`  | 影片顯示名稱（支援 HTML 編碼）。                                                                           |
| `vod_pic`       | `string`  | 縮圖 URL。                                                                                       |
| `vod_remarks`   | `string`  | 備註標籤，顯示在縮圖上（如 `"更新至12集"`、`"HD"`）。                                                             |
| `type_name`     | `string`  | 所屬分類名稱（用於分類過濾）。                                                                               |
| `vod_year`      | `string`  | 年份。                                                                                           |
| `vod_area`      | `string`  | 地區。                                                                                           |
| `vod_director`  | `string`  | 導演。                                                                                           |
| `vod_actor`     | `string`  | 演員。                                                                                           |
| `vod_content`   | `string`  | 簡介/描述。                                                                                        |
| `vod_play_from` | `string`  | 播放來源名稱，多個來源以 `$$$` 分隔。                                                                        |
| `vod_play_url`  | `string`  | 播放集數 URL，格式詳見[下方說明](#spider-025)。                                      |
| `vod_tag`       | `string`  | 特殊標記。`"folder"` 表示此項為資料夾，點擊後以 `vod_id` 作為 `tid` 呼叫 `categoryContent` 取得子列表。                   |
| `action`        | `string`  | 自訂動作字串，點擊時優先於資料夾行為觸發。type==3 呼叫 `Spider.action(action)`，type==4 發送 HTTP 請求，結果以 Toast 顯示。      |
| `cate`          | `Cate`    | 資料夾顯示樣式物件，包含 `land`、`circle`、`ratio` 三個子欄位（含義同下方三欄）。設定此欄位等同於 `vod_tag: "folder"`，即自動將此項視為資料夾。 |
| `land`          | `integer` | 橫向顯示旗標，覆蓋 [Class](#spider-020) 層級的 `land` 設定。                                                |
| `circle`        | `integer` | 圓形顯示旗標，覆蓋 [Class](#spider-020) 層級的 `circle` 設定。                                              |
| `ratio`         | `float`   | 卡片寬高比，覆蓋 [Class](#spider-020) 層級的 `ratio` 設定。                                                |
| `style`         | `Style`   | 此影片卡片的顯示樣式覆蓋，詳見 [CONFIG.md](#legacy-config)。                                                       |

---

<a id="spider-020"></a>

#### Class — 分類物件

`class` 陣列中的每個元素。

| JSON 欄位     | 類型        | 說明                                                 |
|-------------|-----------|----------------------------------------------------|
| `type_id`   | `string`  | 分類唯一 ID，傳入 `categoryContent` 的 `tid` 參數。可縮寫為 `id`。 |
| `type_name` | `string`  | 分類顯示名稱。可縮寫為 `name`。                                |
| `type_flag` | `string`  | `"1"` 表示此分類為資料夾類型。                                 |
| `land`      | `integer` | 此分類下影片的橫向顯示旗標。                                     |
| `circle`    | `integer` | 此分類下影片的圓形顯示旗標。                                     |
| `ratio`     | `float`   | 此分類下影片卡片的寬高比。                                      |

---

<a id="spider-021"></a>

#### Filter — 篩選器物件

`filters` 為一個物件，key 為 `type_id`，value 為 `Filter` 陣列，每個 `Filter` 定義一個篩選維度。

```json
{
  "filters": {
    "1": [
      {
        "key": "area",
        "name": "地區",
        "value": [
          {"n": "全部", "v": ""},
          {"n": "大陸", "v": "大陸"},
          {"n": "美國", "v": "美國"}
        ]
      },
      {
        "key": "year",
        "name": "年份",
        "value": [
          {"n": "全部", "v": ""},
          {"n": "2024", "v": "2024"}
        ]
      }
    ]
  }
}
```

**Filter 欄位：**

| JSON 欄位 | 類型       | 說明                                              |
|---------|----------|-------------------------------------------------|
| `key`   | `string` | 篩選器 ID，作為 `categoryContent` 的 `extend` 參數的 key。 |
| `name`  | `string` | 篩選器顯示名稱。                                        |
| `init`  | `string` | 預設選中的選項 value（選填）。                              |
| `value` | `array`  | 可選項目列表，每項含 `n`（顯示名稱）與 `v`（傳入值）。                 |

使用者選擇後，`extend` 傳入格式為：

```json
{
  "area": "大陸",
  "year": "2024"
}
```

---

<a id="spider-022"></a>

#### Danmaku — 彈幕物件

`danmaku` 陣列中的每個元素。

| JSON 欄位 | 類型       | 說明                           |
|---------|----------|------------------------------|
| `url`   | `string` | 彈幕來源 URL（必填），支援本地路徑（`/` 開頭）。 |
| `name`  | `string` | 顯示名稱（選填），省略時使用 `url`。        |

---

<a id="spider-023"></a>

#### Sub — 字幕物件

`subs` 陣列中的每個元素。

| JSON 欄位  | 類型        | 說明                                                                                                                         |
|----------|-----------|----------------------------------------------------------------------------------------------------------------------------|
| `url`    | `string`  | 字幕檔 URL（必填）。                                                                                                               |
| `name`   | `string`  | 顯示名稱（選填）。                                                                                                                  |
| `lang`   | `string`  | 語言代碼（選填，如 `"zh-tw"`、`"en"`）。                                                                                               |
| `format` | `string`  | MIME 類型（選填），常用值：`"text/x-ssa"`、`"application/x-subrip"`。省略時框架依副檔名自動偵測。                                                     |
| `flag`   | `integer` | ExoPlayer `C.SELECTION_FLAG_*` 常數（選填）。`0` 或省略時預設為 `SELECTION_FLAG_DEFAULT`（自動選擇）；`2` = `SELECTION_FLAG_FORCED`（強制顯示，不可關閉）。 |

---

<a id="spider-024"></a>

#### Drm — DRM 設定物件

`drm` 物件欄位。

| JSON 欄位    | 類型        | 說明                                                     |
|------------|-----------|--------------------------------------------------------|
| `type`     | `string`  | DRM 類型：`"widevine"`、`"playready"`、`"clearkey"`。        |
| `key`      | `string`  | License Server URL（Widevine/PlayReady）或 ClearKey 金鑰字串。 |
| `header`   | `object`  | License 請求的額外 HTTP 標頭，鍵值對格式（選填）。                       |
| `forceKey` | `boolean` | `true` = 強制使用預設 License URI（選填，預設 `false`）。            |

---

<a id="spider-025"></a>

#### 播放集數格式（vod_play_from / vod_play_url）

`detailContent` 回傳的 `Vod` 物件中，集數資訊以特定分隔符號編碼在兩個字串欄位中。

| 符號    | 用途              |
|-------|-----------------|
| `$$$` | 分隔多個播放來源（group） |
| `#`   | 分隔同一來源下的集數      |
| `$`   | 分隔集數名稱與集數 URL   |

**範例：**

```
vod_play_from: "線路一$$$線路二"

vod_play_url:  "第01集$https://cdn1.example.com/ep1.m3u8#第02集$https://cdn1.example.com/ep2.m3u8$$$第01集$https://cdn2.example.com/ep1.m3u8#第02集$https://cdn2.example.com/ep2.m3u8"
```

對應解析結果：

```
線路一:
  - 第01集 → https://cdn1.example.com/ep1.m3u8
  - 第02集 → https://cdn1.example.com/ep2.m3u8

線路二:
  - 第01集 → https://cdn2.example.com/ep1.m3u8
  - 第02集 → https://cdn2.example.com/ep2.m3u8
```

集數 URL 的 value 部分即為 `playerContent` 的 `id` 參數。

---

<a id="spider-026"></a>

### 完整 JSON 範例

<a id="spider-027"></a>

#### homeContent 回傳範例

```json
{
  "class": [
    {
      "type_id": "1",
      "type_name": "電影"
    },
    {
      "type_id": "2",
      "type_name": "電視劇"
    },
    {
      "type_id": "3",
      "type_name": "綜藝"
    },
    {
      "type_id": "4",
      "type_name": "動漫"
    }
  ],
  "filters": {
    "1": [
      {
        "key": "area",
        "name": "地區",
        "value": [
          {"n": "全部", "v": ""},
          {"n": "大陸", "v": "大陸"},
          {"n": "香港", "v": "香港"},
          {"n": "台灣", "v": "台灣"},
          {"n": "美國", "v": "美國"}
        ]
      },
      {
        "key": "year",
        "name": "年份",
        "value": [
          {"n": "全部", "v": ""},
          {"n": "2025", "v": "2025"},
          {"n": "2024", "v": "2024"}
        ]
      }
    ]
  }
}
```

---

<a id="spider-028"></a>

#### homeVideoContent / categoryContent 回傳範例

> `categoryContent` 和 `searchContent` 可額外回傳 `pagecount`；`homeVideoContent` 無此欄位。

```json
{
  "list": [
    {
      "vod_id": "12345",
      "vod_name": "範例電影",
      "vod_pic": "https://example.com/pic/12345.jpg",
      "vod_remarks": "HD",
      "type_name": "電影"
    },
    {
      "vod_id": "67890",
      "vod_name": "範例電視劇",
      "vod_pic": "https://example.com/pic/67890.jpg",
      "vod_remarks": "更新至12集",
      "type_name": "電視劇"
    }
  ],
  "pagecount": 10
}
```

---

<a id="spider-029"></a>

#### detailContent 回傳範例

```json
{
  "list": [
    {
      "vod_id": "12345",
      "vod_name": "範例電影",
      "vod_pic": "https://example.com/pic/12345.jpg",
      "vod_year": "2024",
      "vod_area": "大陸",
      "vod_director": "張三",
      "vod_actor": "李四, 王五",
      "vod_content": "這是一部精彩的電影...",
      "vod_remarks": "HD",
      "type_name": "電影",
      "vod_play_from": "線路一$$$線路二",
      "vod_play_url": "正片$https://cdn1.example.com/movie.m3u8$$$正片$https://cdn2.example.com/movie.m3u8"
    }
  ]
}
```

**多集電視劇範例：**

```json
{
  "list": [
    {
      "vod_id": "67890",
      "vod_name": "範例電視劇",
      "vod_play_from": "主線路$$$備用線路",
      "vod_play_url": "第01集$https://cdn1.example.com/ep1.m3u8#第02集$https://cdn1.example.com/ep2.m3u8$$$第01集$https://cdn2.example.com/ep1.m3u8#第02集$https://cdn2.example.com/ep2.m3u8"
    }
  ]
}
```

---

<a id="spider-030"></a>

#### playerContent 回傳範例

**直接播放（無需解析）：**

```json
{
  "parse": 0,
  "url": "https://cdn.example.com/video/ep1.m3u8",
  "header": {
    "User-Agent": "Mozilla/5.0",
    "Referer": "https://www.example.com/"
  }
}
```

**需要進一步解析（VIP 影片）：**

```json
{
  "parse": 1,
  "url": "https://www.youku.com/video/id_xxx.html",
  "flag": "youku"
}
```

**含字幕與彈幕：**

```json
{
  "parse": 0,
  "url": "https://cdn.example.com/video/ep1.m3u8",
  "header": {
    "Referer": "https://www.example.com/"
  },
  "subs": [
    {
      "name": "繁體中文",
      "url": "https://cdn.example.com/sub/ep1.zh-tw.srt",
      "lang": "zh-tw"
    },
    {
      "name": "英文",
      "url": "https://cdn.example.com/sub/ep1.en.srt",
      "lang": "en"
    }
  ],
  "danmaku": [
    {
      "url": "https://danmaku.example.com/ep1.xml"
    }
  ]
}
```

---

<a id="spider-031"></a>

#### searchContent 回傳範例

```json
{
  "list": [
    {
      "vod_id": "12345",
      "vod_name": "範例電影",
      "vod_pic": "https://example.com/pic/12345.jpg",
      "vod_remarks": "HD",
      "type_name": "電影"
    }
  ]
}
```

---

<a id="spider-032"></a>

#### liveContent 回傳範例

**TXT 格式：**

```
央視頻道,#genre#
CCTV1,http://example.com/cctv1.m3u8#http://cdn2.example.com/cctv1.m3u8
CCTV2,http://example.com/cctv2.m3u8
台灣頻道,#genre#
TVBS,http://example.com/tvbs.m3u8
```

**M3U 格式：**

```
#EXTM3U
#EXTINF:-1 tvg-name="CCTV1" group-title="央視頻道",CCTV1
http://example.com/cctv1.m3u8
```

**JSON 格式：**

```json
[
  {
    "name": "央視頻道",
    "channel": [
      {
        "name": "CCTV1",
        "urls": [
          "http://example.com/cctv1.m3u8"
        ]
      }
    ]
  }
]
```

---

<a id="spider-033"></a>

### 爬蟲本地代理 URL

爬蟲可在回傳的媒體 URL 中使用 `proxy://` 協議，將請求導向本地代理伺服器，由對應語言的 `proxy()`
方法處理。這樣可以在播放器無法直接存取來源時，讓爬蟲居中轉發資料。

| 語言         | 回傳 URL 前綴        | 取得代理 URL 的方法                  |
|------------|------------------|-------------------------------|
| Java（JAR）  | `proxy://`       | `Proxy.getUrl(boolean local)` |
| Python     | `proxy://?do=py` | `getProxyUrl(boolean local)`  |
| JavaScript | `proxy://?do=js` | `getProxy(boolean local)`     |

> `local` 參數：`true` 取得本地（`127.0.0.1`）代理位址，`false` 取得可對外存取的 LAN IP 位址。

完整端點說明見 [LOCAL.md — /proxy](#local-023)。

**使用範例（Java）：**

```java
@Override
public String playerContent(String flag, String id, List<String> vipFlags) throws Exception {
    String proxyUrl = Proxy.getUrl(true) + "?url=" + URLEncoder.encode(id, "UTF-8") + "&token=xxx";
    return "{\"parse\":0,\"url\":\"" + proxyUrl + "\"}";
}

@Override
public Object[] proxy(Map<String, String> params) throws Exception {
    String url = params.get("url");
    String token = params.get("token");
    InputStream stream = fetchWithAuth(url, token);
    return new Object[]{200, "video/mp2t", stream};
}
```


---

<a id="legacy-config"></a>

## 附录 B：上游配置历史文档

本文件說明 Vod（點播）與 Live（直播）配置檔案的 JSON 結構與各欄位意義。

---

<a id="config-001"></a>

### 目錄

- [Vod 配置（VodConfig）](#config-002)
    - [頂層欄位](#config-003)
    - [sites — 點播來源](#config-004)
    - [parses — 解析規則](#config-005)
    - [lives — 直播來源](#config-006)
- [Live 配置（LiveConfig）](#config-007)
    - [頂層欄位](#config-008)
    - [groups — 頻道分組](#config-009)
    - [channel — 頻道項目](#config-010)
- [共用欄位物件](#config-011)
    - [doh — DNS over HTTPS](#config-012)
    - [proxy — 代理伺服器](#config-013)
    - [rules — 網路攔截規則](#config-014)
    - [headers — 注入回應標頭](#config-015)
    - [hosts — DNS 解析覆蓋](#config-016)
    - [ads — 廣告過濾](#config-017)
    - [catchup — 追看/時移](#config-018)
    - [style — 卡片樣式](#config-019)
- [完整範例](#config-025)

---

<a id="config-002"></a>

### Vod 配置（VodConfig）

Vod 配置為一個 JSON 物件，作為應用程式的主要配置入口。配置可透過 URL、本地路徑或直接貼入字串的方式載入。

<a id="config-003"></a>

#### 頂層欄位

| 欄位          | 類型              | 說明                                                             |
|-------------|-----------------|----------------------------------------------------------------|
| `spider`    | `string`        | 全局 Spider JAR 路徑或 URL，提供給所有 `sites` 作為預設爬蟲。支援相對路徑（`./`、`../`）。 |
| `wallpaper` | `string`        | 桌布圖片或影片的路徑/URL。支援靜態圖、GIF、影片格式。                                 |
| `logo`      | `string`        | 應用程式 Logo 圖片路徑/URL。                                            |
| `notice`    | `string`        | 啟動公告文字，將顯示給使用者。                                                |
| `sites`     | `array<Site>`   | 點播來源清單。詳見 [sites](#config-004)。                               |
| `parses`    | `array<Parse>`  | 影片解析規則清單。詳見 [parses](#config-005)。                           |
| `lives`     | `array<Live>`   | 直播來源清單。詳見 [lives — 直播來源](#config-006)。                        |
| `doh`       | `array<Doh>`    | DNS over HTTPS 設定清單。詳見 [doh](#config-012)。            |
| `proxy`     | `array<Proxy>`  | 代理伺服器設定清單。詳見 [proxy](#config-013)。                           |
| `rules`     | `array<Rule>`   | 網路攔截規則清單。詳見 [rules](#config-014)。                           |
| `headers`   | `array<Header>` | 針對特定主機注入 HTTP 回應標頭。詳見 [headers](#config-015)。             |
| `hosts`     | `array<string>` | DNS 解析覆蓋規則。詳見 [hosts](#config-016)。                       |
| `flags`     | `array<string>` | 平台標示旗標，用於標記特殊平台處理（如 `"qq"`）。                                   |
| `ads`       | `array<string>` | 廣告域名過濾清單，符合的請求將被攔截。詳見 [ads](#config-017)。                       |
| `danmaku`   | `string`        | 彈幕 API URL，用於自動搜尋彈幕。詳見 [danmaku](#config-020)。            |

---

<a id="config-004"></a>

#### sites — 點播來源

`sites` 為 `Site` 物件陣列，每個物件代表一個點播來源。

| 欄位            | 類型              | 說明                                        |
|---------------|-----------------|-------------------------------------------|
| `key`         | `string`        | 來源唯一識別碼，作為主鍵使用，不可重複。                      |
| `name`        | `string`        | 來源顯示名稱。                                   |
| `type`        | `integer`       | 來源類型，決定呼叫方式。詳見下表。                         |
| `api`         | `string`        | API 端點 URL 或爬蟲類別名稱（如 `csp_Push`）。         |
| `ext`         | `string`        | 額外擴充資料，傳入爬蟲 `init()` 使用。可為字串、JSON 物件或路徑。  |
| `jar`         | `string`        | 指定此來源使用的 Spider JAR 路徑/URL，覆蓋全局 `spider`。 |
| `click`       | `string`        | 點擊攔截處理 URL 或規則。                           |
| `playUrl`     | `string`        | 播放 URL 前綴或轉換規則。                           |
| `hide`        | `integer`       | `1` 表示在來源列表中隱藏此項目。                        |
| `timeout`     | `integer`       | 請求逾時秒數，覆蓋預設值。                             |
| `searchable`  | `integer`       | 搜尋開關。`0`=停用，`1`=啟用（預設）。                   |
| `changeable`  | `integer`       | 線路切換開關。`0`=停用，`1`=啟用（預設）。                 |
| `quickSearch` | `integer`       | 快速搜尋開關。`0`=停用，`1`=啟用。                     |
| `indexs`      | `integer`       | 索引模式旗標。`1` 表示此來源作為索引來源使用。                 |
| `categories`  | `array<string>` | 顯示的分類名稱白名單，僅顯示清單中的分類。                     |
| `header`      | `object`        | 此來源請求時附加的 HTTP 標頭，格式為鍵值對。                 |
| `style`       | `Style`         | 卡片顯示樣式。詳見 [style](#config-019)。          |

**`type` 可選值：**

| `type` | `api` 格式                              | 說明                                                               |
|--------|---------------------------------------|------------------------------------------------------------------|
| `0`    | HTTP URL                              | 直接 GET 請求，回傳 XML 格式（`ac=videolist`）。                             |
| `1`    | HTTP URL                              | 直接 GET 請求，回傳 JSON 格式，額外支援 Filter 篩選參數（`f=`）。                     |
| `3`    | `csp_ClassName` / `xxx.js` / `xxx.py` | 爬蟲直接呼叫：JAR（DexClassLoader）、JavaScript（QuickJS）、Python（Chaquopy）。 |
| `4`    | HTTP URL                              | 同 `1`，`ext` 擴充參數以 Base64 編碼傳遞（`ext=`）。                           |

**範例：**

```json
{
  "key": "my_source",
  "name": "我的來源",
  "type": 3,
  "api": "csp_XYZ",
  "ext": "./ext.json",
  "searchable": 1,
  "changeable": 1,
  "timeout": 30,
  "header": {
    "User-Agent": "Mozilla/5.0"
  },
  "style": {
    "type": "rect",
    "ratio": 1.33
  }
}
```

---

<a id="config-005"></a>

#### parses — 解析規則

`parses` 為 `Parse` 物件陣列，定義影片 URL 的解析處理規則。

| 欄位           | 類型              | 說明                                       |
|--------------|-----------------|------------------------------------------|
| `name`       | `string`        | 解析器顯示名稱。                                 |
| `type`       | `integer`       | 解析器類型。詳見下表。                              |
| `url`        | `string`        | 解析 API 端點 URL，通常以待解析的影片 URL 作為後綴參數。      |
| `ext`        | `Parse.Ext`     | 解析器擴充設定物件。                               |
| `ext.flag`   | `array<string>` | 適用旗標清單，標示此解析器適用的平台（如 `["qq", "iqiyi"]`）。 |
| `ext.header` | `object`        | 解析請求時附加的 HTTP 標頭，格式為鍵值對。                 |

**`parses.type` 可選值：**

| `type` | 說明                                   |
|--------|--------------------------------------|
| `0`    | 嗅探（WebView 攔截媒體 URL）                 |
| `1`    | JSON API（GET 請求，取回應的 `url` 欄位）       |
| `2`    | JSON 擴展（將所有 type=1 的解析器合併後送入 JAR 處理） |
| `3`    | JSON 聚合（將所有解析器資訊合併後送入 JAR 處理）        |
| `4`    | 超級解析（自動並行嘗試所有 type=0/1 的解析器）         |

**範例：**

```json
{
  "name": "通用解析",
  "type": 1,
  "url": "https://api.example.com/parse?url=",
  "ext": {
    "flag": [
      "qq",
      "youku"
    ],
    "header": {
      "Referer": "https://www.example.com/"
    }
  }
}
```

<a id="config-006"></a>

#### lives — 直播來源

Vod 配置中的 `lives` 欄位用於指向外部直播配置或內嵌直播資訊。每個物件為一個 `Live` 來源，欄位定義與 [Live 配置頂層欄位](#config-008) 相同。

常見用法為指定 `url` 指向外部 `live.json`，或直接內嵌 `groups` 頻道資料。

---

<a id="config-007"></a>

### Live 配置（LiveConfig）

Live 配置可以是獨立的 JSON 檔案，或內嵌於 Vod 配置的 `lives` 陣列中。

獨立的 `live.json` 頂層支援以下欄位：

| 欄位        | 類型              | 說明                                              |
|-----------|-----------------|-------------------------------------------------|
| `spider`  | `string`        | 全局 Spider JAR 路徑，提供給所有 `lives` 作為預設爬蟲。          |
| `lives`   | `array<Live>`   | 直播來源清單，欄位定義見下表。                                 |
| `proxy`   | `array<Proxy>`  | 代理設定，同 Vod 配置。詳見 [proxy](#config-013)。        |
| `rules`   | `array<Rule>`   | 攔截規則，同 Vod 配置。詳見 [rules](#config-014)。       |
| `headers` | `array<Header>` | 注入標頭，同 Vod 配置。詳見 [headers](#config-015)。   |
| `hosts`   | `array<string>` | DNS 覆蓋規則，同 Vod 配置。詳見 [hosts](#config-016)。 |
| `ads`     | `array<string>` | 廣告過濾清單，同 Vod 配置。詳見 [ads](#config-017)。           |

<a id="config-008"></a>

#### 頂層欄位

`lives` 陣列中每個 `Live` 物件的欄位：

| 欄位         | 類型             | 說明                                                                                                  |
|------------|----------------|-----------------------------------------------------------------------------------------------------|
| `name`     | `string`       | 直播來源名稱，作為主鍵使用，不可重複。                                                                                 |
| `url`      | `string`       | 外部直播列表 URL（M3U、TXT 或 JSON 格式）。與 `groups` 二擇一。                                                       |
| `api`      | `string`       | 直播 API 端點或爬蟲類別名稱。                                                                                   |
| `ext`      | `string`       | 傳入直播爬蟲的額外擴充資料。                                                                                      |
| `jar`      | `string`       | 此直播來源使用的 Spider JAR 路徑/URL。                                                                         |
| `click`    | `string`       | 點擊攔截處理 URL 或規則。                                                                                     |
| `logo`     | `string`       | 頻道預設 Logo 圖片 URL，支援 `{id}`、`{name}`、`{logo}` 變數替換。                                                  |
| `epg`      | `string`       | EPG 節目表 URL，多個以逗號分隔。支援 `{id}`、`{name}`、`{epg}` 變數替換；含 `xml`/`gz` 的條目作為 XMLTV 來源，含 `{` 的條目作為 API 範本。 |
| `ua`       | `string`       | 預設 User-Agent 字串。                                                                                   |
| `origin`   | `string`       | 請求 `Origin` 標頭值。                                                                                    |
| `referer`  | `string`       | 請求 `Referer` 標頭值。                                                                                   |
| `timeZone` | `string`       | 時區設定，用於 EPG 時間顯示（如 `"Asia/Taipei"`）。                                                                |
| `timeout`  | `integer`      | 請求逾時秒數。                                                                                             |
| `header`   | `object`       | 此來源請求時附加的 HTTP 標頭，格式為鍵值對。                                                                           |
| `catchup`  | `Catchup`      | 追看/時移設定，作為此來源所有頻道的預設值。詳見 [catchup](#config-018)。                                                 |
| `groups`   | `array<Group>` | 直播頻道分組清單（內嵌方式）。詳見 [groups](#config-009)。                                                          |
| `boot`     | `boolean`      | 是否在應用啟動時自動選中此直播來源。多個來源設定時，最後一個生效。                                                                   |
| `pass`     | `boolean`      | `true` 表示略過密碼保護，強制顯示此來源所有分組（含設有密碼的隱藏分組）。                                                            |

**範例：**

```json
{
  "name": "我的直播",
  "url": "./live.m3u",
  "epg": "https://epg.example.com/api?id={id},https://epg.example.com/xmltv.xml.gz",
  "ua": "Mozilla/5.0",
  "timeZone": "Asia/Taipei",
  "boot": true
}
```

---

<a id="config-009"></a>

#### groups — 頻道分組

`groups` 為 `Group` 物件陣列，將頻道組織為分組顯示。

| 欄位        | 類型               | 說明                                      |
|-----------|------------------|-----------------------------------------|
| `name`    | `string`         | 分組顯示名稱。                                 |
| `pass`    | `string`         | 分組密碼，設定後需輸入密碼才能瀏覽此分組。                   |
| `channel` | `array<Channel>` | 此分組下的頻道清單。詳見 [channel](#config-010)。 |

**範例：**

```json
{
  "name": "新聞台",
  "channel": [
    {
      "name": "TVBS新聞台",
      "urls": [
        "http://example.com/tvbs.m3u8"
      ]
    },
    {
      "name": "民視新聞",
      "urls": [
        "http://example.com/ftv.m3u8"
      ]
    }
  ]
}
```

---

<a id="config-010"></a>

#### channel — 頻道項目

`channel` 為 `Channel` 物件陣列，每個物件代表一個直播頻道。

| 欄位        | 類型              | 說明                                                                                                                 |
|-----------|-----------------|--------------------------------------------------------------------------------------------------------------------|
| `name`    | `string`        | 頻道顯示名稱。                                                                                                            |
| `urls`    | `array<string>` | 頻道播放 URL 清單，支援多個備用線路，依序嘗試。每條 URL 可附加 `$線路名稱` 後綴指定顯示名稱（如 `"http://cdn1.example.com/hbo.m3u8$CDN1"`）；省略時自動顯示為「線路 N」。 |
| `number`  | `string`        | 頻道號碼（顯示用）。                                                                                                         |
| `logo`    | `string`        | 頻道 Logo 圖片 URL，覆蓋來源預設值。                                                                                            |
| `epg`     | `string`        | 此頻道專屬 EPG URL，覆蓋來源預設 EPG。                                                                                          |
| `ua`      | `string`        | 此頻道播放請求的 User-Agent，覆蓋來源預設值。                                                                                       |
| `click`   | `string`        | 點擊攔截處理。                                                                                                            |
| `format`  | `string`        | 指定媒體 MIME type，直接傳入播放器。常用值：`"application/x-mpegURL"`（HLS）。                                                         |
| `origin`  | `string`        | 請求 `Origin` 標頭值，覆蓋來源預設值。                                                                                           |
| `referer` | `string`        | 請求 `Referer` 標頭值，覆蓋來源預設值。                                                                                          |
| `tvgId`   | `string`        | TVG 格式 EPG 頻道 ID。                                                                                                  |
| `tvgName` | `string`        | TVG 格式 EPG 頻道名稱。                                                                                                   |
| `header`  | `object`        | 此頻道請求的額外 HTTP 標頭，格式為鍵值對。                                                                                           |
| `parse`   | `integer`       | 是否需要解析此頻道 URL。`0`=不解析，`1`=解析。                                                                                      |
| `catchup` | `Catchup`       | 此頻道的追看/時移設定，覆蓋分組及來源預設值。詳見 [catchup](#config-018)。                                                               |
| `drm`     | `Drm`           | DRM 版權保護設定。欄位同 [playerContent 回傳的 `drm` 物件](#legacy-spider)。                                                            |

**範例：**

```json
{
  "name": "HBO",
  "urls": [
    "http://cdn1.example.com/hbo.m3u8",
    "http://cdn2.example.com/hbo.m3u8"
  ],
  "number": "601",
  "logo": "https://example.com/logo/hbo.png",
  "ua": "Mozilla/5.0",
  "header": {
    "Referer": "https://www.example.com/"
  },
  "catchup": {
    "type": "append",
    "source": "?playseek=${(b)yyyyMMddHHmmss}-${(e)yyyyMMddHHmmss}"
  }
}
```

---

<a id="config-011"></a>

### 共用欄位物件

以下物件可在 Vod 配置或 Live 配置的對應陣列欄位中使用。

> `doh` 僅 Vod 配置支援，其餘欄位兩者均可使用。

---

<a id="config-012"></a>

#### doh — DNS over HTTPS

設定加密 DNS 解析伺服器，保護 DNS 查詢隱私並防止污染。僅 Vod 配置支援。

| 欄位     | 類型              | 說明                                                    |
|--------|-----------------|-------------------------------------------------------|
| `name` | `string`        | 伺服器顯示名稱。                                              |
| `url`  | `string`        | DoH 查詢端點 URL（如 `https://dns.google/dns-query`）。       |
| `ips`  | `array<string>` | 伺服器本身的 IP 位址清單，用於 Bootstrap 解析，避免 DoH 伺服器本身需要 DNS 查詢。 |

**範例：**

```json
{
  "name": "Google DoH",
  "url": "https://dns.google/dns-query",
  "ips": [
    "8.8.4.4",
    "8.8.8.8"
  ]
}
```

---

<a id="config-013"></a>

#### proxy — 代理伺服器

設定特定域名流量的代理規則。支援 HTTP、HTTPS、SOCKS4、SOCKS5 代理。

**代理 URL 格式：**

```
scheme://username:password@host:port
```

| 協議     | 範例                                  |
|--------|-------------------------------------|
| HTTP   | `http://127.0.0.1:7890`             |
| HTTPS  | `https://127.0.0.1:7890`            |
| SOCKS4 | `socks4://127.0.0.1:1080`           |
| SOCKS5 | `socks5://127.0.0.1:7891`           |
| 帶認證    | `socks5://user:pass@127.0.0.1:7891` |

| 欄位      | 類型              | 說明                              |
|---------|-----------------|---------------------------------|
| `name`  | `string`        | 代理規則顯示名稱。                       |
| `hosts` | `array<string>` | 適用此代理的主機名稱清單，支援正規表示式。靠前的規則優先匹配。 |
| `urls`  | `array<string>` | 代理伺服器 URL 清單（多個時依序嘗試）。          |

**範例：**

```json
{
  "proxy": [
    {
      "name": "指定域名代理",
      "hosts": [
        "googlevideo.com",
        "raw.githubusercontent.com"
      ],
      "urls": [
        "http://127.0.0.1:7890"
      ]
    },
    {
      "name": "全域代理",
      "hosts": [
        ".*"
      ],
      "urls": [
        "socks5://127.0.0.1:7891"
      ]
    }
  ]
}
```

---

<a id="config-014"></a>

#### rules — 網路攔截規則

設定 WebView 或播放器的網路請求攔截與處理規則。

| 欄位        | 類型              | 說明                                              |
|-----------|-----------------|-------------------------------------------------|
| `name`    | `string`        | 規則顯示名稱。                                         |
| `hosts`   | `array<string>` | 觸發此規則的目標主機名稱清單。                                 |
| `regex`   | `array<string>` | 用於擷取播放 URL 的正規表示式清單，符合者視為有效的媒體 URL。             |
| `script`  | `array<string>` | 在 WebView 中執行的 JavaScript 程式碼清單，用於自動點擊、關閉廣告等操作。 |
| `exclude` | `array<string>` | 排除清單，符合此清單的 URL 不觸發 `regex` 擷取。                 |

**範例：**

```json
{
  "rules": [
    {
      "hosts": [
        "video.example.com"
      ],
      "regex": [
        "m3u8?token="
      ],
      "exclude": [
        "preview.json"
      ]
    },
    {
      "hosts": [
        "ads.example.com"
      ],
      "script": [
        "document.querySelector('.close-btn').click()"
      ]
    }
  ]
}
```

---

<a id="config-015"></a>

#### headers — 注入回應標頭

針對特定主機，在 HTTP 回應中注入自訂標頭（通常用於解除 CORS 限制）。

| 欄位       | 類型       | 說明                            |
|----------|----------|-------------------------------|
| `host`   | `string` | 目標主機名稱（不含協議，如 `example.com`）。 |
| `header` | `object` | 要注入的 HTTP 標頭物件，格式為鍵值對。        |

**範例：**

```json
{
  "host": "stream.example.com",
  "header": {
    "Access-Control-Allow-Origin": "*",
    "User-Agent": "okhttp/3.12.13"
  }
}
```

---

<a id="config-016"></a>

#### hosts — DNS 解析覆蓋

覆蓋特定主機名稱的 DNS 解析結果，可用於 CDN 調度或繞過封鎖。支援萬用字元 `*`。

**格式：** `"原始主機名=目標主機名（或 IP）"`

| 欄位     | 類型       | 說明                              |
|--------|----------|---------------------------------|
| （陣列元素） | `string` | 格式為 `"原始主機名=目標主機名"`，支援萬用字元 `*`。 |

**範例：**

```json
{
  "hosts": [
    "stream.example.com=1.2.3.4",
    "old.cdn.example.com=new.cdn.example.com",
    "cache.ott.*.itv.cmvideo.cn=base-v4-free-mghy.e.cdn.chinamobile.com"
  ]
}
```

---

<a id="config-017"></a>

#### ads — 廣告過濾

廣告域名黑名單，符合的 HTTP 請求將被直接攔截拒絕。

| 欄位     | 類型       | 說明      |
|--------|----------|---------|
| （陣列元素） | `string` | 要攔截的域名。 |

**範例：**

```json
{
  "ads": [
    "ads.example.com",
    "tracker.example.net"
  ]
}
```

---

<a id="config-018"></a>

#### catchup — 追看/時移

設定頻道的回看/時移功能，可定義在 `Live`（來源層級）或 `Channel`（頻道層級）。

| 欄位        | 類型       | 說明                                                                                                      |
|-----------|----------|---------------------------------------------------------------------------------------------------------|
| `type`    | `string` | 時移類型。`"append"`（預設）：將格式化後的 `source` 附加至原始 URL 末尾；`"default"`：以格式化後的 `source` 完全替換原始 URL。                |
| `regex`   | `string` | 判斷此追看設定是否適用於當前 URL 的比對條件（子字串或正規表示式）。未設定時只要 `source` 非空即啟用；設定後只有 URL 符合此條件才啟用追看。                         |
| `source`  | `string` | 時移 URL 範本，**非空時才啟用追看功能**。支援 `{(b)格式}`（開始時間）、`{(e)格式}`（結束時間）、`{utc:}`（開始 Unix 秒）、`{utcend:}`（結束 Unix 秒）。 |
| `replace` | `string` | 逗號分隔的替換對（`原字串,新字串`），在組合時移 URL 前先對原始 URL 執行替換。                                                           |

**範例：**

```json
{
  "type": "append",
  "source": "?playseek=${(b)yyyyMMddHHmmss}-${(e)yyyyMMddHHmmss}"
}
```

---

<a id="config-019"></a>

#### style — 卡片樣式

設定 Vod 來源的內容卡片顯示樣式。

| 欄位      | 類型       | 說明                                                  |
|---------|----------|-----------------------------------------------------|
| `type`  | `string` | 卡片類型。可選值：`"rect"`（矩形）、`"oval"`（圓形/橢圓）、`"list"`（列表）。 |
| `ratio` | `float`  | 卡片寬高比（寬度 / 高度）。省略時使用預設比例。                           |

**`ratio` 常用值：**

| `ratio` | 比例   | 用途       |
|---------|------|----------|
| `0.75`  | 3:4  | 直式海報（預設） |
| `1`     | 1:1  | 正方形      |
| `1.33`  | 4:3  | 橫式縮圖     |
| `1.78`  | 16:9 | 寬螢幕縮圖    |

**範例：**

直式（海報，3:4）

```json
{
  "style": {
    "type": "rect"
  }
}
```

橫式（4:3）

```json
{
  "style": {
    "type": "rect",
    "ratio": 1.33
  }
}
```

正方（1:1）

```json
{
  "style": {
    "type": "rect",
    "ratio": 1
  }
}
```

正圓

```json
{
  "style": {
    "type": "oval"
  }
}
```

---

<a id="config-020"></a>

### danmaku — 彈幕 API

`danmaku` 為 VodConfig 頂層字串欄位，指定彈幕搜尋接口。

<a id="config-021"></a>

#### GET 模式（含佔位符）

URL 含 `{name}` 或 `{episode}` 時，以 GET 請求發送，佔位符在請求前替換：

| 佔位符         | 說明   |
|-------------|------|
| `{name}`    | 劇集名稱 |
| `{episode}` | 集數名稱 |

```
https://example.com/danmaku?name={name}&episode={episode}
```

<a id="config-022"></a>

#### POST 模式（不含佔位符）

URL 不含任何佔位符時，改以 POST 請求發送，`name`/`episode` 作為 form 欄位傳入：

```
https://example.com/danmaku
```

POST body：`name=劇集名稱&episode=集數名稱`

<a id="config-023"></a>

#### 回應格式

接口須回傳 JSON 陣列，每個元素為一個彈幕來源物件。

<a id="config-024"></a>

#### 自動搜尋條件

- 設定中「彈幕載入」已開啟（`DanmakuSetting.isLoad()`）
- 設定中「自動載入」已開啟（`DanmakuSetting.isAuto()`）
- 彈幕接口不為空（使用者自訂優先，否則取此欄位）

> **提示：** 使用者也可在設定頁自訂彈幕接口，會優先覆蓋此處的設定。

---

<a id="config-025"></a>

### 完整範例

<a id="config-026"></a>

#### Vod 配置（config.json）

```json
{
  "spider": "./custom_spider.jar",
  "wallpaper": "./wallpaper.jpg",
  "logo": "./logo.jpg",
  "notice": "歡迎使用，本配置僅供測試！",
  "sites": [
    {
      "key": "push_agent",
      "name": "Push",
      "type": 3,
      "api": "csp_Push"
    },
    {
      "key": "my_source",
      "name": "我的影音",
      "type": 3,
      "api": "csp_MySource",
      "ext": "./myext.json",
      "searchable": 1,
      "changeable": 1,
      "timeout": 15,
      "style": {
        "type": "rect",
        "ratio": 1.33
      }
    }
  ],
  "lives": [
    {
      "name": "直播",
      "url": "./live.json",
      "epg": "https://epg.example.com/?ch={name}"
    }
  ],
  "parses": [
    {
      "name": "官方解析",
      "type": 1,
      "url": "https://api.example.com/parse?url="
    }
  ],
  "doh": [
    {
      "name": "Google",
      "url": "https://dns.google/dns-query",
      "ips": [
        "8.8.4.4",
        "8.8.8.8"
      ]
    }
  ],
  "proxy": [
    {
      "name": "指定代理",
      "hosts": [
        "googlevideo.com"
      ],
      "urls": [
        "http://127.0.0.1:7890"
      ]
    }
  ],
  "rules": [
    {
      "hosts": [
        "video.example.com"
      ],
      "regex": [
        "m3u8?token="
      ],
      "exclude": [
        "preview.json"
      ]
    }
  ],
  "headers": [
    {
      "host": "stream.example.com",
      "header": {
        "User-Agent": "okhttp/3.12.13"
      }
    }
  ],
  "hosts": [
    "old.cdn.example.com=new.cdn.example.com"
  ],
  "flags": [
    "qq"
  ],
  "ads": [
    "ads.example.com"
  ]
}
```

<a id="config-027"></a>

#### Live 配置（live.json）

```json
{
  "lives": [
    {
      "name": "台灣頻道",
      "epg": "https://epg.example.com/api?id={id},https://epg.example.com/xmltv.xml.gz",
      "ua": "Mozilla/5.0",
      "timeZone": "Asia/Taipei",
      "boot": true,
      "groups": [
        {
          "name": "新聞台",
          "channel": [
            {
              "name": "TVBS新聞台",
              "number": "56",
              "urls": [
                "http://cdn1.example.com/tvbs.m3u8"
              ],
              "logo": "https://example.com/logo/tvbs.png"
            },
            {
              "name": "民視新聞",
              "number": "52",
              "urls": [
                "http://cdn1.example.com/ftv.m3u8",
                "http://cdn2.example.com/ftv.m3u8"
              ],
              "catchup": {
                "type": "append",
                "source": "?playseek=${(b)yyyyMMddHHmmss}-${(e)yyyyMMddHHmmss}"
              }
            }
          ]
        }
      ]
    }
  ]
}
```


---

<a id="legacy-local"></a>

## 附录 C：上游本地 HTTP API 历史文档

應用程式啟動後會在本地綁定一個 HTTP 伺服器，埠號從 **9978** 開始依序嘗試至 **9998**，取得第一個可用埠。

```
http://127.0.0.1:{port}
```

> 實際埠號依系統可用情況而定，預設起始為 9978。

所有端點支援 GET 與 POST（除特別標注外），參數可放在 Query String 中。回應若無特別說明皆為 `text/plain`，成功回傳 `OK`，失敗回傳 `500` 與錯誤訊息。

---

<a id="local-001"></a>

### 目錄

- [/action — 動作指令](#local-002)
    - [do=control — 播放控制](#local-003)
    - [do=refresh — 刷新指令](#local-005)
    - [do=push — 推送播放](#local-006)
    - [do=file — 開啟檔案](#local-007)
    - [do=search — 觸發搜尋](#local-008)
    - [do=setting — 載入配置](#local-009)
    - [do=cast — 投放媒體](#local-010)
    - [do=sync — 同步資料](#local-011)
- [/cache — 快取操作](#local-012)
- [/media — 播放狀態](#local-016)
- [/file — 本地檔案系統](#local-017)
- [/upload — 上傳檔案](#local-018)
- [/newFolder — 新增資料夾](#local-019)
- [/delFolder — 刪除資料夾](#local-020)
- [/delFile — 刪除檔案](#local-021)
- [/parse — 解析頁面](#local-022)
- [/proxy — 爬蟲代理](#local-023)
- [/device — 裝置資訊](#local-024)
- [端點總覽](#local-025)

---

<a id="local-002"></a>

### /action — 動作指令

透過 `do` 參數分派不同動作。

```
GET/POST http://127.0.0.1:9978/action?do={do}&...
```

---

<a id="local-003"></a>

#### do=control — 播放控制

控制目前播放器的播放狀態。

```
http://127.0.0.1:9978/action?do=control&type={type}
```

| 參數     | 說明        |
|--------|-----------|
| `type` | 控制指令，見下表。 |

**`type` 可選值：**

| `type`   | 說明       |
|----------|----------|
| `play`   | 播放       |
| `pause`  | 暫停       |
| `stop`   | 停止       |
| `replay` | 重新播放     |
| `prev`   | 上一集      |
| `next`   | 下一集      |
| `repeat` | 切換循環播放模式 |

**範例：**

```
http://127.0.0.1:9978/action?do=control&type=play
http://127.0.0.1:9978/action?do=control&type=pause
http://127.0.0.1:9978/action?do=control&type=next
```

---

<a id="local-004"></a>

#### do=danmaku — 發送彈幕

即時發送一條彈幕文字至目前播放器（需播放器支援彈幕）。

```
http://127.0.0.1:9978/action?do=danmaku&text={text}
```

| 參數     | 說明          |
|--------|-------------|
| `text` | 要發送的彈幕文字內容。 |

**範例：**

```
http://127.0.0.1:9978/action?do=danmaku&text=Hello
```

---

<a id="local-005"></a>

#### do=refresh — 刷新指令

觸發應用程式重新載入指定頁面資料，或推送內容至播放器。

```
http://127.0.0.1:9978/action?do=refresh&type={type}&...
```

**`type` 可選值：**

| `type`     | 額外參數   | 說明                                |
|------------|--------|-----------------------------------|
| `live`     | —      | 重新整理直播頁面。                         |
| `detail`   | —      | 重新整理影片詳情頁。                        |
| `player`   | —      | 重新整理播放頁面。                         |
| `subtitle` | `path` | 推送字幕至目前播放器，`path` 為字幕檔 URL。       |
| `danmaku`  | `path` | 推送彈幕至目前播放器，`path` 為彈幕檔 URL。       |
| `vod`      | `json` | 推送 Vod 物件更新，`json` 為 Vod JSON 字串。 |

**範例：**

```
http://127.0.0.1:9978/action?do=refresh&type=detail
http://127.0.0.1:9978/action?do=refresh&type=subtitle&path=http://example.com/sub.srt
http://127.0.0.1:9978/action?do=refresh&type=danmaku&path=http://example.com/danmaku.xml
```

---

<a id="local-006"></a>

#### do=push — 推送播放

推送一個 URL 至應用程式進行播放。

```
http://127.0.0.1:9978/action?do=push&url={url}
```

| 參數    | 說明                    |
|-------|-----------------------|
| `url` | 要播放的媒體 URL（需 URL 編碼）。 |

**範例：**

```
http://127.0.0.1:9978/action?do=push&url=http%3A%2F%2Fexample.com%2Fvideo.m3u8
```

---

<a id="local-007"></a>

#### do=file — 開啟檔案

指定本地檔案路徑，依副檔名執行對應動作。

```
http://127.0.0.1:9978/action?do=file&path={path}
```

| 參數     | 說明         |
|--------|------------|
| `path` | 本地檔案的絕對路徑。 |

**依副檔名的行為：**

| 副檔名                  | 行為            |
|----------------------|---------------|
| `.apk`               | 觸發 APK 安裝流程。  |
| `.srt` `.ssa` `.ass` | 注入字幕至目前播放器。   |
| 其他                   | 觸發設定頁面開啟對應檔案。 |

---

<a id="local-008"></a>

#### do=search — 觸發搜尋

在應用程式介面觸發關鍵字搜尋。

```
http://127.0.0.1:9978/action?do=search&word={word}
```

| 參數     | 說明     |
|--------|--------|
| `word` | 搜尋關鍵字。 |

**範例：**

```
http://127.0.0.1:9978/action?do=search&word=%E9%A3%9F%E7%A5%9E
```

---

<a id="local-009"></a>

#### do=setting — 載入配置

載入配置內容或指定名稱的配置。

```
http://127.0.0.1:9978/action?do=setting&text={text}&name={name}
```

| 參數     | 說明             |
|--------|----------------|
| `text` | 配置內容字串或配置 URL。 |
| `name` | 配置顯示名稱（選填）。    |

---

<a id="local-010"></a>

#### do=cast — 投放媒體

將指定媒體投放至遠端裝置播放。

```
http://127.0.0.1:9978/action?do=cast&config={config}&device={device}&history={history}
```

| 參數        | 說明                                 |
|-----------|------------------------------------|
| `config`  | Config 物件的 JSON 字串，指定要投放的配置。       |
| `device`  | 目標裝置的 Device 物件 JSON 字串（含 IP 等資訊）。 |
| `history` | History 物件的 JSON 字串，包含播放歷史。        |

---

<a id="local-011"></a>

#### do=sync — 同步資料

在多個裝置間同步觀看紀錄（`history`）或收藏清單（`keep`）。

```
POST http://127.0.0.1:9978/action?do=sync&type={type}&device={device}&force={force}&mode={mode}
```

**Query 參數：**

| 參數       | 說明                                         |
|----------|--------------------------------------------|
| `type`   | 同步類型：`"history"`（觀看紀錄）或 `"keep"`（收藏）。      |
| `device` | 目標裝置的 Device 物件 JSON 字串。                   |
| `force`  | `"true"` = 先刪除後合併；其他 = 直接合併。               |
| `mode`   | `"0"` = 雙向（發送+接收）；`"1"` = 僅接收；`"2"` = 僅發送。 |
| `config` | （`history` 用）Config 物件 JSON 字串。            |

**POST Body（`application/x-www-form-urlencoded`）：**

| 參數        | 說明                                |
|-----------|-----------------------------------|
| `targets` | History 或 Keep 物件陣列的 JSON 字串。     |
| `configs` | （`keep` 用）Config URL 陣列的 JSON 字串。 |

---

<a id="local-012"></a>

### /cache — 快取操作

存取應用程式的鍵值快取（基於 SharedPreferences），可用於爬蟲在不同請求間共享資料。

```
GET/POST http://127.0.0.1:9978/cache?do={do}&...
```

**Key 計算規則：** `"cache_" + (rule 為空 ? "" : rule + "_") + key`

---

<a id="local-013"></a>

#### do=get — 讀取快取

```
http://127.0.0.1:9978/cache?do=get&key={key}&rule={rule}
```

| 參數     | 說明                      |
|--------|-------------------------|
| `key`  | 快取鍵名。                   |
| `rule` | 命名空間前綴，用於隔離不同爬蟲的快取（選填）。 |

**回應：** `200 OK`，回傳儲存的字串值（若不存在則為空字串）。

---

<a id="local-014"></a>

#### do=set — 寫入快取

```
http://127.0.0.1:9978/cache?do=set&key={key}&value={value}&rule={rule}
```

| 參數      | 說明          |
|---------|-------------|
| `key`   | 快取鍵名。       |
| `value` | 要儲存的字串值。    |
| `rule`  | 命名空間前綴（選填）。 |

---

<a id="local-015"></a>

#### do=del — 刪除快取

```
http://127.0.0.1:9978/cache?do=del&key={key}&rule={rule}
```

| 參數     | 說明          |
|--------|-------------|
| `key`  | 要刪除的快取鍵名。   |
| `rule` | 命名空間前綴（選填）。 |

---

<a id="local-016"></a>

### /media — 播放狀態

取得目前播放器的媒體資訊與播放狀態。

```
GET http://127.0.0.1:9978/media
```

**回應格式：** `application/json`

**播放器未啟動時：**

```json
{}
```

**播放器啟動時：**

```json
{
  "url": "https://cdn.example.com/video.m3u8",
  "state": 3,
  "speed": 1.0,
  "title": "範例電影",
  "artist": "來源名稱",
  "artwork": "https://example.com/cover.jpg",
  "duration": 7200000,
  "position": 1234567
}
```

**欄位說明：**

| 欄位         | 類型        | 說明                                                       |
|------------|-----------|----------------------------------------------------------|
| `url`      | `string`  | 目前串流 URL，無則為 `""`。                                       |
| `state`    | `integer` | PlaybackStateCompat 狀態碼。`1`=緩衝中，`2`=暫停，`3`=播放中，無則為 `-1`。 |
| `speed`    | `float`   | 播放速率（`1.0` = 正常速度），無則為 `-1`。                             |
| `title`    | `string`  | 媒體標題，無則為 `""`。                                           |
| `artist`   | `string`  | 藝術家或來源名稱，無則為 `""`。                                       |
| `artwork`  | `string`  | 封面圖 URI，無則為 `""`。                                        |
| `duration` | `long`    | 媒體總時長（毫秒），無則為 `-1`。                                      |
| `position` | `long`    | 目前播放位置（毫秒），無則為 `-1`。                                     |

---

<a id="local-017"></a>

### /file — 本地檔案系統

瀏覽或下載應用程式的本地儲存空間。

```
GET http://127.0.0.1:9978/file/{path}
```

| 參數     | 說明                      |
|--------|-------------------------|
| `path` | 相對於應用程式根目錄的路徑。省略時列出根目錄。 |

**目錄回應（JSON）：**

```json
{
  "parent": "videos",
  "files": [
    {
      "name": "movie.mp4",
      "path": "videos/movie.mp4",
      "time": "2025/03/05 12:00:00",
      "dir": 0
    },
    {
      "name": "subtitles",
      "path": "videos/subtitles",
      "time": "2025/03/05 10:00:00",
      "dir": 1
    }
  ]
}
```

**`files` 陣列欄位說明：**

| 欄位     | 類型        | 說明                               |
|--------|-----------|----------------------------------|
| `name` | `string`  | 檔案或目錄名稱。                         |
| `path` | `string`  | 相對於根目錄的路徑。                       |
| `time` | `string`  | 最後修改時間，格式 `yyyy/MM/dd HH:mm:ss`。 |
| `dir`  | `integer` | `1` = 目錄，`0` = 檔案。               |

**`parent` 欄位說明：**

| 值                  | 意義             |
|--------------------|----------------|
| `"."`              | 目前即為根目錄（無上一層）。 |
| `""`               | 上一層為根目錄。       |
| `"path/to/parent"` | 上一層目錄的相對路徑。    |

**檔案回應：** 直接串流檔案內容，支援 Range 請求（`206 Partial Content`）與 ETag 快取（`304 Not Modified`）。

---

<a id="local-018"></a>

### /upload — 上傳檔案

上傳檔案至指定目錄，`.zip` 檔案會自動解壓縮。

```
POST http://127.0.0.1:9978/upload?path={path}
Content-Type: multipart/form-data
```

| 參數     | 說明               |
|--------|------------------|
| `path` | 目標目錄，相對於應用程式根目錄。 |

| 檔案類型   | 行為                   |
|--------|----------------------|
| `.zip` | 解壓縮至 `path` 目錄。      |
| 其他     | 複製至 `path/filename`。 |

---

<a id="local-019"></a>

### /newFolder — 新增資料夾

在指定路徑下建立新目錄。

```
GET http://127.0.0.1:9978/newFolder?path={path}&name={name}
```

| 參數     | 說明                |
|--------|-------------------|
| `path` | 父目錄路徑，相對於應用程式根目錄。 |
| `name` | 要建立的資料夾名稱。        |

---

<a id="local-020"></a>

### /delFolder — 刪除資料夾

刪除指定目錄及其所有內容。

```
GET http://127.0.0.1:9978/delFolder?path={path}
```

| 參數     | 說明                   |
|--------|----------------------|
| `path` | 要刪除的目錄路徑，相對於應用程式根目錄。 |

---

<a id="local-021"></a>

### /delFile — 刪除檔案

刪除指定檔案。

```
GET http://127.0.0.1:9978/delFile?path={path}
```

| 參數     | 說明                   |
|--------|----------------------|
| `path` | 要刪除的檔案路徑，相對於應用程式根目錄。 |

---

<a id="local-022"></a>

### /parse — 解析頁面

將解析器腳本與目標 URL 嵌入 HTML 範本後回傳，通常供 WebView 內使用。

```
GET http://127.0.0.1:9978/parse?jxs={jxs}&url={url}
```

| 參數    | 說明            |
|-------|---------------|
| `jxs` | 解析器腳本識別碼或內容。  |
| `url` | 待解析的媒體頁面 URL。 |

**回應格式：** `text/html`，回傳渲染後的 `parse.html` 頁面。

---

<a id="local-023"></a>

### /proxy — 爬蟲代理

將請求轉發至爬蟲的 `proxy()` 方法處理，供爬蟲自訂回應（如轉發串流、修改標頭等）。

```
GET/POST http://127.0.0.1:9978/proxy?...
```

所有 Query String 參數、請求標頭與 POST Body 會合併後傳入 `BaseLoader.get().proxy(params)`。回應由爬蟲 `proxy()` 決定，框架原封不動地轉發爬蟲回傳的串流與標頭。

爬蟲如何實作 `proxy()` 方法及取得代理 URL，見 [SPIDER.md — 爬蟲本地代理 URL](#spider-033)。

---

<a id="local-024"></a>

### /device — 裝置資訊

取得本機裝置資訊。

```
GET http://127.0.0.1:9978/device
```

**回應格式：** `text/plain`，內容為裝置資訊的 JSON 字串。

**回應欄位：**

| 欄位       | 類型        | 說明                    |
|----------|-----------|-----------------------|
| `uuid`   | `string`  | 裝置唯一識別碼（Android ID）。  |
| `name`   | `string`  | 裝置顯示名稱。               |
| `ip`     | `string`  | 裝置區域網路 IP 位址（含 port）。 |
| `type`   | `integer` | 裝置類型（0=手機, 1=電視）。     |
| `serial` | `string`  | 裝置序號。                 |
| `eth`    | `string`  | 有線網路 MAC 位址。          |
| `wlan`   | `string`  | 無線網路 MAC 位址。          |
| `time`   | `long`    | 回應時間戳（毫秒）。            |

---

<a id="local-025"></a>

### 端點總覽

| 端點                   | 方法       | 主要參數                              | 說明                                            |
|----------------------|----------|-----------------------------------|-----------------------------------------------|
| `/action?do=control` | GET/POST | `type`                            | 播放控制（play/pause/stop/prev/next/repeat/replay） |
| `/action?do=danmaku` | GET/POST | `text`                            | 即時發送一條彈幕至目前播放器                                |
| `/action?do=refresh` | GET/POST | `type`, `path`, `json`            | 刷新頁面或推送字幕/彈幕                                  |
| `/action?do=push`    | GET/POST | `url`                             | 推送 URL 播放                                     |
| `/action?do=file`    | GET/POST | `path`                            | 開啟本地檔案                                        |
| `/action?do=search`  | GET/POST | `word`                            | 觸發關鍵字搜尋                                       |
| `/action?do=setting` | GET/POST | `text`, `name`                    | 載入配置                                          |
| `/action?do=cast`    | GET/POST | `config`, `device`, `history`     | 投放媒體至遠端裝置                                     |
| `/action?do=sync`    | POST     | `type`, `device`, `force`, `mode` | 多裝置資料同步                                       |
| `/cache?do=get`      | GET/POST | `key`, `rule`                     | 讀取快取值                                         |
| `/cache?do=set`      | GET/POST | `key`, `value`, `rule`            | 寫入快取值                                         |
| `/cache?do=del`      | GET/POST | `key`, `rule`                     | 刪除快取值                                         |
| `/media`             | GET      | —                                 | 取得播放狀態 JSON                                   |
| `/file/{path}`       | GET      | —                                 | 瀏覽目錄或下載檔案（支援 Range）                           |
| `/upload`            | POST     | `path`（multipart）                 | 上傳檔案（支援 .zip 解壓）                              |
| `/newFolder`         | GET      | `path`, `name`                    | 建立資料夾                                         |
| `/delFolder`         | GET      | `path`                            | 刪除資料夾                                         |
| `/delFile`           | GET      | `path`                            | 刪除檔案                                          |
| `/parse`             | GET      | `jxs`, `url`                      | 取得渲染後的解析 HTML 頁面                              |
| `/proxy`             | GET/POST | 自訂（轉發至爬蟲）                         | 爬蟲代理轉發                                        |
| `/device`            | GET      | —                                 | 取得裝置資訊                                        |

