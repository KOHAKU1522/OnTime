const NEWS_PROMPT = `
以下のニュース記事のタイトルと概要をもとに、読者に伝わる自然な日本語の要約を2〜3文で作ってください。
本文がある場合は本文を優先し、タイトルをそのまま繰り返さず、何が起きたのかを説明してください。
記事に書かれていない具体的な人物名・数字・経緯・日付は追加しないでください。
情報が不足している場合は、無理に補わず、分かっている内容だけで文章にしてください。
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
    const rss = new TextDecoder("utf-8").decode(await newsResponse.arrayBuffer());
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
    const getArticleText = (html) => {
      const article = html.match(/<article[^>]*>([\s\S]*?)<\/article>/i)?.[1] ?? html;
      const text = cleanText(article
        .replace(/<(script|style|nav|header|footer|aside|form)[^>]*>[\s\S]*?<\/\1>/gi, " ")
        .replace(/<[^>]+>/g, " ")).slice(0, 8000);
      return /(?:�|Ã.|Â.|æ.|ã.){3,}/.test(text) ? "" : text;
    };
    const newsItems = [...rss.matchAll(/<item>([\s\S]*?)<\/item>/g)]
      .slice(0, 10)
      .map(([, item]) => {
        const title = cleanText(getTag(item, "title"));
        const description = cleanText(getTag(item, "description"));
        const link = cleanText(getTag(item, "link"));
        return {
          title: title.replace(/\s+-\s+[^-]+$/, ""),
          description,
          link
        };
      })
      .filter((item) => item.title);

    if (!newsItems.length) {
      throw new Error("ニュース項目が見つかりませんでした");
    }

    const selectedNews = newsItems[Math.floor(Math.random() * newsItems.length)];
    fallbackNews = selectedNews.title;
    let articleText = "";

    if (selectedNews.link) {
      try {
        const articleResponse = await fetch(selectedNews.link, {
          signal: AbortSignal.timeout(3000),
          headers: { "User-Agent": "OnTime news summarizer" }
        });
        if (articleResponse.ok) {
          articleText = getArticleText(
            new TextDecoder("utf-8").decode(await articleResponse.arrayBuffer())
          );
        }
      } catch (error) {
        console.warn("記事本文を取得できませんでした:", error.message);
      }
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(4000),
        body: JSON.stringify({
          contents: [{
            parts: [{
                text: `${NEWS_PROMPT}\n\nニュースタイトル:\n${selectedNews.title}\n\n記事概要:\n${selectedNews.description}\n\n記事本文:\n${articleText}`
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