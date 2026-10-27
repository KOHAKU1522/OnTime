import { toDate, getDayRange, getWeekRange, getMonthRange, getUpcomingRange, isInRange } from "../../utils/date";
import styles from "./TaskPeriodCounts.module.css";

export default function TaskPeriodCounts({ tasks, timeZone, weekStartsOn, now = new Date() }) {
    const deadlines = tasks.filter(task => !task.completed).map(task => toDate(task.deadline)).filter(Boolean);
    const periods = [
        ["今日", getDayRange(now, timeZone), styles.today],
        ["今週", getWeekRange(now, weekStartsOn, timeZone), styles.week],
        ["1週間以内", getUpcomingRange(now, 7, timeZone), styles.week],
        ["今月", getMonthRange(now, timeZone), styles.month],
        ["1ヶ月以内（31日）", getUpcomingRange(now, 31, timeZone), styles.month],
    ];

    return (
        <div className={styles.row} aria-label="期限が近い未完了タスク数">
            {periods.map(([label, range, color]) => {
                const count = deadlines.filter(deadline => isInRange(deadline, range)).length;
                return <span key={label} className={`${styles.badge} ${count > 0 ? color : styles.empty}`}>
                    {label} {count}件
                </span>;
            })}
        </div>
    );
}
