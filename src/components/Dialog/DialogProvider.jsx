import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DialogContext } from "../../hooks/useDialog";
import styles from "./Dialog.module.css";

export default function DialogProvider({ children }) {
    // { kind: "confirm" | "notify", title, message, confirmLabel, cancelLabel, danger, resolve }
    const [dialog, setDialog] = useState(null);
    const confirmBtnRef = useRef(null);
    const cancelBtnRef = useRef(null);
    const restoreFocusRef = useRef(null);
    const dialogRef = useRef(null);

    const open = useCallback((kind, options) => new Promise((resolve) => {
        // 表示中のダイアログがあればキャンセル扱いで閉じてから開く
        dialogRef.current?.resolve(false);
        restoreFocusRef.current = document.activeElement;
        dialogRef.current = { kind, ...options, resolve };
        setDialog(dialogRef.current);
    }), []);

    const confirm = useCallback((options) => open("confirm", options), [open]);
    const notify = useCallback((options) => open("notify", options), [open]);

    const close = useCallback((result) => {
        const current = dialogRef.current;
        dialogRef.current = null;
        setDialog(null);
        current?.resolve(result);
        restoreFocusRef.current?.focus?.();
    }, []);

    useEffect(() => {
        if (!dialog) return;
        // 削除など危険な操作はキャンセルに、それ以外は決定ボタンに初期フォーカス
        (dialog.danger ? cancelBtnRef : confirmBtnRef).current?.focus();
        const onKeyDown = (e) => {
            if (e.key === "Escape") close(false);
        };
        document.addEventListener("keydown", onKeyDown);
        return () => document.removeEventListener("keydown", onKeyDown);
    }, [dialog, close]);

    const value = useMemo(() => ({ confirm, notify }), [confirm, notify]);

    return (
        <DialogContext.Provider value={value}>
            {children}
            {dialog && (
                <div className={styles.overlay} onClick={() => close(false)}>
                    <div
                        className={styles.dialog}
                        role={dialog.kind === "confirm" ? "alertdialog" : "dialog"}
                        aria-modal="true"
                        aria-labelledby="app-dialog-title"
                        aria-describedby={dialog.message ? "app-dialog-message" : undefined}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h2 id="app-dialog-title" className={styles.title}>{dialog.title}</h2>
                        {dialog.message && <p id="app-dialog-message" className={styles.message}>{dialog.message}</p>}
                        <div className={styles.actions}>
                            {dialog.kind === "confirm" && (
                                <button ref={cancelBtnRef} type="button" className={styles.cancelBtn} onClick={() => close(false)}>
                                    {dialog.cancelLabel ?? "キャンセル"}
                                </button>
                            )}
                            <button
                                ref={confirmBtnRef}
                                type="button"
                                className={dialog.danger ? styles.dangerBtn : styles.primaryBtn}
                                onClick={() => close(true)}
                            >
                                {dialog.confirmLabel ?? "OK"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </DialogContext.Provider>
    );
}
