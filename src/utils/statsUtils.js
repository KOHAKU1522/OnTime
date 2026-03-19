const DAY_LABELS = ["日", "月", "火", "水", "木", "金", "土"];

// 過去7日間の日別完了数
export function getWeeklyCompletions(tasks) {
    const result = Array(7).fill(0).map((_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (6 - i));
        d.setHours(0, 0, 0, 0);
        return { date: new Date(d), label: DAY_LABELS[d.getDay()], count: 0, isToday: i === 6 };
    });

    tasks.forEach(task => {
        if (!task.completedAt) return;
        const completedDate = typeof task.completedAt?.toDate === "function"
            ? task.completedAt.toDate()
            : new Date(task.completedAt);
        const dayStart = new Date(completedDate);
        dayStart.setHours(0, 0, 0, 0);

        const slot = result.find(r => r.date.getTime() === dayStart.getTime());
        if (slot) slot.count++;
    });

    return result;
}

// 過去4週間の週別完了数
export function getMonthlyCompletions(tasks) {
    const result = Array(4).fill(0).map((_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (3 - i) * 7);
        d.setHours(0, 0, 0, 0);
        const weekStart = new Date(d);
        weekStart.setDate(d.getDate() - d.getDay()); // 週の始まり（日曜）
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        return {
            label: `${weekStart.getMonth() + 1}/${weekStart.getDate()}週`,
            weekStart,
            weekEnd,
            count: 0,
            isCurrentWeek: i === 3
        };
    });

    tasks.forEach(task => {
        if (!task.completedAt) return;
        const completedDate = typeof task.completedAt?.toDate === "function"
            ? task.completedAt.toDate()
            : new Date(task.completedAt);

        const slot = result.find(r =>
            completedDate >= r.weekStart && completedDate <= r.weekEnd
        );
        if (slot) slot.count++;
    });

    return result;
}
