import { useState, useEffect } from "react";
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

    // 全タスクからユニークなタグを収集
    const allTags = [...new Set(tasks.flatMap(t => t.tags ?? []))];

    const toggleTag = (tag) => {
        setSelectedTags(prev =>
            prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
        );
    };

    // フィルタリング
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

    // 星付きを先頭に押し上げるヘルパー
    const starFirst = (arr) => {
        const starred = arr.filter(t => t.starred);
        const normal  = arr.filter(t => !t.starred);
        return [...starred, ...normal];
    };

    // ソート
    let displayTasks = [...filtered];

    if (sortType === "short") {
        const incomplete = filtered.filter(t => !t.completed).sort((a, b) => getDeadline(a) - getDeadline(b));
        const completed  = filtered.filter(t => t.completed);
        displayTasks = [...starFirst(incomplete), ...completed];
    }
    if (sortType === "recent") {
        const sorted = [...filtered].sort((a, b) => {
            const aTime = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
            const bTime = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
            return bTime - aTime;
        });
        const incomplete = sorted.filter(t => !t.completed);
        const completed  = sorted.filter(t => t.completed);
        displayTasks = [...starFirst(incomplete), ...completed];
    }
    if (sortType === "long") {
        const sorted = filtered.filter(t => !t.completed).sort((a, b) => getDeadline(b) - getDeadline(a));
        displayTasks = starFirst(sorted);
    }
    if (sortType === "completed") {
        displayTasks = filtered.filter(t => t.completed);
    }

    return (
        <div className={styles.container}>
            <div className={styles.sortBar}>
                <div className={styles.sortTitle}>タスク一覧</div>
            </div>

            {/* 検索バー */}
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

            {/* タグフィルター */}
            {allTags.length > 0 && (
                <div className={styles.tagFilter}>
                    {allTags.map(tag => {
                        const active = selectedTags.includes(tag);
                        const ts = getTagStyle(tag);
                        return (
                            <button
                                key={tag}
                                className={`${styles.tagFilterChip} ${active ? styles.active : ""}`}
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
