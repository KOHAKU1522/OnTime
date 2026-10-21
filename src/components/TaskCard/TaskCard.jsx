import styles from "./TaskCard.module.css";
import StarIcon from "../StarIcon/StarIcon";

import { useState, useRef } from "react";
import { formatInZone, toDate } from "../../utils/date";
import { db } from "../../firebase";
import { doc, updateDoc } from "firebase/firestore";
import { deleteTaskAndOfferUndo } from "../../utils/taskTrash";
import { reportFirestoreError } from "../../utils/firestoreError";

import TaskEditModal from "../TaskEditModal/TaskEditModal";
import TagChip from "../TagChip/TagChip";

// user: 親で取得したログインユーザー（ゲストは null）。カードごとに認証リスナーを登録しない
export default function TaskCard({ task, user, showToast, allTags = [], now = new Date(), timeZone, starIcon = "star", starName = "スター" }) {

    const [isExpanded, setIsExpanded] = useState(false);
    const [description, setDescription] = useState(task.description ?? "");
    const [previousTaskDescription, setPreviousTaskDescription] = useState(task.description);
    const [showEdit, setShowEdit] = useState(false);

    const [swipeX, setSwipeX] = useState(0);
    const [isDragging, setIsDragging] = useState(false);
    const touchStartXRef = useRef(null);
    const touchStartYRef = useRef(null);
    const directionLockRef = useRef(null); // null | "h" | "v"

    // ここいじれば誤爆率下げられる。X軸が10px動くまで判定しない。
    const DIRECTION_THRESHOLD = 10;

    if (task.description !== previousTaskDescription) {
        setPreviousTaskDescription(task.description);
        setDescription(task.description ?? "");
    }

    const deadline = toDate(task.deadline);
    const hasDeadline = !!deadline;
    const createdAt = toDate(task.createdAt) ?? deadline;
    const hasMemo = !!task.description;

    // 期限なしタスクは残り時間を無限大として扱う（期限切れ・危険表示にならない）
    const diffMs = hasDeadline ? deadline.getTime() - now.getTime() : Infinity;
    const diffMinutes = Math.ceil(diffMs / (1000 * 60));
    const diffHours = Math.ceil(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);
    const remainHours = diffHours % 24;

    const isExpired = diffHours <= 0 && !task.completed;
    const isDanger = diffHours > 0 && diffHours <= 24 && !task.completed;

    // Firestore 操作を実行し、失敗したら利用者に通知する
    const runTaskOp = async (operation, errorMessage) => {
        try {
            await operation();
            return true;
        } catch (err) {
            showToast?.(reportFirestoreError(errorMessage, err, `users/${user?.uid}/tasks/${task.id}`));
            return false;
        }
    };

    // ===== スワイプで完了 =====
    const handleDragStart = (clientX, clientY) => {
        touchStartXRef.current = clientX;
        touchStartYRef.current = clientY;
        directionLockRef.current = null;
        setIsDragging(true);
    };

    const handleDragMove = (clientX, clientY) => {
        if (touchStartXRef.current === null) return;
        const dx = clientX - touchStartXRef.current;
        const dy = clientY - touchStartYRef.current;

        if (directionLockRef.current === null) {
            if (Math.abs(dx) < DIRECTION_THRESHOLD && Math.abs(dy) < DIRECTION_THRESHOLD) return;
            directionLockRef.current = Math.abs(dx) >= Math.abs(dy) ? "h" : "v";
        }
        if (directionLockRef.current === "v") return;

        if (dx < 0) {
            setSwipeX(Math.max(dx, -120));
        } else if (dx > 0) {
            setSwipeX(Math.min(dx, 120));
        }
    };

    const handleDragEnd = () => {
        if (touchStartXRef.current === null) return;
        setIsDragging(false);
        if (directionLockRef.current === "h") {
            if (swipeX < -80) {
                task.completed ? uncompleteTask() : completeTask();
            } else if (swipeX > 80) {
                toggleStar({ stopPropagation: () => { } });
            }
        }
        setSwipeX(0);
        touchStartXRef.current = null;
        touchStartYRef.current = null;
        directionLockRef.current = null;
    };

    const handleTouchStart = (e) => handleDragStart(e.touches[0].clientX, e.touches[0].clientY);
    const handleTouchMove = (e) => handleDragMove(e.touches[0].clientX, e.touches[0].clientY);
    const handleTouchEnd = () => handleDragEnd();

    const handleMouseDown = (e) => handleDragStart(e.clientX, e.clientY);
    const handleMouseMove = (e) => {
        if (touchStartXRef.current === null) return;
        handleDragMove(e.clientX, e.clientY);
    };
    const handleMouseUp = () => handleDragEnd();
    const handleMouseLeave = () => handleDragEnd();

    // ===== 星（重要）トグル =====
    const toggleStar = async (e) => {
        e.stopPropagation();
        if (!user) return;
        const taskRef = doc(db, "users", user.uid, "tasks", task.id);
        await runTaskOp(() => updateDoc(taskRef, { starred: !task.starred }), "重要マークを変更できませんでした");
    };

    // ===== 完了（アンドゥ付き）=====
    const completeTask = async () => {
        if (!user) return;
        const taskRef = doc(db, "users", user.uid, "tasks", task.id);
        const ok = await runTaskOp(
            () => updateDoc(taskRef, { completed: true, completedAt: new Date() }),
            "タスクを完了できませんでした"
        );

        if (ok && showToast) {
            showToast("タスクを完了しました", () => runTaskOp(
                () => updateDoc(taskRef, { completed: false, completedAt: null }),
                "元に戻せませんでした"
            ));
        }
    };

    // ===== 未完了に戻す =====
    const uncompleteTask = async () => {
        if (!user) return;
        const taskRef = doc(db, "users", user.uid, "tasks", task.id);
        const ok = await runTaskOp(
            () => updateDoc(taskRef, { completed: false, completedAt: null }),
            "未完了に戻せませんでした"
        );

        if (ok && showToast) {
            showToast("未完了に戻しました", () => runTaskOp(
                () => updateDoc(taskRef, { completed: true, completedAt: new Date() }),
                "元に戻せませんでした"
            ));
        }
    };

    // ===== 削除（遅延削除 + アンドゥ）=====
    const deleteTask = () => {
        if (!user) return;

        // サーバーから即時削除し、5秒以内なら「元に戻す」で復元できる
        deleteTaskAndOfferUndo(db, user.uid, task.id, showToast);
    };

    // ===== 説明欄の保存 =====
    const handleDescriptionBlur = async () => {
        if (!user) return;
        const taskRef = doc(db, "users", user.uid, "tasks", task.id);
        await runTaskOp(
            () => updateDoc(taskRef, { description: description || null }),
            "メモを保存できませんでした"
        );
    };

    const formatRemain = () => {
        if (task.completed) return "完了済み";
        if (!hasDeadline) return "期限なし";
        if (isExpired) return "期限切れ";
        if (diffMinutes < 60) return `残り ${diffMinutes}分`;
        if (diffDays > 0) return `残り ${diffDays}日${remainHours}時間`;
        return `残り ${diffHours}時間`;
    };

    // ===== 進捗バー =====
    let progress = 0;
    if (hasDeadline) {
        const totalMs = deadline.getTime() - createdAt.getTime();
        const elapsedMs = now.getTime() - createdAt.getTime();
        progress = Math.min(Math.max(elapsedMs / totalMs, 0), 1);
    }
    const remainRatio = 1 - progress;

    let baseColor = "59, 130, 246";
    if (isDanger) {
        baseColor = "239, 68, 68";
    } else if (remainRatio < 0.5) {
        baseColor = "245, 158, 11";
    }

    const backgroundStyle =
        task.completed || !hasDeadline
            ? undefined
            : isExpired
                ? undefined
                : `linear-gradient(to right, rgba(${baseColor}, 0.12) ${remainRatio * 100}%, transparent ${remainRatio * 100}%)`;

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
                    {task.completed ? "未完了に戻す" : "✓ 完了"}
                </div>
                <div
                    className={`
                    ${styles.card}
                    ${!hasDeadline && !task.completed ? styles.noDeadline : ""}
                    ${isDanger ? styles.danger : ""}
                    ${isExpired ? styles.expired : ""}
                    ${task.completed ? styles.completed : ""}
                `}
                    style={{
                        background: backgroundStyle,
                        transform: `translateX(${swipeX}px)`,
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
                                className={`${styles.starBtn} ${task.starred ? styles.starred : ""}`}
                                onClick={toggleStar}
                                title={`${starName}を${task.starred ? "外す" : "付ける"}`}
                                aria-label={`${starName}を${task.starred ? "外す" : "付ける"}`}
                                aria-pressed={!!task.starred}
                            >
                                <StarIcon name={starIcon} active={!!task.starred} size={18} />
                            </button>
                            <div className={styles.title}>{task.taskName}</div>
                        </div>
                        <div className={styles.deadline}>
                            期限: {hasDeadline ? formatInZone(deadline, timeZone) : "なし"}
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
                        <div className={styles.time} aria-live="off">{formatRemain()}</div>
                        <div className={styles.buttons}>
                            {!task.completed && (
                                <button className={styles.doneBtn} onClick={completeTask}>完了</button>
                            )}
                            <button className={styles.editBtn} onClick={() => setShowEdit(true)}>編集</button>
                            <button className={styles.deleteBtn} onClick={deleteTask}>削除</button>
                        </div>
                    </div>

                    {/* 説明欄トグル */}
                    {/* メモがあるタスクは常に表示、ないタスクだけ追加ボタンで開く */}
                    {!hasMemo && (
                        <div className={styles.expandRow}>
                            <button
                                className={styles.expandBtn}
                                onClick={() => setIsExpanded(v => !v)}
                                aria-expanded={isExpanded}
                            >
                                <span className={`${styles.expandIcon} ${isExpanded ? styles.open : ""}`}>▼</span>
                                メモを追加
                            </button>
                        </div>
                    )}

                    {(hasMemo || isExpanded) && (
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

                    {!task.completed && !isExpired && hasDeadline && (
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
            </div>

            {showEdit && (
                <TaskEditModal
                    task={task}
                    user={user}
                    timeZone={timeZone}
                    onClose={() => setShowEdit(false)}
                    allTags={allTags}
                />
            )}
        </>
    );
}
