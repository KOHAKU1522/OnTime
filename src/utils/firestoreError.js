// Firestore / Firebase のエラーを種類ごとに分類し、利用者向けの案内と診断ログを出す。
// 画面には内部情報（UID・パス・スタックトレース）を出さず、コンソールには原因の切り分けに必要な情報だけを出す。

const HINTS = {
    permission: "この操作の権限がありません。アプリのサーバー設定が更新中の可能性があります。時間をおいても解決しない場合はお問い合わせください",
    auth: "ログインの有効期限が切れた可能性があります。再ログインしてください",
    network: "サーバーに接続できませんでした。通信状況を確認して、もう一度お試しください",
    quota: "利用が集中しています。しばらくしてから、もう一度お試しください",
    conflict: "ほかの操作と重なりました。もう一度お試しください",
    notFound: "対象のデータが見つかりませんでした。画面を更新してください",
    invalid: "保存できない内容が含まれています。入力内容を確認してください",
    unknown: "予期しないエラーが発生しました。もう一度お試しください",
};

export const classifyFirestoreError = (err) => {
    const code = String(err?.code ?? "").replace(/^(firestore|auth)\//, "");
    let kind = "unknown";
    if (code === "permission-denied") kind = "permission";
    else if (code === "unauthenticated" || code === "user-token-expired") kind = "auth";
    else if (code === "unavailable" || code === "deadline-exceeded" || code === "network-request-failed") kind = "network";
    else if (code === "resource-exhausted") kind = "quota";
    else if (code === "aborted" || code === "failed-precondition") kind = "conflict";
    else if (code === "not-found") kind = "notFound";
    else if (code === "invalid-argument") kind = "invalid";
    else if (typeof navigator !== "undefined" && navigator.onLine === false) kind = "network";
    return { kind, code: code || "unknown", hint: HINTS[kind] };
};

// UID をログに残さないようにパスを伏せる
const maskPath = (path) => (path ? String(path).replace(/^users\/[^/]+/, "users/{uid}")
    .replace(/^(users\/\{uid\}\/[^/]+)\/.*$/, "$1/{document}") : undefined);

// 診断ログ。permission-denied の場合は開発者向けに確認ポイントも出す
export const logFirestoreError = (operation, err, path) => {
    const { kind, code } = classifyFirestoreError(err);
    console.error(`[Firestore] ${operation} に失敗しました`, {
        code,
        kind,
        path: maskPath(path),
        online: typeof navigator !== "undefined" ? navigator.onLine : undefined,
    });
    if (kind === "permission") {
        console.warn(
            "[Firestore] permission-denied: 接続先プロジェクト、ログイン中のアカウント、本番ルールの読み取り・書き込み条件を確認してください。"
        );
    }
};

// 「◯◯できませんでした。<原因に応じた案内>」
export const firestoreErrorMessage = (action, err) => `${action}。${classifyFirestoreError(err).hint}`;

// ログ出力と利用者向けメッセージをまとめて作る
export const reportFirestoreError = (action, err, path) => {
    logFirestoreError(action, err, path);
    return firestoreErrorMessage(action, err);
};
