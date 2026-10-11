import {
    DEFAULT_TIME_ZONE, addDaysToKey, addMonthsToKey, dateKeyInZone, dateKeyToDate,
    parseDateKey, resolveTimeZone, weekdayOfKey, zonedTimeToDate, getZonedParts,
} from "./timezone";

export { DEFAULT_TIME_ZONE, dateKeyInZone, resolveTimeZone };

// Firestore Timestamp / Date / 文字列 / 数値を Date に変換する
export const toDate = (value) => {
    if (value == null) return null;
    if (typeof value?.toDate === "function") return value.toDate();
    const d = new Date(value instanceof Date ? value.getTime() : value);
    return Number.isNaN(d.getTime()) ? null : d;
};

// 比較用のミリ秒値（変換できない値は fallback）
export const toTime = (value, fallback = 0) => toDate(value)?.getTime() ?? fallback;

// 以下、日付の区切りはすべてユーザー設定のタイムゾーン（未設定は Asia/Tokyo）で計算する

export const isSameDayInZone = (a, b, timeZone) =>
    !!a && !!b && dateKeyInZone(a, timeZone) === dateKeyInZone(b, timeZone);

// 今日から days 日後の 23:59
export const endOfDayAfter = (now, days, timeZone) =>
    dateKeyToDate(addDaysToKey(dateKeyInZone(now, timeZone), days), timeZone, 23, 59);

// カレンダー上の months か月後の 23:59（月末は丸める）
export const endOfDayAfterMonths = (now, months, timeZone) =>
    dateKeyToDate(addMonthsToKey(dateKeyInZone(now, timeZone), months), timeZone, 23, 59);

// [start, end) の範囲。startKey は範囲初日の日付キー
const rangeFromKeys = (startKey, endKey, timeZone) => ({
    startKey,
    start: dateKeyToDate(startKey, timeZone),
    end: dateKeyToDate(endKey, timeZone),
});

export const getDayRange = (now, timeZone) => {
    const key = dateKeyInZone(now, timeZone);
    return rangeFromKeys(key, addDaysToKey(key, 1), timeZone);
};

// weekStartsOn: 0=日曜 … 6=土曜
export const getWeekRange = (now, weekStartsOn = 1, timeZone) => {
    const today = dateKeyInZone(now, timeZone);
    const startKey = addDaysToKey(today, -((weekdayOfKey(today) - weekStartsOn + 7) % 7));
    return rangeFromKeys(startKey, addDaysToKey(startKey, 7), timeZone);
};

export const getMonthRange = (now, timeZone) => {
    const { year, month } = getZonedParts(now, timeZone);
    const startKey = `${year}-${String(month + 1).padStart(2, "0")}-01`;
    return rangeFromKeys(startKey, addMonthsToKey(startKey, 1), timeZone);
};

export const isInRange = (date, { start, end }) => !!date && date >= start && date < end;

// <input type="datetime-local"> 用の値（設定タイムゾーンの壁時計時刻）
export const toZonedInputValue = (value, timeZone) => {
    const d = toDate(value);
    if (!d) return "";
    const p = getZonedParts(d, timeZone);
    const pad = (n) => String(n).padStart(2, "0");
    return `${p.year}-${pad(p.month + 1)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`;
};

// "YYYY-MM-DDTHH:mm"（または "YYYY-MM-DD"）を設定タイムゾーンの時刻として Date にする
export const fromZonedInputValue = (value, timeZone) => {
    const m = typeof value === "string" && value.match(/^(\d{4}-\d{2}-\d{2})(?:T(\d{2}):(\d{2}))?$/);
    if (!m) return null;
    return zonedTimeToDate({ ...parseDateKey(m[1]), hour: Number(m[2] ?? 0), minute: Number(m[3] ?? 0) }, timeZone);
};

// 設定タイムゾーンで日時を表示する
export const formatInZone = (value, timeZone, options = {}) => {
    const d = toDate(value);
    if (!d) return "";
    return d.toLocaleString("ja-JP", { ...options, timeZone: resolveTimeZone(timeZone) });
};
