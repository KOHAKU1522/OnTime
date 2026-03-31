import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import styles from "./CodeRefPage.module.css";
import { codes } from "../codes";

const BackIcon = () => (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="15 18 9 12 15 6" />
    </svg>
);

const CopyIcon = () => (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
        <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
    </svg>
);

const CheckIcon = () => (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12" />
    </svg>
);

function CodeBlock({ entry }) {
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        navigator.clipboard.writeText(entry.code).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    };

    return (
        <div className={styles.codeCard}>
            <div className={styles.codeHeader}>
                <div className={styles.codeMeta}>
                    <span className={styles.codeTitle}>{entry.title}</span>
                    {entry.language && (
                        <span className={styles.codeLang}>{entry.language}</span>
                    )}
                </div>
                <button
                    className={`${styles.copyBtn} ${copied ? styles.copied : ""}`}
                    onClick={handleCopy}
                    title="コピー"
                >
                    {copied ? <CheckIcon /> : <CopyIcon />}
                    <span>{copied ? "コピー済み" : "コピー"}</span>
                </button>
            </div>
            {entry.description && (
                <p className={styles.codeDesc}>{entry.description}</p>
            )}
            <pre className={styles.codePre}>
                <code>{entry.code}</code>
            </pre>
        </div>
    );
}

export default function CodeRefPage() {

    useEffect(() => {
        window.scrollTo(0, 0);
    }, []);

    const navigate = useNavigate();

    return (
        <div className={styles.page}>
            <div className={styles.header}>
                <button className={styles.backBtn} onClick={() => navigate(-1)}>
                    <BackIcon />
                </button>
                <h2 className={styles.title}>コード参照(一部抜粋)</h2>
            </div>

            {codes.length === 0 ? (
                <div className={styles.empty}>
                    <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" className={styles.emptyIcon}>
                        <polyline points="16 18 22 12 16 6" />
                        <polyline points="8 6 2 12 8 18" />
                    </svg>
                    <span className={styles.emptyText}>コードはまだありません</span>
                    <span className={styles.emptyHint}>src/codes.js にエントリを追加してください</span>
                </div>
            ) : (
                <div className={styles.list}>
                    {codes.map((entry, i) => (
                        <CodeBlock key={i} entry={entry} />
                    ))}
                </div>
            )}
        </div>
    );
}
