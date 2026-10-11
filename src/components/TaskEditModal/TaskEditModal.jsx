import { useState } from "react";
import { db } from "../../firebase";
import { doc, updateDoc } from "firebase/firestore";
import styles from "./TaskEditModal.module.css";
import TagChip from "../TagChip/TagChip";
import { fromZonedInputValue, toZonedInputValue } from "../../utils/date";
import { reportFirestoreError } from "../../utils/firestoreError";

// 日時の入力欄は設定タイムゾーンの時刻で表示・保存する
export default function TaskEditModal({ task, user, timeZone, onClose, allTags = [] }) {
    const [taskName, setTaskName] = useState(task.taskName);
    const [deadline, setDeadline] = useState(toZonedInputValue(task.deadline, timeZone));
    const [startDate, setStartDate] = useState(toZonedInputValue(task.startDate, timeZone));
    const [description, setDescription] = useState(task.description ?? "");
    const [tags, setTags] = useState(task.tags ?? []);
    const [tagInput, setTagInput] = useState("");
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    const addTag = () => {
        const t = tagInput.trim();
        if (t && !tags.includes(t)) {
            setTags(prev => [...prev, t]);
        }
        setTagInput("");
    };

    const removeTag = (tag) => {
        setTags(prev => prev.filter(t => t !== tag));
    };

    const handleSave = async () => {
        if (!taskName) return;
        if (!user) return;

        setSaving(true);
        setError("");
        const taskRef = doc(db, "users", user.uid, "tasks", task.id);
        try {
            await updateDoc(taskRef, {
                taskName,
                deadline: deadline ? fromZonedInputValue(deadline, timeZone) : null,
                startDate: startDate ? fromZonedInputValue(startDate, timeZone) : null,
                description: description || null,
                tags,
            });
            onClose();
        } catch (err) {
            setError(reportFirestoreError("保存できませんでした", err, taskRef.path));
        } finally {
            setSaving(false);
        }
    };

    const handleUncomplete = async () => {
        if (!user) return;
        const taskRef = doc(db, "users", user.uid, "tasks", task.id);
        try {
            await updateDoc(taskRef, { completed: false, completedAt: null });
            onClose();
        } catch (err) {
            setError(reportFirestoreError("未完了に戻せませんでした", err, taskRef.path));
        }
    };

    return (
        <div className={styles.overlay} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
            <div className={styles.sheet}>
                <div className={styles.handle} />
                <div className={styles.content}>
                    <div className={styles.formTitle}>タスクを編集</div>

                    <div className={styles.field}>
                        <label className={styles.label}>タスク名</label>
                        <input
                            className={styles.input}
                            value={taskName}
                            onChange={(e) => setTaskName(e.target.value)}
                            placeholder="タスク名"
                        />
                    </div>

                    <div className={styles.field}>
                        <label className={styles.label}>期限（空欄で期限なし）</label>
                        <input
                            type="datetime-local"
                            className={styles.input}
                            value={deadline}
                            onChange={(e) => setDeadline(e.target.value)}
                        />
                    </div>

                    <div className={styles.field}>
                        <label className={styles.label}>開始日（任意）</label>
                        <input
                            type="datetime-local"
                            className={styles.input}
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                        />
                    </div>

                    <div className={styles.field}>
                        <label className={styles.label}>メモ（任意）</label>
                        <textarea
                            className={styles.textarea}
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="メモを入力..."
                        />
                    </div>

                    <div className={styles.field}>
                        <label className={styles.label}>タグ</label>
                        <div className={styles.tagInputRow}>
                            <input
                                className={styles.tagInputField}
                                value={tagInput}
                                onChange={(e) => setTagInput(e.target.value)}
                                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }}
                                placeholder="タグを追加..."
                            />
                            <button className={styles.tagAddBtn} onClick={addTag}>追加</button>
                        </div>
                        {tags.length > 0 && (
                            <div className={styles.tagChips}>
                                {tags.map((tag, i) => (
                                    <TagChip key={i} tag={tag} onRemove={removeTag} />
                                ))}
                            </div>
                        )}
                        {allTags.filter(t => !tags.includes(t)).length > 0 && (
                            <div className={styles.tagSuggestions}>
                                <span className={styles.tagSuggestLabel}>既存タグ</span>
                                <div className={styles.tagSuggestChips}>
                                    {allTags.filter(t => !tags.includes(t)).map((tag, i) => (
                                        <TagChip key={i} tag={tag} onSelect={() => {
                                            if (!tags.includes(tag)) setTags(prev => [...prev, tag]);
                                        }} readonly />
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {error && <p className={styles.error} role="alert">{error}</p>}
                    {task.completed && (
                        <button className={styles.uncompleteBtn} onClick={handleUncomplete}>
                            未完了に戻す
                        </button>
                    )}
                    <button
                        className={styles.saveBtn}
                        onClick={handleSave}
                        disabled={saving || !taskName}
                    >
                        {saving ? "保存中..." : "保存する"}
                    </button>
                </div>
                <div className={styles.safeArea} />
            </div>
        </div>
    );
}
