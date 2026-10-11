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

export default function News({ timeZone }) {
  const [items, setItems] = useState([]);
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
      if (!response.ok || !Array.isArray(result.items)) {
        throw Object.assign(new Error(result.error ?? `HTTP ${response.status}`), { code: result.code });
      }
      setItems(result.items);
      setStatus("success");
    } catch (error) {
      console.error("ニュース取得エラー:", error);
      setErrorCode(error.code ?? "NETWORK");
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    // 初回取得
    fetchNews();
  }, [fetchNews]);

  return (
    <section className={styles.container} aria-label="今日のニュース" aria-busy={status === "loading"}>
      <div className={styles.label}>TODAY'S NEWS</div>

      {status === "loading" && <p className={styles.text}>ニュースを読み込んでいます…</p>}

      {status === "error" && (
        <div className={styles.error} role="alert">
          <p className={styles.text}>{describeError(errorCode)}</p>
          <button type="button" className={styles.retryBtn} onClick={fetchNews}>再試行</button>
        </div>
      )}

      {status === "success" && (
        <ul className={styles.list}>
          {items.map((item, i) => (
            <li key={item.link || i} className={styles.item}>
              {item.link ? (
                <a className={styles.title} href={item.link} target="_blank" rel="noopener noreferrer">
                  {item.title}
                </a>
              ) : (
                <span className={styles.title}>{item.title}</span>
              )}
              <span className={styles.meta}>
                {[item.source, formatTime(item.pubDate, timeZone)].filter(Boolean).join(" · ")}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
