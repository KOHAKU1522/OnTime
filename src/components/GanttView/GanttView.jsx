import styles from "./GanttView.module.css";
import { useRef, useEffect, useState } from "react";
import { auth, db } from "../../firebase";
import { doc, updateDoc, deleteDoc } from "firebase/firestore";
import TagChip from "../TagChip/TagChip";

export default function GanttView({ tasks, sortType = "short" }) {
    const scrollRef = useRef(null);
    const [popupTask, setPopupTask] = useState(null);

    const getDate = (date) => {
        if (typeof date?.toDate === "function") return date.toDate();
        return new Date(date);
    };

    const normalizeDate = (date) => {
        const d = getDate(date);
        d.setHours(0, 0, 0, 0);
        return d;
    };

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const minDate = new Date(today);
    minDate.setDate(today.getDate() - 14);

    const maxDate = new Date(today);
    maxDate.setDate(today.getDate() + 30);

    const CELL_WIDTH = 28;

    const getOffsetDays = (date) => {
        return Math.floor(
            (normalizeDate(date) - normalizeDate(minDate)) /
            (1000 * 60 * 60 * 24)
        );
    };

    const todayOffset = getOffsetDays(today);

    useEffect(() => {
        if (scrollRef.current) {
            const scrollTo = Math.max(0, (todayOffset - 4) * CELL_WIDTH);
            scrollRef.current.scrollLeft = scrollTo;
        }
    }, []);

    if (!tasks) return <div className={styles.empty}>読み込み中...</div>;
    if (tasks.length === 0) return <div className={styles.empty}>タスクがありません</div>;

    // TaskList と同じ並び順ロジック
    const getDeadline = (task) => normalizeDate(task.deadline);

    const starFirst = (arr) => [...arr.filter(t => t.starred), ...arr.filter(t => !t.starred)];

    let sortedTasks = [];

    if (sortType === "short") {
        const incomplete = tasks
            .filter(t => !t.completed)
            .sort((a, b) => getDeadline(a) - getDeadline(b));
        const completed = tasks.filter(t => t.completed);
        sortedTasks = [...starFirst(incomplete), ...completed];
    } else if (sortType === "recent") {
        const sorted = [...tasks].sort((a, b) => {
            const aTime = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
            const bTime = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
            return bTime - aTime;
        });
        const incomplete = sorted.filter(t => !t.completed);
        const completed  = sorted.filter(t => t.completed);
        sortedTasks = [...starFirst(incomplete), ...completed];
    } else if (sortType === "long") {
        const sorted = tasks
            .filter(t => !t.completed)
            .sort((a, b) => getDeadline(b) - getDeadline(a));
        sortedTasks = starFirst(sorted);
    } else if (sortType === "completed") {
        sortedTasks = tasks.filter(t => t.completed);
    }

    const dateList = [];
    let current = new Date(minDate);
    while (current <= maxDate) {
        dateList.push(new Date(current));
        current.setDate(current.getDate() + 1);
    }

    const handleComplete = async (task) => {
        const user = auth.currentUser;
        if (!user) return;
        const taskRef = doc(db, "users", user.uid, "tasks", task.id);
        await updateDoc(taskRef, { completed: true, completedAt: new Date() });
    };

    const handleDelete = async (task) => {
        const user = auth.currentUser;
        if (!user) return;
        if (!window.confirm("このタスクを削除しますか？")) return;
        const taskRef = doc(db, "users", user.uid, "tasks", task.id);
        await deleteDoc(taskRef);
    };

    const popupDl = popupTask ? getDate(popupTask.deadline) : null;
    const popupDaysLeft = popupDl ? Math.ceil((popupDl - new Date()) / (1000 * 60 * 60 * 24)) : 0;
    const popupRemain = !popupTask ? "" : popupTask.completed ? "完了済み" : popupDaysLeft < 0 ? "期限切れ" : popupDaysLeft === 0 ? "今日まで" : `残り ${popupDaysLeft}日`;
    const popupTags = popupTask?.tags ?? [];

    return (
        <>
        <div className={styles.container}>

            {/* 左固定：タスク名 + アクションボタン */}
            <div className={styles.left}>
                <div className={styles.leftHeader}>タスク</div>
                {sortedTasks.map(task => {
                    const deadline = getDeadline(task);
                    const daysLeft = Math.ceil((deadline - today) / (1000 * 60 * 60 * 24));
                    const isDanger = daysLeft <= 1 && !task.completed;

                    return (
                        <div
                            key={task.id}
                            className={`${styles.taskRow} ${task.completed ? styles.taskRowCompleted : ""}`}
                        >
                            <div className={styles.taskNameRow}>
                                <span
                                    className={styles.taskDot}
                                    style={{
                                        backgroundColor: task.completed
                                            ? "var(--completed-text)"
                                            : isDanger
                                                ? "var(--color-danger)"
                                                : daysLeft <= 3
                                                    ? "var(--color-warning)"
                                                    : "var(--color-blue)"
                                    }}
                                />
                                {task.starred && <span className={styles.starMark}>★</span>}
                                <span className={styles.taskName} title={task.taskName}>
                                    {task.taskName.length > 7
                                        ? task.taskName.slice(0, 7) + "…"
                                        : task.taskName}
                                </span>
                            </div>
                            <div className={styles.actionRow}>
                                {!task.completed && (
                                    <button
                                        className={styles.doneBtn}
                                        onClick={() => handleComplete(task)}
                                    >
                                        完了
                                    </button>
                                )}
                                <button
                                    className={styles.deleteBtn}
                                    onClick={() => handleDelete(task)}
                                >
                                    削除
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* 右スクロール */}
            <div className={styles.right} ref={scrollRef}>
                <div
                    className={styles.inner}
                    style={{ width: `${dateList.length * CELL_WIDTH}px` }}
                >

                    {/* 日付ヘッダー */}
                    <div className={styles.header}>
                        {dateList.map((date, i) => {
                            const isToday = date.getTime() === today.getTime();
                            const isMonthStart = date.getDate() === 1;
                            const weekDay = date.getDay();
                            const weekLabels = ["日", "月", "火", "水", "木", "金", "土"];
                            const isSun = weekDay === 0;
                            const isSat = weekDay === 6;
                            return (
                                <div
                                    key={i}
                                    className={`${styles.dateCell} ${isToday ? styles.todayHeaderCell : ""}`}
                                    style={{ width: `${CELL_WIDTH}px` }}
                                >
                                    {isMonthStart && (
                                        <span className={styles.monthLabel}>
                                            {date.getMonth() + 1}月
                                        </span>
                                    )}
                                    <span className={styles.dayLabel}>{date.getDate()}</span>
                                    <span
                                        className={styles.weekLabel}
                                        style={{
                                            color: isToday ? "#2563eb" : isSun ? "var(--color-danger)" : isSat ? "var(--color-blue)" : undefined
                                        }}
                                    >
                                        {weekLabels[weekDay]}
                                    </span>
                                    {isToday && <div className={styles.todayDot} />}
                                </div>
                            );
                        })}
                    </div>

                    {/* 行エリア */}
                    <div className={styles.rowsArea}>

                        {/* 今日の縦線 */}
                        <div
                            className={styles.todayLine}
                            style={{ left: `${todayOffset * CELL_WIDTH + CELL_WIDTH / 2}px` }}
                        />

                        {sortedTasks.map(task => {
                            const startDate = task.startDate || task.createdAt;
                            const deadline = task.deadline;

                            const start = getOffsetDays(startDate);
                            const end = getOffsetDays(deadline);

                            if (isNaN(start) || isNaN(end)) return null;

                            const width = Math.max((end - start + 1) * CELL_WIDTH, CELL_WIDTH);
                            const daysLeft = end - todayOffset;
                            const isDanger = daysLeft <= 1 && !task.completed;
                            const isWarning = daysLeft > 1 && daysLeft <= 3 && !task.completed;

                            const barColor = task.completed
                                ? "var(--completed-border)"
                                : isDanger
                                    ? "var(--color-danger)"
                                    : isWarning
                                        ? "var(--color-warning)"
                                        : "var(--color-blue)";

                            return (
                                <div
                                    key={task.id}
                                    className={`${styles.row} ${task.completed ? styles.rowCompleted : ""}`}
                                >
                                    <div
                                        className={styles.bar}
                                        title={task.taskName}
                                        onClick={() => setPopupTask(task)}
                                        style={{
                                            left: `${start * CELL_WIDTH}px`,
                                            width: `${width}px`,
                                            backgroundColor: barColor,
                                            cursor: "pointer",
                                        }}
                                    >
                                        <span className={styles.barLabel}>
                                            {task.starred ? "★ " : ""}{task.taskName}
                                        </span>
                                    </div>
                                </div>
                            );
                        })}

                    </div>
                </div>
            </div>

        </div>

        {popupTask && (
            <div className={styles.popupOverlay} onClick={() => setPopupTask(null)}>
                <div className={styles.popupSheet} onClick={e => e.stopPropagation()}>
                    <div className={styles.popupHandle} />
                    <div className={styles.popupTitle}>
                        {popupTask.starred && <span className={styles.popupStar}>★</span>}
                        {popupTask.taskName}
                    </div>
                    <div className={styles.popupRow}>
                        <span className={styles.popupLabel}>期限</span>
                        <span className={styles.popupValue}>{popupDl.toLocaleString("ja-JP", { month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                    </div>
                    <div className={styles.popupRow}>
                        <span className={styles.popupLabel}>状態</span>
                        <span className={styles.popupValue}>{popupRemain}</span>
                    </div>
                    {popupTask.description && (
                        <div className={styles.popupRow}>
                            <span className={styles.popupLabel}>メモ</span>
                            <span className={styles.popupValue}>{popupTask.description}</span>
                        </div>
                    )}
                    {popupTags.length > 0 && (
                        <div className={styles.popupTags}>
                            {popupTags.map((tag, i) => <TagChip key={i} tag={tag} readonly />)}
                        </div>
                    )}
                    <button className={styles.popupClose} onClick={() => setPopupTask(null)}>閉じる</button>
                </div>
            </div>
        )}
        </>
    );
}
