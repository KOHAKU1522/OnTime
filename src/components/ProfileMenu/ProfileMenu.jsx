import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { signOut } from "firebase/auth";
import { auth } from "../../firebase";
import { ROUTES } from "../../const";
import styles from "./ProfileMenu.module.css";

export default function ProfileMenu({ onClose }) {
    const navigate = useNavigate();
    const user = auth.currentUser;

    useEffect(() => {
        document.body.style.overflow = "hidden";
        return () => { document.body.style.overflow = ""; };
    }, []);

    const handleLogout = async () => {
        if (!window.confirm("ログアウトしますか？")) return;
        await signOut(auth);
        navigate(ROUTES.LOGIN);
    };

    const handleSetting = () => {
        onClose();
        navigate(`/${ROUTES.SETTING}`);
    };

    return (
        <div className={styles.overlay} onClick={onClose}>
            <div className={styles.sheet} onClick={e => e.stopPropagation()}>
                <div className={styles.handle} />

                {/* ユーザー情報 */}
                <div className={styles.userSection}>
                    <div className={styles.avatar}>
                        {user?.photoURL
                            ? <img src={user.photoURL} alt="avatar" className={styles.avatarImg} />
                            : <span>👤</span>
                        }
                    </div>
                    <div className={styles.userInfo}>
                        <div className={styles.userName}>{user?.displayName || "ユーザー"}</div>
                        <div className={styles.userEmail}>{user?.email}</div>
                    </div>
                </div>

                <div className={styles.divider} />

                {/* メニュー */}
                <button className={styles.menuItem} onClick={handleSetting}>
                    <span className={styles.menuIcon}>
                        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="3"/>
                            <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>
                        </svg>
                    </span>
                    <span className={styles.menuLabel}>設定</span>
                    <span className={styles.menuArrow}>›</span>
                </button>

                <div className={styles.itemDivider} />

                <button className={`${styles.menuItem} ${styles.danger}`} onClick={handleLogout}>
                    <span className={styles.menuIcon}>
                        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/>
                            <polyline points="16 17 21 12 16 7"/>
                            <line x1="21" y1="12" x2="9" y2="12"/>
                        </svg>
                    </span>
                    <span className={styles.menuLabel}>ログアウト</span>
                </button>

                <div className={styles.safeArea} />
            </div>
        </div>
    );
}
