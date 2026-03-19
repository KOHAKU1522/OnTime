import { useState } from "react";
import styles from "./TaskInput.module.css";
import TagChip from "../TagChip/TagChip";

const PRESETS = [
    { label: "今日中", getDate: () => { const d = new Date(); d.setHours(23, 59, 0, 0); return d; } },
    { label: "明日", getDate: () => { const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(23, 59, 0, 0); return d; } },
    { label: "3日後", getDate: () => { const d = new Date(); d.setDate(d.getDate() + 3); d.setHours(23, 59, 0, 0); return d; } },
    { label: "1週間後", getDate: () => { const d = new Date(); d.setDate(d.getDate() + 7); d.setHours(23, 59, 0, 0); return d; } },
];

const toDatetimeLocal = (date) => {
    const pad = (n) => String(n).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

export default function TaskInput({ onAddTask, allTags = [] }) {
    const [taskName, setTaskName] = useState("");
    const [deadline, setDeadline] = useState("");
    const [selectedPreset, setSelectedPreset] = useState(null);
    const [startDate, setStartDate] = useState("");
    const [showStartDate, setShowStartDate] = useState(false);
    const [description, setDescription] = useState("");
    const [showDescription, setShowDescription] = useState(false);
    const [tags, setTags] = useState([]);
    const [tagInput, setTagInput] = useState("");
    const [showTags, setShowTags] = useState(false);

    const handlePreset = (preset, index) => {
        setDeadline(toDatetimeLocal(preset.getDate()));
        setSelectedPreset(index);
    };

    const handleCustom = () => {
        setSelectedPreset("custom");
        setDeadline("");
    };

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

    const handleAdd = () => {
        if (!taskName || !deadline) return;
        onAddTask({
            taskName,
            deadline,
            startDate: startDate || null,
            description: description || null,
            tags,
            createdAt: new Date(),
            completed: false
        });
        setTaskName("");
        setDeadline("");
        setStartDate("");
        setDescription("");
        setTags([]);
        setTagInput("");
        setSelectedPreset(null);
        setShowStartDate(false);
        setShowDescription(false);
        setShowTags(false);
    };

    const deadlineDisplay = deadline
        ? new Date(deadline).toLocaleString("ja-JP", { month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" })
        : null;

    return (
        <div className={styles.container}>
            <h2 className={styles.title}>タスク追加</h2>

            <input
                type="text"
                placeholder="タスク名"
                value={taskName}
                onChange={(e) => setTaskName(e.target.value)}
                className={styles.input}
            />

            <div className={styles.section}>
                <div className={styles.sectionLabel}>期限</div>
                <div className={styles.presets}>
                    {PRESETS.map((preset, i) => (
                        <button
                            key={i}
                            className={`${styles.presetBtn} ${selectedPreset === i ? styles.presetSelected : ""}`}
                            onClick={() => handlePreset(preset, i)}
                        >
                            {preset.label}
                        </button>
                    ))}
                    <button
                        className={`${styles.presetBtn} ${selectedPreset === "custom" ? styles.presetSelected : ""}`}
                        onClick={handleCustom}
                    >
                        カスタム
                    </button>
                </div>

                {selectedPreset === "custom" && (
                    <input
                        type="datetime-local"
                        value={deadline}
                        onChange={(e) => setDeadline(e.target.value)}
                        className={styles.input}
                    />
                )}

                {deadlineDisplay && selectedPreset !== "custom" && (
                    <div className={styles.selectedDate}>
                        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                            <rect x="3" y="4" width="18" height="18" rx="2" />
                            <line x1="16" y1="2" x2="16" y2="6" />
                            <line x1="8" y1="2" x2="8" y2="6" />
                            <line x1="3" y1="10" x2="21" y2="10" />
                        </svg>
                        {deadlineDisplay}
                    </div>
                )}
            </div>

            {!showStartDate ? (
                <button className={styles.toggleBtn} onClick={() => setShowStartDate(true)}>
                    ＋ 開始日を設定（任意）
                </button>
            ) : (
                <div className={styles.section}>
                    <div className={styles.sectionLabel}>開始日</div>
                    <input
                        type="datetime-local"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className={styles.input}
                    />
                </div>
            )}

            {!showDescription ? (
                <button className={styles.toggleBtn} onClick={() => setShowDescription(true)}>
                    ＋ メモを追加（任意）
                </button>
            ) : (
                <div className={styles.section}>
                    <div className={styles.sectionLabel}>メモ</div>
                    <textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        className={styles.textarea}
                        placeholder="メモを入力..."
                    />
                </div>
            )}

            {!showTags ? (
                <button className={styles.toggleBtn} onClick={() => setShowTags(true)}>
                    ＋ タグを追加（任意）
                </button>
            ) : (
                <div className={styles.section}>
                    <div className={styles.sectionLabel}>タグ</div>
                    <div className={styles.tagInputRow}>
                        <input
                            className={styles.tagInputField}
                            value={tagInput}
                            onChange={(e) => setTagInput(e.target.value)}
                            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }}
                            placeholder="タグ名..."
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
            )}

            <button onClick={handleAdd} className={styles.addButton}>
                ＋ 追加する
            </button>
        </div>
    );
}
