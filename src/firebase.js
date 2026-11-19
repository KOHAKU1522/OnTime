import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth, signInAnonymously } from "firebase/auth";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_API_KEY,
  authDomain: import.meta.env.VITE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_APP_ID,
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const auth = getAuth(app);

// Separate auth keeps guest task data local while the AI endpoint retains token verification and rate limits.
const guestApp = initializeApp(firebaseConfig, "ai-guest");
const guestAuth = getAuth(guestApp);
export async function getAiToken() {
  if (auth.currentUser) return auth.currentUser.getIdToken();
  await guestAuth.authStateReady();
  const user = guestAuth.currentUser ?? (await signInAnonymously(guestAuth)).user;
  return user.getIdToken();
}
