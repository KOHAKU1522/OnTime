import { useEffect, useState } from "react";
import styles from "./News.module.css";

export default function News() {
  const [news, setNews] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchNews = async () => {
      try {
        const response = await fetch("/.netlify/functions/generate-news");
        if (!response.ok) throw new Error(`ニュース取得失敗: ${response.status}`);
        const result = await response.json();
        setNews(result.news);
      } catch (error) {
        console.error("ニュース取得エラー:", error);
        setNews("ニュースを取得できませんでした。");
      } finally {
        setIsLoading(false);
      }
    };

    fetchNews();
  }, []);

  return (
    <section className={styles.container} aria-label="今日のニュース">
      <div className={styles.label}>TODAY'S NEWS</div>
      <p className={styles.text} aria-live="polite">
        {isLoading ? "ニュースを読み込んでいます..." : news}
      </p>
    </section>
  );
}
