import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import styles from "./GuidePage.module.css";
import { guide } from "../guide.js";

const BackIcon = () => (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="15 18 9 12 15 6" />
    </svg>
);

function GuideBlock({ entry }) {
    return (
        <div className={styles.codeCard}>
            <div className={styles.codeHeader}>
                <div className={styles.codeMeta}>
                    <span className={styles.codeTitle}>{entry.title}</span>
                </div>
            </div>

            {entry.sentence && (
                <div className={styles.codeDesc}>{entry.sentence}</div>
            )}

            {entry.image_src && entry.image_src.length > 0 && (
                <div className={styles.imageRow}>
                    {entry.image_src.map((src, i) => (
                        <img
                            key={i}
                            src={src}
                            alt={`${entry.title} ${i + 1}`}
                            className={styles.guideImage}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

export default function GuidePage() {

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
                <h2 className={styles.title}>アプリの使い方</h2>
            </div>

            {guide.length === 0 ? (
                <div className={styles.empty}>
                    <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" className={styles.emptyIcon}>
                        <polyline points="16 18 22 12 16 6" />
                        <polyline points="8 6 2 12 8 18" />
                    </svg>
                    <span className={styles.emptyText}>説明はまだありません</span>
                    <span className={styles.emptyHint}>src/guide.js にエントリを追加してください</span>
                </div>
            ) : (
                <div className={styles.list}>
                    {guide.map((entry, i) => (
                        <GuideBlock key={i} entry={entry} />
                    ))}
                </div>
            )}
        </div>
    );
}
