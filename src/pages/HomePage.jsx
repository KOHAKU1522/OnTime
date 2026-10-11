import { useState } from "react";
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
                        <span className={styles.periodBadge}>今週 {weekCount}件</span>
                        <span className={styles.periodBadge}>今月 {monthCount}件</span>
                    </div>
                </div>
                <button className={styles.userIcon} onClick={() => setShowMenu(true)}>
                    {user?.photoURL
                        ? <img src={user.photoURL} alt="user" className={styles.userPhoto} />
                        : "👤"
                    }
                </button>
            </header>

            {/* オフのときはコンポーネント自体を描画せず、ニュースも取得しない */}
            {newsEnabled && <News timeZone={timeZone} />}

            <NaturalTaskInput onAddTask={handleAddTask} isGuest={isGuest} timeZone={timeZone} weekStartsOn={settings.weekStartsOn} />

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
