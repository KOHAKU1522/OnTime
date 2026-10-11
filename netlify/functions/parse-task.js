// 自然言語の文章からタスク内容を抽出する（登録はしない。登録はクライアントで利用者が確認した後に行う）
// GEMINI_API_KEY はサーバー側の環境変数のみで扱い、クライアントには渡さない。
import {adminAuth, adminDb, isAdminConfigured} from "../lib/firebaseAdmin.js";
import {LIMITS, consume} from "../lib/rateLimit.js";
import {resolveTimeZone} from "../../src/utils/timezone.js";

const MAX_TURNS = 6;
const MODEL = "gemini-3.6-flash";

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: {"Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store"},
});

// Firebase ID トークンを Admin SDK で検証する（署名・有効期限・失効を確認）
const verifyUser = async (request) => {
  const idToken = request.headers.get("authorization")?.match(/^Bearer (.+)$/)?.[1];
  if (!idToken) return null;
  const decoded = await adminAuth().verifyIdToken(idToken, true);
  return decoded.uid;
};

const RATE_LIMIT_MESSAGES = {
  MINUTE: (sec) => `短時間に続けて利用されたため、一時的に制限しています。${sec}秒ほど待ってから再度お試しください。`,
  DAY: () => `本日の利用上限（${LIMITS.perDay}回）に達しました。明日（日本時間0時以降）に再度お試しください。`,
};

const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    status: {type: "STRING", enum: ["ok", "need_info"]},
    question: {type: "STRING"},
    taskName: {type: "STRING"},
    deadline: {type: "STRING"},
    startDate: {type: "STRING"},
    description: {type: "STRING"},
    tags: {type: "ARRAY", items: {type: "STRING"}},
    notes: {type: "ARRAY", items: {type: "STRING"}},
  },
  required: ["status"],
};

const buildPrompt = (now, timeZone) => `
あなたはタスク管理アプリの入力補助です。利用者の文章からタスクを1件抽出してください。
現在日時: ${now}（タイムゾーン: ${timeZone}）

規則:
- taskName: やることを簡潔に。deadline: 期限を "YYYY-MM-DDTHH:mm"（${timeZone} の現地時刻）で。
- 時刻の指定がない期限は 23:59 にする。startDate は開始日時の指定がある場合のみ同じ形式で。
- 「来週」「月末」「明後日」など相対的・曖昧な表現は、現在日時から具体的な日付に変換し、
  notes に「『来週金曜』を 10月16日(金) と解釈しました」のように解釈内容を必ず書く。
- タスク内容または期限が文章から判断できない場合は status を "need_info" にし、
  question に不足している点を尋ねる日本語の質問を1つだけ書く。推測で埋めない。
- description と tags は文章に明示されている場合のみ。書かれていない情報を作らない。
`;

const pad = (n) => String(n).padStart(2, "0");
const isValidLocalDateTime = (value) => {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value ?? "")) return false;
  const d = new Date(`${value}:00Z`);
  return !Number.isNaN(d.getTime()) &&
    `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}` === value;
};

// AI の出力をそのまま信用せず、形式を検証・正規化する
export const normalizeResult = (raw) => {
  const taskName = typeof raw?.taskName === "string" ? raw.taskName.trim().slice(0, 100) : "";
  const deadline = isValidLocalDateTime(raw?.deadline) ? raw.deadline : "";
  if (raw?.status !== "ok" || !taskName || !deadline) {
    return {
      status: "need_info",
      question: (typeof raw?.question === "string" && raw.question.trim()) ||
        (!taskName ? "どのようなタスクを追加しますか？" : "期限はいつにしますか？"),
    };
  }
  return {
    status: "ok",
    task: {
      taskName,
      deadline,
      startDate: isValidLocalDateTime(raw.startDate) ? raw.startDate : null,
      description: typeof raw.description === "string" && raw.description.trim() ? raw.description.trim().slice(0, 500) : null,
      tags: Array.isArray(raw.tags) ? raw.tags.filter((t) => typeof t === "string" && t.trim()).map((t) => t.trim().slice(0, 20)).slice(0, 5) : [],
    },
    notes: Array.isArray(raw.notes) ? raw.notes.filter((n) => typeof n === "string").slice(0, 5) : [],
  };
};

export default async function handler(request) {
  if (request.method !== "POST") return json({error: "Method Not Allowed"}, 405);

  const apiKey = globalThis.process?.env?.GEMINI_API_KEY;
  if (!apiKey || !isAdminConfigured()) return json({error: "サーバーの設定が不足しています", code: "NOT_CONFIGURED"}, 500);

  // 1. 認証（失敗時は Gemini を呼ばずに拒否）
  let uid = null;
  try {
    uid = await verifyUser(request);
  } catch (error) {
    console.warn("auth verify failed:", error?.code ?? error?.message);
  }
  if (!uid) return json({error: "ログインが必要です", code: "UNAUTHORIZED"}, 401);

  // 2. 入力検証（不備があれば Gemini を呼ばず、回数も消費しない）

  const body = await request.json().catch(() => null);
  const turns = Array.isArray(body?.turns) ? body.turns.slice(-MAX_TURNS) : [];
  // 会話は利用者の発言から始める
  while (turns.length && turns[0]?.role !== "user") turns.shift();
  const valid = turns.length > 0 && turns.every((t) =>
    (t.role === "user" || t.role === "model") &&
    typeof t.text === "string" && t.text.trim() && t.text.length <= LIMITS.maxInputLength);
  if (!valid) {
    return json({
      error: `入力内容が正しくないか、${LIMITS.maxInputLength}文字を超えています`,
      code: "BAD_REQUEST",
    }, 400);
  }

  // 3. 利用回数の確認と記録（トランザクション）。記録できない場合は安全側に倒して拒否する
  let limit;
  try {
    limit = await consume(adminDb(), uid);
  } catch (error) {
    console.error("rate limit error:", error);
    return json({error: "現在混み合っています。しばらくしてから再度お試しください", code: "UNAVAILABLE"}, 503);
  }
  if (!limit.allowed) {
    return new Response(JSON.stringify({
      error: RATE_LIMIT_MESSAGES[limit.reason](limit.retryAfterSec),
      code: "RATE_LIMITED",
      reason: limit.reason,
      retryAfterSec: limit.retryAfterSec,
    }), {
      status: 429,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
        "Retry-After": String(limit.retryAfterSec),
      },
    });
  }

  // 4. Gemini 呼び出し
  const now = typeof body.now === "string" ? body.now.slice(0, 100) : new Date().toISOString();
  // 利用者が設定したタイムゾーン（不正な値は既定の Asia/Tokyo）
  const timeZone = resolveTimeZone(typeof body.timeZone === "string" ? body.timeZone.slice(0, 64) : "");

  try {
    const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
        {
          method: "POST",
          headers: {"Content-Type": "application/json", "x-goog-api-key": apiKey},
          signal: AbortSignal.timeout(15000),
          body: JSON.stringify({
            systemInstruction: {parts: [{text: buildPrompt(now, timeZone)}]},
            contents: turns.map((t) => ({role: t.role, parts: [{text: t.text}]})),
            generationConfig: {
              responseMimeType: "application/json",
              responseSchema: RESPONSE_SCHEMA,
              temperature: 0.1,
            },
          }),
        },
    );
    if (!response.ok) {
      console.error("Gemini API error:", response.status);
      return json({error: "解析に失敗しました", code: "AI_FAILED"}, 502);
    }
    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    return json(normalizeResult(JSON.parse(text)));
  } catch (error) {
    console.error("parse-task error:", error);
    return json({error: "解析に失敗しました", code: "AI_FAILED"}, 502);
  }
}
