import { toDate, dateKeyInZone } from "./date";
import { addDaysToKey, parseDateKey, weekdayOfKey } from "./timezone";

const DAY_LABELS = ["日", "月", "火", "水", "木", "金", "土"];

// 今週の開始日（設定の週の開始曜日・タイムゾーン）の日付キー
const getWeekStartKey = (now, weekStartsOn, timeZone) => {
    const today = dateKeyInZone(now, timeZone);
    return addDaysToKey(today, -((weekdayOfKey(today) - weekStartsOn + 7) % 7));
};

// 完了日時を設定タイムゾーンの日付キーにする
const completedKeys = (tasks, timeZone) => tasks
    .map(task => toDate(task.completedAt))
    .filter(Boolean)
    .map(d => dateKeyInZone(d, timeZone));

// 今週（設定の開始曜日から7日間）の日別完了数
export function getWeeklyCompletions(tasks, { weekStartsOn = 1, timeZone, now = new Date() } = {}) {
    const startKey = getWeekStartKey(now, weekStartsOn, timeZone);
    const todayKey = dateKeyInZone(now, timeZone);
    const result = Array.from({ length: 7 }, (_, i) => {
        const key = addDaysToKey(startKey, i);
        return { key, label: DAY_LABELS[weekdayOfKey(key)], count: 0, isToday: key === todayKey };
    });

    completedKeys(tasks, timeZone).forEach(key => {
        const slot = result.find(r => r.key === key);
        if (slot) slot.count++;
    });

    return result;
}

// 今週を含む直近4週間（設定の開始曜日で区切る）の週別完了数
export function getMonthlyCompletions(tasks, { weekStartsOn = 1, timeZone, now = new Date() } = {}) {
    const currentStart = getWeekStartKey(now, weekStartsOn, timeZone);
    const result = Array.from({ length: 4 }, (_, i) => {
        const startKey = addDaysToKey(currentStart, -(3 - i) * 7);
        const { month, day } = parseDateKey(startKey);
        return {
            label: `${month + 1}/${day}週`,
            startKey,
            endKey: addDaysToKey(startKey, 7), // 含まない
            count: 0,
            isCurrentWeek: i === 3,
        };
    });

    completedKeys(tasks, timeZone).forEach(key => {
        const slot = result.find(r => key >= r.startKey && key < r.endKey);
        if (slot) slot.count++;
    });

    return result;
}
