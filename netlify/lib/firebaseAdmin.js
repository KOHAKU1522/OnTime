// Netlify Functions から使う Firebase Admin SDK（サーバー専用。クライアントからは import しない）
import {cert, getApps, initializeApp} from "firebase-admin/app";
import {getAuth} from "firebase-admin/auth";
import {getFirestore} from "firebase-admin/firestore";

const env = globalThis.process?.env ?? {};

// サービスアカウントは3つの環境変数で渡す（Netlify Functions の環境変数は合計 4KB 制限があるため JSON 全体は避ける）
export const ADMIN_ENV_NAMES = ["FIREBASE_PROJECT_ID", "FIREBASE_CLIENT_EMAIL", "FIREBASE_PRIVATE_KEY"];

// 管理画面への貼り付け方の違い（前後の引用符、"\n" の文字列）を吸収する
const normalizePrivateKey = (value) => String(value ?? "")
    .trim()
    .replace(/^"([\s\S]*)"$/, "$1")
    .replace(/\\n/g, "\n");

// 設定状況（値は返さず、不足している変数名と形式の問題だけを返す）
export const getAdminConfigStatus = () => {
  const missing = ADMIN_ENV_NAMES.filter((name) => !String(env[name] ?? "").trim());
  if (missing.length) return {ok: false, missing, problem: "missing"};
  if (!normalizePrivateKey(env.FIREBASE_PRIVATE_KEY).includes("BEGIN PRIVATE KEY")) {
    return {ok: false, missing: [], problem: "FIREBASE_PRIVATE_KEY の形式が正しくありません（-----BEGIN PRIVATE KEY----- から始まる値を設定）"};
  }
  return {ok: true, missing: []};
};

export const isAdminConfigured = () => getAdminConfigStatus().ok;

let initError = null;
const getApp = () => {
  if (getApps()[0]) return getApps()[0];
  if (initError) throw initError;
  try {
    return initializeApp({
      credential: cert({
        projectId: env.FIREBASE_PROJECT_ID.trim(),
        clientEmail: env.FIREBASE_CLIENT_EMAIL.trim(),
        privateKey: normalizePrivateKey(env.FIREBASE_PRIVATE_KEY),
      }),
    });
  } catch (error) {
    // 秘密鍵の内容はログに出さない
    initError = Object.assign(new Error("firebase-admin の初期化に失敗しました"), {code: "admin/init-failed", cause: error?.code});
    throw initError;
  }
};

export const adminProjectId = () => String(env.FIREBASE_PROJECT_ID ?? "").trim();
export const adminAuth = () => getAuth(getApp());
export const adminDb = () => getFirestore(getApp());
