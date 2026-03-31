import { useState } from "react";
import { db, auth } from "../../firebase";
import { doc, updateDoc } from "firebase/firestore";
import styles from "./TaskEditModal.module.css";
import TagChip from "../TagChip/TagChip";

const pad = (n) => String(n).padStart(2, "0");
const toDatetimeLocal = (date) => {
    if (!date) return "";
    const d = typeof date?.toDate === "function" ? date.toDate() : new Date(date);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export default function TaskEditModal({ task, onClose, allTags = [] }) {
    const [taskName, setTaskName] = useState(task.taskName);
    const [deadline, setDeadline] = useState(toDatetimeLocal(task.deadline));
    const [startDate, setStartDate] = useState(toDatetimeLocal(task.startDate));
    const [description, setDescription] = useState(task.description ?? "");
    const [tags, setTags] = useState(task.tags ?? []);
    const [tagInput, setTagInput] = useState("");
    const [saving, setSaving] = useState(false);

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
        if (!taskName || !deadline) return;
        const user = auth.currentUser;
        if (!user) return;

        setSaving(true);
        const taskRef = doc(db, "users", user.uid, "tasks", task.id);
        await updateDoc(taskRef, {
            taskName,
            deadline: new Date(deadline),
            startDate: startDate ? new Date(startDate) : null,
            description: description || null,
            tags,
        });
        setSaving(false);
        onClose();
    };

    const handleUncomplete = async () => {
        const user = auth.currentUser;
        if (!user) return;
        const taskRef = doc(db, "users", user.uid, "tasks", task.id);
        await updateDoc(taskRef, { completed: false, completedAt: null });
        onClose();
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
                        <label className={styles.label}>期限</label>
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

                    {task.completed && (
                        <button className={styles.uncompleteBtn} onClick={handleUncomplete}>
                            未完了に戻す
                        </button>
                    )}
                    <button
                        className={styles.saveBtn}
                        onClick={handleSave}
                        disabled={saving || !taskName || !deadline}
                    >
                        {saving ? "保存中..." : "保存する"}
                    </button>
                </div>
                <div className={styles.safeArea} />
            </div>
        </div>
    );
}
