import { useEffect, useRef, useState } from "react";
import styles from "./HomePage.module.css";

import { useOutletContext } from "react-router-dom";

import { db } from "../firebase";
import { addDoc, collection } from "firebase/firestore";
import { toDate, getDayRange, getWeekRange, getMonthRange, isInRange, formatInZone, fromZonedInputValue } from "../utils/date";

import TaskInput from "../components/TaskInput/TaskInput";
import TaskList from "../components/TaskList/TaskList";
import ProfileMenu from "../components/ProfileMenu/ProfileMenu";
import News from "../components/News/News";
import { useNewsEnabled } from "../hooks/useNewsEnabled";
import NaturalTaskInput from "../components/NaturalTaskInput/NaturalTaskInput";
import { reportFirestoreError } from "../utils/firestoreError";

export default function HomePage({ isGuest }) {

    const { user, tasks, sortType, setSortType, showToast, settings, updateSettings } = useOutletContext();
    const [showMenu, setShowMenu] = useState(false);
    const [newsEnabled] = useNewsEnabled();
    const [showAiInstructions, setShowAiInstructions] = useState(false);
    const aiToggleRef = useRef(null);
    const aiCloseButtonRef = useRef(null);

    useEffect(() => {
        if (!showAiInstructions) return;
        const previousOverflow = document.body.style.overflow;
        const aiToggleButton = aiToggleRef.current;
        document.body.style.overflow = "hidden";

        const handleKeyDown = (event) => {
            if (event.key === "Escape") setShowAiInstructions(false);
        };
        window.addEventListener("keydown", handleKeyDown);
        aiCloseButtonRef.current?.focus();

        return () => {
            document.body.style.overflow = previousOverflow;
            window.removeEventListener("keydown", handleKeyDown);
            aiToggleButton?.focus();
        };
    }, [showAiInstructions]);

    const timeZone = settings.timeZone;
    const today = new Date();
    const dateStr = formatInZone(today, timeZone, {
        month: "long",
        day: "numeric",
        weekday: "short",
    });

    // 入力欄の "YYYY-MM-DDTHH:mm" を設定タイムゾーンの時刻として解釈する
    const parseInput = (value) => (value ? fromZonedInputValue(value, timeZone) : null);

    const activeCount = tasks.filter(t => !t.completed).length;

    // ゲストモード用の追加タスク
    const [guestTasks, setGuestTasks] = useState([]);
    const allTasks = isGuest ? [...tasks, ...guestTasks] : tasks;

    // 期限が今日・今週・今月の範囲にある未完了タスク数（週は設定した開始曜日から）
    const activeDeadlines = allTasks.filter(t => !t.completed).map(t => toDate(t.deadline)).filter(Boolean);
    const countIn = (range) => activeDeadlines.filter(d => isInRange(d, range)).length;
    const todayCount = countIn(getDayRange(today, timeZone));
    const weekCount = countIn(getWeekRange(today, settings.weekStartsOn, timeZone));
    const monthCount = countIn(getMonthRange(today, timeZone));

    const handleAddTask = async (task) => {

        if (isGuest) {
            const newTask = {
                taskName: task.taskName,
                deadline: parseInput(task.deadline),
                startDate: parseInput(task.startDate),
                description: task.description || null,
                tags: task.tags ?? [],
                starred: task.starred === true,
                completed: false,
                createdAt: new Date()
            };
            
            showToast("ゲストモード：保存されません");
            
            setGuestTasks(prev => [...prev, newTask]);
            return true;
        }

        if (!user) return false;

        try {
            await addDoc(
                collection(db, "users", user.uid, "tasks"),
                {
                    taskName: task.taskName,
                    deadline: parseInput(task.deadline),
                    startDate: parseInput(task.startDate),
                    description: task.description || null,
                    tags: task.tags ?? [],
                    starred: task.starred === true,
                    completed: false,
                    createdAt: new Date()
                }
            );
            return true;
        } catch (err) {
            showToast(reportFirestoreError("タスクを追加できませんでした", err, `users/${user.uid}/tasks`));
            return false;
        }
    };

    return (
        <div className={styles.home}>
            <header className={styles.header}>
                <div>
                    <div className={styles.date}>{dateStr}</div>
                    <div className={styles.taskCountRow}>
                        <span className={styles.taskCount}>
                            {activeCount === 0 ? "タスクはありません" : `${activeCount}件のタスク`}
                        </span>
                    </div>
                    <div className={styles.periodRow} aria-label="期限が近い未完了タスク数">
                        <span className={todayCount > 0 ? styles.todayBadge : styles.periodBadge}>今日 {todayCount}件</span>
                        <span className={weekCount > 0 ? styles.weekBadge : styles.periodBadge}>今週 {weekCount}件</span>
                        <span className={monthCount > 0 ? styles.monthBadge : styles.periodBadge}>今月 {monthCount}件</span>
                    </div>
                </div>
                <button className={styles.userIcon} onClick={() => setShowMenu(true)}>
                    {user?.photoURL
                        ? <img src={user.photoURL} alt="user" className={styles.userPhoto} />
                        : "👤"
                    }
                </button>
            </header>

            {newsEnabled && <News timeZone={timeZone} />}

            <button
                ref={aiToggleRef}
                type="button"
                className={`${styles.panelToggle} ${styles.aiPanelToggle}`}
                onClick={() => setShowAiInstructions(true)}
                disabled={isGuest}
                aria-label={isGuest ? "AIへの指示はログイン後に利用できます" : "AIへの指示を開く"}
                aria-expanded={showAiInstructions && !isGuest}
                aria-controls="home-ai-instructions-dialog"
                title={isGuest ? "AIへの指示はログイン後に利用できます" : "AIへの指示を開く"}
            >
                <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="url(#ai-brain-rainbow)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <defs>
                        <linearGradient id="ai-brain-rainbow" x1="3" y1="5" x2="21" y2="19" gradientUnits="userSpaceOnUse">
                            <stop stopColor="#ef4444" />
                            <stop offset="0.2" stopColor="#f59e0b" />
                            <stop offset="0.4" stopColor="#eab308" />
                            <stop offset="0.6" stopColor="#22c55e" />
                            <stop offset="0.8" stopColor="#3b82f6" />
                            <stop offset="1" stopColor="#a855f7" />
                        </linearGradient>
                    </defs>
                    <path d="M12 5.1a3.2 3.2 0 0 0-5.9 1.6 3.3 3.3 0 0 0-1.5 5.8 3.2 3.2 0 0 0 2.1 5.3 3.1 3.1 0 0 0 5.3 1.2V5.1Z" />
                    <path d="M12 5.1a3.2 3.2 0 0 1 5.9 1.6 3.3 3.3 0 0 1 1.5 5.8 3.2 3.2 0 0 1-2.1 5.3 3.1 3.1 0 0 1-5.3 1.2V5.1Z" />
                    <path d="M12 5v14M8 8.5h2M7.3 12h3M8.5 15.5h2M16 8.5h-2m2.7 3.5h-3m2.5 3.5h-2" />
                </svg>
            </button>

            {showAiInstructions && !isGuest && (
                <div
                    className={styles.aiBackdrop}
                    onClick={(event) => {
                        if (event.target === event.currentTarget) setShowAiInstructions(false);
                    }}
                >
                    <section
                        id="home-ai-instructions-dialog"
                        className={styles.aiDialog}
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="home-ai-instructions-title"
                    >
                        <header className={styles.aiDialogHeader}>
                            <h2 id="home-ai-instructions-title" className={styles.aiDialogTitle}>AIへの指示</h2>
                            <button
                                ref={aiCloseButtonRef}
                                type="button"
                                className={styles.aiDialogClose}
                                onClick={() => setShowAiInstructions(false)}
                                aria-label="AIへの指示を閉じる"
                                title="閉じる"
                            >
                                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                                    <path d="m18 6-12 12M6 6l12 12" />
                                </svg>
                            </button>
                        </header>
                        <NaturalTaskInput
                            onAddTask={handleAddTask}
                            isGuest={isGuest}
                            timeZone={timeZone}
                            weekStartsOn={settings.weekStartsOn}
                            embedded
                        />
                    </section>
                </div>
            )}

            <TaskInput onAddTask={handleAddTask} timeZone={timeZone} allTags={[...new Set(allTasks.flatMap(t => t.tags ?? []))]} />

            <TaskList
                tasks={allTasks}
                user={user}
                timeZone={timeZone}
                sortType={sortType}
                setSortType={setSortType}
                showToast={showToast}
                starredFirst={settings.starredFirst}
                onStarredFirstChange={(value) => updateSettings({ starredFirst: value })}
            />

            {showMenu && <ProfileMenu onClose={() => setShowMenu(false)} />}

        </div>
    );
}
