import styles from "./StatsChart.module.css";

export default function StatsChart({ data }) {
    const maxCount = Math.max(...data.map(d => d.count), 1);

    return (
        <div className={styles.chart}>
            <div className={styles.bars}>
                {data.map((item, i) => (
                    <div key={i} className={styles.barGroup}>
                        <div className={styles.barWrapper}>
                            {item.count > 0 && (
                                <span className={styles.barCount}>{item.count}</span>
                            )}
                            <div
                                className={`${styles.bar} ${item.isToday || item.isCurrentWeek ? styles.barHighlight : ""}`}
                                style={{ height: `${(item.count / maxCount) * 100}%` }}
                            />
                        </div>
                        <div className={styles.barLabel}>{item.label}</div>
                    </div>
                ))}
            </div>
        </div>
    );
}
