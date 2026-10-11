// 自然言語タスク解析の純粋関数（プロンプト生成・AI 出力の検証・下書きとの統合・質問の重複防止）
import {addDaysToKey, dateKeyInZone, getZonedParts, weekdayOfKey} from "../../src/utils/timezone.js";
import {deriveTaskName, extractDeadline} from "./dateParse.js";

export const MAX_TURNS = 9;
const WEEKDAY_LABELS = ["日", "月", "火", "水", "木", "金", "土"];
const pad = (n) => String(n).padStart(2, "0");

// すべての項目を必須にする（不明な項目は空文字・空配列）。省略や崩れた JSON を防ぐ
export const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    status: {type: "STRING", enum: ["ok", "need_info"]},
    taskName: {type: "STRING"},
    deadline: {type: "STRING"},
    startDate: {type: "STRING"},
    description: {type: "STRING"},
    tags: {type: "ARRAY", items: {type: "STRING"}},
    notes: {type: "ARRAY", items: {type: "STRING"}},
    question: {type: "STRING"},
  },
  required: ["status", "taskName", "deadline", "startDate", "description", "tags", "notes", "question"],
  propertyOrdering: ["status", "taskName", "deadline", "startDate", "description", "tags", "notes", "question"],
};

// 今日から3週間分の日付と曜日の対応表（相対的な日付を AI が正しく変換できるようにする）
const buildCalendar = (now, timeZone, weekStartsOn) => {
  const today = dateKeyInZone(now, timeZone);
  const weekStart = addDaysToKey(today, -((weekdayOfKey(today) - weekStartsOn + 7) % 7));
  const lines = [];
  for (let w = 0; w < 3; w++) {
    const label = ["今週", "来週", "再来週"][w];
    const days = Array.from({length: 7}, (_, i) => {
      const key = addDaysToKey(weekStart, w * 7 + i);
      return `${key}(${WEEKDAY_LABELS[weekdayOfKey(key)]})${key === today ? "=今日" : ""}`;
    });
    lines.push(`${label}: ${days.join(" ")}`);
  }
  return lines.join("\n");
};

export const buildPrompt = ({now, timeZone, weekStartsOn = 1, draft}) => {
  const p = getZonedParts(now, timeZone);
  const nowText = `${p.year}-${pad(p.month + 1)}-${pad(p.day)}(${WEEKDAY_LABELS[p.weekday]}) ${pad(p.hour)}:${pad(p.minute)}`;
  const known = draft && (draft.taskName || draft.deadline) ?
    `\nこれまでの会話で分かっている内容（新しい発言で変更されない限り引き継ぐ）:\n- タスク名: ${draft.taskName || "未定"}\n- 期限: ${draft.deadline || "未定"}\n` :
    "";
  return `あなたはタスク管理アプリの入力補助です。会話全体から、追加するタスクを1件だけ読み取ってください。
現在日時: ${nowText}（タイムゾーン: ${timeZone}、週の開始: ${WEEKDAY_LABELS[weekStartsOn]}曜日）
カレンダー:
${buildCalendar(now, timeZone, weekStartsOn)}
${known}
出力の規則:
- taskName: やることを簡潔な日本語で（日付や「までに」は含めない）。分からなければ空文字。
- deadline: 期限を "YYYY-MM-DDTHH:mm"（${timeZone} の現地時刻）で。時刻の指定がなければ 23:59。分からなければ空文字。
- 「来週の金曜」「明日」「月末」などは上のカレンダーで具体的な日付にし、notes に「『来週の金曜』を 10月23日(金) と解釈しました」のように書く。
- 依頼文に日付や曜日が含まれていれば、聞き返さずに status を "ok" にする。
- タスク名か期限が本当に分からない場合だけ status を "need_info" にし、question に不足している点だけを尋ねる質問を1つ書く。
- 利用者がすでに答えた内容を再び尋ねない。回答は直前の質問と最初の依頼文に結び付けて解釈する。
- startDate・description・tags は明示されている場合のみ。書かれていない情報を作らない。該当しなければ空文字・空配列。
`;
};

const DATE_TIME = /^(\d{4}-\d{2}-\d{2})(?:[T ](\d{2}):(\d{2})(?::\d{2})?)?$/;

// "YYYY-MM-DD"・"YYYY-MM-DD HH:mm"・秒付きも受け付け、"YYYY-MM-DDTHH:mm" にそろえる
export const normalizeDateTime = (value) => {
  const m = typeof value === "string" ? value.trim().match(DATE_TIME) : null;
  if (!m) return "";
  const result = `${m[1]}T${m[2] ?? "23"}:${m[3] ?? "59"}`;
  const d = new Date(`${result}:00Z`);
  if (Number.isNaN(d.getTime())) return "";
  const check = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
  return check === result ? result : "";
};

// AI が崩れた出力（JSON の項目名や英文の混入）をした場合は使わない
const looksBroken = (text) =>
  /taskName|deadline|status|notes|json|[{}"]/i.test(text) || (text.match(/[A-Za-z]{2,}/g) ?? []).length >= 3;

export const cleanTaskName = (value) => {
  if (typeof value !== "string") return "";
  const text = value.replace(/\s+/g, " ").trim();
  if (!text || text.length > 100 || looksBroken(text)) return "";
  return text;
};

const cleanNotes = (notes) => (Array.isArray(notes) ? notes : [])
    .filter((n) => typeof n === "string" && n.trim() && n.length <= 200 && !looksBroken(n))
    .slice(0, 5);

// クライアントから受け取った下書き（前回までに分かった内容）を検証する
export const sanitizeDraft = (draft) => ({
  taskName: cleanTaskName(draft?.taskName),
  deadline: normalizeDateTime(draft?.deadline),
});

// 会話履歴を整える。最初の依頼文は常に残し、残りは直近のやり取りを使う（user/model を交互にする）
export const trimTurns = (turns) => {
  const list = turns.filter((t) => t && (t.role === "user" || t.role === "model"));
  while (list.length && list[0].role !== "user") list.shift();
  if (list.length <= MAX_TURNS) return list;
  let tail = list.slice(-(MAX_TURNS - 1));
  if (tail[0].role === "user") tail = tail.slice(1);
  return [list[0], ...tail];
};

const QUESTIONS = {
  taskName: "どのようなタスクを追加しますか？",
  deadline: "期限はいつにしますか？（例：明日、来週の金曜、10月23日の18時）",
};

const FINAL_QUESTIONS = {
  taskName: "追加したいタスクの内容を、一言で入力してください。",
  deadline: "期限の日付を「10月23日」や「明日」のように入力してください。",
};

// 前回までと同じ質問にならないよう、回答を引用した具体的な聞き方に変える
const rephrase = (field, lastAnswer) => (field === "deadline" ?
  `「${lastAnswer}」から期限を読み取れませんでした。日付や曜日で教えてください（例：10月23日、来週の金曜の18時、3日後）。` :
  `「${lastAnswer}」からタスク名を読み取れませんでした。やることを短く教えてください（例：レポートを提出）。`);

const formatKey = (deadline) => {
  const [date, time] = deadline.split("T");
  const [, m, d] = date.split("-").map(Number);
  return `${m}月${d}日(${WEEKDAY_LABELS[weekdayOfKey(date)]}) ${time}`;
};

// AI の出力・決まったルールによる読み取り・下書きを統合して結果を決める。
// raw: AI の出力（取得できなかった場合は null）
export const resolveTask = (raw, {turns, draft = {}, now = new Date(), timeZone, weekStartsOn = 1}) => {
  const userTurns = turns.filter((t) => t.role === "user");
  const latest = userTurns.at(-1)?.text ?? "";
  const prevQuestions = turns.filter((t) => t.role === "model").map((t) => t.text);
  const opts = {now, timeZone, weekStartsOn};

  const aiTaskName = cleanTaskName(raw?.taskName);
  const aiDeadline = normalizeDateTime(raw?.deadline);
  // 最新の発言に日付表現があれば、それを優先する（修正指示・回答を確実に反映）
  const latestRule = extractDeadline(latest, opts);
  const anyRule = latestRule ?? userTurns.slice().reverse().map((t) => extractDeadline(t.text, opts)).find(Boolean) ?? null;

  const deadline = latestRule?.deadline || aiDeadline || draft.deadline || anyRule?.deadline || "";
  // AI のタスク名が使えない場合は、元の依頼文 → その後の回答の順に、日付表現を除いた文から補う
  const derivedName = userTurns
      .map((t) => cleanTaskName(deriveTaskName(t.text, extractDeadline(t.text, opts)?.matched ?? [])))
      .find(Boolean) ?? "";
  const taskName = aiTaskName || draft.taskName || derivedName;

  const notes = cleanNotes(raw?.notes);
  if (deadline && deadline === latestRule?.deadline && latestRule.matched.length && deadline !== aiDeadline) {
    notes.unshift(`『${latestRule.matched.join(" ")}』を ${formatKey(deadline)} と解釈しました`);
  }

  if (taskName && deadline) {
    return {
      status: "ok",
      task: {
        taskName,
        deadline,
        startDate: normalizeDateTime(raw?.startDate) || null,
        description: typeof raw?.description === "string" && raw.description.trim() && !looksBroken(raw.description) ?
          raw.description.trim().slice(0, 500) : null,
        tags: Array.isArray(raw?.tags) ?
          raw.tags.filter((t) => typeof t === "string" && t.trim()).map((t) => t.trim().slice(0, 20)).slice(0, 5) : [],
      },
      notes: notes.slice(0, 5),
      draft: {taskName, deadline},
    };
  }

  // 不足している項目だけを尋ねる。同じ質問は繰り返さない
  const missing = taskName ? "deadline" : "taskName";
  const aiQuestion = typeof raw?.question === "string" && raw.question.trim() && !looksBroken(raw.question) ?
    raw.question.trim().slice(0, 200) : "";
  // 候補を順に試し、これまでに尋ねていない言い方を使う（回答を引用した聞き方は回答ごとに変わる）
  const candidates = [
    aiQuestion,
    QUESTIONS[missing],
    userTurns.length > 1 ? rephrase(missing, latest.slice(0, 40)) : "",
    FINAL_QUESTIONS[missing],
  ].filter(Boolean);
  const question = candidates.find((q) => !prevQuestions.includes(q)) ?? rephrase(missing, latest.slice(0, 40));
  return {status: "need_info", question, draft: {taskName, deadline}};
};
