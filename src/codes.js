// このファイルにプロジェクト内のコードスニペットを追加してください。
// 各エントリの形式：
// {
//   title: "タイトル",
//   description: "説明（省略可）",
//   language: "javascript" | "css" | "jsx" | "bash" など,
//   code: `コード本文`
// }

export const codes = [
    {
        title: "GanttView.jsx",
        description: "ReactでFirestoreのタスクをガントチャート表示し、操作と詳細ポップアップを提供するコンポーネント",
        language: "JavaScript",
        code: `import styles from "./GanttView.module.css";
import { useRef, useEffect, useState } from "react";
import { db } from "../../firebase";
import { doc, updateDoc, deleteDoc } from "firebase/firestore";
import { useAuthUser } from "../../hooks/useAuthUser";
import TagChip from "../TagChip/TagChip";

export default function GanttView({ tasks, sortType = "short" }) {
    const user = useAuthUser();
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
        if (!user) return;
        const taskRef = doc(db, "users", user.uid, "tasks", task.id);
        await updateDoc(taskRef, { completed: true, completedAt: new Date() });
    };

    const handleDelete = async (task) => {
        if (!user) return;
        if (!window.confirm("このタスクを削除しますか？")) return;
        const taskRef = doc(db, "users", user.uid, "tasks", task.id);
        await deleteDoc(taskRef);
    };

    const popupDl = popupTask ? getDate(popupTask.deadline) : null;
    const popupDaysLeft = popupDl ? Math.ceil((popupDl - new Date()) / (1000 * 60 * 60 * 24)) : 0;
    const popupRemain = !popupTask ? "" : popupTask.completed ? "完了済み" : popupDaysLeft < 0 ? "期限切れ" : popupDaysLeft === 0 ? "今日まで" : \`残り \${popupDaysLeft}日\`;
    const popupTags = popupTask?.tags ?? [];

    return (
        <>
        <div className={styles.container}>

            <div className={styles.left}>
                <div className={styles.leftHeader}>タスク</div>
                {sortedTasks.map(task => {
                    const deadline = getDeadline(task);
                    const daysLeft = Math.ceil((deadline - today) / (1000 * 60 * 60 * 24));
                    const isDanger = daysLeft <= 1 && !task.completed;

                    return (
                        <div
                            key={task.id}
                            className={\`\${styles.taskRow} \${task.completed ? styles.taskRowCompleted : ""}\`}
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

            <div className={styles.right} ref={scrollRef}>
                <div
                    className={styles.inner}
                    style={{ width: \`\${dateList.length * CELL_WIDTH}px\` }}
                >

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
                                    className={\`\${styles.dateCell} \${isToday ? styles.todayHeaderCell : ""}\`}
                                    style={{ width: \`\${CELL_WIDTH}px\` }}
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

                    <div className={styles.rowsArea}>

                        <div
                            className={styles.todayLine}
                            style={{ left: \`\${todayOffset * CELL_WIDTH + CELL_WIDTH / 2}px\` }}
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
                                    className={\`\${styles.row} \${task.completed ? styles.rowCompleted : ""}\`}
                                >
                                    <div
                                        className={styles.bar}
                                        title={task.taskName}
                                        onClick={() => setPopupTask(task)}
                                        style={{
                                            left: \`\${start * CELL_WIDTH}px\`,
                                            width: \`\${width}px\`,
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
`
    },
    {
        title: "GanttView.css",
        description: "Reactガントチャートのタスク表示やポップアップを整えるCSSスタイル",
        language: "CSS",
        code: `.container {
    display: flex;
    background: var(--bg-card);
    border-radius: 12px;
    box-shadow: var(--shadow-card);
    overflow: hidden;
    font-family: sans-serif;
}

.empty {
    text-align: center;
    color: var(--text-muted);
    padding: 40px 20px;
    font-size: 0.9rem;
}

.left {
    width: 82px;
    min-width: 82px;
    border-right: 1px solid var(--divider);
    background: var(--bg-card);
    z-index: 20;
}

.leftHeader {
    box-sizing: border-box;
    height: 58px;
    display: flex;
    align-items: center;
    padding-left: 10px;
    font-size: 0.68rem;
    font-weight: 700;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.06em;
    border-bottom: 1px solid var(--divider);
}

.taskRow {
    box-sizing: border-box;
    height: 55px;
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 4px;
    padding: 6px 6px 6px 10px;
    border-bottom: 1px solid var(--divider);
}

.taskRowCompleted { opacity: 0.5; }

.taskNameRow {
    display: flex;
    align-items: center;
    gap: 6px;
    overflow: hidden;
}

.taskName {
    font-size: 0.78rem;
    font-weight: 500;
    color: var(--text-primary);
    white-space: nowrap;
    overflow: hidden;
}

.taskRowCompleted .taskName {
    color: var(--text-muted);
    text-decoration: line-through;
}

.taskDot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    flex-shrink: 0;
}

.starMark {
    font-size: 0.65rem;
    color: #f59e0b;
    flex-shrink: 0;
    line-height: 1;
}

.popupOverlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.4);
    z-index: 400;
    display: flex;
    align-items: flex-end;
    animation: popupFadeIn 0.2s ease;
}

@keyframes popupFadeIn {
    from { opacity: 0; }
    to   { opacity: 1; }
}

.popupSheet {
    width: 100%;
    background: var(--bg-card);
    border-radius: 20px 20px 0 0;
    padding: 0 20px 20px;
    animation: popupSlideUp 0.25s ease;
}

@keyframes popupSlideUp {
    from { transform: translateY(100%); }
    to   { transform: translateY(0); }
}

.popupHandle {
    width: 36px;
    height: 4px;
    border-radius: 99px;
    background: var(--border);
    margin: 12px auto 16px;
}

.popupTitle {
    font-size: 1rem;
    font-weight: 700;
    color: var(--text-primary);
    margin-bottom: 16px;
    display: flex;
    align-items: center;
    gap: 6px;
}

.popupStar {
    color: #f59e0b;
    font-size: 0.95rem;
}

.popupRow {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    margin-bottom: 10px;
}

.popupLabel {
    font-size: 0.72rem;
    font-weight: 700;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    min-width: 36px;
    padding-top: 1px;
}

.popupValue {
    font-size: 0.88rem;
    color: var(--text-primary);
    flex: 1;
    white-space: pre-wrap;
    word-break: break-word;
}

.popupTags {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-bottom: 10px;
}

.popupClose {
    width: 100%;
    margin-top: 12px;
    padding: 12px;
    background: var(--bg-card-alt);
    border: none;
    border-radius: 12px;
    font-size: 0.9rem;
    font-weight: 600;
    color: var(--text-primary);
    cursor: pointer;
}

.actionRow {
    display: flex;
    gap: 4px;
}

.doneBtn {
    font-size: 0.58rem;
    padding: 1px 5px;
    border: 1px solid var(--color-success);
    border-radius: 4px;
    background: transparent;
    color: var(--color-success);
    cursor: pointer;
    font-weight: 500;
}

.deleteBtn {
    font-size: 0.58rem;
    padding: 1px 5px;
    border: 1px solid var(--color-danger-border);
    border-radius: 4px;
    background: transparent;
    color: var(--color-danger);
    cursor: pointer;
    font-weight: 500;
}

.right {
    overflow-x: auto;
    flex: 1;
    scrollbar-width: thin;
    scrollbar-color: var(--border) transparent;
}

.right::-webkit-scrollbar { height: 3px; }

.right::-webkit-scrollbar-thumb {
    background: var(--border);
    border-radius: 2px;
}

.inner { position: relative; }

.header {
    box-sizing: border-box;
    display: flex;
    height: 58px;
    position: sticky;
    top: 0;
    background: var(--bg-card);
    z-index: 10;
    border-bottom: 1px solid var(--divider);
    background-image: linear-gradient(to right, var(--divider) 1px, transparent 1px);
    background-size: 28px 100%;
}

.dateCell {
    flex-shrink: 0;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    position: relative;
}

.todayHeaderCell { background: rgba(37, 99, 235, 0.06); }

.monthLabel {
    position: absolute;
    top: 5px;
    font-size: 8px;
    font-weight: 700;
    color: var(--text-muted);
    letter-spacing: 0.02em;
}

.dayLabel {
    font-size: 10px;
    color: var(--text-muted);
    font-weight: 500;
    margin-top: 8px;
}

.todayHeaderCell .dayLabel {
    color: #2563eb;
    font-weight: 800;
}

.weekLabel {
    font-size: 8px;
    color: var(--text-muted);
    font-weight: 500;
    margin-top: 1px;
    opacity: 0.6;
}

.todayDot {
    width: 3px;
    height: 3px;
    border-radius: 50%;
    background: #2563eb;
    position: absolute;
    bottom: 7px;
}

.rowsArea { position: relative; }

.todayLine {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 1px;
    background: #2563eb;
    opacity: 0.25;
    z-index: 5;
    pointer-events: none;
}

.row {
    box-sizing: border-box;
    height: 55px;
    border-bottom: 1px solid var(--divider);
    position: relative;
    display: flex;
    align-items: center;
    background-image: linear-gradient(to right, var(--divider) 1px, transparent 1px);
    background-size: 28px 100%;
}

.rowCompleted { opacity: 0.5; }

.bar {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    height: 28px;
    border-radius: 99px;
    z-index: 2;
    display: flex;
    align-items: center;
    overflow: hidden;
}

.barLabel {
    font-size: 11px;
    font-weight: 700;
    color: #fff;
    padding: 0 10px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    letter-spacing: 0.01em;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.25);
}
`
    },
    {
        title: "MacroPage.jsx",
        description: "ReactとFirestoreで、指定頻度で自動タスクを追加・管理できるマクロ機能のページコンポーネント",
        language: "JavaScript",
        code: `import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { auth, db } from "../firebase";
import {
    collection, addDoc, deleteDoc, updateDoc,
    onSnapshot, doc, serverTimestamp
} from "firebase/firestore";
import styles from "./MacroPage.module.css";

const FREQ_OPTIONS = [
    { value: "daily", label: "毎日" },
    { value: "weekly", label: "曜日指定" },
    { value: "monthly", label: "毎月" },
];

const WEEKDAY_LABELS = ["日", "月", "火", "水", "木", "金", "土"];

const DEFAULT_FORM = {
    taskName: "",
    frequency: "daily",
    weekdays: [],
    dayOfMonth: 1,
    deadlineDays: 1,
};

export default function MacroPage() {

    useEffect(() => {
        window.scrollTo(0, 0);
    }, []);

    const navigate = useNavigate();
    const [macros, setMacros] = useState([]);
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState(DEFAULT_FORM);

    const user = auth.currentUser;

    useEffect(() => {
        if (!user) return;
        const ref = collection(db, "users", user.uid, "macros");
        const unsub = onSnapshot(ref, snap => {
            setMacros(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        });
        return () => unsub();
    }, []);

    const handleToggle = async (macro) => {
        const ref = doc(db, "users", user.uid, "macros", macro.id);
        await updateDoc(ref, { enabled: !macro.enabled });
    };

    const handleDelete = async (macro) => {
        if (!window.confirm(\`「\${macro.taskName}」を削除しますか？\`)) return;
        await deleteDoc(doc(db, "users", user.uid, "macros", macro.id));
    };

    const handleSave = async () => {
        if (!form.taskName.trim()) return;
        if (form.frequency === "weekly" && form.weekdays.length === 0) return;

        await addDoc(collection(db, "users", user.uid, "macros"), {
            ...form,
            enabled: true,
            lastTriggered: null,
            createdAt: serverTimestamp(),
        });
        setForm(DEFAULT_FORM);
        setShowForm(false);
    };

    const toggleWeekday = (day) => {
        setForm(f => ({
            ...f,
            weekdays: f.weekdays.includes(day)
                ? f.weekdays.filter(d => d !== day)
                : [...f.weekdays, day],
        }));
    };

    const freqLabel = (macro) => {
        if (macro.frequency === "daily") return "毎日";
        if (macro.frequency === "weekly") {
            return macro.weekdays.map(d => WEEKDAY_LABELS[d]).join("・") + "曜日";
        }
        return \`毎月\${macro.dayOfMonth}日\`;
    };

    return (
        <div className={styles.page}>
            <header className={styles.header}>
                <button className={styles.backBtn} onClick={() => navigate(-1)}>
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="15 18 9 12 15 6" />
                    </svg>
                </button>
                <h2 className={styles.title}>マクロ</h2>
                <button className={styles.addBtn} onClick={() => setShowForm(true)}>＋</button>
            </header>

            <p className={styles.desc}>指定した頻度で自動的にタスクを追加します。</p>

            {macros.length === 0 && !showForm && (
                <div className={styles.empty}>
                    <div className={styles.emptyIcon}>
                        <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="17 1 21 5 17 9" />
                            <path d="M3 11V9a4 4 0 014-4h14" />
                            <polyline points="7 23 3 19 7 15" />
                            <path d="M21 13v2a4 4 0 01-4 4H3" />
                        </svg>
                    </div>
                    <div className={styles.emptyText}>マクロはまだありません</div>
                    <button className={styles.emptyAddBtn} onClick={() => setShowForm(true)}>
                        最初のマクロを作成
                    </button>
                </div>
            )}

            {macros.map(macro => (
                <div key={macro.id} className={\`\${styles.macroCard} \${!macro.enabled ? styles.disabled : ""}\`}>
                    <div className={styles.macroMain}>
                        <div className={styles.macroName}>{macro.taskName}</div>
                        <div className={styles.macroMeta}>
                            {freqLabel(macro)} ・ {macro.deadlineDays === 0 ? "当日締め切り" : \`\${macro.deadlineDays}日後締め切り\`}
                        </div>
                    </div>
                    <div className={styles.macroActions}>
                        <button
                            className={\`\${styles.toggle} \${macro.enabled ? styles.toggleOn : styles.toggleOff}\`}
                            onClick={() => handleToggle(macro)}
                        >
                            {macro.enabled ? "ON" : "OFF"}
                        </button>
                        <button className={styles.deleteBtn} onClick={() => handleDelete(macro)}>
                            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="3 6 5 6 21 6" />
                                <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
                                <path d="M10 11v6M14 11v6" />
                            </svg>
                        </button>
                    </div>
                </div>
            ))}

            {showForm && (
                <div className={styles.formOverlay} onClick={() => setShowForm(false)}>
                    <div className={styles.formSheet} onClick={e => e.stopPropagation()}>
                        <div className={styles.formHandle} />
                        <h3 className={styles.formTitle}>マクロを追加</h3>

                        <div className={styles.field}>
                            <label className={styles.label}>タスク名</label>
                            <input
                                className={styles.input}
                                type="text"
                                placeholder="例: 日報を書く"
                                value={form.taskName}
                                onChange={e => setForm(f => ({ ...f, taskName: e.target.value }))}
                            />
                        </div>

                        <div className={styles.field}>
                            <label className={styles.label}>頻度</label>
                            <div className={styles.freqChips}>
                                {FREQ_OPTIONS.map(opt => (
                                    <button
                                        key={opt.value}
                                        className={\`\${styles.freqChip} \${form.frequency === opt.value ? styles.freqActive : ""}\`}
                                        onClick={() => setForm(f => ({ ...f, frequency: opt.value }))}
                                    >
                                        {opt.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {form.frequency === "weekly" && (
                            <div className={styles.field}>
                                <label className={styles.label}>曜日</label>
                                <div className={styles.weekdays}>
                                    {WEEKDAY_LABELS.map((label, i) => (
                                        <button
                                            key={i}
                                            className={\`\${styles.dayBtn} \${form.weekdays.includes(i) ? styles.dayActive : ""}\`}
                                            onClick={() => toggleWeekday(i)}
                                        >
                                            {label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {form.frequency === "monthly" && (
                            <div className={styles.field}>
                                <label className={styles.label}>日付</label>
                                <div className={styles.numberRow}>
                                    <span>毎月</span>
                                    <input
                                        type="number"
                                        min="1"
                                        max="28"
                                        className={styles.numberInput}
                                        value={form.dayOfMonth}
                                        onChange={e => setForm(f => ({ ...f, dayOfMonth: Number(e.target.value) }))}
                                    />
                                    <span>日</span>
                                </div>
                            </div>
                        )}

                        <div className={styles.field}>
                            <label className={styles.label}>締め切り</label>
                            <div className={styles.numberRow}>
                                <span>追加日の</span>
                                <input
                                    type="number"
                                    min="0"
                                    max="30"
                                    className={styles.numberInput}
                                    value={form.deadlineDays}
                                    onChange={e => setForm(f => ({ ...f, deadlineDays: Number(e.target.value) }))}
                                />
                                <span>日後</span>
                            </div>
                        </div>

                        <button className={styles.saveBtn} onClick={handleSave}>保存する</button>
                        <div className={styles.safeArea} />
                    </div>
                </div>
            )}
        </div>
    );
}
`
    },
    {
        title: "App.jsx",
        description: "React Routerを使ってログインページと保護されたメインページ群をルーティングするアプリのエントリコンポーネント",
        language: "JavaScript",
        code: `import { Route, Routes } from 'react-router-dom';
import { ROUTES } from './const';

import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import CalendarPage from "./pages/CalendarPage";
import SettingPage from "./pages/SettingPage";
import MacroPage from "./pages/MacroPage";
import CodeRefPage from "./pages/CodeRefPage";
import GuidePage from './pages/GuidePage';
import OtherAppsPage from "./pages/OtherAppsPage"

import './App.css';
import ProtectedRoute from './components/ProtectedRoute';

import Layout from "./components/Layout/Layout";
import { useDarkMode } from "./hooks/useDarkMode";
import { useState } from 'react';

function App() {

  useDarkMode();

  const [isGuest, setIsGuest] = useState(false);
  const [guestTasks, setGuestTasks] = useState([]);

  return (
    <>
      <Routes>
        <Route path={ROUTES.LOGIN}
          element={<LoginPage isGuest={isGuest} setIsGuest={setIsGuest} />}
        />

        <Route
          element={
            <ProtectedRoute isGuest={isGuest}>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route
            path={ROUTES.HOME}
            element={<HomePage isGuest={isGuest} guestTasks={guestTasks} setGuestTasks={setGuestTasks} />}
          />
          <Route
            path={ROUTES.CALENDAR}
            element={<CalendarPage isGuest={isGuest} guestTasks={guestTasks} />}
          />
          <Route path={ROUTES.SETTING} element={<SettingPage />} />
          <Route path={ROUTES.MACRO} element={<MacroPage />} />
          <Route path={ROUTES.CODE_REF} element={<CodeRefPage />} />
          <Route path={ROUTES.GUIDE} element={<GuidePage />} />
          <Route path={ROUTES.OTHER_APPS} element={<OtherAppsPage />} />
        </Route>
      </Routes>
    </>
  );
}

export default App;
`,
    },
    {
        title: "LoginPage.jsx",
        description: "Firebase認証を使ってメール・パスワードやGoogleアカウントでログイン・新規登録を行い、認証状態に応じてホームページへ遷移するReactログインページコンポーネント",
        language: "JavasSript",
        code: `import { useEffect, useState } from "react";
import { LOGIN_PAGE_SUBTITLE } from "../const";
import styles from "./LoginPage.module.css";

import { useNavigate } from "react-router-dom";

import { auth } from "../firebase";
import {
    signInWithEmailAndPassword,
    GoogleAuthProvider,
    signInWithPopup,
    signInWithRedirect,
    getRedirectResult,
    onAuthStateChanged,
    createUserWithEmailAndPassword,
    sendEmailVerification,
} from "firebase/auth";

export default function LoginPage({ isGuest, setIsGuest }) {

    const [subtitle] = useState(() =>
        LOGIN_PAGE_SUBTITLE[Math.floor(Math.random() * LOGIN_PAGE_SUBTITLE.length)]
    );

    const navigate = useNavigate();

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");

    const [errorMessage, setErrorMessage] = useState("");
    // useEffect(() => {
    //     if (errorMessage) {
    //         alert(errorMessage);
    //         setErrorMessage("");
    //     }
    // }, [errorMessage]);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (user) navigate("/home");
        });

        getRedirectResult(auth).catch((error) => {
            console.error(error);
            setErrorMessage("Googleログインに失敗しました");
        });

        return () => unsubscribe();
    }, []);

    const handleLogin = async () => {
        try {
            const userCredential = await signInWithEmailAndPassword(auth, email, password);

            if (!userCredential.user.emailVerified) {
                setErrorMessage("メール確認をしてください");
                return;
            }

            navigate("/home");

        } catch (error) {
            if (error.code === "auth/user-not-found") {
                setErrorMessage("ユーザーが存在しません");
            } else if (error.code === "auth/wrong-password") {
                setErrorMessage("パスワードが間違っています");
            } else {
                setErrorMessage("ログインに失敗しました");
            }
        }
    };

    const handleGoogleLogin = async () => {
        const provider = new GoogleAuthProvider();
        const fmt = (e) => e?.code ? \`\${e.code}\` : \`\${e?.name}: \${e?.message}\`;
        try {
            await signInWithPopup(auth, provider);
        } catch (error) {
            if (error.code === "auth/popup-cancelled-by-user") {
                return;
            }
            if (error.code === "auth/popup-blocked") {
                try {
                    await signInWithRedirect(auth, provider);
                } catch (e) {
                    setErrorMessage(fmt(e));
                }
            } else {
                setErrorMessage(fmt(error));
            }
        }
    };

    const handleRegister = async () => {

        if (!email || !password) {
            setErrorMessage("メールとパスワードを入力してください");
            return;
        }

        try {
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);

            await sendEmailVerification(userCredential.user);
            await auth.signOut();
            setErrorMessage("確認メールを送信しました");
            navigate("/");

        } catch (error) {
            if (error.code === "auth/email-already-in-use") {
                setErrorMessage("このメールは既に登録されています");
            } else if (error.code === "auth/invalid-email") {
                setErrorMessage("メールアドレスの形式が正しくありません");
            } else if (error.code === "auth/weak-password") {
                setErrorMessage("パスワードは6文字以上にしてください");
            } else {
                setErrorMessage("登録に失敗しました");
            }
        }
    };

    return (
        <div className={styles.container}>
            <div className={styles.card}>
                <h1 className={styles.title}>OnTime</h1>
                <p className={errorMessage ? styles.error : styles.subtitle}>
                    {errorMessage || subtitle}
                </p>

                <input
                    type="email"
                    placeholder="メールアドレス"
                    className={styles.input}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                />

                <input
                    type="password"
                    placeholder="パスワード"
                    className={styles.input}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                />

                <button className={styles.button} onClick={handleLogin}>
                    ログイン
                </button>

                <button className={\`\${styles.googleButton} \${styles.button}\`} onClick={handleGoogleLogin}>
                    <img className={styles.img} src="/images/google-logo.png" alt="" />
                    Googleでログイン
                </button>

                <button className={styles.button} onClick={handleRegister}>
                    新規登録
                </button>

                <button
                    className={styles.button}
                    onClick={() => {
                        setIsGuest(true);
                        navigate("/home");
                        alert("ゲストログインの場合、「データの保存」「カレンダー機能」「マクロ機能」等がご利用いただけません。")
                    }}
                >
                    ログインせずに使う
                </button>
            </div>
        </div>
    );
}
`,
    },
    {
        title: "useNotification.js",
        description: "Reactでタスクの期限が近づいたときにブラウザ通知を送るカスタムフックuseNotifications",
        language: "JavaScript",
        code: `import { useEffect, useRef } from "react";
        
export function useNotifications(tasks, enabled, notifyMinutes = 1440) {
    const notifiedRef = useRef(new Set());

    useEffect(() => {
        if (!enabled) return;
        if (!("Notification" in window)) return;
        if (Notification.permission !== "granted") return;

        const checkDeadlines = () => {
            const now = new Date();
            tasks.forEach(task => {
                if (task.completed) return;
                const deadline = typeof task.deadline?.toDate === "function"
                    ? task.deadline.toDate()
                    : new Date(task.deadline);
                const diffMs = deadline - now;
                const diffMin = diffMs / 60000;

                const key = \`\${task.id}_\${notifyMinutes}\`;
                if (diffMin > 0 && diffMin <= notifyMinutes && !notifiedRef.current.has(key)) {
                    notifiedRef.current.add(key);
                    const diffH = Math.floor(diffMin / 60);
                    const remaining = diffH >= 1
                        ? \`あと\${diffH}時間\`
                        : \`あと\${Math.ceil(diffMin)}分\`;
                    new Notification("OnTime - 期限が近づいています", {
                        body: \`「\${task.taskName}」の期限まで\${remaining}です\`,
                        icon: "/images/app-logo.png",
                    });
                }
            });
        };

        checkDeadlines();
        const interval = setInterval(checkDeadlines, 60000);
        return () => clearInterval(interval);
    }, [tasks, enabled, notifyMinutes]);
}
`
    },
    {
        title: "index.css",
        description: "ダークモード用にCSSの変数を設定しているCSSファイル",
        language: "CSS",
        code: `/* ===== CSS Variables (Light / Dark) ===== */
:root {
  --bg-page: #f8f8f8;
  --bg-card: #ffffff;
  --bg-card-alt: #f3f4f6;
  --bg-footer: rgba(255, 255, 255, 0.75);
  --bg-footer-border: rgba(255, 255, 255, 0.6);
  --bg-input: #ffffff;
  --bg-preset: #ffffff;

  --text-primary: #111111;
  --text-secondary: #555555;
  --text-muted: #9ca3af;
  --text-deadline: #666666;

  --border: #e5e7eb;
  --border-focus: #6c5ce7;
  --divider: #f3f4f6;

  --brand: #6c5ce7;
  --brand-hover: #5941c7;
  --brand-focus-ring: rgba(108, 92, 231, 0.15);

  --shadow-card: 0 4px 12px rgba(0, 0, 0, 0.08);
  --shadow-footer: 0 8px 32px rgba(0, 0, 0, 0.1);
  --shadow-user-icon: 0 2px 8px rgba(0, 0, 0, 0.08);

  --color-danger: #ef4444;
  --color-danger-bg: #fef2f2;
  --color-danger-border: #fca5a5;
  --color-warning: #f59e0b;
  --color-success: #4caf50;
  --color-blue: rgb(59, 130, 246);

  --footer-inactive: #aab0bb;
  --footer-active-bg: #f0f0f5;
  --footer-active-dot: #111;

  --gauge-bg: #e5e7eb;

  --completed-bg: #f3f4f6;
  --completed-text: #9ca3af;
  --completed-border: #999;

  --tag-bg: #ede9fe;
  --tag-text: #5b21b6;

  --toast-bg: #1c1c1e;
  --toast-text: #f2f2f7;
  --toast-undo: #a78bfa;
}

[data-theme="dark"] {
  --bg-page: #0f0f0f;
  --bg-card: #1c1c1e;
  --bg-card-alt: #2c2c2e;
  --bg-footer: rgba(28, 28, 30, 0.85);
  --bg-footer-border: rgba(255, 255, 255, 0.08);
  --bg-input: #2c2c2e;
  --bg-preset: #2c2c2e;

  --text-primary: #f2f2f7;
  --text-secondary: #aeaeb2;
  --text-muted: #636366;
  --text-deadline: #8e8e93;

  --border: #3a3a3c;
  --border-focus: #a78bfa;
  --divider: #2c2c2e;

  --brand: #a78bfa;
  --brand-hover: #7c3aed;
  --brand-focus-ring: rgba(167, 139, 250, 0.2);

  --shadow-card: 0 4px 12px rgba(0, 0, 0, 0.3);
  --shadow-footer: 0 8px 32px rgba(0, 0, 0, 0.4);
  --shadow-user-icon: 0 2px 8px rgba(0, 0, 0, 0.3);

  --color-danger: #f87171;
  --color-danger-bg: #3b1f1f;
  --color-danger-border: #7f1d1d;
  --color-warning: #fbbf24;
  --color-success: #34d399;
  --color-blue: rgb(96, 165, 250);

  --footer-inactive: #636366;
  --footer-active-bg: #2c2c2e;
  --footer-active-dot: #f2f2f7;

  --gauge-bg: #3a3a3c;

  --completed-bg: #2c2c2e;
  --completed-text: #636366;
  --completed-border: #4b5563;

  --tag-bg: #3b2d6e;
  --tag-text: #c4b5fd;

  --toast-bg: #f2f2f7;
  --toast-text: #1c1c1e;
  --toast-undo: #6c5ce7;
}

* {
  box-sizing: border-box;
}

input, textarea, select {
  font-size: max(16px, 1em) !important;
}

body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  background: var(--bg-page);
  color: var(--text-primary);
  transition: background 0.2s ease, color 0.2s ease;
}
`
    },
    {
        title: "index.html",
        description: "HTMLファイル",
        language: "HTML",
        code: `<!doctype html>
<html lang="ja">

<head>
  <meta charset="UTF-8" />

  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>OnTime</title>
  <link rel="manifest" href="/manifest.json" />
  <link rel="apple-touch-icon" href="/images/app-logo2.png" />
  <meta name="apple-mobile-web-app-capable" content="yes" />
  <meta name="apple-mobile-web-app-status-bar-style" content="default" />
  <meta name="apple-mobile-web-app-title" content="OnTime" />
</head>

<body>
  <div id="root"></div>
  <script type="module" src="/src/main.jsx"></script>
</body>

</html>
`
    },
    {
        title: "firebase.js",
        description: "FirebaseのAPIを取得しているJavaScriptファイル",
        language: "JavaScript",
        code: `import { initializeApp } from "firebase/app";
        import { getFirestore } from "firebase/firestore";
        import { getAuth } from "firebase/auth";
        
        const firebaseConfig = {
          apiKey: import.meta.env.VITE_API_KEY,
          authDomain: import.meta.env.VITE_AUTH_DOMAIN,
          projectId: import.meta.env.VITE_PROJECT_ID,
          storageBucket: import.meta.env.VITE_STORAGE_BUCKET,
          messagingSenderId: import.meta.env.VITE_MESSAGING_SENDER_ID,
          appId: import.meta.env.VITE_APP_ID,
        };
        
        const app = initializeApp(firebaseConfig);
        
        export const db = getFirestore(app);
        export const auth = getAuth(app);
`
    },
    {
        title: "HomePage.jsx",
        description: "ホームページのJSXファイル。日時の取得やuseOutletContext()で親から子へのプロップス渡している",
        language: "JavaScript",
        code: `import { useState } from "react";
import styles from "./HomePage.module.css";

import { useOutletContext } from "react-router-dom";

import { db } from "../firebase";
import { addDoc, collection } from "firebase/firestore";

import TaskInput from "../components/TaskInput/TaskInput";
import TaskList from "../components/TaskList/TaskList";
import ProfileMenu from "../components/ProfileMenu/ProfileMenu";

export default function HomePage({ isGuest }) {

    const { user, tasks, sortType, setSortType, showToast } = useOutletContext();
    const [showMenu, setShowMenu] = useState(false);

    const today = new Date();
    const dateStr = today.toLocaleDateString("ja-JP", {
        month: "long",
        day: "numeric",
        weekday: "short",
    });

    const activeCount = tasks.filter(t => !t.completed).length;

    const todayCount = tasks.filter(t => {
        if (t.completed) return false;
        const dl = t.deadline?.toDate ? t.deadline.toDate() : new Date(t.deadline);
        return (
            dl.getFullYear() === today.getFullYear() &&
            dl.getMonth() === today.getMonth() &&
            dl.getDate() === today.getDate()
        );
    }).length;

    const [guestTasks, setGuestTasks] = useState([]);
    const allTasks = isGuest ? [...tasks, ...guestTasks] : tasks;

    const handleAddTask = async (task) => {

        if (isGuest) {
            const newTask = {
                taskName: task.taskName,
                deadline: new Date(task.deadline),
                startDate: task.startDate ? new Date(task.startDate) : null,
                description: task.description || null,
                tags: task.tags ?? [],
                completed: false,
                createdAt: new Date()
            };
            
            showToast("ゲストモード：保存されません");
            
            setGuestTasks(prev => [...prev, newTask]);
            return;
        }

        if (!user) return;

        await addDoc(
            collection(db, "users", user.uid, "tasks"),
            {
                taskName: task.taskName,
                deadline: new Date(task.deadline),
                startDate: task.startDate ? new Date(task.startDate) : null,
                description: task.description || null,
                tags: task.tags ?? [],
                completed: false,
                createdAt: new Date()
            }
        );
    };

    return (
        <div className={styles.home}>

            <header className={styles.header}>
                <div>
                    <div className={styles.date}>{dateStr}</div>
                    <div className={styles.taskCountRow}>
                        <span className={styles.taskCount}>
                            {activeCount === 0 ? "タスクはありません" : \`\${activeCount}件のタスク\`}
                        </span>
                        {todayCount > 0 && (
                            <span className={styles.todayBadge}>今日 {todayCount}件</span>
                        )}
                    </div>
                </div>
                <button className={styles.userIcon} onClick={() => setShowMenu(true)}>
                    {user?.photoURL
                        ? <img src={user.photoURL} alt="user" className={styles.userPhoto} />
                        : "👤"
                    }
                </button>
            </header>

            <TaskInput onAddTask={handleAddTask} allTags={[...new Set(allTasks.flatMap(t => t.tags ?? []))]} />

            <TaskList tasks={allTasks} sortType={sortType} setSortType={setSortType} showToast={showToast} />

            {showMenu && <ProfileMenu onClose={() => setShowMenu(false)} />}

        </div>
    );
}
`
    },
    {
        title: "TaskList.jsx",
        description: "ソートロジックやデバウンスを記述しているJSXファイル",
        language: "JavaScript",
        code: `import { useState, useEffect } from "react";
import TaskCard from "../TaskCard/TaskCard.jsx";
import SortChips from "../SortChips/SortChips.jsx";
import styles from "./TaskList.module.css";
import { getTagStyle } from "../../utils/tagColors";

export default function TaskList({ tasks, sortType, setSortType, showToast }) {

    const [searchQuery, setSearchQuery] = useState("");
    const [debouncedQuery, setDebouncedQuery] = useState("");
    const [selectedTags, setSelectedTags] = useState([]);

    // デバウンス: 300ms
    useEffect(() => {
        const timer = setTimeout(() => setDebouncedQuery(searchQuery), 300);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    const getDeadline = (task) => {
        if (typeof task.deadline?.toDate === "function") return task.deadline.toDate();
        return new Date(task.deadline);
    };

    const allTags = [...new Set(tasks.flatMap(t => t.tags ?? []))];

    const toggleTag = (tag) => {
        setSelectedTags(prev =>
            prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
        );
    };

    let filtered = tasks;

    if (debouncedQuery.trim()) {
        filtered = filtered.filter(t =>
            t.taskName.toLowerCase().includes(debouncedQuery.toLowerCase())
        );
    }

    if (selectedTags.length > 0) {
        filtered = filtered.filter(t =>
            selectedTags.every(tag => (t.tags ?? []).includes(tag))
        );
    }

    const starFirst = (arr) => {
        const starred = arr.filter(t => t.starred);
        const normal  = arr.filter(t => !t.starred);
        return [...starred, ...normal];
    };

    const sortCompleted = (arr) => {
        return [...arr].sort((a, b) => {
            const aTime = a.completedAt?.toDate ? a.completedAt.toDate() : new Date(a.completedAt ?? 0);
            const bTime = b.completedAt?.toDate ? b.completedAt.toDate() : new Date(b.completedAt ?? 0);
            return bTime - aTime;
        });
    };

    let displayTasks = [...filtered];

    if (sortType === "short") {
        const incomplete = filtered.filter(t => !t.completed).sort((a, b) => getDeadline(a) - getDeadline(b));
        const completed  = sortCompleted(filtered.filter(t => t.completed));
        displayTasks = [...starFirst(incomplete), ...completed];
    }
    if (sortType === "recent") {
        const sorted = [...filtered].sort((a, b) => {
            const aTime = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
            const bTime = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
            return bTime - aTime;
        });
        const incomplete = sorted.filter(t => !t.completed);
        const completed  = sortCompleted(filtered.filter(t => t.completed));
        displayTasks = [...starFirst(incomplete), ...completed];
    }
    if (sortType === "long") {
        const sorted = filtered.filter(t => !t.completed).sort((a, b) => getDeadline(b) - getDeadline(a));
        displayTasks = starFirst(sorted);
    }
    if (sortType === "completed") {
        displayTasks = sortCompleted(filtered.filter(t => t.completed));
    }

    return (
        <div className={styles.container}>
            <div className={styles.sortBar}>
                <div className={styles.sortTitle}>タスク一覧</div>
            </div>

            <div className={styles.searchBar}>
                <input
                    type="text"
                    className={styles.searchInput}
                    placeholder="タスクを検索..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
                {searchQuery && (
                    <button className={styles.searchClear} onClick={() => setSearchQuery("")}>
                        ✕
                    </button>
                )}
            </div>

            {allTags.length > 0 && (
                <div className={styles.tagFilter}>
                    {allTags.map(tag => {
                        const active = selectedTags.includes(tag);
                        const ts = getTagStyle(tag);
                        return (
                            <button
                                key={tag}
                                className={\`\${styles.tagFilterChip} \${active ? styles.active : ""}\`}
                                style={active ? { backgroundColor: ts.backgroundColor, color: ts.color, borderColor: ts.backgroundColor } : {}}
                                onClick={() => toggleTag(tag)}
                            >
                                {tag}
                            </button>
                        );
                    })}
                </div>
            )}

            <SortChips value={sortType} onChange={setSortType} />

            <div className={styles.list}>
                {displayTasks.length === 0 ? (
                    <div className={styles.empty}>
                        {debouncedQuery || selectedTags.length > 0 ? "条件に一致するタスクはありません" : "タスクはありません"}
                    </div>
                ) : (
                    displayTasks.map(task => (
                        <TaskCard key={task.id} task={task} showToast={showToast} allTags={allTags} />
                    ))
                )}
            </div>
        </div>
    );
}
`
    },
    {
        title: "TaskCard.jsx",
        description: "タスクカードの操作や属性、値の全てを管理しているJSXファイル",
        language: "JavaScript",
        code: `import styles from "./TaskCard.module.css";

import { useState, useEffect, useRef } from "react";
import { db } from "../../firebase";
import { doc, updateDoc, deleteDoc } from "firebase/firestore";
import { useAuthUser } from "../../hooks/useAuthUser";

import TaskEditModal from "../TaskEditModal/TaskEditModal";
import TagChip from "../TagChip/TagChip";

export default function TaskCard({ task, showToast, allTags = [] }) {

    const [now, setNow] = useState(new Date());
    const [isExpanded, setIsExpanded] = useState(false);
    const [description, setDescription] = useState(task.description ?? "");
    const [showEdit, setShowEdit] = useState(false);
    const pendingDeleteRef = useRef(null);

    const [swipeX, setSwipeX] = useState(0);
    const [isDragging, setIsDragging] = useState(false);
    const touchStartXRef = useRef(null);

    useEffect(() => {
        const timer = setInterval(() => {
            setNow(new Date());
        }, 60000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        setDescription(task.description ?? "");
    }, [task.description]);

    const getDate = (val) => {
        if (typeof val?.toDate === "function") return val.toDate();
        return new Date(val);
    };

    const deadline = getDate(task.deadline);
    const createdAt = getDate(task.createdAt);

    const diffMs = deadline.getTime() - now.getTime();
    const diffMinutes = Math.ceil(diffMs / (1000 * 60));
    const diffHours = Math.ceil(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);
    const remainHours = diffHours % 24;

    const isExpired = diffHours <= 0 && !task.completed;
    const isDanger = diffHours > 0 && diffHours <= 24 && !task.completed;

    const user = useAuthUser();

    const handleDragStart = (clientX) => {
        touchStartXRef.current = clientX;
        setIsDragging(true);
    };

    const handleDragMove = (clientX) => {
        if (touchStartXRef.current === null) return;
        const dx = clientX - touchStartXRef.current;
        if (dx < 0) {
            setSwipeX(Math.max(dx, -120));
        } else if (dx > 0) {
            setSwipeX(Math.min(dx, 120));
        }
    };

    const handleDragEnd = () => {
        if (touchStartXRef.current === null) return;
        setIsDragging(false);
        if (swipeX < -80) {
            task.completed ? uncompleteTask() : completeTask();
        } else if (swipeX > 80) {
            toggleStar({ stopPropagation: () => {} });
        }
        setSwipeX(0);
        touchStartXRef.current = null;
    };

    const handleTouchStart = (e) => handleDragStart(e.touches[0].clientX);
    const handleTouchMove = (e) => handleDragMove(e.touches[0].clientX);
    const handleTouchEnd = () => handleDragEnd();

    const handleMouseDown = (e) => handleDragStart(e.clientX);
    const handleMouseMove = (e) => {
        if (touchStartXRef.current === null) return;
        handleDragMove(e.clientX);
    };
    const handleMouseUp = () => handleDragEnd();
    const handleMouseLeave = () => handleDragEnd();

    const toggleStar = async (e) => {
        e.stopPropagation();
        if (!user) return;
        const taskRef = doc(db, "users", user.uid, "tasks", task.id);
        await updateDoc(taskRef, { starred: !task.starred });
    };

    const completeTask = async () => {
        if (!user) return;
        const taskRef = doc(db, "users", user.uid, "tasks", task.id);
        await updateDoc(taskRef, { completed: true, completedAt: new Date() });

        if (showToast) {
            showToast("タスクを完了しました", async () => {
                await updateDoc(taskRef, { completed: false, completedAt: null });
            });
        }
    };

    const uncompleteTask = async () => {
        if (!user) return;
        const taskRef = doc(db, "users", user.uid, "tasks", task.id);
        await updateDoc(taskRef, { completed: false, completedAt: null });

        if (showToast) {
            showToast("未完了に戻しました", async () => {
                await updateDoc(taskRef, { completed: true, completedAt: new Date() });
            });
        }
    };

    const deleteTask = () => {
        if (!user) return;

        const taskRef = doc(db, "users", user.uid, "tasks", task.id);

        if (pendingDeleteRef.current) {
            clearTimeout(pendingDeleteRef.current);
        }

        pendingDeleteRef.current = setTimeout(async () => {
            await deleteDoc(taskRef);
            pendingDeleteRef.current = null;
        }, 5000);

        if (showToast) {
            showToast("タスクを削除しました", () => {
                if (pendingDeleteRef.current) {
                    clearTimeout(pendingDeleteRef.current);
                    pendingDeleteRef.current = null;
                }
            });
        }
    };

    const handleDescriptionBlur = async () => {
        if (!user) return;
        const taskRef = doc(db, "users", user.uid, "tasks", task.id);
        await updateDoc(taskRef, { description: description || null });
    };

    const formatRemain = () => {
        if (task.completed) return "完了済み";
        if (isExpired) return "期限切れ";
        if (diffMinutes < 60) return \`残り \${diffMinutes}分\`;
        if (diffDays > 0) return \`残り \${diffDays}日\${remainHours}時間\`;
        return \`残り \${diffHours}時間\`;
    };

    const totalMs = deadline.getTime() - createdAt.getTime();
    const elapsedMs = now.getTime() - createdAt.getTime();
    let progress = elapsedMs / totalMs;
    progress = Math.min(Math.max(progress, 0), 1);
    const remainRatio = 1 - progress;

    let baseColor = "59, 130, 246";
    if (isDanger) {
        baseColor = "239, 68, 68";
    } else if (remainRatio < 0.5) {
        baseColor = "245, 158, 11";
    }

    const backgroundStyle =
        task.completed
            ? undefined
            : isExpired
                ? undefined
                : \`linear-gradient(to right, rgba(\${baseColor}, 0.12) \${remainRatio * 100}%, transparent \${remainRatio * 100}%)\`;

    const tags = task.tags ?? [];

    const completeRevealOpacity = Math.min(Math.max(-swipeX, 0) / 80, 1);
    const starRevealOpacity = Math.min(Math.max(swipeX, 0) / 80, 1);

    return (
        <>
            <div className={styles.swipeContainer}>
            <div className={styles.swipeBgLeft} style={{ opacity: starRevealOpacity }}>
                {task.starred ? "★ 重要解除" : "★ 重要に追加"}
            </div>
            <div
                className={styles.swipeBg}
                style={{ opacity: completeRevealOpacity }}
            >
                {task.completed ? "↩ 未完了に戻す" : "✓ 完了"}
            </div>
            <div
                className={\`
                    \${styles.card}
                    \${isDanger ? styles.danger : ""}
                    \${isExpired ? styles.expired : ""}
                    \${task.completed ? styles.completed : ""}
                \`}
                style={{
                    background: backgroundStyle,
                    transform: \`translateX(\${swipeX}px)\`,
                    transition: isDragging ? "background 0.4s ease" : "transform 0.3s ease, background 0.4s ease",
                }}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseLeave}
            >
                <div className={styles.left}>
                    <div className={styles.titleRow}>
                        <button
                            className={\`\${styles.starBtn} \${task.starred ? styles.starred : ""}\`}
                            onClick={toggleStar}
                            title={task.starred ? "重要から外す" : "重要に追加"}
                        >
                            {task.starred ? "★" : "☆"}
                        </button>
                        <div className={styles.title}>{task.taskName}</div>
                    </div>
                    <div className={styles.deadline}>
                        期限: {deadline.toLocaleString()}
                    </div>
                    {tags.length > 0 && (
                        <div className={styles.tagList}>
                            {tags.map((tag, i) => (
                                <TagChip key={i} tag={tag} readonly />
                            ))}
                        </div>
                    )}
                </div>

                <div className={styles.right}>
                    <div className={styles.time}>{formatRemain()}</div>
                    <div className={styles.buttons}>
                        {!task.completed && (
                            <button className={styles.doneBtn} onClick={completeTask}>完了</button>
                        )}
                        <button className={styles.editBtn} onClick={() => setShowEdit(true)}>編集</button>
                        <button className={styles.deleteBtn} onClick={deleteTask}>削除</button>
                    </div>
                </div>

                <div className={styles.expandRow}>
                    <button
                        className={styles.expandBtn}
                        onClick={() => setIsExpanded(v => !v)}
                    >
                        <span className={\`\${styles.expandIcon} \${isExpanded ? styles.open : ""}\`}>▼</span>
                        {description ? "メモあり" : "メモを追加"}
                    </button>
                </div>

                {isExpanded && (
                    <div className={styles.expandedArea}>
                        <textarea
                            className={styles.descriptionTextarea}
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            onBlur={handleDescriptionBlur}
                            placeholder="メモを入力..."
                        />
                    </div>
                )}

                {!task.completed && !isExpired && (
                    <div className={styles.gaugeWrapper}>
                        <div
                            className={styles.gauge}
                            style={{
                                width: \`\${remainRatio * 100}%\`,
                                backgroundColor: isDanger
                                    ? "rgb(239, 68, 68)"
                                    : remainRatio < 0.5
                                        ? "rgb(245, 158, 11)"
                                        : "rgb(59, 130, 246)"
                            }}
                        />
                    </div>
                )}
            </div>
            </div>

            {showEdit && (
                <TaskEditModal
                    task={task}
                    onClose={() => setShowEdit(false)}
                    allTags={allTags}
                />
            )}
        </>
    );
}
`
    },
    // {
    //     title: "タイトル",
    //     description: "説明（省略可）",
    //     language: "javascript",
    //     code: `コード本文`
    // },
];
