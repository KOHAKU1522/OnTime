// ユーザー単位の利用回数制限（Firestore トランザクションで記録するため同時リクエストでも上限を超えない）
// 記録先 rateLimits/{uid} は firestore.rules でクライアントからの読み書きを拒否しており、Admin SDK からのみ更新される。

const env = globalThis.process?.env ?? {};
const readLimit = (name, fallback) => {
  const value = Number(env[name]);
  return Number.isInteger(value) && value > 0 ? value : fallback;
};

// 上限値は環境変数で調整できる（未設定時は既定値）
export const LIMITS = {
  perMinute: readLimit("PARSE_TASK_LIMIT_PER_MINUTE", 5),
  perDay: readLimit("PARSE_TASK_LIMIT_PER_DAY", 20),
  maxInputLength: readLimit("PARSE_TASK_MAX_INPUT_LENGTH", 1000),
};

const MINUTE_MS = 60 * 1000;
const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

// 日本時間の日付キー（YYYY-MM-DD）
export const jstDateKey = (ms) => new Date(ms + JST_OFFSET_MS).toISOString().slice(0, 10);

// 次の日本時間 0:00 までのミリ秒
const msUntilJstMidnight = (ms) => {
  const jst = ms + JST_OFFSET_MS;
  return Math.ceil(jst / 86400000) * 86400000 - jst || 86400000;
};

// 記録内容から判定する純粋関数（テストしやすいようにトランザクションと分離）
// 1分は直近60秒のスライディングウィンドウ、1日は日本時間の暦日で数える
export const evaluate = (data, nowMs, limits = LIMITS) => {
  const dayKey = jstDateKey(nowMs);
  const recent = (Array.isArray(data?.recent) ? data.recent : [])
      .filter((t) => typeof t === "number" && t > nowMs - MINUTE_MS && t <= nowMs);
  const dayCount = data?.dayKey === dayKey && Number.isInteger(data?.dayCount) ? data.dayCount : 0;

  if (dayCount >= limits.perDay) {
    return {allowed: false, reason: "DAY", retryAfterSec: Math.ceil(msUntilJstMidnight(nowMs) / 1000)};
  }
  if (recent.length >= limits.perMinute) {
    const oldest = Math.min(...recent);
    return {allowed: false, reason: "MINUTE", retryAfterSec: Math.max(1, Math.ceil((oldest + MINUTE_MS - nowMs) / 1000))};
  }
  return {
    allowed: true,
    next: {recent: [...recent, nowMs], dayKey, dayCount: dayCount + 1, updatedAt: nowMs},
    remainingToday: limits.perDay - dayCount - 1,
  };
};

// 1回分の利用を予約する。上限内なら記録して allowed: true を返す
export const consume = async (db, uid, nowMs = Date.now()) => {
  const ref = db.collection("rateLimits").doc(uid);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const result = evaluate(snap.exists ? snap.data() : null, nowMs);
    if (result.allowed) tx.set(ref, result.next);
    return result;
  });
};
