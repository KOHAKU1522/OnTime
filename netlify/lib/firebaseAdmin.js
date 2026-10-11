// Netlify Functions から使う Firebase Admin SDK（サーバー専用。クライアントからは import しない）
import {cert, getApps, initializeApp} from "firebase-admin/app";
import {getAuth} from "firebase-admin/auth";
import {getFirestore} from "firebase-admin/firestore";

const env = globalThis.process?.env ?? {};

// サービスアカウントは3つの環境変数で渡す（Netlify Functions の環境変数は合計 4KB 制限があるため JSON 全体は避ける）
export const isAdminConfigured = () =>
  Boolean(env.FIREBASE_PROJECT_ID && env.FIREBASE_CLIENT_EMAIL && env.FIREBASE_PRIVATE_KEY);

const getApp = () => getApps()[0] ?? initializeApp({
  credential: cert({
    projectId: env.FIREBASE_PROJECT_ID,
    clientEmail: env.FIREBASE_CLIENT_EMAIL,
    // 環境変数に "\n" として保存された改行を戻す
    privateKey: env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
  }),
});

export const adminAuth = () => getAuth(getApp());
export const adminDb = () => getFirestore(getApp());
