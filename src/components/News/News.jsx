import { useCallback, useEffect, useState } from "react";
import styles from "./News.module.css";
import { formatInZone } from "../../utils/date";

// エラー種別ごとの利用者向けメッセージ
const describeError = (code) => {
  if (code === "OFFLINE") return "インターネットに接続されていません。接続を確認してから再試行してください。";
  if (code === "UPSTREAM_TIMEOUT") return "ニュース配信元の応答がありませんでした。しばらくしてから再試行してください。";
  if (code === "INVALID_FEED") return "ニュースを正しく読み取れませんでした。時間をおいて再試行してください。";
  return "ニュースを取得できませんでした。通信状況を確認して再試行してください。";
};

const formatTime = (value, timeZone) =>
  formatInZone(value, timeZone, { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });

// 取得した記事からランダムに1件を選び、先頭に置く（取得・更新のときだけ選び直す）
const pickFeatured = (items) => {
  if (items.length <= 1) return items;
  const index = Math.floor(Math.random() * items.length);
  return [items[index], ...items.slice(0, index), ...items.slice(index + 1)];
};

function NewsLink({ item, timeZone, featured = false }) {
  const meta = [item.source, formatTime(item.pubDate, timeZone)].filter(Boolean).join(" · ");
  const titleClass = `${styles.title} ${featured ? styles.featuredTitle : ""}`;
  return (
    <>
      {item.link ? (
        <a className={titleClass} href={item.link} target="_blank" rel="noopener noreferrer">
          {item.title}
        </a>
      ) : (
        <span className={titleClass}>{item.title}</span>
      )}
      {meta && <span className={styles.meta}>{meta}</span>}
    </>
  );
}

export default function News({ timeZone }) {
  const [items, setItems] = useState([]); // items[0] が表示する1件
  const [status, setStatus] = useState("loading"); // loading | success | error
  const [errorCode, setErrorCode] = useState(null);

  const fetchNews = useCallback(async () => {
    setStatus("loading");
    setErrorCode(null);
    if (!navigator.onLine) {
      setErrorCode("OFFLINE");
      setStatus("error");
      return;
    }
    try {
      const response = await fetch("/.netlify/functions/generate-news");
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !Array.isArray(result.items) || result.items.length === 0) {
        throw Object.assign(new Error(result.error ?? `HTTP ${response.status}`), { code: result.code });
      }
      setItems(pickFeatured(result.items));
      setStatus("success");
    } catch (error) {
      console.error("ニュース取得エラー:", error);
      setErrorCode(error.code ?? "NETWORK");
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    // 初回取得
    queueMicrotask(fetchNews);
  }, [fetchNews]);

  const [featured, ...others] = items;

  return (
    <section className={styles.container} aria-label="今日のニュース" aria-busy={status === "loading"}>
      <div className={styles.header}>
        <div className={styles.label}>TODAY'S NEWS</div>
        {status === "success" && (
          <button type="button" className={styles.refreshBtn} onClick={fetchNews} aria-label="ニュースを更新">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="23 4 23 10 17 10" />
              <path d="M20.49 15A9 9 0 1 1 18.36 5.64L23 10" />
            </svg>
          </button>
        )}
      </div>

      {status === "loading" && <p className={styles.text}>ニュースを読み込んでいます…</p>}

      {status === "error" && (
        <div className={styles.error} role="alert">
          <p className={styles.text}>{describeError(errorCode)}</p>
          <button type="button" className={styles.retryBtn} onClick={fetchNews}>再試行</button>
        </div>
      )}

      {status === "success" && featured && (
        <>
          <div className={styles.featured}>
            <NewsLink item={featured} timeZone={timeZone} featured />
          </div>

          {others.length > 0 && (
            <details className={styles.more}>
              <summary className={styles.moreSummary}>ほかのニュース（{others.length}件）</summary>
              <ul className={styles.list}>
                {others.map((item, i) => (
                  <li key={item.link || i} className={styles.item}>
                    <NewsLink item={item} timeZone={timeZone} />
                  </li>
                ))}
              </ul>
            </details>
          )}
        </>
      )}
    </section>
  );
}
