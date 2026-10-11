import { useEffect, useRef, useState } from "react";
import styles from "./VoiceInput.module.css";

const SpeechRecognition =
    typeof window !== "undefined"
        ? (window.SpeechRecognition || window.webkitSpeechRecognition || null)
        : null;

// 認識エラーごとの案内。fatal: 自動再開せずに停止する
const RECOGNITION_ERRORS = {
    "not-allowed": { fatal: true, message: "マイクの使用が許可されていません。ブラウザーのサイト設定でマイクを許可してください。" },
    "service-not-allowed": { fatal: true, message: "このブラウザーでは音声認識サービスを利用できません。" },
    "audio-capture": { fatal: true, message: "マイクが見つかりません。接続を確認してください。" },
    "network": { fatal: true, message: "音声認識にはインターネット接続が必要です。接続を確認してから再度お試しください。" },
    "language-not-supported": { fatal: true, message: "日本語の音声認識に対応していません。" },
    "bad-grammar": { fatal: true, message: "音声を認識できませんでした。" },
};

export default function VoiceInput({ value, onChange }) {
    // idle | starting | listening
    const [status, setStatus] = useState("idle");
    const [errorMessage, setErrorMessage] = useState("");
    const recognitionRef = useRef(null);
    const valueRef = useRef(value);
    const onChangeRef = useRef(onChange);
    const sessionBaseRef = useRef("");
    const shouldListenRef = useRef(false);
    const restartTimerRef = useRef(null);
    const startTimerRef = useRef(null);
    const mountedRef = useRef(true);
    const attemptRef = useRef(0); // 開始操作の世代（権限確認中に停止された開始処理を破棄する）

    useEffect(() => {
        valueRef.current = value;
        onChangeRef.current = onChange;
    }, [value, onChange]);

    const clearTimers = () => {
        clearTimeout(restartTimerRef.current);
        clearTimeout(startTimerRef.current);
        restartTimerRef.current = null;
        startTimerRef.current = null;
    };

    useEffect(() => {
        mountedRef.current = true;
        return () => {
            // 画面を離れたら認識を止め、以後のイベントで状態を更新しない
            mountedRef.current = false;
            shouldListenRef.current = false;
            clearTimers();
            const r = recognitionRef.current;
            if (r) {
                r.onstart = r.onresult = r.onerror = r.onend = null;
                try { r.abort(); } catch { /* 既に停止済み */ }
            }
        };
    }, []);

    const fail = (message) => {
        shouldListenRef.current = false;
        clearTimers();
        if (!mountedRef.current) return;
        setErrorMessage(message);
        setStatus("idle");
    };

    const createRecognition = () => {
        const r = new SpeechRecognition();
        r.lang = "ja-JP";
        r.interimResults = true;
        r.continuous = false;

        r.onstart = () => {
            clearTimeout(startTimerRef.current);
            startTimerRef.current = null;
            if (!mountedRef.current) return;
            setErrorMessage("");
            setStatus("listening");
        };

        r.onresult = (ev) => {
            let transcript = "";
            for (let i = 0; i < ev.results.length; ++i) {
                transcript += ev.results[i][0].transcript;
            }
            if (transcript) onChangeRef.current(`${sessionBaseRef.current}${transcript}`);
        };

        r.onerror = (ev) => {
            // no-speech（無音）と aborted（停止操作）は自動再開・停止の流れに任せる
            if (ev.error === "no-speech" || ev.error === "aborted") return;
            const info = RECOGNITION_ERRORS[ev.error];
            if (info?.fatal) {
                fail(info.message);
            } else {
                console.warn("SpeechRecognition error:", ev.error);
                fail("音声を認識できませんでした。もう一度お試しください。");
            }
        };

        r.onend = () => {
            if (!shouldListenRef.current) {
                if (mountedRef.current) setStatus("idle");
                return;
            }
            // 停止ボタンが押されるまで聞き取りを続ける（1回の認識が終わるたびに再開）
            restartTimerRef.current = setTimeout(() => {
                if (!shouldListenRef.current) return;
                try {
                    sessionBaseRef.current = valueRef.current;
                    r.start();
                } catch (e) {
                    if (e?.name !== "InvalidStateError") fail("マイクを再開できませんでした。");
                }
            }, 150);
        };

        return r;
    };

    const startListening = async () => {
        if (!SpeechRecognition) return;
        if (!window.isSecureContext) {
            setErrorMessage("音声入力は HTTPS で開いたページでのみ利用できます。");
            return;
        }

        const attempt = ++attemptRef.current;
        setStatus("starting");
        setErrorMessage("");

        // 先にマイク権限を確認し、拒否・未接続を分かりやすく伝える
        if (navigator.mediaDevices?.getUserMedia) {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                stream.getTracks().forEach((track) => track.stop());
            } catch (e) {
                if (attempt !== attemptRef.current) return;
                fail(
                    e?.name === "NotAllowedError" || e?.name === "SecurityError"
                        ? "マイクの使用が許可されていません。ブラウザーのサイト設定でマイクを許可してください。"
                        : e?.name === "NotFoundError"
                            ? "マイクが見つかりません。接続を確認してください。"
                            : "マイクに接続できませんでした。"
                );
                return;
            }
        }
        if (!mountedRef.current || attempt !== attemptRef.current) return;

        if (!recognitionRef.current) recognitionRef.current = createRecognition();

        sessionBaseRef.current = valueRef.current;
        shouldListenRef.current = true;
        try {
            recognitionRef.current.start();
            startTimerRef.current = setTimeout(() => {
                if (shouldListenRef.current) {
                    try { recognitionRef.current?.abort(); } catch { /* 既に停止済み */ }
                    fail("マイクを開始できませんでした。ブラウザーのマイク権限を確認してください。");
                }
            }, 3000);
        } catch (e) {
            console.error("SpeechRecognition start error:", e);
            fail("マイクを開始できませんでした。");
        }
    };

    const stopListening = () => {
        attemptRef.current++;
        shouldListenRef.current = false;
        clearTimers();
        try { recognitionRef.current?.stop(); } catch { /* 既に停止済み */ }
        setStatus("idle");
    };

    const handleToggle = () => {
        if (!SpeechRecognition) return;
        // 開始処理中・録音中のどちらでも、もう一度押すと停止する
        if (status === "idle") startListening();
        else stopListening();
    };

    const active = status !== "idle";

    return (
        <div className={styles.container}>
            <button
                type="button"
                className={`${styles.micButton} ${active ? styles.on : ""}`}
                onClick={handleToggle}
                disabled={!SpeechRecognition}
                aria-pressed={active}
                aria-label={active ? "音声入力を停止" : "音声入力を開始"}
                title={active ? "音声入力を停止" : "音声入力"}
            >
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <rect x="9" y="2" width="6" height="12" rx="3" />
                    <path d="M5 10a7 7 0 0 0 14 0M12 19v3m-4 0h8" />
                </svg>
            </button>

            {active && (
                <span className={styles.statusText} role="status">
                    {status === "starting" ? "準備中…" : "録音中…"}
                </span>
            )}

            {errorMessage && <div className={styles.info} role="alert">{errorMessage}</div>}
            {!SpeechRecognition && !errorMessage && (
                <div className={styles.info}>このブラウザは音声認識をサポートしていません。Chrome、Edge、Safari をお試しください。</div>
            )}
        </div>
    );
}
