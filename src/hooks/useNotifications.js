import { useEffect, useRef } from "react";

export function useNotifications(tasks, enabled, notifyMinutes = 1440) {
    const notifiedRef = useRef(new Set());

    useEffect(() => {
        if (!enabled) return;
        if (!("Notification" in window)) return;
        if (Notification.permission !== "granted") return;

        const checkDeadlines = () => {
            const now = new Date();
            tasks.forEach(task => {
                if (task.completed) return;
                const deadline = typeof task.deadline?.toDate === "function"
                    ? task.deadline.toDate()
                    : new Date(task.deadline);
                const diffMs = deadline - now;
                const diffMin = diffMs / 60000;

                const key = `${task.id}_${notifyMinutes}`;
                if (diffMin > 0 && diffMin <= notifyMinutes && !notifiedRef.current.has(key)) {
                    notifiedRef.current.add(key);
                    const diffH = Math.floor(diffMin / 60);
                    const remaining = diffH >= 1
                        ? `あと${diffH}時間`
                        : `あと${Math.ceil(diffMin)}分`;
                    new Notification("OnTime - 期限が近づいています", {
                        body: `「${task.taskName}」の期限まで${remaining}です`,
                        icon: "/images/app-logo.png",
                    });
                }
            });
        };

        checkDeadlines();
        const interval = setInterval(checkDeadlines, 60000);
        return () => clearInterval(interval);
    }, [tasks, enabled, notifyMinutes]);
}
