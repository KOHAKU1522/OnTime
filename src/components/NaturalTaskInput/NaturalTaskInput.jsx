import { useState } from "react";
import { auth } from "../../firebase";
import styles from "./NaturalTaskInput.module.css";
import { formatInZone, fromZonedInputValue } from "../../utils/date";

// サーバーのエラーコードごとの案内（内部の原因は画面に出さない）
const ERROR_MESSAGES = {
    UNAUTHORIZED: "ログインが必要です。再ログインしてからお試しください。",
    SESSION_EXPIRED: "ログインの有効期限が切れました。再ログインしてください。",
    BAD_REQUEST: "入力が長すぎるか、内容を読み取れませんでした。短くして再度お試しください。",
    NOT_CONFIGURED: "現在この機能は利用できません。通常のタスク追加をご利用ください。",
    FUNCTION_NOT_FOUND: "現在この機能は利用できません。通常のタスク追加をご利用ください。",
    AUTH_UNAVAILABLE: "認証サーバーに接続できませんでした。しばらくしてから再度お試しください。",
    UNAVAILABLE: "現在混み合っています。しばらくしてから再度お試しください。",
    AI_BUSY: "AI の利用が集中しています。しばらくしてから再度お試しください。",
    OFFLINE: "インターネットに接続されていません。接続を確認してください。",
};

// AI が返す "YYYY-MM-DDTHH:mm" は設定タイムゾーンの時刻
const formatDateTime = (value, timeZone) => {
    if (!value) return "";
    return formatInZone(fromZonedInputValue(value, timeZone), timeZone, {
        year: "numeric", month: "long", day: "numeric", weekday: "short",
        hour: "2-digit", minute: "2-digit",
    });
};

// 自然言語からタスクを読み取り、利用者の確認後にだけ登録する
export default function NaturalTaskInput({ onAddTask, isGuest, timeZone }) {
    const [text, setText] = useState("");
    const [turns, setTurns] = useState([]); // AI との会話履歴（不足情報の質問と回答）
    const [question, setQuestion] = useState("");
    const [proposal, setProposal] = useState(null); // { task, notes }
    const [status, setStatus] = useState("idle"); // idle | parsing | saving
    const [error, setError] = useState("");

    const reset = () => {
        setText("");
        setTurns([]);
        setQuestion("");
        setProposal(null);
        setError("");
        setStatus("idle");
    };

    const handleParse = async (e) => {
        e.preventDefault();
        const input = text.trim();
        if (!input || status !== "idle") return;

        const nextTurns = [...turns, { role: "user", text: input }];
        setStatus("parsing");
        setError("");
        try {
            const token = await auth.currentUser?.getIdToken();
            if (!token) throw Object.assign(new Error("no token"), { code: "UNAUTHORIZED" });

            const response = await fetch("/.netlify/functions/parse-task", {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                body: JSON.stringify({
                    turns: nextTurns,
                    now: formatInZone(new Date(), timeZone, {
                        year: "numeric", month: "long", day: "numeric", weekday: "long",
                        hour: "2-digit", minute: "2-digit",
                    }),
                    timeZone,
                }),
            });
            const result = await response.json().catch(() => ({}));
            if (!response.ok) {
                // 関数自体が見つからない（未デプロイ・ルーティング不備）場合は JSON が返らない
                if (response.status === 404 && !result.code) {
                    throw Object.assign(new Error("function not found"), { code: "FUNCTION_NOT_FOUND" });
                }
                throw Object.assign(new Error(result.error), { code: result.code, serverMessage: result.error });
            }

            setText("");
            if (result.status === "need_info") {
                setTurns([...nextTurns, { role: "model", text: result.question }]);
                setQuestion(result.question);
            } else {
                setTurns(nextTurns);
                setQuestion("");
                setProposal({ task: result.task, notes: result.notes ?? [] });
            }
        } catch (err) {
            console.error("[parse-task] 解析エラー", { code: err.code ?? "NETWORK" });
            if (!err.code && !navigator.onLine) err.code = "OFFLINE";
            // 利用上限・入力不備はサーバーのメッセージ（待ち時間・上限値を含む）をそのまま表示する
            const useServerMessage = (err.code === "RATE_LIMITED" || err.code === "BAD_REQUEST" || err.code === "AI_FAILED") && err.serverMessage;
            setError(useServerMessage
                ? err.serverMessage
                : ERROR_MESSAGES[err.code] ?? "読み取りに失敗しました。通信状況を確認して、もう一度お試しください。");
        } finally {
            setStatus("idle");
        }
    };

    const handleConfirm = async () => {
        if (!proposal || status !== "idle") return;
        setStatus("saving");
        const ok = await onAddTask({ ...proposal.task, createdAt: new Date(), completed: false });
        if (ok === false) {
            setStatus("idle");
            return;
        }
        reset();
    };

    // 修正：提案を破棄して、追加の指示を入力できるようにする
    const handleRevise = () => {
        const { task } = proposal;
        setProposal(null);
        setQuestion("どこを修正しますか？（例：期限は金曜の18時）");
        setTurns(prev => [...prev, {
            role: "model",
            text: `タスク「${task.taskName}」、期限 ${task.deadline} と解釈しました。どこを修正しますか？`,
        }]);
    };

    if (isGuest) return null;

    const busy = status !== "idle";

    return (
        <section className={styles.container} aria-label="文章でタスクを追加">
            {!proposal && (
                <form onSubmit={handleParse} className={styles.form}>
                    {question && <p className={styles.question} role="status">{question}</p>}
                    <div className={styles.row}>
                        <input
                            className={styles.input}
                            type="text"
                            maxLength={1000}
                            value={text}
                            onChange={e => setText(e.target.value)}
                            placeholder={question ? "回答を入力" : "例：来週金曜までにレポートを提出"}
                            aria-label={question ? "質問への回答" : "タスクを文章で入力"}
                            disabled={busy}
                        />
                        <button className={styles.primaryBtn} type="submit" disabled={busy || !text.trim()}>
                            {status === "parsing" ? "読み取り中…" : question ? "回答" : "読み取る"}
                        </button>
                    </div>
                    {turns.length > 0 && (
                        <button type="button" className={styles.textBtn} onClick={reset} disabled={busy}>
                            やり直す
                        </button>
                    )}
                </form>
            )}

            {proposal && (
                <div className={styles.confirm} role="dialog" aria-label="登録内容の確認">
                    <p className={styles.confirmTitle}>この内容で追加しますか？</p>
                    <dl className={styles.fields}>
                        <dt>タスク</dt><dd>{proposal.task.taskName}</dd>
                        <dt>期限</dt><dd>{formatDateTime(proposal.task.deadline, timeZone)}</dd>
                        {proposal.task.startDate && (<><dt>開始</dt><dd>{formatDateTime(proposal.task.startDate, timeZone)}</dd></>)}
                        {proposal.task.description && (<><dt>メモ</dt><dd>{proposal.task.description}</dd></>)}
                        {proposal.task.tags.length > 0 && (<><dt>タグ</dt><dd>{proposal.task.tags.join("、")}</dd></>)}
                    </dl>
                    {proposal.notes.length > 0 && (
                        <ul className={styles.notes}>
                            {proposal.notes.map((note, i) => <li key={i}>{note}</li>)}
                        </ul>
                    )}
                    <div className={styles.actions}>
                        <button type="button" className={styles.textBtn} onClick={reset} disabled={busy}>キャンセル</button>
                        <button type="button" className={styles.secondaryBtn} onClick={handleRevise} disabled={busy}>修正する</button>
                        <button type="button" className={styles.primaryBtn} onClick={handleConfirm} disabled={busy}>
                            {status === "saving" ? "追加中…" : "追加する"}
                        </button>
                    </div>
                </div>
            )}

            {error && <p className={styles.error} role="alert">{error}</p>}
        </section>
    );
}
