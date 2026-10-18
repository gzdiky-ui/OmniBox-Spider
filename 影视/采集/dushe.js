// @name 毒舌03
// @author 梦
// @description 影视站：https://www.dushe03.com/ ，适配当前页面结构，支持首页、分类、详情、搜索与播放
// @dependencies cheerio
// @version 1.1.0
// @downloadURL https://gh-proxy.org/https://github.com/Silent1566/OmniBox-Spider/raw/refs/heads/main/影视/采集/毒舌03.js

const OmniBox = require("omnibox_sdk");
const runner = require("spider_runner");
const cheerio = require("cheerio");
const crypto = require("crypto");

const BASE_URL = (process.env.DUSHE03_HOST || "https://www.dushe03.com").replace(/\/$/, "");
const BASE_ORIGIN = new URL(BASE_URL).origin;
const UA = process.env.DUSHE03_UA || "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36";
const HOME_CACHE_TTL = readCacheTtl("DUSHE03_HOME_CACHE_TTL", 900);
const CATEGORY_CACHE_TTL = readCacheTtl("DUSHE03_CATEGORY_CACHE_TTL", 900);
const DETAIL_CACHE_TTL = readCacheTtl("DUSHE03_DETAIL_CACHE_TTL", 1800);
const SEARCH_CACHE_TTL = readCacheTtl("DUSHE03_SEARCH_CACHE_TTL", 600);
const PLAY_CACHE_TTL = readCacheTtl("DUSHE03_PLAY_CACHE_TTL", 900);
const PLAY_FAILURE_CACHE_TTL = readCacheTtl("DUSHE03_PLAY_FAILURE_CACHE_TTL", 60);
const CDNDEFEND_COOKIE_TTL = readCacheTtl("DUSHE03_CDNDEFEND_COOKIE_TTL", 1800);
const SEARCH_TOKEN_TTL = readCacheTtl("DUSHE03_SEARCH_TOKEN_TTL", 1800);
const PLAY_SCAN_LIMIT = readBoundedInt("DUSHE03_PLAY_SCAN_LIMIT", 8, 1, 20);
const MAX_PAGE = 100000;
const MAX_CACHE_TTL_SECONDS = 7 * 24 * 60 * 60;

const CATEGORY_CONFIG = [
  { id: "1", name: "电影" },
  { id: "2", name: "剧集" },
  { id: "3", name: "综艺" },
  { id: "4", name: "动漫" },
  { id: "6", name: "短剧" },
];

const CLASS_LIST = CATEGORY_CONFIG.map((item) => ({ type_id: item.id, type_name: item.name }));
const CATEGORY_SHOW_PATH = Object.fromEntries(CATEGORY_CONFIG.map((item) => [item.id, `/show/${item.id}------.html`]));
const STATIC_HOST = process.env.DUSHE03_STATIC_HOST || "https://vres.bavdxfg.cn";
const PIC_HEADERS = {
  Referer: `${BASE_URL}/`,
  Origin: BASE_URL,
  "User-Agent": UA,
};
const FILTERS = {
  "1": [
    { key: "type", name: "类型", init: "", value: [{ name: "全部", value: "" }, { name: "剧情", value: "剧情" }, { name: "爱情", value: "爱情" }, { name: "喜剧", value: "喜剧" }, { name: "动作", value: "动作" }, { name: "恐怖", value: "恐怖" }, { name: "科幻", value: "科幻" }, { name: "悬疑", value: "悬疑" }, { name: "惊悚", value: "惊悚" }, { name: "犯罪", value: "犯罪" }, { name: "冒险", value: "冒险" }, { name: "动画", value: "动画" }, { name: "奇幻", value: "奇幻" }, { name: "武侠", value: "武侠" }] },
    { key: "area", name: "地区", init: "", value: [{ name: "地区", value: "" }, { name: "大陆", value: "中国大陆" }, { name: "香港", value: "中国香港" }, { name: "韩国", value: "韩国" }, { name: "美国", value: "美国" }, { name: "日本", value: "日本" }, { name: "法国", value: "法国" }, { name: "英国", value: "英国" }, { name: "德国", value: "德国" }, { name: "台湾", value: "中国台湾" }, { name: "泰国", value: "泰国" }, { name: "印度", value: "印度" }, { name: "其他", value: "其他" }] },
    { key: "lang", name: "语言", init: "", value: [{ name: "全部", value: "" }, { name: "国语", value: "国语" }, { name: "粤语", value: "粤语" }, { name: "英语", value: "英语" }, { name: "日语", value: "日语" }, { name: "韩语", value: "韩语" }, { name: "法语", value: "法语" }, { name: "其他", value: "其他" }] },
    { key: "year", name: "年份", init: "", value: [{ name: "全部", value: "" }, { name: "2026", value: "2026" }, { name: "2025", value: "2025" }, { name: "2024", value: "2024" }, { name: "2023", value: "2023" }, { name: "2022", value: "2022" }, { name: "2021", value: "2021" }, { name: "2020", value: "2020" }, { name: "10年代", value: "2010_2019" }, { name: "00年代", value: "2000_2009" }, { name: "90年代", value: "1990_1999" }, { name: "80年代", value: "1980_1989" }, { name: "更早", value: "0_1979" }] },
    { key: "by", name: "排序", init: "3", value: [{ name: "综合", value: "1" }, { name: "最新", value: "2" }, { name: "最热", value: "3" }, { name: "评分", value: "4" }] },
  ],
  "2": [
    { key: "type", name: "类型", init: "", value: [{ name: "全部", value: "" }, { name: "剧情", value: "剧情" }, { name: "爱情", value: "爱情" }, { name: "喜剧", value: "喜剧" }, { name: "犯罪", value: "犯罪" }, { name: "悬疑", value: "悬疑" }, { name: "古装", value: "古装" }, { name: "动作", value: "动作" }, { name: "家庭", value: "家庭" }, { name: "惊悚", value: "惊悚" }, { name: "奇幻", value: "奇幻" }, { name: "美剧", value: "美剧" }, { name: "科幻", value: "科幻" }, { name: "历史", value: "历史" }, { name: "战争", value: "战争" }, { name: "韩剧", value: "韩剧" }, { name: "武侠", value: "武侠" }, { name: "言情", value: "言情" }, { name: "恐怖", value: "恐怖" }, { name: "冒险", value: "冒险" }, { name: "都市", value: "都市" }, { name: "职场", value: "职场" }] },
    { key: "area", name: "地区", init: "", value: [{ name: "地区", value: "" }, { name: "大陆", value: "中国大陆" }, { name: "香港", value: "中国香港" }, { name: "韩国", value: "韩国" }, { name: "美国", value: "美国" }, { name: "日本", value: "日本" }, { name: "法国", value: "法国" }, { name: "英国", value: "英国" }, { name: "德国", value: "德国" }, { name: "台湾", value: "中国台湾" }, { name: "泰国", value: "泰国" }, { name: "印度", value: "印度" }, { name: "其他", value: "其他" }] },
    { key: "lang", name: "语言", init: "", value: [{ name: "全部", value: "" }, { name: "国语", value: "国语" }, { name: "粤语", value: "粤语" }, { name: "英语", value: "英语" }, { name: "日语", value: "日语" }, { name: "韩语", value: "韩语" }, { name: "法语", value: "法语" }, { name: "其他", value: "其他" }] },
    { key: "year", name: "年份", init: "", value: [{ name: "全部", value: "" }, { name: "2026", value: "2026" }, { name: "2025", value: "2025" }, { name: "2024", value: "2024" }, { name: "2023", value: "2023" }, { name: "2022", value: "2022" }, { name: "2021", value: "2021" }, { name: "2020", value: "2020" }, { name: "10年代", value: "2010_2019" }, { name: "00年代", value: "2000_2009" }, { name: "90年代", value: "1990_1999" }, { name: "80年代", value: "1980_1989" }, { name: "更早", value: "0_1979" }] },
    { key: "by", name: "排序", init: "3", value: [{ name: "综合", value: "1" }, { name: "最新", value: "2" }, { name: "最热", value: "3" }, { name: "评分", value: "4" }] },
  ],
  "3": [
    { key: "type", name: "类型", init: "", value: [{ name: "全部", value: "" }, { name: "真人秀", value: "真人秀" }, { name: "脱口秀", value: "脱口秀" }, { name: "选秀", value: "选秀" }, { name: "美食", value: "美食" }, { name: "旅游", value: "旅游" }, { name: "晚会", value: "晚会" }, { name: "音乐", value: "音乐" }, { name: "纪实", value: "纪实" }] },
    { key: "area", name: "地区", init: "", value: [{ name: "地区", value: "" }, { name: "大陆", value: "中国大陆" }, { name: "香港", value: "中国香港" }, { name: "韩国", value: "韩国" }, { name: "美国", value: "美国" }, { name: "日本", value: "日本" }, { name: "台湾", value: "中国台湾" }, { name: "泰国", value: "泰国" }, { name: "其他", value: "其他" }] },
    { key: "lang", name: "语言", init: "", value: [{ name: "全部", value: "" }, { name: "国语", value: "国语" }, { name: "粤语", value: "粤语" }, { name: "英语", value: "英语" }, { name: "日语", value: "日语" }, { name: "韩语", value: "韩语" }, { name: "其他", value: "其他" }] },
    { key: "year", name: "年份", init: "", value: [{ name: "全部", value: "" }, { name: "2026", value: "2026" }, { name: "2025", value: "2025" }, { name: "2024", value: "2024" }, { name: "2023", value: "2023" }, { name: "2022", value: "2022" }, { name: "2021", value: "2021" }, { name: "2020", value: "2020" }, { name: "10年代", value: "2010_2019" }, { name: "00年代", value: "2000_2009" }, { name: "90年代", value: "1990_1999" }, { name: "80年代", value: "1980_1989" }, { name: "更早", value: "0_1979" }] },
    { key: "by", name: "排序", init: "3", value: [{ name: "综合", value: "1" }, { name: "最新", value: "2" }, { name: "最热", value: "3" }, { name: "评分", value: "4" }] },
  ],
  "4": [
    { key: "type", name: "类型", init: "", value: [{ name: "全部", value: "" }, { name: "热血", value: "热血" }, { name: "搞笑", value: "搞笑" }, { name: "冒险", value: "冒险" }, { name: "奇幻", value: "奇幻" }, { name: "恋爱", value: "恋爱" }, { name: "校园", value: "校园" }, { name: "科幻", value: "科幻" }, { name: "战斗", value: "战斗" }] },
    { key: "area", name: "地区", init: "", value: [{ name: "地区", value: "" }, { name: "大陆", value: "中国大陆" }, { name: "日本", value: "日本" }, { name: "美国", value: "美国" }, { name: "韩国", value: "韩国" }, { name: "其他", value: "其他" }] },
    { key: "lang", name: "语言", init: "", value: [{ name: "全部", value: "" }, { name: "国语", value: "国语" }, { name: "日语", value: "日语" }, { name: "英语", value: "英语" }, { name: "其他", value: "其他" }] },
    { key: "year", name: "年份", init: "", value: [{ name: "全部", value: "" }, { name: "2026", value: "2026" }, { name: "2025", value: "2025" }, { name: "2024", value: "2024" }, { name: "2023", value: "2023" }, { name: "2022", value: "2022" }, { name: "2021", value: "2021" }, { name: "2020", value: "2020" }, { name: "10年代", value: "2010_2019" }, { name: "00年代", value: "2000_2009" }, { name: "90年代", value: "1990_1999" }, { name: "80年代", value: "1980_1989" }, { name: "更早", value: "0_1979" }] },
    { key: "by", name: "排序", init: "3", value: [{ name: "综合", value: "1" }, { name: "最新", value: "2" }, { name: "最热", value: "3" }, { name: "评分", value: "4" }] },
  ],
  "6": [
    { key: "type", name: "类型", init: "", value: [{ name: "全部", value: "" }, { name: "爱情", value: "爱情" }, { name: "都市", value: "都市" }, { name: "逆袭", value: "逆袭" }, { name: "悬疑", value: "悬疑" }, { name: "古装", value: "古装" }, { name: "穿越", value: "穿越" }, { name: "甜宠", value: "甜宠" }] },
    { key: "area", name: "地区", init: "", value: [{ name: "地区", value: "" }, { name: "大陆", value: "中国大陆" }, { name: "台湾", value: "中国台湾" }, { name: "香港", value: "中国香港" }, { name: "其他", value: "其他" }] },
    { key: "lang", name: "语言", init: "", value: [{ name: "全部", value: "" }, { name: "国语", value: "国语" }, { name: "粤语", value: "粤语" }, { name: "其他", value: "其他" }] },
    { key: "year", name: "年份", init: "", value: [{ name: "全部", value: "" }, { name: "2026", value: "2026" }, { name: "2025", value: "2025" }, { name: "2024", value: "2024" }, { name: "2023", value: "2023" }, { name: "2022", value: "2022" }, { name: "2021", value: "2021" }, { name: "2020", value: "2020" }, { name: "10年代", value: "2010_2019" }, { name: "00年代", value: "2000_2009" }, { name: "90年代", value: "1990_1999" }, { name: "80年代", value: "1980_1989" }, { name: "更早", value: "0_1979" }] },
    { key: "by", name: "排序", init: "3", value: [{ name: "综合", value: "1" }, { name: "最新", value: "2" }, { name: "最热", value: "3" }, { name: "评分", value: "4" }] },
  ],
};

let cdndefendCookieState = {
  value: "",
  expiresAt: 0,
};
let searchTokenState = {
  value: "",
  expiresAt: 0,
};

const cacheInFlight = new Map();

module.exports = { home, category, detail, search, play };
runner.run(module.exports);

function readCacheTtl(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) return fallback;
  return Math.min(Math.floor(value), MAX_CACHE_TTL_SECONDS);
}

function readBoundedInt(name, fallback, min, max) {
  const raw = process.env[name];
  const value = Number(raw);
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(value)));
}

function normalizePage(value, fallback = 1) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(MAX_PAGE, Math.floor(parsed));
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map((item) => stableJson(item)).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function stableCacheKey(prefix, parts = {}) {
  return `${prefix}:${stableJson(parts)}`;
}

function isFreshState(state) {
  return Boolean(state?.value) && (!state.expiresAt || Date.now() < state.expiresAt);
}

function makeState(value, ttlSeconds) {
  return {
    value: String(value || ""),
    expiresAt: ttlSeconds > 0 ? Date.now() + ttlSeconds * 1000 : 0,
  };
}

function absUrl(raw = "") {
  const value = String(raw || "").trim();
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return value;
  if (value.startsWith("//")) return `https:${value}`;
  if (value.startsWith("/vod1/")) {
    return new URL(value, `${STATIC_HOST}/`).toString();
  }
  try {
    return new URL(value, `${BASE_URL}/`).toString();
  } catch (_) {
    return value;
  }
}

function toSiteUrl(raw, pathPattern) {
  const value = String(raw || "").trim();
  if (!value) throw new Error("empty site url");
  const absolute = absUrl(value);
  let parsed;
  try {
    parsed = new URL(absolute);
  } catch (_) {
    throw new Error(`invalid site url: ${value}`);
  }
  if (parsed.origin !== BASE_ORIGIN) {
    throw new Error(`unsupported site host: ${parsed.host}`);
  }
  if (pathPattern && !pathPattern.test(parsed.pathname)) {
    throw new Error(`unsupported site path: ${parsed.pathname}`);
  }
  return parsed.toString();
}

function detailUrlFromInput(params = {}) {
  const raw = String(params.vod_id || params.videoId || params.id || "").trim();
  if (!raw) return "";
  if (/^\d+$/.test(raw)) return `${BASE_URL}/detail/${raw}.html`;
  return toSiteUrl(raw, /^\/detail\/[^/]+\.html$/i);
}

function playUrlFromInput(params = {}) {
  const raw = String(params.playId || params.id || "").trim();
  if (!raw) return "";
  if (/^\d+$/.test(raw)) return `${BASE_URL}/play/${raw}.html`;
  return toSiteUrl(raw, /^\/(?:play|detail)\/[^/]+\.html$/i);
}

function cleanText(value) {
  return String(value || "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&#160;/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/\r/g, "")
    .replace(/[ \t\f\v]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim();
}

function decodeHtmlEntities(value) {
  return String(value || "")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function encodeSegment(value) {
  return encodeURIComponent(String(value || "").trim());
}

function summarizeImageCandidates($, root, selectors = []) {
  const scope = root && typeof root.find === "function" ? root : $(root);
  const summary = [];
  for (const selector of selectors) {
    const nodes = scope.find(selector).toArray().slice(0, 3);
    for (const el of nodes) {
      const wrapped = $(el);
      summary.push({
        selector,
        self: {
          dataOriginal: String(wrapped.attr("data-original") || ""),
          dataSrc: String(wrapped.attr("data-src") || ""),
          src: String(wrapped.attr("src") || ""),
        },
        parentA: {
          dataOriginal: String(wrapped.parent("a").attr("data-original") || ""),
          dataSrc: String(wrapped.parent("a").attr("data-src") || ""),
          src: String(wrapped.parent("a").attr("src") || ""),
        },
        closestA: {
          dataOriginal: String(wrapped.closest("a").attr("data-original") || ""),
          dataSrc: String(wrapped.closest("a").attr("data-src") || ""),
          src: String(wrapped.closest("a").attr("src") || ""),
        },
      });
      if (summary.length >= 4) return summary;
    }
  }
  return summary;
}

function pickImage($, root, selectors = []) {
  const scope = root && typeof root.find === "function" ? root : $(root);
  for (const selector of selectors) {
    const nodes = scope.find(selector).toArray();
    for (const el of nodes) {
      const wrapped = $(el);
      const candidateGroups = [
        [wrapped.attr("data-original"), wrapped.attr("data-src"), wrapped.attr("src"), wrapped.attr("data-url"), wrapped.attr("data-lazy-src"), wrapped.attr("original")],
        [wrapped.parent("a").attr("data-original"), wrapped.parent("a").attr("data-src"), wrapped.parent("a").attr("src")],
        [wrapped.closest("a").attr("data-original"), wrapped.closest("a").attr("data-src"), wrapped.closest("a").attr("src")],
      ];
      for (const candidates of candidateGroups) {
        for (const raw of candidates.map((item) => String(item || "").trim()).filter(Boolean)) {
          if (/logo_placeholder|noneCoverImg|blank\.gif|base64|avatar\.png|empty-box/i.test(raw)) continue;
          return raw;
        }
      }
    }
  }
  return "";
}

function dedupeVodList(list) {
  const out = [];
  const seen = new Set();
  for (const item of Array.isArray(list) ? list : []) {
    const key = String(item?.vod_id || item?.vod_name || "");
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

function dedupeEpisodes(episodes) {
  const out = [];
  const seen = new Set();
  for (const ep of Array.isArray(episodes) ? episodes : []) {
    const name = cleanText(ep?.name || "");
    const playId = String(ep?.playId || "").trim();
    const key = `${name}|${playId}`;
    if (!name || !playId || seen.has(key)) continue;
    seen.add(key);
    out.push({ ...ep, name, playId });
  }
  return out;
}

function extractSearchToken(html) {
  const text = String(html || "");
  try {
    const $ = cheerio.load(text);
    const value = $("input[name='t']").first().attr("value")
      || $("input[name=t]").first().attr("value")
      || "";
    if (value) return String(value).trim();
  } catch (_) {}
  const nameFirst = text.match(/<input\b[^>]*\bname=["']t["'][^>]*\bvalue=["']([^"']+)["'][^>]*>/i);
  if (nameFirst) return decodeHtmlEntities(nameFirst[1]).trim();
  const valueFirst = text.match(/<input\b[^>]*\bvalue=["']([^"']+)["'][^>]*\bname=["']t["'][^>]*>/i);
  return decodeHtmlEntities(valueFirst?.[1] || "").trim();
}

function rememberSearchToken(token) {
  const value = String(token || "").trim();
  if (!value) return "";
  searchTokenState = makeState(value, SEARCH_TOKEN_TTL);
  return value;
}

function extractCdndefendPrefix(challengeHtml = "") {
  const text = String(challengeHtml || "");
  return (
    process.env.DUSHE03_CDNDEFEND_PREFIX
    || (text.match(/\['([A-F0-9]{40})','cdndefend_js_cookie='/i)?.[1])
    || (text.match(/const\s+[a-zA-Z0-9_$]+\s*=\s*\['([A-F0-9]{40})','cdndefend_js_cookie='/i)?.[1])
    || ""
  ).trim();
}

function solveCdndefendCookie(challengeHtml = "", options = {}) {
  const force = options.force === true;
  if (!force && !challengeHtml && isFreshState(cdndefendCookieState)) {
    return cdndefendCookieState.value;
  }
  const prefix = extractCdndefendPrefix(challengeHtml);
  if (!prefix) return "";
  const idx = parseInt(prefix[0], 16);
  let counter = 0;
  while (counter < 10_000_000) {
    const candidate = `${prefix}${counter}`;
    const digest = crypto.createHash("sha1").update(candidate).digest();
    if (digest[idx] === 0xb0 && digest[idx + 1] === 0x0b) {
      cdndefendCookieState = makeState(candidate, CDNDEFEND_COOKIE_TTL);
      return candidate;
    }
    counter += 1;
  }
  return "";
}

function getStoredCdndefendCookie() {
  if (isFreshState(cdndefendCookieState)) return cdndefendCookieState.value;
  cdndefendCookieState = { value: "", expiresAt: 0 };
  return "";
}

function mergeCookieHeader(currentCookie, cookieValue) {
  const kept = String(currentCookie || "")
    .split(";")
    .map((item) => item.trim())
    .filter((item) => item && !item.startsWith("cdndefend_js_cookie="));
  if (cookieValue) kept.push(`cdndefend_js_cookie=${cookieValue}`);
  return kept.join("; ");
}

async function requestText(url, options = {}) {
  const method = options.method || "GET";
  const retry850 = options.retry850 !== false;
  await OmniBox.log("info", `[毒舌03][request] ${method} ${url}`);
  const storedCookie = options.skipCookie ? "" : getStoredCdndefendCookie();
  const headers = {
    "User-Agent": UA,
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
    "Cache-Control": "no-cache",
    Pragma: "no-cache",
    Referer: options.referer || `${BASE_URL}/`,
    "Upgrade-Insecure-Requests": "1",
    ...(options.headers || {}),
  };
  if (storedCookie) {
    headers.Cookie = mergeCookieHeader(headers.Cookie, storedCookie);
  }

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const res = await OmniBox.request(url, {
      method,
      headers,
      body: options.body,
      timeout: options.timeout || 20000,
    });
    const statusCode = Number(res?.statusCode || 0);
    const body = res?.body;
    const text = typeof body === "string" ? body : Buffer.isBuffer(body) ? body.toString() : String(body || "");
    if (statusCode === 200) return text;
    if (statusCode !== 850 || !retry850 || attempt >= 2) {
      throw new Error(`HTTP ${statusCode || "unknown"} @ ${url}`);
    }
    const cookie = solveCdndefendCookie(text, { force: true });
    if (!cookie) throw new Error(`HTTP 850, challenge unsolved @ ${url}`);
    headers.Cookie = mergeCookieHeader(headers.Cookie, cookie);
    await OmniBox.log("warn", `[毒舌03][request] HTTP 850, refreshed cdndefend cookie: ${url}`);
  }
  throw new Error(`HTTP 850, retry exhausted @ ${url}`);
}

async function getCachedText(cacheKey, ttl, producer) {
  try {
    const cached = await OmniBox.getCache(cacheKey);
    if (cached) return String(cached);
  } catch (_) {}
  if (cacheInFlight.has(cacheKey)) return cacheInFlight.get(cacheKey);
  const task = Promise.resolve()
    .then(() => producer())
    .then(async (value) => {
      const text = String(value ?? "");
      if (ttl > 0 && text) {
        try {
          await OmniBox.setCache(cacheKey, text, ttl);
        } catch (_) {}
      }
      return text;
    })
    .finally(() => {
      cacheInFlight.delete(cacheKey);
    });
  cacheInFlight.set(cacheKey, task);
  return task;
}

function extractYearFromTitle(title) {
  const match = String(title || "").match(/^(.*?)\s*-\s*.*?(\d{4})年最新/);
  return match?.[2] || "";
}

function normalizeScore(value) {
  const match = String(value || "").match(/(?:豆瓣|评分)?\s*[:：]?\s*(\d+(?:\.\d+)?)\s*分?/i);
  if (!match) return "";
  const score = Number(match[1]);
  if (!Number.isFinite(score) || score < 0 || score > 10) return "";
  return Number(score.toFixed(1)).toString();
}

function buildCard($, el, options = {}) {
  const node = $(el);
  const anchor = node.find("a[href]").first();
  const href = anchor.attr("href") || "";
  const imageNodes = node.find("img");
  const images = imageNodes.toArray();
  const poster = images.length > 1 ? $(images[1]) : $(images[0] || []);
  const title = cleanText(
    node.find(".v-item-title:not([style*='display: none'])").first().text()
      || poster.attr("alt")
      || anchor.attr("title")
      || ""
  );
  const picSelectors = [
    "a[href]",
    ".v-item-cover img:not(#noneCoverImg)",
    ".v-item-main img:not(#noneCoverImg)",
    "img:not(#noneCoverImg)",
  ];
  const pic = pickImage($, node, picSelectors);
  if (options.logImageDebug) {
    const debug = summarizeImageCandidates($, node, picSelectors);
    options.logImageDebug({ title, href, pic, debug });
  }
  const remarks = cleanText(node.find(".v-item-bottom span").first().text());
  const score = cleanText(node.find(".v-item-top-left span").first().text());
  return {
    vod_id: absUrl(href),
    vod_name: title,
    vod_pic: absUrl(pic),
    vod_pic_headers: { ...PIC_HEADERS },
    vod_remarks: remarks || score,
    vod_douban_score: normalizeScore(score),
  };
}

function parseModuleList(html, options = {}) {
  const $ = cheerio.load(html);
  const list = [];
  $(".module-item").each((_, el) => list.push(buildCard($, el, options)));
  return dedupeVodList(list).filter((item) => item.vod_id && item.vod_name);
}

function parseSearchList(html) {
  const $ = cheerio.load(html);
  const list = [];
  $(".search-result-item[href]").each((_, el) => {
    const node = $(el);
    const href = node.attr("href") || "";
    const title = cleanText(node.find(".title").first().text());
    const pic = pickImage($, node, [
      ".search-result-item-pic img:not(#noneCoverImg)",
      ".search-result-item-side img:not(#noneCoverImg)",
      "img:not(#noneCoverImg)",
    ]);
    const tags = node.find(".tags span").map((__, span) => cleanText($(span).text())).get().filter(Boolean);
    const actor = cleanText(node.find(".actors span").first().text());
    const desc = cleanText(node.find(".desc").first().text());
    list.push({
      vod_id: absUrl(href),
      vod_name: title,
      vod_pic: absUrl(pic),
      vod_pic_headers: { ...PIC_HEADERS },
      vod_remarks: tags.join("/") || actor,
      vod_actor: actor,
      vod_content: desc,
    });
  });
  return dedupeVodList(list).filter((item) => item.vod_id && item.vod_name);
}

function pageFromHref(href) {
  const value = String(href || "").trim();
  if (!value) return 0;
  try {
    const parsed = new URL(value, BASE_URL);
    const queryPage = parsed.searchParams.get("page");
    if (queryPage) return normalizePage(queryPage);
    const showMatch = parsed.pathname.match(/\/show\/\d+-[^/]*-(\d+)\.html$/i);
    if (showMatch) return normalizePage(showMatch[1]);
    const legacyMatch = parsed.pathname.match(/\/channel\/\d+-(\d+)\.html$/i);
    if (legacyMatch) return normalizePage(legacyMatch[1]);
  } catch (_) {}
  return 0;
}

function parseDeclaredTotal($) {
  const text = cleanText($(".search-result-info, .pagination-info, .page-total").first().text());
  if (!text) return null;
  const match = text.match(/(?:找到|共)\s*([\d,]+)\s*(?:部|条|个)/i);
  if (!match) return null;
  const total = Number(match[1].replace(/,/g, ""));
  return Number.isFinite(total) && total >= 0 ? total : null;
}

function parsePagination($, currentPage, listCount = 0) {
  const page = normalizePage(currentPage);
  const box = $(".pagenation-box").first();
  const nextHref = box.find(".page-item-next[href]").first().attr("href") || "";
  const prevHref = box.find(".page-item-prev[href]").first().attr("href") || "";
  let maxLinkedPage = page;
  box.find("a[href]").each((_, el) => {
    maxLinkedPage = Math.max(maxLinkedPage, pageFromHref($(el).attr("href")));
  });
  const declaredTotal = parseDeclaredTotal($);
  const pageSize = listCount > 0 ? listCount : 18;
  let pagecount;
  if (declaredTotal !== null) {
    pagecount = declaredTotal === 0 ? 1 : Math.ceil(declaredTotal / pageSize);
  } else {
    pagecount = nextHref ? Math.max(maxLinkedPage, page + 1) : Math.max(page, maxLinkedPage);
  }
  pagecount = Math.max(page, pagecount);
  const hasMore = Boolean(nextHref)
    || (declaredTotal !== null && page * pageSize < declaredTotal)
    || maxLinkedPage > page;
  return {
    page,
    pagecount,
    total: declaredTotal !== null ? declaredTotal : listCount,
    total_exact: declaredTotal !== null,
    has_more: hasMore,
    next_page: hasMore ? page + 1 : null,
    next_url: nextHref ? absUrl(nextHref) : "",
    prev_url: prevHref ? absUrl(prevHref) : "",
  };
}

function parseDetailRows($) {
  const map = {};
  $(".detail-info-row").each((_, row) => {
    const label = cleanText($(row).find(".detail-info-row-side").first().text()).replace(/[：:]$/, "");
    const value = cleanText($(row).find(".detail-info-row-main").first().text());
    if (label && value) map[label] = value;
  });
  return map;
}

function decodePathSegment(value) {
  try {
    return decodeURIComponent(String(value || "")).trim();
  } catch (_) {
    return String(value || "").trim();
  }
}

function parseShowTagHref(href) {
  const value = String(href || "").trim();
  if (!value) return {};
  try {
    const parsed = new URL(value, BASE_URL);
    const match = parsed.pathname.match(/^\/show\/\d+-(.+)\.html$/i);
    if (!match) return {};
    const parts = match[1].split("-");
    return {
      type: decodePathSegment(parts[0]),
      area: decodePathSegment(parts[1]),
      lang: decodePathSegment(parts[2]),
      year: decodePathSegment(parts[3]),
    };
  } catch (_) {
    return {};
  }
}

function parseDetailTags($) {
  const areas = [];
  const types = [];
  const languages = [];
  const years = [];
  $(".detail-tags .detail-tags-item").each((_, el) => {
    const text = cleanText($(el).text());
    const tag = parseShowTagHref($(el).attr("href"));
    if (tag.area) areas.push(tag.area);
    if (tag.type) types.push(tag.type);
    if (tag.lang) languages.push(tag.lang);
    if (/^\d{4}$/.test(tag.year || "")) years.push(tag.year);
    else if (/^\d{4}$/.test(text)) years.push(text);
  });
  return {
    areas: [...new Set(areas.filter(Boolean))],
    types: [...new Set(types.filter(Boolean))],
    languages: [...new Set(languages.filter(Boolean))],
    years: [...new Set(years.filter(Boolean))],
  };
}

function parseDetailSources($) {
  const sourceNames = $(".source-list-box-main .source-item .source-item-label")
    .map((_, el) => cleanText($(el).text()))
    .get()
    .filter(Boolean);
  const episodeLists = $(".episode-list-box-main .episode-list").toArray();
  const sources = [];
  episodeLists.forEach((listNode, index) => {
    const episodes = [];
    $(listNode).find("a[href]").each((__, a) => {
      const href = $(a).attr("href") || "";
      const name = cleanText($(a).text());
      if (!href || !name) return;
      episodes.push({ name, playId: absUrl(href) });
    });
    if (episodes.length) {
      sources.push({
        name: sourceNames[index] || `线路${index + 1}`,
        episodes: dedupeEpisodes(episodes),
      });
    }
  });
  return sources;
}

function parseDetail(html, detailUrl, options = {}) {
  const $ = cheerio.load(html);
  const title = cleanText($(".detail-title strong").eq(1).text() || $("title").text().replace(/-.*$/, ""));
  const picSelectors = [
    "img:not(#noneCoverImg)",
    "img[data-original]",
    "img[data-src]",
    "img[src]",
  ];
  const pic = absUrl(pickImage($, $(".detail-box-side").first(), picSelectors));
  if (options.logImageDebug) {
    options.logImageDebug({
      title,
      href: detailUrl,
      pic,
      debug: summarizeImageCandidates($, $(".detail-box-side").first(), picSelectors),
    });
  }
  const tagInfo = parseDetailTags($);
  const meta = parseDetailRows($);
  const desc = cleanText($(".detail-desc").first().text() || $("meta[name='description']").attr("content") || "");
  const remarks = meta["备注"] || meta["状态"] || "";
  const vod_play_sources = parseDetailSources($);
  return {
    vod_id: String(detailUrl || ""),
    vod_name: title,
    vod_pic: pic,
    vod_pic_headers: { ...PIC_HEADERS },
    vod_remarks: remarks,
    vod_year: meta["首映"] ? String(meta["首映"]).slice(0, 4) : tagInfo.years[0] || "",
    vod_area: tagInfo.areas.join(","),
    type_name: tagInfo.types.join(","),
    vod_actor: meta["演员"] || "",
    vod_director: meta["导演"] || "",
    vod_lang: meta["语言"] || tagInfo.languages.join(","),
    vod_content: desc,
    vod_play_sources,
  };
}

function decodeJsString(value) {
  return String(value || "")
    .replace(/\\u\{([0-9a-fA-F]+)\}/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/\\x([0-9a-fA-F]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/\\([\\'"\/bfnrt])/g, (_, char) => ({
      "\\": "\\",
      "'": "'",
      '"': '"',
      "/": "/",
      b: "\b",
      f: "\f",
      n: "\n",
      r: "\r",
      t: "\t",
    })[char] ?? char);
}

function resolvePlayUrl(rawUrl) {
  const playUrl = decodeJsString(rawUrl).trim();
  if (!playUrl) return "";
  if (/^https?:\/\//i.test(playUrl)) return playUrl;
  if (playUrl.startsWith("//")) return `https:${playUrl}`;
  return absUrl(playUrl);
}

function readJsObjectField(body, names) {
  const keys = names.map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  const pattern = new RegExp(
    `(?:^|[,{;\\s])(?:"(?:${keys})"|'(?:${keys})'|(?:${keys}))\\s*:\\s*(["'])((?:\\\\[\\s\\S]|[^\\\\])*?)\\1`,
    "i"
  );
  const match = String(body || "").match(pattern);
  return match ? decodeJsString(match[2]) : "";
}

function extractPlaySource(html) {
  const text = String(html || "");
  const match = text.match(/(?:const|let|var)\s+playSource\s*=\s*\{([\s\S]*?)\}\s*;/i);
  if (match) {
    const body = match[1];
    const rawUrl = readJsObjectField(body, ["src", "url", "playUrl", "videoUrl", "sourceUrl"]);
    const type = readJsObjectField(body, ["type", "mimeType"]);
    return { url: resolvePlayUrl(rawUrl), type };
  }
  try {
    const $ = cheerio.load(text);
    const rawUrl = $("video[src], source[src]")
      .toArray()
      .map((el) => $(el).attr("src") || "")
      .find((value) => /\.(m3u8|mp4)(\?|#|$)/i.test(value));
    if (rawUrl) {
      return {
        url: resolvePlayUrl(rawUrl),
        type: /\.mp4(\?|#|$)/i.test(rawUrl) ? "video/mp4" : "application/x-mpegURL",
      };
    }
  } catch (_) {}
  return { url: "", type: "" };
}

async function resolvePlayPage(playPageUrl, referer) {
  const html = await requestText(playPageUrl, { referer });
  return extractPlaySource(html);
}

function detailUrlFromPlayPage(playPageUrl) {
  try {
    const parsed = new URL(playPageUrl);
    const match = parsed.pathname.match(/^\/play\/(\d+)-/i);
    return match ? `${BASE_URL}/detail/${match[1]}.html` : "";
  } catch (_) {
    return "";
  }
}

async function resolveAlternateSource(playPageUrl) {
  const detailUrl = detailUrlFromPlayPage(playPageUrl);
  if (!detailUrl) return null;
  const detailHtml = await getCachedText(
    stableCacheKey("dushe03:detail", { url: detailUrl }),
    DETAIL_CACHE_TTL,
    () => requestText(detailUrl)
  );
  const vod = parseDetail(detailHtml, detailUrl);
  const episodes = dedupeEpisodes(
    (vod.vod_play_sources || []).flatMap((source) => source.episodes || [])
  ).filter((episode) => episode.playId && episode.playId !== playPageUrl);

  let checked = 0;
  for (const episode of episodes) {
    if (checked >= PLAY_SCAN_LIMIT) break;
    checked += 1;
    try {
      const source = await resolvePlayPage(episode.playId, detailUrl);
      if (source.url) {
        return {
          ...source,
          pageUrl: episode.playId,
          resolvedFrom: "alternate-line",
          checked,
        };
      }
    } catch (e) {
      await OmniBox.log("warn", `[毒舌03][play] alternate line failed: ${episode.playId} ${e.message || e}`);
    }
  }
  return null;
}

async function trySniffVideo(sniffUrl, headers = {}) {
  if (!sniffUrl || typeof OmniBox.sniffVideo !== "function") return null;
  try {
    await OmniBox.log("info", `[毒舌03][play] sniffVideo start url=${sniffUrl} headers=${JSON.stringify(headers)}`);
    const sniffed = await OmniBox.sniffVideo(sniffUrl, headers);
    await OmniBox.log("info", `[毒舌03][play] sniffVideo result=${JSON.stringify(sniffed || null)}`);
    if (sniffed?.url) {
      return {
        parse: 0,
        url: sniffed.url,
        urls: [{ name: "嗅探线路", url: sniffed.url }],
        header: sniffed.header || headers,
      };
    }
  } catch (e) {
    await OmniBox.log("warn", `[毒舌03][play] sniffVideo failed: ${e.message || e}`);
  }
  return null;
}

function buildAppSniffFallback(sniffUrl, headers = {}) {
  return {
    parse: 1,
    url: sniffUrl,
    urls: [{ name: "嗅探线路", url: sniffUrl }],
    header: headers,
  };
}

function buildShowUrl(tid, ext = {}) {
  const type = encodeSegment(ext.type || "");
  const area = encodeSegment(ext.area || "");
  const lang = encodeSegment(ext.lang || "");
  const year = encodeSegment(ext.year || "");
  const by = encodeSegment(ext.by || "3");
  const page = normalizePage(ext.page);
  return `${BASE_URL}/show/${encodeURIComponent(String(tid || "1"))}-${type}-${area}-${lang}-${year}-${by}-${page}.html`;
}

function createImageDebugLogger(scope) {
  if (process.env.DUSHE03_DEBUG_IMAGES !== "1") return undefined;
  let logged = 0;
  return ({ title, href, pic, debug }) => {
    if (logged >= 2) return;
    logged += 1;
    OmniBox.log("info", `[毒舌03][image][${scope}] title=${title} href=${href} picked=${pic} abs=${absUrl(pic)} headers=${JSON.stringify(PIC_HEADERS)} debug=${JSON.stringify(debug)}`);
  };
}

async function getCachedJson(cacheKey, producer, successTtl, failureTtl) {
  try {
    const cached = await OmniBox.getCache(cacheKey);
    if (cached) return JSON.parse(String(cached));
  } catch (_) {}
  if (cacheInFlight.has(cacheKey)) return cacheInFlight.get(cacheKey);
  const task = Promise.resolve()
    .then(() => producer())
    .then(async (value) => {
      const ttl = value?.url ? successTtl : failureTtl;
      if (ttl > 0) {
        try {
          await OmniBox.setCache(cacheKey, JSON.stringify(value), ttl);
        } catch (_) {}
      }
      return value;
    })
    .finally(() => {
      cacheInFlight.delete(cacheKey);
    });
  cacheInFlight.set(cacheKey, task);
  return task;
}

async function resolveFirstPlayableEpisode(detailUrl, referer) {
  const detailHtml = await getCachedText(
    stableCacheKey("dushe03:detail", { url: detailUrl }),
    DETAIL_CACHE_TTL,
    () => requestText(detailUrl)
  );
  const vod = parseDetail(detailHtml, detailUrl);
  const episodes = dedupeEpisodes(
    (vod.vod_play_sources || []).flatMap((source) => source.episodes || [])
  );
  let checked = 0;
  for (const episode of episodes) {
    if (checked >= PLAY_SCAN_LIMIT) break;
    checked += 1;
    const playPageUrl = toSiteUrl(episode.playId, /^\/play\/[^/]+\.html$/i);
    try {
      const source = await resolvePlayPage(playPageUrl, referer || detailUrl);
      if (source.url) {
        return {
          ...source,
          pageUrl: playPageUrl,
          resolvedFrom: "detail-first-playable",
          checked,
        };
      }
    } catch (e) {
      await OmniBox.log("warn", `[毒舌03][play] episode probe failed: ${playPageUrl} ${e.message || e}`);
    }
  }
  return null;
}

async function home() {
  try {
    const html = await getCachedText("dushe03:home", HOME_CACHE_TTL, () => requestText(`${BASE_URL}/`));
    rememberSearchToken(extractSearchToken(html));
    const list = parseModuleList(html, {
      logImageDebug: createImageDebugLogger("home"),
    }).slice(0, 24);
    await OmniBox.log("info", `[毒舌03][home] count=${list.length}`);
    return { class: CLASS_LIST, filters: FILTERS, list };
  } catch (e) {
    await OmniBox.log("error", `[毒舌03][home] failed: ${e.message || e}`);
    return { class: CLASS_LIST, filters: FILTERS, list: [] };
  }
}

async function category(params = {}) {
  try {
    const tid = String(params.type_id || params.categoryId || params.tid || "1");
    const page = normalizePage(params.page ?? params.pg ?? 1);
    const extend = params.filters || params.extend || params.ext || {};
    const hasFilter = ["type", "area", "lang", "year"].some((key) => String(extend[key] || "").length > 0) || String(extend.by || "") !== "";
    const url = hasFilter || page > 1
      ? buildShowUrl(tid, { ...extend, by: extend.by || "3", page })
      : `${BASE_URL}${CATEGORY_SHOW_PATH[tid] || `/channel/${encodeURIComponent(tid)}.html`}`;
    const html = await getCachedText(
      stableCacheKey("dushe03:category", { tid, page, filters: extend }),
      CATEGORY_CACHE_TTL,
      () => requestText(url)
    );
    const list = parseModuleList(html, {
      logImageDebug: createImageDebugLogger("category"),
    });
    const pagination = parsePagination(cheerio.load(html), page, list.length);
    await OmniBox.log("info", `[毒舌03][category] tid=${tid} page=${page} filters=${JSON.stringify(extend)} url=${url.replace(BASE_URL, "")} count=${list.length} has_more=${pagination.has_more}`);
    return {
      page,
      pagecount: pagination.pagecount,
      limit: list.length,
      total: pagination.total,
      total_exact: pagination.total_exact,
      has_more: pagination.has_more,
      next_page: pagination.next_page,
      next_url: pagination.next_url,
      filters: FILTERS[tid] || [],
      list,
    };
  } catch (e) {
    await OmniBox.log("error", `[毒舌03][category] failed: ${e.message || e}`);
    const page = normalizePage(params.page ?? params.pg ?? 1);
    return {
      page,
      pagecount: page,
      limit: 0,
      total: 0,
      total_exact: false,
      has_more: false,
      next_page: null,
      next_url: "",
      filters: FILTERS[String(params.type_id || params.categoryId || params.tid || "1")] || [],
      list: [],
    };
  }
}

async function detail(params = {}) {
  try {
    const vodId = detailUrlFromInput(params);
    if (!vodId) return { list: [] };
    const html = await getCachedText(
      stableCacheKey("dushe03:detail", { url: vodId }),
      DETAIL_CACHE_TTL,
      () => requestText(vodId)
    );
    const vod = parseDetail(html, vodId, {
      logImageDebug: createImageDebugLogger("detail"),
    });
    await OmniBox.log("info", `[毒舌03][detail] vod=${vod.vod_name || vodId} area=${vod.vod_area} type=${vod.type_name} sources=${vod.vod_play_sources?.length || 0}`);
    return { list: [vod] };
  } catch (e) {
    await OmniBox.log("error", `[毒舌03][detail] failed: ${e.message || e}`);
    return { list: [] };
  }
}

async function search(params = {}) {
  try {
    const wd = String(params.wd || params.keyword || "").trim();
    const page = normalizePage(params.page ?? 1);
    if (!wd) return { page, pagecount: page, limit: 0, total: 0, total_exact: false, has_more: false, list: [] };
    const homeHtml = await getCachedText("dushe03:home", HOME_CACHE_TTL, () => requestText(`${BASE_URL}/`));
    let token = isFreshState(searchTokenState) ? searchTokenState.value : rememberSearchToken(extractSearchToken(homeHtml));
    if (!token) {
      const freshHome = await requestText(`${BASE_URL}/`);
      token = rememberSearchToken(extractSearchToken(freshHome));
    }
    if (!token) {
      await OmniBox.log("warn", `[毒舌03][search] token missing, skip unsafe search request wd=${wd}`);
      return { page, pagecount: page, limit: 0, total: 0, total_exact: false, has_more: false, list: [] };
    }
    const urlObject = new URL("/search", BASE_URL);
    urlObject.searchParams.set("k", wd);
    urlObject.searchParams.set("t", token);
    if (page > 1) urlObject.searchParams.set("page", String(page));
    const url = urlObject.toString();
    const html = await getCachedText(
      stableCacheKey("dushe03:search", { wd, page, token }),
      SEARCH_CACHE_TTL,
      () => requestText(url, { referer: `${BASE_URL}/` })
    );
    const list = parseSearchList(html);
    const pagination = parsePagination(cheerio.load(html), page, list.length);
    await OmniBox.log("info", `[毒舌03][search] wd=${wd} page=${page} count=${list.length} total=${pagination.total} pagecount=${pagination.pagecount}`);
    return {
      page,
      pagecount: pagination.pagecount,
      limit: list.length,
      total: pagination.total,
      total_exact: pagination.total_exact,
      has_more: pagination.has_more,
      next_page: pagination.next_page,
      next_url: pagination.next_url,
      list,
    };
  } catch (e) {
    await OmniBox.log("error", `[毒舌03][search] failed: ${e.message || e}`);
    const page = normalizePage(params.page ?? 1);
    return {
      page,
      pagecount: page,
      limit: 0,
      total: 0,
      total_exact: false,
      has_more: false,
      next_page: null,
      next_url: "",
      list: [],
    };
  }
}

async function play(params = {}) {
  try {
    const playId = String(params.playId || params.id || "").trim();
    if (!playId) return { parse: 0, url: "", urls: [], header: {} };
    const baseHeaders = { "User-Agent": UA, Referer: `${BASE_URL}/`, Origin: BASE_URL };

    if (/\.(m3u8|mp4)(\?|#|$)/i.test(playId)) {
      const url = resolvePlayUrl(playId);
      if (!url) throw new Error(`invalid direct media url: ${playId}`);
      return { parse: 0, url, urls: [{ name: "播放", url }], header: baseHeaders };
    }

    const absolutePlayId = playUrlFromInput(params);
    const sniffHeaders = { "User-Agent": UA, Referer: absolutePlayId || `${BASE_URL}/`, Origin: BASE_URL };
    const cacheKey = stableCacheKey("dushe03:play", { url: absolutePlayId });
    const parsed = await getCachedJson(cacheKey, async () => {
      if (/\/play\//i.test(absolutePlayId)) {
        const source = await resolvePlayPage(absolutePlayId, `${BASE_URL}/`);
        if (source.url) {
          return {
            ...source,
            pageUrl: absolutePlayId,
            resolvedFrom: "play-source",
          };
        }
        const alternate = await resolveAlternateSource(absolutePlayId);
        if (alternate?.url) return alternate;
        return {
          url: "",
          type: source.type || "",
          pageUrl: absolutePlayId,
          resolvedFrom: "unresolved",
        };
      }
      if (/\/detail\//i.test(absolutePlayId)) {
        const episodeSource = await resolveFirstPlayableEpisode(absolutePlayId, `${BASE_URL}/`);
        if (episodeSource?.url) return episodeSource;
      }
      return { url: "", type: "", pageUrl: absolutePlayId, resolvedFrom: "unresolved" };
    }, PLAY_CACHE_TTL, PLAY_FAILURE_CACHE_TTL);

    if (parsed?.url) {
      const url = resolvePlayUrl(parsed.url);
      const pageUrl = absUrl(parsed.pageUrl || absolutePlayId);
      const directHeaders = /\.(m3u8|mp4)(\?|#|$)/i.test(url) ? { Referer: pageUrl || `${BASE_URL}/`, Origin: BASE_URL, "User-Agent": UA } : {};
      await OmniBox.log("info", `[毒舌03][play] resolved from=${parsed.resolvedFrom || "unknown"} type=${parsed.type || "unknown"} url=${url} pageUrl=${pageUrl}`);
      if (/\.(m3u8|mp4)(\?|#|$)/i.test(url)) {
        const lineName = parsed.resolvedFrom === "alternate-line" ? "备用线路" : "播放";
        return { parse: 0, url, urls: [{ name: lineName, url }], header: directHeaders };
      }
      const sniffResult = await trySniffVideo(url, { ...sniffHeaders, Referer: pageUrl || url, Origin: BASE_URL });
      if (sniffResult) return sniffResult;
      await OmniBox.log("warn", `[毒舌03][play] sdk sniff failed, fallback parse=1 url=${url}`);
      return buildAppSniffFallback(url, { ...sniffHeaders, Referer: pageUrl || url, Origin: BASE_URL });
    }

    const fallbackUrl = parsed?.pageUrl || absolutePlayId;
    const fallbackHeaders = { ...sniffHeaders, Referer: fallbackUrl || `${BASE_URL}/` };
    const sniffResult = await trySniffVideo(fallbackUrl, fallbackHeaders);
    if (sniffResult) return sniffResult;

    await OmniBox.log("warn", `[毒舌03][play] final fallback parse=1 url=${fallbackUrl}`);
    return buildAppSniffFallback(fallbackUrl, fallbackHeaders);
  } catch (e) {
    await OmniBox.log("error", `[毒舌03][play] failed: ${e.message || e}`);
    return { parse: 0, url: "", urls: [], header: {} };
  }
}
