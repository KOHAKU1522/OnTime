import { useEffect, useRef, useState } from "react";
import styles from "./VoiceInput.module.css";

const SpeechRecognition =
    typeof window !== "undefined" && (window.SpeechRecognition || window.webkitSpeechRecognition)
        ? (window.SpeechRecognition || window.webkitSpeechRecognition)
        : null;

export default function VoiceInput({ value, onChange }) {
    const [listening, setListening] = useState(false);
    const [errorMessage, setErrorMessage] = useState("");
    const recognitionRef = useRef(null);
    const valueRef = useRef(value);
    const sessionBaseRef = useRef("");
    const shouldListenRef = useRef(false);
    const listeningRef = useRef(false);
    const restartTimerRef = useRef(null);
    const startTimerRef = useRef(null);

    useEffect(() => {
        valueRef.current = value;
    }, [value]);

    useEffect(() => {
        return () => {
            shouldListenRef.current = false;
            if (restartTimerRef.current) {
                clearTimeout(restartTimerRef.current);
            }
            if (startTimerRef.current) {
                clearTimeout(startTimerRef.current);
            }
            if (recognitionRef.current) {
                recognitionRef.current.onresult = null;
                recognitionRef.current.onend = null;
                try {
                    recognitionRef.current.stop();
                } catch (e) {}
            }
        };
    }, []);

    const startListening = async () => {
        if (!SpeechRecognition) return;

        if (!navigator.mediaDevices?.getUserMedia) {
            setErrorMessage("このブラウザーではマイク入力を利用できません。");
            return;
        }

        sessionBaseRef.current = valueRef.current;

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            stream.getTracks().forEach((track) => track.stop());
        } catch (e) {
            setErrorMessage(
                e?.name === "NotAllowedError"
                    ? "マイクの使用を許可してください。"
                    : "マイクに接続できませんでした。"
            );
            return;
        }

        if (!recognitionRef.current) {
            const r = new SpeechRecognition();
            r.lang = "ja-JP";
            r.interimResults = true;
            r.continuous = false;
            r.onstart = () => {
                if (startTimerRef.current) {
                    clearTimeout(startTimerRef.current);
                    startTimerRef.current = null;
                }
                setErrorMessage("");
                listeningRef.current = true;
                setListening(true);
            };

            r.onresult = (ev) => {
                let transcript = "";
                for (let i = 0; i < ev.results.length; ++i) {
                    transcript += ev.results[i][0].transcript;
                }

                if (transcript) {
                    onChange(`${sessionBaseRef.current}${transcript}`);
                    requestAnimationFrame(() => {
                        // if (textareaRef && textareaRef.current) {
                        //     textareaRef.current.style.height = "auto";
                        //     textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 220)}px`;
                        // }
                    });
                }
            };

            r.onerror = (ev) => {
                if (ev.error === "not-allowed" || ev.error === "service-not-allowed") {
                    shouldListenRef.current = false;
                    setErrorMessage("マイクの使用が許可されていません。");
                } else if (ev.error !== "no-speech" && ev.error !== "aborted") {
                    setErrorMessage("音声を認識できませんでした。");
                }
            };

            r.onend = () => {
                if (!shouldListenRef.current) {
                    listeningRef.current = false;
                    setListening(false);
                    return;
                }

                if (shouldListenRef.current) {
                    restartTimerRef.current = setTimeout(() => {
                        try {
                            sessionBaseRef.current = valueRef.current;
                            recognitionRef.current?.start();
                        } catch (e) {
                            if (e?.name !== "InvalidStateError") {
                                shouldListenRef.current = false;
                                setErrorMessage("マイクを再開できませんでした。");
                            }
                        }
                    }, 150);
                }
            };

            recognitionRef.current = r;
        }

        shouldListenRef.current = true;
        setErrorMessage("");
        try {
            recognitionRef.current.start();
            startTimerRef.current = setTimeout(() => {
                if (shouldListenRef.current && !listeningRef.current) {
                    shouldListenRef.current = false;
                    setErrorMessage("マイクを開始できませんでした。ブラウザーのマイク権限を確認してください。");
                }
            }, 1500);
        } catch (e) {
            shouldListenRef.current = false;
            console.error("SpeechRecognition start error:", e);
            setErrorMessage("マイクを開始できませんでした。");
        }
    };

    const stopListening = () => {
        if (!recognitionRef.current) return;
        shouldListenRef.current = false;
        if (restartTimerRef.current) {
            clearTimeout(restartTimerRef.current);
            restartTimerRef.current = null;
        }
        if (startTimerRef.current) {
            clearTimeout(startTimerRef.current);
            startTimerRef.current = null;
        }
        try {
            recognitionRef.current.stop();
        } catch (e) {}
        listeningRef.current = false;
    };

    const handleToggle = () => {
        if (!SpeechRecognition) return;
        if (listening) stopListening();
        else startListening();
    };

    return (
        <div className={styles.container}>
            <button
                type="button"
                className={`${styles.micButton} ${listening ? styles.on : ""}`}
                onClick={handleToggle}
                disabled={!SpeechRecognition}
                aria-pressed={listening}
            >
                {listening ? "録音中…（停止）" : "音声入力"}
            </button>

            {errorMessage && <div className={styles.info}>{errorMessage}</div>}
            {!SpeechRecognition && !errorMessage && (
                <div className={styles.info}>このブラウザは音声認識をサポートしていません。</div>
            )}
        </div>
    );
}
