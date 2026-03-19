import { useEffect, useRef } from "react";

export function useNotifications(tasks, enabled) {
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

                // 1時間以内かつ未来の場合に通知（セッション内1回のみ）
                if (diffMin > 0 && diffMin <= 60 && !notifiedRef.current.has(`${task.id}_1h`)) {
                    notifiedRef.current.add(`${task.id}_1h`);
                    new Notification("OnTime - 期限が近づいています", {
                        body: `「${task.taskName}」の期限まであと${Math.ceil(diffMin)}分です`,
                        icon: "/vite.svg",
                    });
                }

                // 1日以内かつ1時間超の場合に通知
                if (diffMin > 60 && diffMin <= 1440 && !notifiedRef.current.has(`${task.id}_1d`)) {
                    notifiedRef.current.add(`${task.id}_1d`);
                    const diffH = Math.floor(diffMin / 60);
                    new Notification("OnTime - 期限が近づいています", {
                        body: `「${task.taskName}」の期限まであと${diffH}時間です`,
                        icon: "/vite.svg",
                    });
                }
            });
        };

        checkDeadlines();
        const interval = setInterval(checkDeadlines, 60000);
        return () => clearInterval(interval);
    }, [tasks, enabled]);
}
