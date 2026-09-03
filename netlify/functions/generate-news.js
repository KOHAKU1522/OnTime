const NEWS_PROMPT = `
以下のニュースタイトルをもとに、読者に伝わる自然な日本語の文章を2〜3文で作ってください。
タイトルに書かれていない具体的な人物名・数字・経緯・日付は追加しないでください。
タイトルの内容から確実に言える範囲だけを、簡潔に説明してください。
見出し・箇条書き・前置き・謝罪・英語の日付表記は不要です。
`;

const formatNews = (text) => text
  .split(/\r?\n/)
  .map((line) => line.replace(/^\s*[-*]\s*/, "").trim())
  .filter((line) => line && !/^(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun),\s+\d{1,2}\s+[A-Z][a-z]{2}/.test(line))
  .join("\n")
  .trim();

export default async function handler() {
  let fallbackNews = "";
  try {
    const apiKey = globalThis.process?.env?.GEMINI_API_KEY;
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "APIキーが設定されていません" }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }

    const newsResponse = await fetch("https://news.google.com/rss?hl=ja&gl=JP&ceid=JP:ja");
    if (!newsResponse.ok) {
      throw new Error(`ニュースソース取得失敗: ${newsResponse.status}`);
    }
    const rss = await newsResponse.text();
    const getTag = (item, tag) => item.match(
      new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`)
    )?.[1] ?? "";
    const cleanText = (text) => text
      .replace(/<!\[CDATA\[|\]\]>/g, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&#39;/g, "'")
      .replace(/&quot;/g, '"')
      .replace(/\s+/g, " ")
      .trim();
    const newsItems = [...rss.matchAll(/<item>([\s\S]*?)<\/item>/g)]
      .slice(0, 10)
      .map(([, item]) => {
        const title = cleanText(getTag(item, "title"));
        return title.replace(/\s+-\s+[^-]+$/, "");
      })
      .filter(Boolean);

    if (!newsItems.length) {
      throw new Error("ニュース項目が見つかりませんでした");
    }

    const selectedNews = newsItems[Math.floor(Math.random() * newsItems.length)];
    fallbackNews = selectedNews;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(4000),
        body: JSON.stringify({
          contents: [{
            parts: [{
                text: `${NEWS_PROMPT}\n\nニュースタイトル:\n${selectedNews}`
            }]
          }],
          generationConfig: { temperature: 0.2, maxOutputTokens: 180 }
        })
      }
    );

    if (!response.ok) {
      console.error("Gemini API error:", response.status, await response.text());
      return new Response(JSON.stringify({ news: fallbackNews }), {
        headers: { "Content-Type": "application/json" }
      });
    }

    const data = await response.json();
    const news = formatNews(data.candidates?.[0]?.content?.parts?.[0]?.text ?? "");

    if (!news) {
      return new Response(JSON.stringify({ news: fallbackNews }), {
        headers: { "Content-Type": "application/json" }
      });
    }

    return new Response(JSON.stringify({ news }), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (error) {
    console.error("ニュース取得エラー:", error);
    if (fallbackNews) {
      return new Response(JSON.stringify({ news: fallbackNews }), {
        headers: { "Content-Type": "application/json" }
      });
    }
    return new Response(JSON.stringify({ error: "ニュースの取得に失敗しました" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}