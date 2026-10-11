import { useEffect, useState } from "react";
import styles from "./Toast.module.css";

const DURATION = 5000;

// トーストごとに key を変えて作り直すことで、進捗を初期値から始める
function ToastBody({ toast, onDismiss }) {
    const [progress, setProgress] = useState(100);

    useEffect(() => {
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
    }, [onDismiss]);

    const handleUndo = () => {
        if (toast.onUndo) toast.onUndo();
        onDismiss();
    };

    return (
        <div className={styles.toast} role="status" aria-live="polite">
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

export default function Toast({ toast, onDismiss }) {
    if (!toast) return null;
    return <ToastBody key={toast.id} toast={toast} onDismiss={onDismiss} />;
}
