import { useState, useEffect } from "react";
import TaskCard from "../TaskCard/TaskCard.jsx";
import SortChips from "../SortChips/SortChips.jsx";
import styles from "./TaskList.module.css";
import { getTagStyle } from "../../utils/tagColors";
import { toTime } from "../../utils/date";

// 期限なしタスクは昇順・降順どちらでも末尾に置く
const NO_DEADLINE = null;
const getDeadline = (task) => {
    const t = toTime(task.deadline, NaN);
    return Number.isNaN(t) ? NO_DEADLINE : t;
};
const compareDeadline = (a, b, direction = 1) => {
    const da = getDeadline(a);
    const db = getDeadline(b);
    if (da === NO_DEADLINE && db === NO_DEADLINE) return 0;
    if (da === NO_DEADLINE) return 1;
    if (db === NO_DEADLINE) return -1;
    return (da - db) * direction;
};

export default function TaskList({ tasks, user, timeZone, sortType, setSortType, showToast, starredFirst = true, starIcon = "star", starName = "スター", onStarredFirstChange }) {

    const [searchQuery, setSearchQuery] = useState("");
    const [debouncedQuery, setDebouncedQuery] = useState("");
    const [selectedTags, setSelectedTags] = useState([]);

    // 残り時間表示用の時計（全カードで共有する1つのタイマー）
    const [now, setNow] = useState(() => new Date());
    useEffect(() => {
        const timer = setInterval(() => setNow(new Date()), 60000);
        return () => clearInterval(timer);
    }, []);

    // デバウンス: 300ms
    useEffect(() => {
        const timer = setTimeout(() => setDebouncedQuery(searchQuery), 300);
        return () => clearTimeout(timer);
    }, [searchQuery]);

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

    // 星付きを先頭に押し上げるヘルパー（設定が無効なら並び順をそのまま使う）
    const starFirst = (arr) => {
        if (!starredFirst) return arr;
        const starred = arr.filter(t => t.starred);
        const normal  = arr.filter(t => !t.starred);
        return [...starred, ...normal];
    };

    // 完了済みを completedAt 降順（新しい順）で並べるヘルパー
    const sortCompleted = (arr) => {
        return [...arr].sort((a, b) => toTime(b.completedAt) - toTime(a.completedAt));
    };

    // ソート：未完了は一覧に、完了済みは折りたたみ欄に分ける
    let activeTasks = [];
    let completedTasks = [];
    let showCompletedFolded = true;

    if (sortType === "short") {
        activeTasks = starFirst(filtered.filter(t => !t.completed).sort((a, b) => compareDeadline(a, b, 1)));
        completedTasks = sortCompleted(filtered.filter(t => t.completed));
    }
    if (sortType === "recent") {
        const sorted = [...filtered].sort((a, b) => toTime(b.createdAt) - toTime(a.createdAt));
        activeTasks = starFirst(sorted.filter(t => !t.completed));
        completedTasks = sortCompleted(filtered.filter(t => t.completed));
    }
    if (sortType === "long") {
        activeTasks = starFirst(filtered.filter(t => !t.completed).sort((a, b) => compareDeadline(a, b, -1)));
        showCompletedFolded = false;
    }
    if (sortType === "completed") {
        // 「完了済み」ソートでは完了タスクを直接一覧表示する
        activeTasks = sortCompleted(filtered.filter(t => t.completed));
        showCompletedFolded = false;
    }

    const hasFilter = debouncedQuery || selectedTags.length > 0;
    const renderCard = (task) => (
        <TaskCard key={task.id} task={task} user={user} timeZone={timeZone} showToast={showToast} allTags={allTags} now={now} starIcon={starIcon} starName={starName} />
    );

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

            <SortChips
                value={sortType}
                onChange={setSortType}
                starredFirst={starredFirst}
                starIcon={starIcon}
                starName={starName}
                onStarredFirstChange={onStarredFirstChange}
            />

            <div className={styles.list}>
                {activeTasks.length === 0 ? (
                    <div className={styles.empty}>
                        {hasFilter
                            ? "条件に一致するタスクはありません"
                            : completedTasks.length > 0 && showCompletedFolded
                                ? "未完了のタスクはありません"
                                : "タスクはありません"}
                    </div>
                ) : (
                    activeTasks.map(renderCard)
                )}
            </div>

            {showCompletedFolded && completedTasks.length > 0 && (
                <details className={styles.completedSection}>
                    <summary className={styles.completedSummary}>
                        完了済み（{completedTasks.length}件）
                    </summary>
                    <div className={styles.list}>
                        {completedTasks.map(renderCard)}
                    </div>
                </details>
            )}
        </div>
    );
}
