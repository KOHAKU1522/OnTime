import styles from "./PageLoader.module.css";

// ページの遅延読み込み中に表示する（短時間で終わる場合はちらつかないよう少し遅れて表示）
export default function PageLoader() {
    return (
        <div className={styles.loader} role="status" aria-live="polite">
            <span className={styles.spinner} aria-hidden="true" />
            <span className={styles.text}>読み込み中…</span>
        </div>
    );
}
