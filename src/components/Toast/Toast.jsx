import { useEffect, useState } from "react";
import styles from "./Toast.module.css";

const DURATION = 5000;

export default function Toast({ toast, onDismiss }) {
    const [progress, setProgress] = useState(100);

    useEffect(() => {
        if (!toast) return;
        setProgress(100);

        const start = Date.now();
        const interval = setInterval(() => {
            const elapsed = Date.now() - start;
            const remaining = Math.max(0, 100 - (elapsed / DURATION) * 100);
            setProgress(remaining);
            if (remaining === 0) {
                clearInterval(interval);
                onDismiss();
            }
        }, 50);

        return () => clearInterval(interval);
    }, [toast?.id]);

    if (!toast) return null;

    const handleUndo = () => {
        if (toast.onUndo) toast.onUndo();
        onDismiss();
    };

    return (
        <div className={styles.toast}>
            <span className={styles.message}>{toast.message}</span>
            {toast.onUndo && (
                <button className={styles.undoBtn} onClick={handleUndo}>元に戻す</button>
            )}
            <div className={styles.progressBar}>
                <div className={styles.progress} style={{ width: `${progress}%` }} />
            </div>
        </div>
    );
}
