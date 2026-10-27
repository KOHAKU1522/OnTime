export const REQUIRED_FIREBASE_ENV = [
    "VITE_API_KEY", "VITE_AUTH_DOMAIN", "VITE_PROJECT_ID", "VITE_APP_ID",
];

export function assertFirebaseConfig(env) {
    const missing = REQUIRED_FIREBASE_ENV.filter(name => !String(env[name] ?? "").trim());
    if (missing.length) throw new Error(`Firebase設定が不足しています: ${missing.join(", ")}`);
}
