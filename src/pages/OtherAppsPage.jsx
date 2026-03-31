import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import styles from "./OtherAppsPage.module.css";
import { otherApps } from "../OtherApps.js";

const BackIcon = () => (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="15 18 9 12 15 6" />
    </svg>
);

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
                <h2 className={styles.title}>他のおすすめのアプリ</h2>
            </div>

            <ul>
                {otherApps.map((item, index) => (
                    <li className={styles.itemList} key={index}>
                        <div className={styles.itemBox}>
                            <h2 className={styles.itemTitle}>
                                {item.title}
                            </h2>

                            <a className={styles.itemLink}
                                href={item.link}
                                target="_blank"
                            >
                                <img className={styles.itemImage}
                                    src={item.imageSrc}
                                    alt="image"
                                />
                            </a>

                            {item.subtitle && (
                                <p className={styles.itemSubtitle}>
                                    {item.subtitle}
                                </p>
                            )}
                        </div>
                    </li>
                ))}
            </ul>

        </div>
    );
}
