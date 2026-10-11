import { createContext, useContext } from "react";

export const DialogContext = createContext(null);

// アプリ内ダイアログ（window.confirm / alert の置き換え）
// const { confirm, notify } = useDialog();
// if (await confirm({ title, message, confirmLabel, danger: true })) { ... }
export function useDialog() {
    const ctx = useContext(DialogContext);
    if (!ctx) throw new Error("useDialog は DialogProvider の内側で使ってください");
    return ctx;
}
