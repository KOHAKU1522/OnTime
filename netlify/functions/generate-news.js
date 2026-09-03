export default async function handler() {
  try {
    const apiKey = globalThis.process?.env?.GEMINI_API_KEY;
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "APIキーが設定されていません" }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: "今日の日本の時事ニュースを1件、Google検索で確認し、事実ベースで日本語2〜3行に要約してください。見出しは不要です。情報が不確かな場合は、その旨を短く書いてください。"
            }]
          }],
          tools: [{ google_search: {} }],
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