// 日本語の日付・時刻表現を決まったルールで解釈する（AI の出力が不正・取得できない場合の補完に使う）
import {
  addDaysToKey, addMonthsToKey, dateKeyInZone, parseDateKey, weekdayOfKey,
} from "../../src/utils/timezone.js";

const WEEKDAY = {日: 0, 月: 1, 火: 2, 水: 3, 木: 4, 金: 5, 土: 6};
const pad = (n) => String(n).padStart(2, "0");

// 全角数字・記号を半角にそろえる
export const normalizeText = (text) => String(text ?? "")
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xFEE0))
    .replace(/[：]/g, ":")
    .replace(/[／]/g, "/")
    .replace(new RegExp(String.fromCharCode(0x3000), "g"), " "); // 全角スペース

const lastDayKey = (key) => addDaysToKey(addMonthsToKey(`${key.slice(0, 7)}-01`, 1), -1);

const isValidKey = (key) => {
  const {year, month, day} = parseDateKey(key);
  const d = new Date(Date.UTC(year, month, day));
  return d.getUTCFullYear() === year && d.getUTCMonth() === month && d.getUTCDate() === day;
};

// 日付部分の候補（文中の位置も返す）
const findDate = (text, today, weekStartsOn) => {
  const {year, month} = parseDateKey(today);
  const todayWeekday = weekdayOfKey(today);
  const weekStart = addDaysToKey(today, -((todayWeekday - weekStartsOn + 7) % 7));
  const rules = [
    // 2026年10月23日 / 2026/10/23 / 2026-10-23
    [/(\d{4})[年/-](\d{1,2})[月/-](\d{1,2})日?/, (m) => `${m[1]}-${pad(m[2])}-${pad(m[3])}`],
    // 再来週・来週・今週の金曜（週の開始曜日を考慮）
    [/(再来週|来週|今週)の?([日月火水木金土])曜(?:日)?/, (m) => {
      const weeks = m[1] === "再来週" ? 2 : m[1] === "来週" ? 1 : 0;
      const offset = (WEEKDAY[m[2]] - weekStartsOn + 7) % 7;
      return addDaysToKey(weekStart, weeks * 7 + offset);
    }],
    // 10月23日 / 10/23（過ぎていれば来年）
    [/(\d{1,2})月(\d{1,2})日|(?<![\d:])(\d{1,2})\/(\d{1,2})(?![\d/])/, (m) => {
      const mm = Number(m[1] ?? m[3]);
      const dd = Number(m[2] ?? m[4]);
      let key = `${year}-${pad(mm)}-${pad(dd)}`;
      if (key < today) key = `${year + 1}-${pad(mm)}-${pad(dd)}`;
      return key;
    }],
    [/明々後日|しあさって/, () => addDaysToKey(today, 3)],
    [/明後日|あさって/, () => addDaysToKey(today, 2)],
    [/明日|あした|あす/, () => addDaysToKey(today, 1)],
    [/今日|本日|きょう/, () => today],
    [/(\d+)日後/, (m) => addDaysToKey(today, Number(m[1]))],
    [/(\d+)週間後/, (m) => addDaysToKey(today, Number(m[1]) * 7)],
    [/(\d+)[かヶケカ]月後/, (m) => addMonthsToKey(today, Number(m[1]))],
    [/来月末/, () => lastDayKey(addMonthsToKey(`${today.slice(0, 7)}-01`, 1))],
    [/今月末|月末/, () => lastDayKey(today)],
    [/今週中|今週末/, () => addDaysToKey(weekStart, 6)],
    [/来週中|来週末/, () => addDaysToKey(weekStart, 13)],
    // 次の・今度の金曜（今日が金曜なら翌週）／金曜（今日が金曜なら今日）
    [/(次の|今度の)?([日月火水木金土])曜(?:日)?/, (m) => {
      let diff = (WEEKDAY[m[2]] - todayWeekday + 7) % 7;
      if (diff === 0 && m[1]) diff = 7;
      return addDaysToKey(today, diff);
    }],
    // 23日（今月。過ぎていれば来月）
    [/(?<![\d月/])(\d{1,2})日(?!後|間|中)/, (m) => {
      const key = `${year}-${pad(month + 1)}-${pad(Number(m[1]))}`;
      if (key >= today) return key;
      const nextMonth = addMonthsToKey(`${year}-${pad(month + 1)}-01`, 1);
      return `${nextMonth.slice(0, 8)}${pad(Number(m[1]))}`;
    }],
  ];
  for (const [re, toKey] of rules) {
    const m = text.match(re);
    if (!m) continue;
    const key = toKey(m);
    if (key && isValidKey(key)) return {key, match: m[0], index: m.index};
  }
  return null;
};

// 時刻部分（15時 / 15:30 / 午後3時半 / 正午）
const findTime = (text) => {
  if (/正午/.test(text)) return {hour: 12, minute: 0, match: text.match(/正午/)[0]};
  const m = text.match(/(午前|午後)?\s*(\d{1,2})(?::(\d{2})|時(?:(\d{1,2})分|半)?)/);
  if (!m) return null;
  let hour = Number(m[2]);
  const minute = m[3] ? Number(m[3]) : m[4] ? Number(m[4]) : /半/.test(m[0]) ? 30 : 0;
  if (m[1] === "午後" && hour < 12) hour += 12;
  if (m[1] === "午前" && hour === 12) hour = 0;
  if (hour > 23 || minute > 59) return null;
  return {hour, minute, match: m[0]};
};

// 文章から期限を読み取る。戻り値: { deadline: "YYYY-MM-DDTHH:mm", matched: ["来週の金曜", "15時"] } または null
export const extractDeadline = (rawText, {now = new Date(), timeZone, weekStartsOn = 1} = {}) => {
  const text = normalizeText(rawText);
  const today = dateKeyInZone(now, timeZone);
  const date = findDate(text, today, weekStartsOn);
  if (!date) return null;
  const time = findTime(text);
  const hhmm = time ? `${pad(time.hour)}:${pad(time.minute)}` : "23:59";
  return {deadline: `${date.key}T${hhmm}`, matched: [date.match, time?.match].filter(Boolean)};
};

// 日付表現と前後の助詞を取り除いてタスク名の候補を作る（AI のタスク名が使えない場合の補完）
export const deriveTaskName = (rawText, matched = []) => {
  let text = normalizeText(rawText);
  for (const expr of matched) {
    const escaped = expr.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    text = text.replace(new RegExp(`(?:の)?${escaped}(?:までに|まで|中に|中|に|の|、)?`), "");
  }
  return text
      .replace(/\s+/g, " ")
      .replace(/^[\s、。,.のにをでまで]+/, "")
      .replace(/[\s、。,.]+$/, "")
      .replace(/(までに|まで)$/, "")
      .trim()
      .slice(0, 100);
};
