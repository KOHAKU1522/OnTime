import { useState, useEffect } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import { db } from "../firebase";
import { useAuthUser } from "../hooks/useAuthUser";
import {
    collection, addDoc, deleteDoc, updateDoc,
    onSnapshot, doc, serverTimestamp
} from "firebase/firestore";
import styles from "./MacroPage.module.css";
import { getIntervalDays, getNextIntervalKey, isDateKey, todayKey } from "../utils/macroSchedule";
import { useDialog } from "../hooks/useDialog";

const FREQ_OPTIONS = [
    { value: "daily", label: "毎日" },
    { value: "weekly", label: "曜日指定" },
    { value: "monthly", label: "毎月" },
    { value: "interval", label: "何日おき" },
];

const WEEKDAY_LABELS = ["日", "月", "火", "水", "木", "金", "土"];

const DEFAULT_FORM = {
    taskName: "",
    frequency: "daily",
    weekdays: [],
    dayOfMonth: 1,
    deadlineDays: 0,
    intervalDays: 2,
    startDate: "",
};

const clampInt = (value, min, max, fallback) => {
    const n = Number(value);
    return Number.isInteger(n) ? Math.min(Math.max(n, min), max) : fallback;
};

// 既存マクロ（新しい項目がない古いデータを含む）を編集フォームの値に変換する
const macroToForm = (macro, timeZone) => ({
    taskName: macro.taskName ?? "",
    frequency: FREQ_OPTIONS.some(o => o.value === macro.frequency) ? macro.frequency : "daily",
    weekdays: Array.isArray(macro.weekdays) ? macro.weekdays : [],
    dayOfMonth: clampInt(macro.dayOfMonth, 1, 28, 1),
    deadlineDays: clampInt(macro.deadlineDays, 0, 30, 0),
    intervalDays: getIntervalDays(macro) ?? 2,
    startDate: isDateKey(macro.startDate) ? macro.startDate : todayKey(new Date(), timeZone),
});

const formatDateKey = (key) => {
    if (!isDateKey(key)) return "";
    const [, m, d] = key.split("-").map(Number);
    return `${m}/${d}`;
};

export default function MacroPage() {

    useEffect(() => {
        window.scrollTo(0, 0);
    }, []);

    const navigate = useNavigate();
    const [macros, setMacros] = useState([]);
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState(DEFAULT_FORM);
    const [editingId, setEditingId] = useState(null);
    const [formError, setFormError] = useState("");

    const user = useAuthUser();
    const uid = user?.uid;
    const { showToast, settings } = useOutletContext();
    const timeZone = settings.timeZone;
    const { confirm } = useDialog();

    useEffect(() => {
        if (!uid) return;
        const ref = collection(db, "users", uid, "macros");
        const unsub = onSnapshot(
            ref,
            snap => setMacros(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
            err => {
                console.error("マクロ読み込みエラー:", err);
                showToast("マクロを読み込めませんでした。再読み込みしてください");
            }
        );
        return () => unsub();
    }, [uid, showToast]);

    const runMacroOp = async (operation, errorMessage) => {
        if (!uid) return false;
        try {
            await operation();
            return true;
        } catch (err) {
            console.error(errorMessage, err);
            showToast(`${errorMessage}。もう一度お試しください`);
            return false;
        }
    };

    const handleToggle = (macro) => runMacroOp(
        () => updateDoc(doc(db, "users", uid, "macros", macro.id), { enabled: !macro.enabled }),
        "切り替えできませんでした"
    );

    const handleDelete = async (macro) => {
        const ok = await confirm({
            title: "マクロを削除しますか？",
            message: `「${macro.taskName}」を削除します。これまでに追加されたタスクは残ります。`,
            confirmLabel: "削除",
            danger: true,
        });
        if (!ok) return;
        await runMacroOp(
            () => deleteDoc(doc(db, "users", uid, "macros", macro.id)),
            "削除できませんでした"
        );
    };

    const openCreate = () => {
        setEditingId(null);
        setForm({ ...DEFAULT_FORM, startDate: todayKey(new Date(), timeZone) });
        setFormError("");
        setShowForm(true);
    };

    const openEdit = (macro) => {
        setEditingId(macro.id);
        setForm(macroToForm(macro, timeZone));
        setFormError("");
        setShowForm(true);
    };

    const closeForm = () => {
        setShowForm(false);
        setEditingId(null);
        setFormError("");
    };

    const validate = () => {
        if (!form.taskName.trim()) return "タスク名を入力してください";
        if (form.frequency === "weekly" && form.weekdays.length === 0) return "曜日を1つ以上選んでください";
        if (form.frequency === "monthly" && clampInt(form.dayOfMonth, 1, 28, null) !== Number(form.dayOfMonth)) {
            return "日付は1〜28の整数で入力してください";
        }
        if (form.frequency === "interval") {
            if (!getIntervalDays(form)) return "間隔は1〜365日の整数で入力してください";
            if (!isDateKey(form.startDate)) return "開始日を選んでください";
        }
        if (clampInt(form.deadlineDays, 0, 30, null) !== Number(form.deadlineDays)) {
            return "締め切りは0〜30日の整数で入力してください";
        }
        return "";
    };

    const handleSave = async () => {
        const error = validate();
        if (error) {
            setFormError(error);
            return;
        }

        // 設定項目のみ保存する。実行履歴（lastTriggered / lastTriggeredKey）と有効状態は編集で変えないため、
        // 今日すでに追加済みのマクロを編集しても同じ日に再追加されない
        const isInterval = form.frequency === "interval";
        const fields = {
            taskName: form.taskName.trim(),
            frequency: form.frequency,
            weekdays: form.frequency === "weekly" ? [...form.weekdays].sort((a, b) => a - b) : [],
            dayOfMonth: Number(form.dayOfMonth),
            deadlineDays: Number(form.deadlineDays),
            intervalDays: isInterval ? Number(form.intervalDays) : null,
            startDate: isInterval ? form.startDate : null,
        };

        const ok = await runMacroOp(
            () => editingId
                ? updateDoc(doc(db, "users", uid, "macros", editingId), { ...fields, updatedAt: serverTimestamp() })
                : addDoc(collection(db, "users", uid, "macros"), {
                    ...fields,
                    enabled: true,
                    lastTriggered: null,
                    lastTriggeredKey: null,
                    createdAt: serverTimestamp(),
                }),
            "保存できませんでした"
        );
        if (!ok) return;
        setForm(DEFAULT_FORM);
        closeForm();
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
            return (macro.weekdays ?? []).map(d => WEEKDAY_LABELS[d]).join("・") + "曜日";
        }
        if (macro.frequency === "interval") {
            const next = formatDateKey(getNextIntervalKey(macro, timeZone));
            return `${getIntervalDays(macro) ?? "?"}日おき` + (macro.enabled && next ? `（次回 ${next}）` : "");
        }
        return `毎月${macro.dayOfMonth}日`;
    };

    // 有効なマクロを上に（同じ状態の中では元の順序を保つ）
    const sortedMacros = [...macros].sort((a, b) => Number(!!b.enabled) - Number(!!a.enabled));

    return (
        <div className={styles.page}>
            <header className={styles.header}>
                <button className={styles.backBtn} onClick={() => navigate(-1)}>
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="15 18 9 12 15 6" />
                    </svg>
                </button>
                <h2 className={styles.title}>マクロ</h2>
                <button className={styles.addBtn} onClick={openCreate} aria-label="マクロを追加">＋</button>
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
                    <button className={styles.emptyAddBtn} onClick={openCreate}>
                        最初のマクロを作成
                    </button>
                </div>
            )}

            {sortedMacros.map(macro => (
                <div key={macro.id} className={`${styles.macroCard} ${!macro.enabled ? styles.disabled : ""}`}>
                    <button
                        type="button"
                        className={styles.macroMain}
                        onClick={() => openEdit(macro)}
                        aria-label={`「${macro.taskName}」を編集`}
                    >
                        <span className={styles.macroName}>{macro.taskName}</span>
                        <span className={styles.macroMeta}>
                            {freqLabel(macro)} ・ {Number(macro.deadlineDays ?? 0) === 0 ? "当日締め切り" : `${macro.deadlineDays}日後締め切り`}
                        </span>
                    </button>
                    <div className={styles.macroActions}>
                        <button
                            className={`${styles.toggle} ${macro.enabled ? styles.toggleOn : styles.toggleOff}`}
                            onClick={() => handleToggle(macro)}
                            aria-pressed={!!macro.enabled}
                            aria-label={macro.enabled ? "一時停止する" : "再開する"}
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
                <div className={styles.formOverlay} onClick={closeForm}>
                    <div className={styles.formSheet} onClick={e => e.stopPropagation()}>
                        <div className={styles.formHandle} />
                        <h3 className={styles.formTitle}>{editingId ? "マクロを編集" : "マクロを追加"}</h3>

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

                        {form.frequency === "interval" && (
                            <div className={styles.field}>
                                <label className={styles.label}>間隔</label>
                                <div className={styles.numberRow}>
                                    <input
                                        type="number"
                                        min="1"
                                        max="365"
                                        className={styles.numberInput}
                                        value={form.intervalDays}
                                        onChange={e => setForm(f => ({ ...f, intervalDays: e.target.value === "" ? "" : Number(e.target.value) }))}
                                        aria-label="間隔（日）"
                                    />
                                    <span>日おきに追加</span>
                                </div>
                                <label className={styles.label} htmlFor="macroStartDate">開始日</label>
                                <input
                                    id="macroStartDate"
                                    type="date"
                                    className={styles.input}
                                    value={form.startDate}
                                    onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))}
                                />
                                <p className={styles.hint}>
                                    開始日に最初のタスクを追加し、以後は前回追加した日から{getIntervalDays(form) ?? "N"}日ごとに追加します（設定のタイムゾーン {timeZone} の日付）。
                                    一時停止中の分をまとめて追加することはありません。
                                </p>
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

                        {formError && <p className={styles.formError} role="alert">{formError}</p>}
                        <button className={styles.saveBtn} onClick={handleSave}>保存する</button>
                        <div className={styles.safeArea} />
                    </div>
                </div>
            )}
        </div>
    );
}
