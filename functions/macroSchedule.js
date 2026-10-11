// マクロの実行判定（純粋関数）。日付はユーザーが設定したタイムゾーンで扱う（未設定は Asia/Tokyo）。
// functions/macroSchedule.js と src/utils/macroSchedule.js は同じ内容を保つこと
// （サーバーの定期実行とアプリ起動時の実行で判定を一致させるため）。
import {
  addDaysToKey, dateKeyInZone, dateKeyToDate, getZonedParts, isDateKey,
  resolveTimeZone,
} from "./timezone.js";

export {isDateKey};

export const todayKey = (now = new Date(), timeZone) =>
  dateKeyInZone(now, resolveTimeZone(timeZone));

// 前回実行日（設定タイムゾーンの YYYY-MM-DD）。
// lastTriggeredKey がない古いデータは lastTriggered（Timestamp / Date）から復元する
export const getLastTriggeredKey = (macro, timeZone) => {
  if (isDateKey(macro?.lastTriggeredKey)) return macro.lastTriggeredKey;
  const raw = macro?.lastTriggered;
  const last = typeof raw?.toDate === "function" ? raw.toDate() : raw;
  if (!(last instanceof Date) || Number.isNaN(last.getTime())) return null;
  return dateKeyInZone(last, resolveTimeZone(timeZone));
};

export const getIntervalDays = (macro) => {
  const n = Number(macro?.intervalDays);
  return Number.isInteger(n) && n >= 1 && n <= 365 ? n : null;
};

// 「何日おき」マクロの次回実行日。
// 起点は「開始日」と「前回実行日 + 間隔」の遅いほう（開始日を後ろにずらす編集にも従う）
export const getNextIntervalKey = (macro, timeZone) => {
  const n = getIntervalDays(macro);
  if (!n) return null;
  const start = isDateKey(macro.startDate) ? macro.startDate : null;
  const lastKey = getLastTriggeredKey(macro, timeZone);
  if (!lastKey) return start;
  const nextKey = addDaysToKey(lastKey, n);
  return start && start > nextKey ? start : nextKey;
};

// 今日（設定タイムゾーン）このマクロでタスクを追加すべきか。
// 1日1回まで、遡って複数件は作らない。
// 前回実行日以前の日付では実行しない（タイムゾーンを西へ変更して日付が戻った場合の重複を防ぐ）
export const isMacroDue = (macro, now, timeZone) => {
  if (!macro?.enabled) return false;
  const zone = resolveTimeZone(timeZone);
  const parts = getZonedParts(now, zone);
  const today = dateKeyInZone(now, zone);
  const lastKey = getLastTriggeredKey(macro, zone);
  if (lastKey && today <= lastKey) return false;

  switch (macro.frequency) {
    case "daily":
      return true;
    case "weekly":
      return (macro.weekdays ?? []).includes(parts.weekday);
    case "monthly":
      return parts.day === Number(macro.dayOfMonth);
    case "interval": {
      if (!getIntervalDays(macro)) return false;
      const next = getNextIntervalKey(macro, zone);
      // 開始日も前回実行日もない場合は今日から開始
      return next === null || today >= next;
    }
    default:
      return false;
  }
};

// 締め切り: 設定タイムゾーンで (追加日 + deadlineDays) の 23:59
export const computeMacroDeadline = (now, deadlineDays, timeZone) => {
  const zone = resolveTimeZone(timeZone);
  const n = Number(deadlineDays);
  const days = Number.isInteger(n) ? n : 0;
  return dateKeyToDate(addDaysToKey(todayKey(now, zone), days), zone, 23, 59);
};

// 同じマクロ・同じ日のタスクは同じ ID にして二重登録を防ぐ
export const macroTaskId = (macroId, now, timeZone) =>
  `macro_${macroId}_${todayKey(now, timeZone)}`;

// マクロから生成するタスクの内容
export const buildMacroTask = (macroId, macro, now, timeZone) => ({
  taskName: macro.taskName,
  deadline: computeMacroDeadline(now, macro.deadlineDays, timeZone),
  startDate: null,
  completed: false,
  createdAt: now,
  fromMacro: true,
  macroId,
  description: null,
  tags: [],
});
