import styles from "./SortChips.module.css";
import StarIcon from "../StarIcon/StarIcon";

const OPTIONS = [
    { value: "short", label: "期限順" },
    { value: "recent", label: "追加順" },
    { value: "long", label: "期限が遠い順" },
    { value: "completed", label: "完了済み" },
];

export default function SortChips({ value, onChange, starredFirst, starIcon = "star", starName = "スター", onStarredFirstChange }) {
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
                        className={`${styles.chip} ${styles.starChip} ${starredFirst ? styles.starActive : ""}`}
                        onClick={() => onStarredFirstChange(!starredFirst)}
                        aria-pressed={starredFirst}
                        title={`${starName}付きタスクを最上部に表示します`}
                    >
                        <StarIcon name={starIcon} active={starredFirst} size={16} />
                        {starName}優先
                    </button>
                </>
            )}
        </div>
    );
}
