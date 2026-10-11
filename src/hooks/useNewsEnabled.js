import { useCallback, useState } from "react";

const STORAGE_KEY = "newsEnabled";

// ニュース表示のオン・オフ（端末ごとの表示設定。ダークモードと同じく localStorage に保存）。
// 読み込みが同期的なので、オフのときは最初からニュースを取得しない。既定はオン
export function useNewsEnabled() {
    const [enabled, setEnabled] = useState(() => {
        try {
            return localStorage.getItem(STORAGE_KEY) !== "false";
        } catch {
            return true;
        }
    });

    const update = useCallback((value) => {
        setEnabled(value);
        try {
            localStorage.setItem(STORAGE_KEY, value ? "true" : "false");
        } catch {
            // 保存できない環境（プライベートモード等）では今回の表示だけに反映
        }
    }, []);

    return [enabled, update];
}
