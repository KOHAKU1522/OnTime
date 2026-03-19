import { useEffect, useState } from "react";
import { LOGIN_PAGE_SUBTITLE } from "../const";
import styles from "./LoginPage.module.css";

import { useNavigate } from "react-router-dom";

import { auth } from "../firebase";
import { signInWithEmailAndPassword, GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { sendEmailVerification } from "firebase/auth";

export default function LoginPage() {

    const [subtitle] = useState(() =>
        LOGIN_PAGE_SUBTITLE[Math.floor(Math.random() * LOGIN_PAGE_SUBTITLE.length)]
    );

    const navigate = useNavigate();

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");

    const [errorMessage, setErrorMessage] = useState("");
    // useEffect(() => {
    //     if (errorMessage) {
    //         alert(errorMessage);
    //         setErrorMessage("");
    //     }
    // }, [errorMessage]);

    useEffect(() => {
        if (auth.currentUser) {
            navigate("/home");
        }
    }, []);

    const handleLogin = async () => {
        try {
            const userCredential = await signInWithEmailAndPassword(auth, email, password);

            if (!userCredential.user.emailVerified) {
                setErrorMessage("メール確認をしてください");
                return;
            }

            navigate("/home");

        } catch (error) {
            if (error.code === "auth/user-not-found") {
                setErrorMessage("ユーザーが存在しません");
            } else if (error.code === "auth/wrong-password") {
                setErrorMessage("パスワードが間違っています");
            } else {
                setErrorMessage("ログインに失敗しました");
            }
        }
    };

    const handleGoogleLogin = async () => {
        try {
            const provider = new GoogleAuthProvider();
            await signInWithPopup(auth, provider);
            console.log("Googleログイン成功");
            navigate("/home");
        } catch (error) {
            console.error(error);
        }
    };

    const handleRegister = async () => {

        if (!email || !password) {
            setErrorMessage("メールとパスワードを入力してください");
            return;
        }

        try {
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);

            await sendEmailVerification(userCredential.user);
            await auth.signOut();
            setErrorMessage("確認メールを送信しました");
            navigate("/");

        } catch (error) {
            if (error.code === "auth/email-already-in-use") {
                setErrorMessage("このメールは既に登録されています");
            } else if (error.code === "auth/invalid-email") {
                setErrorMessage("メールアドレスの形式が正しくありません");
            } else if (error.code === "auth/weak-password") {
                setErrorMessage("パスワードは6文字以上にしてください");
            } else {
                setErrorMessage("登録に失敗しました");
            }
        }
    };

    return (
        <div className={styles.container}>
            <div className={styles.card}>
                <h1 className={styles.title}>OnTime</h1>
                <p className={errorMessage ? styles.error : styles.subtitle}>
                    {errorMessage || subtitle}
                </p>

                <input
                    type="email"
                    placeholder="メールアドレス"
                    className={styles.input}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                />

                <input
                    type="password"
                    placeholder="パスワード"
                    className={styles.input}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                />

                <button className={styles.button} onClick={handleLogin}>
                    ログイン
                </button>

                <button className={`${styles.googleButton} ${styles.button}`} onClick={handleGoogleLogin}>
                    <img className={styles.img} src="/images/google-logo.png" alt="" />
                    Googleでログイン
                </button>

                <button className={styles.button} onClick={handleRegister}>
                    新規登録
                </button>
            </div>
        </div>
    );
}
