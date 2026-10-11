import styles from "./SortChips.module.css";

const OPTIONS = [
    { value: "short", label: "期限順" },
    { value: "recent", label: "追加順" },
    { value: "long", label: "期限が遠い順" },
    { value: "completed", label: "完了済み" },
];

export default function SortChips({ value, onChange, starredFirst, onStarredFirstChange }) {
    return (
        <div className={styles.chips}>
            {OPTIONS.map(opt => (
                <button
                    key={opt.value}
                    className={`${styles.chip} ${value === opt.value ? styles.active : ""}`}
                    onClick={() => onChange(opt.value)}
                >
                    {opt.label}
                </button>
            ))}
            {onStarredFirstChange && (
                <>
                    <span className={styles.separator} aria-hidden="true" />
                    <button
                        className={`${styles.chip} ${starredFirst ? styles.starActive : ""}`}
                        onClick={() => onStarredFirstChange(!starredFirst)}
                        aria-pressed={starredFirst}
                        title="スター付きタスクを最上部に表示します"
                    >
                        ★ スター優先
                    </button>
                </>
            )}
        </div>
    );
}
