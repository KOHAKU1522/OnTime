import { useState } from "react";
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

    // ゲストモード用の追加タスク
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
                            {activeCount === 0 ? "タスクはありません" : `${activeCount}件のタスク`}
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
