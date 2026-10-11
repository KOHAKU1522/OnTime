// Google News の RSS を取得し、内容を加工・要約せずにそのまま返す
const FEED_URL = "https://news.google.com/rss?hl=ja&gl=JP&ceid=JP:ja";
// クライアントで1件をランダム表示し、残りは折りたたみ一覧に出す
const MAX_ITEMS = 10;

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: {
    "Content-Type": "application/json; charset=utf-8",
    // 取得結果を短時間キャッシュして RSS への負荷を抑える
    "Cache-Control": status === 200 ? "public, max-age=300" : "no-store",
  },
});

const decodeEntities = (text) => text
  .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
  .replace(/&lt;/g, "<")
  .replace(/&gt;/g, ">")
  .replace(/&quot;/g, '"')
  .replace(/&#39;|&apos;/g, "'")
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
  .replace(/&amp;/g, "&")
  .trim();

const getTag = (xml, tag) => {
  const raw = xml.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`))?.[1];
  return raw == null ? "" : decodeEntities(raw);
};

// http(s) 以外のリンクは表示しない
const safeUrl = (value) => {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : "";
  } catch {
    return "";
  }
};

export const parseFeed = (xml) => {
  if (!/<rss[\s>]/.test(xml) || !/<channel[\s>]/.test(xml)) return null;
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)]
    .map(([, item]) => ({
      title: getTag(item, "title"),
      link: safeUrl(getTag(item, "link")),
      source: getTag(item, "source"),
      pubDate: getTag(item, "pubDate"),
    }))
    .filter((item) => item.title)
    .slice(0, MAX_ITEMS);
};

export default async function handler() {
  let xml;
  try {
    const response = await fetch(FEED_URL, {signal: AbortSignal.timeout(5000)});
    if (!response.ok) {
      console.error("RSS fetch failed:", response.status);
      return json({error: "ニュース配信元に接続できませんでした", code: "UPSTREAM_FAILED"}, 502);
    }
    xml = new TextDecoder("utf-8").decode(await response.arrayBuffer());
  } catch (error) {
    console.error("RSS fetch error:", error);
    const timeout = error?.name === "TimeoutError";
    return json({
      error: timeout ? "ニュース配信元の応答がありませんでした" : "ニュース配信元に接続できませんでした",
      code: timeout ? "UPSTREAM_TIMEOUT" : "UPSTREAM_FAILED",
    }, 502);
  }

  const items = parseFeed(xml);
  if (!items || items.length === 0) {
    return json({error: "ニュースの形式が正しくありませんでした", code: "INVALID_FEED"}, 502);
  }

  return json({items, fetchedAt: new Date().toISOString()});
}
