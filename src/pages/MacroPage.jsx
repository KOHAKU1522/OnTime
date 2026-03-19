import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { auth, db } from "../firebase";
import {
    collection, addDoc, deleteDoc, updateDoc,
    onSnapshot, doc, serverTimestamp
} from "firebase/firestore";
import styles from "./MacroPage.module.css";

const FREQ_OPTIONS = [
    { value: "daily", label: "毎日" },
    { value: "weekly", label: "曜日指定" },
    { value: "monthly", label: "毎月" },
];

const WEEKDAY_LABELS = ["日", "月", "火", "水", "木", "金", "土"];

const DEFAULT_FORM = {
    taskName: "",
    frequency: "daily",
    weekdays: [],
    dayOfMonth: 1,
    deadlineDays: 1,
};

export default function MacroPage() {

    useEffect(() => {
        window.scrollTo(0, 0);
    }, []);

    const navigate = useNavigate();
    const [macros, setMacros] = useState([]);
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState(DEFAULT_FORM);

    const user = auth.currentUser;

    useEffect(() => {
        if (!user) return;
        const ref = collection(db, "users", user.uid, "macros");
        const unsub = onSnapshot(ref, snap => {
            setMacros(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        });
        return () => unsub();
    }, []);

    const handleToggle = async (macro) => {
        const ref = doc(db, "users", user.uid, "macros", macro.id);
        await updateDoc(ref, { enabled: !macro.enabled });
    };

    const handleDelete = async (macro) => {
        if (!window.confirm(`「${macro.taskName}」を削除しますか？`)) return;
        await deleteDoc(doc(db, "users", user.uid, "macros", macro.id));
    };

    const handleSave = async () => {
        if (!form.taskName.trim()) return;
        if (form.frequency === "weekly" && form.weekdays.length === 0) return;

        await addDoc(collection(db, "users", user.uid, "macros"), {
            ...form,
            enabled: true,
            lastTriggered: null,
            createdAt: serverTimestamp(),
        });
        setForm(DEFAULT_FORM);
        setShowForm(false);
    };

    const toggleWeekday = (day) => {
        setForm(f => ({
            ...f,
            weekdays: f.weekdays.includes(day)
                ? f.weekdays.filter(d => d !== day)
                : [...f.weekdays, day],
        }));
    };

    const freqLabel = (macro) => {
        if (macro.frequency === "daily") return "毎日";
        if (macro.frequency === "weekly") {
            return macro.weekdays.map(d => WEEKDAY_LABELS[d]).join("・") + "曜日";
        }
        return `毎月${macro.dayOfMonth}日`;
    };

    return (
        <div className={styles.page}>
            <header className={styles.header}>
                <button className={styles.backBtn} onClick={() => navigate(-1)}>
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="15 18 9 12 15 6" />
                    </svg>
                </button>
                <h2 className={styles.title}>マクロ</h2>
                <button className={styles.addBtn} onClick={() => setShowForm(true)}>＋</button>
            </header>

            <p className={styles.desc}>指定した頻度で自動的にタスクを追加します。</p>

            {macros.length === 0 && !showForm && (
                <div className={styles.empty}>
                    <div className={styles.emptyIcon}>
                        <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="17 1 21 5 17 9" />
                            <path d="M3 11V9a4 4 0 014-4h14" />
                            <polyline points="7 23 3 19 7 15" />
                            <path d="M21 13v2a4 4 0 01-4 4H3" />
                        </svg>
                    </div>
                    <div className={styles.emptyText}>マクロはまだありません</div>
                    <button className={styles.emptyAddBtn} onClick={() => setShowForm(true)}>
                        最初のマクロを作成
                    </button>
                </div>
            )}

            {macros.map(macro => (
                <div key={macro.id} className={`${styles.macroCard} ${!macro.enabled ? styles.disabled : ""}`}>
                    <div className={styles.macroMain}>
                        <div className={styles.macroName}>{macro.taskName}</div>
                        <div className={styles.macroMeta}>
                            {freqLabel(macro)} ・ {macro.deadlineDays === 0 ? "当日締め切り" : `${macro.deadlineDays}日後締め切り`}
                        </div>
                    </div>
                    <div className={styles.macroActions}>
                        <button
                            className={`${styles.toggle} ${macro.enabled ? styles.toggleOn : styles.toggleOff}`}
                            onClick={() => handleToggle(macro)}
                        >
                            {macro.enabled ? "ON" : "OFF"}
                        </button>
                        <button className={styles.deleteBtn} onClick={() => handleDelete(macro)}>
                            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="3 6 5 6 21 6" />
                                <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
                                <path d="M10 11v6M14 11v6" />
                            </svg>
                        </button>
                    </div>
                </div>
            ))}

            {/* 追加フォーム */}
            {showForm && (
                <div className={styles.formOverlay} onClick={() => setShowForm(false)}>
                    <div className={styles.formSheet} onClick={e => e.stopPropagation()}>
                        <div className={styles.formHandle} />
                        <h3 className={styles.formTitle}>マクロを追加</h3>

                        <div className={styles.field}>
                            <label className={styles.label}>タスク名</label>
                            <input
                                className={styles.input}
                                type="text"
                                placeholder="例: 日報を書く"
                                value={form.taskName}
                                onChange={e => setForm(f => ({ ...f, taskName: e.target.value }))}
                            />
                        </div>

                        <div className={styles.field}>
                            <label className={styles.label}>頻度</label>
                            <div className={styles.freqChips}>
                                {FREQ_OPTIONS.map(opt => (
                                    <button
                                        key={opt.value}
                                        className={`${styles.freqChip} ${form.frequency === opt.value ? styles.freqActive : ""}`}
                                        onClick={() => setForm(f => ({ ...f, frequency: opt.value }))}
                                    >
                                        {opt.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {form.frequency === "weekly" && (
                            <div className={styles.field}>
                                <label className={styles.label}>曜日</label>
                                <div className={styles.weekdays}>
                                    {WEEKDAY_LABELS.map((label, i) => (
                                        <button
                                            key={i}
                                            className={`${styles.dayBtn} ${form.weekdays.includes(i) ? styles.dayActive : ""}`}
                                            onClick={() => toggleWeekday(i)}
                                        >
                                            {label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {form.frequency === "monthly" && (
                            <div className={styles.field}>
                                <label className={styles.label}>日付</label>
                                <div className={styles.numberRow}>
                                    <span>毎月</span>
                                    <input
                                        type="number"
                                        min="1"
                                        max="28"
                                        className={styles.numberInput}
                                        value={form.dayOfMonth}
                                        onChange={e => setForm(f => ({ ...f, dayOfMonth: Number(e.target.value) }))}
                                    />
                                    <span>日</span>
                                </div>
                            </div>
                        )}

                        <div className={styles.field}>
                            <label className={styles.label}>締め切り</label>
                            <div className={styles.numberRow}>
                                <span>追加日の</span>
                                <input
                                    type="number"
                                    min="0"
                                    max="30"
                                    className={styles.numberInput}
                                    value={form.deadlineDays}
                                    onChange={e => setForm(f => ({ ...f, deadlineDays: Number(e.target.value) }))}
                                />
                                <span>日後</span>
                            </div>
                        </div>

                        <button className={styles.saveBtn} onClick={handleSave}>保存する</button>
                        <div className={styles.safeArea} />
                    </div>
                </div>
            )}
        </div>
    );
}
