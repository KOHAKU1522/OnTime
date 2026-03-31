import { useState } from "react";
import { useOutletContext } from "react-router-dom";
import GanttView from "../components/GanttView/GanttView";
import SortChips from "../components/SortChips/SortChips";
import styles from "./CalendarPage.module.css";
import { getTagStyle } from "../utils/tagColors";

export default function CalendarPage({ isGuest, guestTasks }) {
    const { tasks, sortType, setSortType } = useOutletContext();
    const [selectedTags, setSelectedTags] = useState([]);

    const today = new Date();

    const allTasks = isGuest ? [...tasks, ...guestTasks] : tasks;

    const allTags = [...new Set(allTasks.flatMap(t => t.tags ?? []))];

    const toggleTag = (tag) => {
        setSelectedTags(prev =>
            prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
        );
    };

    const filteredTasks = selectedTags.length > 0
        ? allTasks.filter(t => selectedTags.every(tag => (t.tags ?? []).includes(tag)))
        : allTasks;

    const activeCount = filteredTasks.filter(t => !t.completed).length;
    const todayCount = filteredTasks.filter(t => {
        if (t.completed) return false;
        const dl = t.deadline?.toDate ? t.deadline.toDate() : new Date(t.deadline);
        return (
            dl.getFullYear() === today.getFullYear() &&
            dl.getMonth() === today.getMonth() &&
            dl.getDate() === today.getDate()
        );
    }).length;

    return (
        <div className={styles.page}>
            <div className={styles.header}>
                <h2 className={styles.title}>カレンダー</h2>
                <div className={styles.countRow}>
                    <span className={styles.taskCount}>
                        {activeCount === 0 ? "タスクなし" : `${activeCount}件`}
                    </span>
                    {todayCount > 0 && (
                        <span className={styles.todayBadge}>今日 {todayCount}件</span>
                    )}
                </div>
            </div>

            {allTags.length > 0 && (
                <div className={styles.tagFilter}>
                    {allTags.map(tag => {
                        const active = selectedTags.includes(tag);
                        const ts = getTagStyle(tag);
                        return (
                            <button
                                key={tag}
                                className={`${styles.tagFilterChip} ${active ? styles.tagFilterActive : ""}`}
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
            <div className={styles.ganttWrapper}>
                <GanttView tasks={filteredTasks} sortType={sortType} />
            </div>
        </div>
    );
}
