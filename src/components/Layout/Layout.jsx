import Footer from "../Footer/Footer";
import Toast from "../Toast/Toast";
import { Outlet } from "react-router-dom";
import styles from "./Layout.module.css";

import { Suspense, useEffect, useState, useRef } from "react";
import PageLoader from "../PageLoader/PageLoader";
import { purgeExpiredTrash } from "../../utils/taskTrash";
import { logFirestoreError, reportFirestoreError } from "../../utils/firestoreError";
import { db } from "../../firebase";
import { useAuthUser } from "../../hooks/useAuthUser";
import { collection, onSnapshot } from "firebase/firestore";
import { runMacrosForUser } from "../../utils/macro";

import { useToast } from "../../hooks/useToast";
import { useNotifications } from "../../hooks/useNotifications";
import { useUserSettings } from "../../hooks/useUserSettings";

export default function Layout() {

    const user = useAuthUser();
    const [tasks, setTasks] = useState([]);
    const [sortType, setSortType] = useState("short");
    const [notificationsEnabled, setNotificationsEnabled] = useState(
        () => localStorage.getItem("notificationsEnabled") === "true"
    );
    const [notifyMinutes, setNotifyMinutes] = useState(
        () => Number(localStorage.getItem("notifyMinutes") || 1440)
    );
    const macroCheckedRef = useRef(false);
    const { toast, showToast, dismissToast } = useToast();
    const { settings, updateSettings, loaded: settingsLoaded } = useUserSettings(user?.uid, showToast);

    useNotifications(tasks, notificationsEnabled, notifyMinutes);

    useEffect(() => {
        if (!user?.uid) return;
        const tasksRef = collection(db, "users", user.uid, "tasks");
        const unsubscribe = onSnapshot(
            tasksRef,
            (snapshot) => {
                setTasks(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
            },
            (err) => showToast(reportFirestoreError("タスクを読み込めませんでした", err, tasksRef.path))
        );

        return () => unsubscribe();
    }, [user?.uid, showToast]);

    // マクロチェック：ユーザー確定後にセッションにつき1回（主処理はサーバーの定期実行）
    // 設定（タイムゾーン）の読み込み後に実行し、日付の判定をサーバーと一致させる
    useEffect(() => {
        if (!user?.uid || !settingsLoaded || macroCheckedRef.current) return;
        macroCheckedRef.current = true;

        runMacrosForUser(db, user.uid, settings.timeZone).catch((err) => {
            showToast(reportFirestoreError("マクロによるタスク追加に失敗しました", err, `users/${user.uid}/macros`));
        });
    }, [user?.uid, settingsLoaded, settings.timeZone, showToast]);

    // 取り消し期限を過ぎた削除済みタスクの退避データを整理する（失敗しても動作に影響しない）
    useEffect(() => {
        if (!user?.uid) return;
        purgeExpiredTrash(db, user.uid).catch((err) => logFirestoreError("削除済みタスクの整理", err, `users/${user.uid}/deletedTasks`));
    }, [user?.uid]);

    const toggleNotifications = (val) => {
        setNotificationsEnabled(val);
        localStorage.setItem("notificationsEnabled", val ? "true" : "false");
    };

    const changeNotifyMinutes = (val) => {
        setNotifyMinutes(val);
        localStorage.setItem("notifyMinutes", String(val));
    };

    return (
        <div className="layout">
            <main className={styles.content}>
                <Suspense fallback={<PageLoader />}>
                    <Outlet context={{
                        user, tasks, sortType, setSortType,
                        showToast,
                        notificationsEnabled, toggleNotifications,
                        notifyMinutes, changeNotifyMinutes,
                        settings, updateSettings
                    }} />
                </Suspense>
            </main>
            <Footer />
            <Toast toast={toast} onDismiss={dismissToast} />
        </div>
    );
}
