import { useState } from "react";
import styles from "./TaskInput.module.css";
import TagChip from "../TagChip/TagChip";
import VoiceInput from "../VoiceInput/VoiceInput.jsx";
import { endOfDayAfter, endOfDayAfterMonths, formatInZone, fromZonedInputValue, getMonthRange, getWeekRange, toZonedInputValue } from "../../utils/date";

// 期限の選択肢（いずれも設定タイムゾーンでその日の 23:59）
const PRESETS = [
    { key: "today", label: "今日中", getDate: (tz) => endOfDayAfter(new Date(), 0, tz) },
    { key: "tomorrow", label: "明日", getDate: (tz) => endOfDayAfter(new Date(), 1, tz) },
    { key: "3days", label: "3日後", getDate: (tz) => endOfDayAfter(new Date(), 3, tz) },
    { key: "1week", label: "1週間後", getDate: (tz) => endOfDayAfter(new Date(), 7, tz) },
    // 30日後ではなくカレンダー上の1か月後（月末は丸める）
    { key: "1month", label: "1ヶ月後", getDate: (tz) => endOfDayAfterMonths(new Date(), 1, tz) },
    { key: "thisWeek", label: "今週中", getDate: (tz, weekStartsOn) => endOfDayAfter(new Date(getWeekRange(new Date(), weekStartsOn, tz).end.getTime() - 1), 0, tz) },
    { key: "thisMonth", label: "今月中", getDate: (tz) => endOfDayAfter(new Date(getMonthRange(new Date(), tz).end.getTime() - 1), 0, tz) },
    { key: "none", label: "期限なし", getDate: () => null },
];
const QUICK_PRESETS = PRESETS.slice(0, 3);
const MORE_PRESETS = PRESETS.slice(3);

// 入力値（deadline など）は設定タイムゾーンの "YYYY-MM-DDTHH:mm" で保持し、保存時に変換する
export default function TaskInput({ onAddTask, allTags = [], timeZone, weekStartsOn = 1 }) {
    const [taskName, setTaskName] = useState("");
    const [deadline, setDeadline] = useState("");
    const [selectedPreset, setSelectedPreset] = useState(null);
    const [customDate, setCustomDate] = useState("");
    const [customTime, setCustomTime] = useState("23:59");
    const [formError, setFormError] = useState("");
    const [startDate, setStartDate] = useState("");
    const [showStartDate, setShowStartDate] = useState(false);
    const [description, setDescription] = useState("");
    const [showDescription, setShowDescription] = useState(false);
    const [starred, setStarred] = useState(false);
    const [tags, setTags] = useState([]);
    const [tagInput, setTagInput] = useState("");
    const [showTags, setShowTags] = useState(false);

    const handlePreset = (preset) => {
        const date = preset.getDate(timeZone, weekStartsOn);
        setDeadline(date ? toZonedInputValue(date, timeZone) : "");
        setSelectedPreset(preset.key);
        setFormError("");
    };

    const handleCustom = () => {
        setSelectedPreset("custom");
        setDeadline("");
        setFormError("");
    };

    const handleMorePresetChange = (e) => {
        if (e.target.value === "custom") {
            handleCustom();
            return;
        }
        const preset = MORE_PRESETS.find((option) => option.key === e.target.value);
        if (preset) handlePreset(preset);
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

    const handleAdd = async () => {
        if (!taskName.trim()) {
            setFormError("タスク名を入力してください");
            return;
        }
        let finalDeadline = null;
        if (selectedPreset === null) {
            setFormError("期限を選んでください（期限なしも選べます）");
            return;
        } else if (selectedPreset === "custom") {
            if (!customDate) {
                setFormError("カスタムの日付を選んでください");
                return;
            }
            finalDeadline = `${customDate}T${customTime || "23:59"}`;
        } else if (selectedPreset !== "none") {
            finalDeadline = deadline;
        }
        setFormError("");
        // 保存に失敗した場合は入力内容を残す
        const ok = await onAddTask({
            taskName,
            deadline: finalDeadline,
            startDate: startDate || null,
            description: description || null,
            tags,
            starred,
            createdAt: new Date(),
            completed: false
        });
        if (ok === false) return;
        setTaskName("");
        setDeadline("");
        setStartDate("");
        setDescription("");
        setStarred(false);
        setTags([]);
        setTagInput("");
        setSelectedPreset(null);
        setCustomDate("");
        setCustomTime("23:59");
        setShowStartDate(false);
        setShowDescription(false);
        setShowTags(false);
    };

    const deadlineDisplay = selectedPreset === "none"
        ? "期限なし"
        : deadline
            ? formatInZone(fromZonedInputValue(deadline, timeZone), timeZone, { month: "long", day: "numeric", weekday: "short", hour: "2-digit", minute: "2-digit" })
            : null;
    const selectedMorePreset = MORE_PRESETS.some((preset) => preset.key === selectedPreset);

    return (
        <div className={styles.container}>
            <h2 className={styles.title}>タスク追加</h2>

            <div className={styles.taskNameInputWrapper}>
                <div className={styles.taskNameField}>
                    <input
                        type="text"
                        placeholder="タスク名"
                        value={taskName}
                        onChange={(e) => setTaskName(e.target.value)}
                        className={`${styles.input} ${styles.taskNameInput}`}
                    />
                    {taskName && (
                        <button
                            type="button"
                            onClick={() => setTaskName("")}
                            className={styles.clearButton}
                            aria-label="タスク名をクリア"
                            title="タスク名をクリア"
                        >
                            ×
                        </button>
                    )}
                </div>
                <VoiceInput value={taskName} onChange={setTaskName}/>
            </div>

            <div className={styles.section}>
                <div className={styles.sectionLabel}>期限</div>
                <div className={styles.presets}>
                    {QUICK_PRESETS.map((preset) => (
                        <button
                            key={preset.key}
                            className={`${styles.presetBtn} ${selectedPreset === preset.key ? styles.presetSelected : ""}`}
                            onClick={() => handlePreset(preset)}
                            aria-pressed={selectedPreset === preset.key}
                        >
                            {preset.label}
                        </button>
                    ))}
                    <select
                        className={`${styles.presetSelect} ${selectedMorePreset || selectedPreset === "custom" ? styles.presetSelected : ""}`}
                        value={selectedMorePreset || selectedPreset === "custom" ? selectedPreset : ""}
                        onChange={handleMorePresetChange}
                        aria-label="その他の期限"
                    >
                        <option value="">その他</option>
                        {MORE_PRESETS.filter((preset) => preset.key !== "none").map((preset) => (
                            <option key={preset.key} value={preset.key}>{preset.label}</option>
                        ))}
                        <option value="custom">日時を指定</option>
                        <option value="none">期限なし</option>
                    </select>
                </div>

                {selectedPreset === "custom" && (
                    <div className={styles.customDeadline}>
                        <input
                            type="date"
                            value={customDate}
                            onChange={(e) => { setCustomDate(e.target.value); setFormError(""); }}
                            className={styles.input}
                            aria-label="期限の日付"
                        />
                        <input
                            type="time"
                            value={customTime}
                            onChange={(e) => setCustomTime(e.target.value)}
                            className={styles.input}
                            aria-label="期限の時刻（省略時は23:59）"
                        />
                    </div>
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

            <div className={styles.optionalActions}>
            {!showStartDate ? (
                <button className={styles.toggleBtn} onClick={() => setShowStartDate(true)}>
                        ＋ 開始日を設定
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
                        ＋ メモを追加
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
                        ＋ タグを追加
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
            <label className={`${styles.starOption} ${starred ? styles.starOptionActive : ""}`}>
                <input
                    type="checkbox"
                    checked={starred}
                    onChange={(e) => setStarred(e.target.checked)}
                />
                <span>スターを付ける</span>
            </label>
            </div>

            {formError && <p className={styles.formError} role="alert">{formError}</p>}

            <button onClick={handleAdd} className={styles.addButton}>
                ＋ 追加する
            </button>
        </div>
    );
}
