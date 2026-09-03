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
    const newsSource = [...rss.matchAll(/<item>([\s\S]*?)<\/item>/g)]
      .slice(0, 10)
      .map(([, item]) => item
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim())
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
                text: `今日は${new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", dateStyle: "long" }).format(new Date())}です。以下はGoogleニュースの最新一覧です。今日または直近のニュースを1件だけ選び、日付を必ず含めて、事実ベースで日本語2〜3行に要約してください。古いニュースしかない場合は、その中で最も新しいものを選んでください。見出しや前置きは不要です。\n\n${newsSource}`
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