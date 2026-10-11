import { useCallback, useEffect, useState } from "react";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "../firebase";
import { DEFAULT_TIME_ZONE, isValidTimeZone } from "../utils/timezone";

export const DEFAULT_SETTINGS = {
    weekStartsOn: 1,     // 週の開始曜日（0=日曜 … 6=土曜）。初期値は月曜
    starredFirst: true,  // スター付きタスクを最上部に表示
    timeZone: DEFAULT_TIME_ZONE, // 日付の区切り・表示に使うタイムゾーン。初期値は Asia/Tokyo
};

// 値を検証して既定値で補う（古いデータや不正値でも壊れないように）
const normalize = (data) => ({
    weekStartsOn: Number.isInteger(data?.weekStartsOn) && data.weekStartsOn >= 0 && data.weekStartsOn <= 6
        ? data.weekStartsOn : DEFAULT_SETTINGS.weekStartsOn,
    starredFirst: typeof data?.starredFirst === "boolean" ? data.starredFirst : DEFAULT_SETTINGS.starredFirst,
    timeZone: isValidTimeZone(data?.timeZone) ? data.timeZone : DEFAULT_SETTINGS.timeZone,
});

// ユーザーごとの設定を users/{uid}/settings/preferences に保存する（ゲストは端末内のみ）
export function useUserSettings(uid, onError) {
    const [settings, setSettings] = useState(DEFAULT_SETTINGS);
    // 設定を読み込んだユーザーID（読み込み完了の判定に使う。ゲストは常に完了扱い）
    const [loadedUid, setLoadedUid] = useState(null);
    const loaded = !uid || loadedUid === uid;

    useEffect(() => {
        if (!uid) return;
        const ref = doc(db, "users", uid, "settings", "preferences");
        return onSnapshot(
            ref,
            (snap) => {
                setSettings(normalize(snap.data()));
                setLoadedUid(uid);
            },
            (err) => {
                setLoadedUid(uid);
                console.error("設定読み込みエラー:", err);
                onError?.("設定を読み込めませんでした。既定の設定で表示しています");
            }
        );
    }, [uid, onError]);

    const updateSettings = useCallback(async (patch) => {
        const prev = settings;
        const next = normalize({ ...settings, ...patch });
        setSettings(next); // 先に画面へ反映
        if (!uid) return true;
        try {
            await setDoc(doc(db, "users", uid, "settings", "preferences"), next, { merge: true });
            return true;
        } catch (err) {
            console.error("設定保存エラー:", err);
            setSettings(prev);
            onError?.("設定を保存できませんでした。通信状況を確認して、もう一度お試しください");
            return false;
        }
    }, [uid, settings, onError]);

    return { settings, updateSettings, loaded };
}
