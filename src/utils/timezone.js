// タイムゾーンを指定した日付計算（純粋関数。外部ライブラリなしで Intl を使う）。
// functions/timezone.js と src/utils/timezone.js は同じ内容を保つこと。

export const DEFAULT_TIME_ZONE = "Asia/Tokyo";
const DAY_MS = 24 * 60 * 60 * 1000;
const WEEKDAYS = {Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6};
const formatterCache = new Map();

export const isValidTimeZone = (timeZone) => {
  if (typeof timeZone !== "string" || !timeZone) return false;
  try {
    new globalThis.Intl.DateTimeFormat("en-US", {timeZone});
    return true;
  } catch {
    return false;
  }
};

// 未設定・不正な値は既定（Asia/Tokyo）にする
export const resolveTimeZone = (timeZone) =>
  isValidTimeZone(timeZone) ? timeZone : DEFAULT_TIME_ZONE;

const getFormatter = (timeZone) => {
  let formatter = formatterCache.get(timeZone);
  if (!formatter) {
    formatter = new globalThis.Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
      weekday: "short",
    });
    formatterCache.set(timeZone, formatter);
  }
  return formatter;
};

// 指定タイムゾーンでの年月日・時刻・曜日（month は 0 始まり、weekday は 0=日曜）
export const getZonedParts = (date, timeZone) => {
  const parts = {};
  const formatter = getFormatter(resolveTimeZone(timeZone));
  for (const {type, value} of formatter.formatToParts(date)) {
    parts[type] = value;
  }
  return {
    year: Number(parts.year),
    month: Number(parts.month) - 1,
    day: Number(parts.day),
    hour: Number(parts.hour) % 24,
    minute: Number(parts.minute),
    second: Number(parts.second),
    weekday: WEEKDAYS[parts.weekday],
  };
};

// UTC からのずれ（ミリ秒）。例: Asia/Tokyo は +9時間
export const getTimeZoneOffsetMs = (date, timeZone) => {
  const p = getZonedParts(date, timeZone);
  const asUtc = Date.UTC(p.year, p.month, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
};

// 指定タイムゾーンの壁時計の時刻を Date に変換する（夏時間の切り替わりも考慮）
export const zonedTimeToDate = (
    {year, month, day, hour = 0, minute = 0}, timeZone,
) => {
  const zone = resolveTimeZone(timeZone);
  const utcGuess = Date.UTC(year, month, day, hour, minute);
  const first = utcGuess - getTimeZoneOffsetMs(new Date(utcGuess), zone);
  const second = utcGuess - getTimeZoneOffsetMs(new Date(first), zone);
  return new Date(second);
};

const pad = (n) => String(n).padStart(2, "0");

// 日付キー（YYYY-MM-DD）。暦日の比較・加算に使う
export const toDateKey = ({year, month, day}) =>
  `${year}-${pad(month + 1)}-${pad(day)}`;

export const isDateKey = (value) =>
  typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);

export const parseDateKey = (key) => {
  const [year, month, day] = key.split("-").map(Number);
  return {year, month: month - 1, day};
};

export const dateKeyInZone = (date, timeZone) =>
  toDateKey(getZonedParts(date, timeZone));

export const dayNumber = (key) => {
  const {year, month, day} = parseDateKey(key);
  return Date.UTC(year, month, day) / DAY_MS;
};

// 暦日の加算（タイムゾーンや夏時間に影響されない）
export const addDaysToKey = (key, days) => {
  const {year, month, day} = parseDateKey(key);
  const d = new Date(Date.UTC(year, month, day + days));
  return toDateKey({
    year: d.getUTCFullYear(),
    month: d.getUTCMonth(),
    day: d.getUTCDate(),
  });
};

// カレンダー上の nか月後（1/31 の1か月後は 2/28 or 29 のように月末で丸める）
export const addMonthsToKey = (key, months) => {
  const {year, month, day} = parseDateKey(key);
  const target = new Date(Date.UTC(year, month + months, 1));
  const lastDay = new Date(Date.UTC(
      target.getUTCFullYear(), target.getUTCMonth() + 1, 0,
  )).getUTCDate();
  return toDateKey({
    year: target.getUTCFullYear(),
    month: target.getUTCMonth(),
    day: Math.min(day, lastDay),
  });
};

export const weekdayOfKey = (key) =>
  new Date(dayNumber(key) * DAY_MS).getUTCDay();

// 日付キーの指定時刻（タイムゾーン上）を Date にする
export const dateKeyToDate = (key, timeZone, hour = 0, minute = 0) =>
  zonedTimeToDate({...parseDateKey(key), hour, minute}, timeZone);
