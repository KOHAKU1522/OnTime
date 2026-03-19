import styles from "./TaskCard.module.css";

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

    useEffect(() => {
        const timer = setInterval(() => {
            setNow(new Date());
        }, 60000);
        return () => clearInterval(timer);
    }, []);

    // descriptionがtask側から変更された場合（編集後）に同期
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

    // ===== 星（重要）トグル =====
    const toggleStar = async (e) => {
        e.stopPropagation();
        if (!user) return;
        const taskRef = doc(db, "users", user.uid, "tasks", task.id);
        await updateDoc(taskRef, { starred: !task.starred });
    };

    // ===== 完了（アンドゥ付き）=====
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

    // ===== 削除（遅延削除 + アンドゥ）=====
    const deleteTask = () => {
        if (!user) return;

        const taskRef = doc(db, "users", user.uid, "tasks", task.id);

        // 既存の保留を解除
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

    // ===== 説明欄の保存 =====
    const handleDescriptionBlur = async () => {
        if (!user) return;
        const taskRef = doc(db, "users", user.uid, "tasks", task.id);
        await updateDoc(taskRef, { description: description || null });
    };

    const formatRemain = () => {
        if (task.completed) return "完了済み";
        if (isExpired) return "期限切れ";
        if (diffMinutes < 60) return `残り ${diffMinutes}分`;
        if (diffDays > 0) return `残り ${diffDays}日${remainHours}時間`;
        return `残り ${diffHours}時間`;
    };

    // ===== 進捗バー =====
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
                : `linear-gradient(to right, rgba(${baseColor}, 0.12) ${remainRatio * 100}%, transparent ${remainRatio * 100}%)`;

    const tags = task.tags ?? [];

    return (
        <>
            <div
                className={`
                    ${styles.card}
                    ${isDanger ? styles.danger : ""}
                    ${isExpired ? styles.expired : ""}
                    ${task.completed ? styles.completed : ""}
                `}
                style={{ background: backgroundStyle }}
            >
                <div className={styles.left}>
                    <div className={styles.titleRow}>
                        <button
                            className={`${styles.starBtn} ${task.starred ? styles.starred : ""}`}
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

                {/* 説明欄トグル */}
                <div className={styles.expandRow}>
                    <button
                        className={styles.expandBtn}
                        onClick={() => setIsExpanded(v => !v)}
                    >
                        <span className={`${styles.expandIcon} ${isExpanded ? styles.open : ""}`}>▼</span>
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
                                width: `${remainRatio * 100}%`,
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
