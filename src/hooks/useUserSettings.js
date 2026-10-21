import { useCallback, useEffect, useState } from "react";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "../firebase";
import { DEFAULT_TIME_ZONE, isValidTimeZone } from "../utils/timezone";
import { reportFirestoreError } from "../utils/firestoreError";

export const DEFAULT_SETTINGS = {
    profileName: null,
    profileImage: null,
    weekStartsOn: 1,     // 週の開始曜日（0=日曜 … 6=土曜）。初期値は月曜
    starredFirst: true,  // スター付きタスクを最上部に表示
    starIcon: "star",
    starName: "スター",
    timeZone: DEFAULT_TIME_ZONE, // 日付の区切り・表示に使うタイムゾーン。初期値は Asia/Tokyo
};

export const STAR_ICON_OPTIONS = [
    { value: "star", label: "星" },
    { value: "heart", label: "ハート" },
    { value: "bookmark", label: "ブックマーク" },
];

// 値を検証して既定値で補う（古いデータや不正値でも壊れないように）
const normalize = (data) => ({
    profileName: typeof data?.profileName === "string" && data.profileName.trim()
        ? data.profileName.trim().slice(0, 50) : null,
    profileImage: data?.profileImage === "" ? "" :
        typeof data?.profileImage === "string" && data.profileImage.length <= 100000 &&
        /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(data.profileImage) ? data.profileImage : null,
    weekStartsOn: Number.isInteger(data?.weekStartsOn) && data.weekStartsOn >= 0 && data.weekStartsOn <= 6
        ? data.weekStartsOn : DEFAULT_SETTINGS.weekStartsOn,
    starredFirst: typeof data?.starredFirst === "boolean" ? data.starredFirst : DEFAULT_SETTINGS.starredFirst,
    starIcon: STAR_ICON_OPTIONS.some(option => option.value === data?.starIcon) ? data.starIcon : DEFAULT_SETTINGS.starIcon,
    starName: typeof data?.starName === "string" && data.starName.trim()
        ? data.starName.trim().slice(0, 16) : DEFAULT_SETTINGS.starName,
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
                onError?.(reportFirestoreError("設定を読み込めませんでした（既定の設定で表示しています）", err, ref.path));
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
            setSettings(prev);
            onError?.(reportFirestoreError("設定を保存できませんでした", err, `users/${uid}/settings/preferences`));
            return false;
        }
    }, [uid, settings, onError]);

    return { settings, updateSettings, loaded };
}
