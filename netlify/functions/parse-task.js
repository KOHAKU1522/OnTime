// 自然言語の文章からタスク内容を抽出する（登録はしない。登録はクライアントで利用者が確認した後に行う）
// GEMINI_API_KEY はサーバー側の環境変数のみで扱い、クライアントには渡さない。
import {adminAuth, adminDb, adminProjectId, getAdminConfigStatus} from "../lib/firebaseAdmin.js";
import {LIMITS, consume} from "../lib/rateLimit.js";
import {resolveTimeZone} from "../../src/utils/timezone.js";
import {RESPONSE_SCHEMA, buildPrompt, resolveTask, sanitizeDraft, trimTurns} from "../lib/taskParse.js";

// クライアントから受け取る会話の最大件数（これを超える分は古いものから捨てる。最初の依頼文は残す）
const MAX_INPUT_TURNS = 30;
// モデルは環境変数で切り替えられる（未設定時の既定値）
const MODEL = (globalThis.process?.env?.GEMINI_MODEL ?? "").trim() || "gemini-3.6-flash";

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: {"Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store"},
});

// 診断ログ（秘密情報・トークン・入力本文は出さない）
const log = (level, event, detail = {}) => console[level](`[parse-task] ${event}`, JSON.stringify(detail));

// Firebase ID トークンを Admin SDK で検証する（署名・有効期限・失効を確認）
// 戻り値: { uid } または { status, code, error }
const verifyUser = async (request) => {
  const idToken = request.headers.get("authorization")?.match(/^Bearer (.+)$/)?.[1];
  if (!idToken) return {status: 401, code: "UNAUTHORIZED", error: "ログインが必要です"};
  try {
    const decoded = await adminAuth().verifyIdToken(idToken, true);
    return {uid: decoded.uid};
  } catch (error) {
    const code = error?.code ?? "unknown";
    if (["auth/id-token-expired", "auth/id-token-revoked", "auth/user-disabled", "auth/user-not-found"].includes(code)) {
      log("warn", "token rejected", {code});
      return {status: 401, code: "SESSION_EXPIRED", error: "ログインの有効期限が切れました。再ログインしてください"};
    }
    // 別プロジェクトのトークン（Web アプリと FIREBASE_PROJECT_ID の不一致）は設定の問題
    if (code === "auth/argument-error" && /"aud"|audience/i.test(String(error?.message))) {
      log("error", "project mismatch", {code, hint: "FIREBASE_PROJECT_ID が Web アプリの Firebase プロジェクトと一致しているか確認", adminProject: adminProjectId()});
      return {status: 503, code: "NOT_CONFIGURED", error: "現在この機能は利用できません"};
    }
    if (code === "admin/init-failed" || code.startsWith("app/")) {
      log("error", "admin init failed", {code, cause: error?.cause, hint: "FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY を確認"});
      return {status: 503, code: "NOT_CONFIGURED", error: "現在この機能は利用できません"};
    }
    if (code === "auth/argument-error" || code === "auth/invalid-id-token") {
      log("warn", "invalid token", {code});
      return {status: 401, code: "UNAUTHORIZED", error: "ログインが必要です"};
    }
    log("error", "token verification unavailable", {code});
    return {status: 503, code: "AUTH_UNAVAILABLE", error: "認証サーバーに接続できませんでした。しばらくしてから再度お試しください"};
  }
};

const RATE_LIMIT_MESSAGES = {
  MINUTE: (sec) => `短時間に続けて利用されたため、一時的に制限しています。${sec}秒ほど待ってから再度お試しください。`,
  DAY: () => `本日の利用上限（${LIMITS.perDay}回）に達しました。明日（日本時間0時以降）に再度お試しください。`,
};

// Gemini を呼び出して JSON を返す。失敗した場合は null（原因はログに記録）
const callGemini = async (apiKey, {turns, draft, now, timeZone, weekStartsOn}) => {
  try {
    const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
        {
          method: "POST",
          headers: {"Content-Type": "application/json", "x-goog-api-key": apiKey},
          signal: AbortSignal.timeout(15000),
          body: JSON.stringify({
            systemInstruction: {parts: [{text: buildPrompt({now, timeZone, weekStartsOn, draft})}]},
            contents: turns.map((t) => ({role: t.role, parts: [{text: t.text}]})),
            // Gemini 3 系は temperature を下げると出力が崩れやすいため既定値のまま使う
            generationConfig: {responseMimeType: "application/json", responseSchema: RESPONSE_SCHEMA},
          }),
        },
    );
    if (!response.ok) {
      const detail = await response.json().catch(() => ({}));
      log("error", "gemini api error", {
        httpStatus: response.status,
        apiStatus: detail?.error?.status,
        model: MODEL,
        hint: response.status === 404 ? `モデル ${MODEL} が利用できるか確認（GEMINI_MODEL で変更可）` :
          response.status === 403 || response.status === 400 ? "GEMINI_API_KEY・API キーの制限を確認" : undefined,
      });
      return null;
    }
    const data = await response.json();
    // 思考過程（thought）を除いた本文だけを使う
    const text = (data.candidates?.[0]?.content?.parts ?? [])
        .filter((part) => !part.thought && typeof part.text === "string")
        .map((part) => part.text).join("").trim()
        .replace(/^```(?:json)?\s*|\s*```$/g, "");
    if (!text) {
      log("warn", "gemini empty response", {blockReason: data.promptFeedback?.blockReason, finishReason: data.candidates?.[0]?.finishReason});
      return null;
    }
    try {
      return JSON.parse(text);
    } catch {
      log("warn", "gemini invalid json", {length: text.length});
      return null;
    }
  } catch (error) {
    log("error", "gemini call failed", {name: error?.name, timeout: error?.name === "TimeoutError"});
    return null;
  }
};

export default async function handler(request) {
  if (request.method !== "POST") return json({error: "Method Not Allowed"}, 405);

  // 0. サーバー設定の確認（不足している環境変数名だけをログに出す。値は出さない）
  const apiKey = (globalThis.process?.env?.GEMINI_API_KEY ?? "").trim();
  const adminStatus = getAdminConfigStatus();
  if (!apiKey || !adminStatus.ok) {
    log("error", "not configured", {
      missing: [...(apiKey ? [] : ["GEMINI_API_KEY"]), ...adminStatus.missing],
      problem: adminStatus.problem,
    });
    return json({error: "現在この機能は利用できません", code: "NOT_CONFIGURED"}, 503);
  }

  // 1. 認証（失敗時は Gemini を呼ばずに拒否）
  const auth = await verifyUser(request);
  if (!auth.uid) return json({error: auth.error, code: auth.code}, auth.status);
  const uid = auth.uid;

  // 2. 入力検証（不備があれば Gemini を呼ばず、回数も消費しない）

  const body = await request.json().catch(() => null);
  const allTurns = Array.isArray(body?.turns) ? body.turns : [];
  // 件数が多すぎる場合も最初の依頼文は残す
  const rawTurns = allTurns.length > MAX_INPUT_TURNS ?
    [allTurns[0], ...allTurns.slice(-(MAX_INPUT_TURNS - 1))] : allTurns;
  const valid = rawTurns.length > 0 && rawTurns.every((t) =>
    (t?.role === "user" || t?.role === "model") &&
    typeof t.text === "string" && t.text.trim() && t.text.length <= LIMITS.maxInputLength);
  const turns = valid ? trimTurns(rawTurns) : [];
  if (!valid || turns.length === 0) {
    return json({
      error: `入力内容が正しくないか、${LIMITS.maxInputLength}文字を超えています`,
      code: "BAD_REQUEST",
    }, 400);
  }
  // 前回までに分かった内容（タスク名・期限）。質問への回答を元の依頼と結び付けるために使う
  const draft = sanitizeDraft(body.draft);
  const timeZone = resolveTimeZone(typeof body.timeZone === "string" ? body.timeZone.slice(0, 64) : "");
  const weekStartsOn = Number.isInteger(body.weekStartsOn) && body.weekStartsOn >= 0 && body.weekStartsOn <= 6 ?
    body.weekStartsOn : 1;
  const now = new Date();

  // 3. 利用回数の確認と記録（トランザクション）。記録できない場合は安全側に倒して拒否する
  let limit;
  try {
    limit = await consume(adminDb(), uid);
  } catch (error) {
    // PERMISSION_DENIED(7) はサービスアカウントの権限不足、それ以外は一時的な障害の可能性
    log("error", "rate limit store failed", {code: error?.code ?? "unknown", hint: error?.code === 7 ? "サービスアカウントに Firestore への書き込み権限があるか確認" : undefined});
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

  // 4. Gemini 呼び出し。失敗・不正な出力でも、決まったルールでの読み取りと下書きで補う
  const raw = await callGemini(apiKey, {turns, draft, now, timeZone, weekStartsOn});
  return json(resolveTask(raw, {turns, draft, now, timeZone, weekStartsOn}));
}
