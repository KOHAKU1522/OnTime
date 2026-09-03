const NEWS_PROMPT = `
ニュース候補から最も新しく重要な記事を1件だけ選んでください。
候補に書かれている情報だけを使い、候補にない人物名・事件名・数字・日付を絶対に追加しないでください。
タイトルが文字化けしている、意味を判別できない、またはニュース内容が不明な候補は選ばないでください。
選んだ記事を日本語の自然な2〜3文で要約してください。1文目に記事の日付を含め、見出し・箇条書き・前置き・謝罪は不要です。
`;

export default async function handler() {
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
    const newsSource = [...rss.matchAll(/<item>([\s\S]*?)<\/item>/g)]
      .slice(0, 10)
      .map(([, item], index) => {
        const title = cleanText(getTag(item, "title"));
        const publishedAt = cleanText(getTag(item, "pubDate"));
        return `[${index + 1}] ${title} (公開日時: ${publishedAt})`;
      })
      .join("\n");

    if (!newsSource) {
      throw new Error("ニュース項目が見つかりませんでした");
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{
            parts: [{
          text: `今日は${new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", dateStyle: "long" }).format(new Date())}です。${NEWS_PROMPT}\n\nニュース候補:\n${newsSource}`
            }]
          }],
          generationConfig: { temperature: 0.2, maxOutputTokens: 180 }
        })
      }
    );

    if (!response.ok) {
      console.error("Gemini API error:", response.status, await response.text());
      return new Response(JSON.stringify({ error: "ニュースの取得に失敗しました" }), {
        status: 502,
        headers: { "Content-Type": "application/json" }
      });
    }

    const data = await response.json();
    const news = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

    if (!news) {
      return new Response(JSON.stringify({ error: "ニュースが生成されませんでした" }), {
        status: 502,
        headers: { "Content-Type": "application/json" }
      });
    }

    return new Response(JSON.stringify({ news }), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (error) {
    console.error("ニュース取得エラー:", error);
    return new Response(JSON.stringify({ error: "ニュースの取得に失敗しました" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}