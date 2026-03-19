import Footer from "../Footer/Footer";
import Toast from "../Toast/Toast";
import { Outlet } from "react-router-dom";
import styles from "./Layout.module.css";

import { useEffect, useState, useRef } from "react";
import { auth, db } from "../../firebase";
import { onAuthStateChanged } from "firebase/auth";
import {
    collection, onSnapshot, addDoc, getDocs, updateDoc, doc
} from "firebase/firestore";

import { useToast } from "../../hooks/useToast";
import { useNotifications } from "../../hooks/useNotifications";

export default function Layout() {

    const [tasks, setTasks] = useState([]);
    const [sortType, setSortType] = useState("short");
    const [notificationsEnabled, setNotificationsEnabled] = useState(
        () => localStorage.getItem("notificationsEnabled") === "true"
    );
    const macroCheckedRef = useRef(false);
    const { toast, showToast, dismissToast } = useToast();

    useNotifications(tasks, notificationsEnabled);

    useEffect(() => {
        let unsubscribeTasks = null;

        const startListener = (user) => {
            if (!user || unsubscribeTasks) return;
            const tasksRef = collection(db, "users", user.uid, "tasks");
            unsubscribeTasks = onSnapshot(tasksRef, (snapshot) => {
                setTasks(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
            });
        };

        // auth.currentUser が既に設定されていればすぐ開始
        if (auth.currentUser) {
            startListener(auth.currentUser);
            return () => { if (unsubscribeTasks) unsubscribeTasks(); };
        }

        // Google リダイレクト後など auth 復元を待つ
        const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
            startListener(user);
        });

        return () => {
            unsubscribeAuth();
            if (unsubscribeTasks) unsubscribeTasks();
        };
    }, []);

    // マクロチェック：セッションにつき1回
    useEffect(() => {
        if (macroCheckedRef.current) return;
        macroCheckedRef.current = true;

        const runMacros = async () => {
            const user = auth.currentUser;
            if (!user) return;

            const macrosRef = collection(db, "users", user.uid, "macros");
            const snap = await getDocs(macrosRef);
            const now = new Date();

            for (const macroDoc of snap.docs) {
                const macro = macroDoc.data();
                if (!macro.enabled) continue;

                const lastTriggered = macro.lastTriggered?.toDate?.() ?? null;
                const alreadyToday = lastTriggered &&
                    lastTriggered.getFullYear() === now.getFullYear() &&
                    lastTriggered.getMonth() === now.getMonth() &&
                    lastTriggered.getDate() === now.getDate();

                if (alreadyToday) continue;

                let shouldTrigger = false;
                if (macro.frequency === "daily") {
                    shouldTrigger = true;
                } else if (macro.frequency === "weekly") {
                    shouldTrigger = (macro.weekdays ?? []).includes(now.getDay());
                } else if (macro.frequency === "monthly") {
                    shouldTrigger = now.getDate() === macro.dayOfMonth;
                }

                if (!shouldTrigger) continue;

                const deadline = new Date(now);
                deadline.setDate(deadline.getDate() + (macro.deadlineDays ?? 0));
                deadline.setHours(23, 59, 0, 0);

                await addDoc(collection(db, "users", user.uid, "tasks"), {
                    taskName: macro.taskName,
                    deadline,
                    startDate: null,
                    completed: false,
                    createdAt: now,
                    fromMacro: true,
                    description: null,
                    tags: [],
                });

                await updateDoc(doc(db, "users", user.uid, "macros", macroDoc.id), {
                    lastTriggered: now,
                });
            }
        };

        runMacros();
    }, []);

    const toggleNotifications = (val) => {
        setNotificationsEnabled(val);
        localStorage.setItem("notificationsEnabled", val ? "true" : "false");
    };

    return (
        <div className="layout">
            <main className={styles.content}>
                <Outlet context={{
                    tasks, sortType, setSortType,
                    showToast,
                    notificationsEnabled, toggleNotifications
                }} />
            </main>
            <Footer />
            <Toast toast={toast} onDismiss={dismissToast} />
        </div>
    );
}
