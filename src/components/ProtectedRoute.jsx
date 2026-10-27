import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../firebase";
import { Navigate } from "react-router-dom";

export default function ProtectedRoute({ children, isGuest }) {
    const [user, setUser] = useState(undefined);
    const [authError, setAuthError] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => setAuthError(true), 15000);
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            clearTimeout(timer);
            setAuthError(false);
            setUser(currentUser);
        }, (error) => {
            clearTimeout(timer);
            console.error("[Auth] 認証状態の確認に失敗しました", { code: error?.code ?? "unknown" });
            setAuthError(true);
        });
        return () => { clearTimeout(timer); unsubscribe(); };
    }, []);

    if (authError) return <div role="alert">
        <p>認証状態を確認できませんでした。通信状況を確認して再読み込みしてください。</p>
        <button type="button" onClick={() => window.location.reload()}>再読み込み</button>
    </div>;
    if (user === undefined) return <p role="status">認証状態を確認しています…</p>;

    if (!user && !isGuest) return <Navigate to="/" />;

    return children;
}
