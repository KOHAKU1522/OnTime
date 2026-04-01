import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useOutletContext } from "react-router-dom";
import { signOut } from "firebase/auth";
import { auth } from "../firebase";
import { ROUTES } from "../const";
import styles from "./SettingPage.module.css";
import { useDarkMode } from "../hooks/useDarkMode";
import StatsChart from "../components/StatsChart/StatsChart";
import { getWeeklyCompletions, getMonthlyCompletions } from "../utils/statsUtils";

const Icon = ({ d, d2, children, ...props }) => (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
        {children}
    </svg>
);

const MoonIcon = () => <Icon><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" /></Icon>;
const BellIcon = () => <Icon><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 01-3.46 0" /></Icon>;
const RepeatIcon = () => <Icon><polyline points="17 1 21 5 17 9" /><path d="M3 11V9a4 4 0 014-4h14" /><polyline points="7 23 3 19 7 15" /><path d="M21 13v2a4 4 0 01-4 4H3" /></Icon>;
const LogOutIcon = () => <Icon><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></Icon>;
const TagIcon = () => <Icon><path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z" /><line x1="7" y1="7" x2="7.01" y2="7" /></Icon>;
const InfoIcon = () => <Icon><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></Icon>;

const GuideIcon = () => (
    <Icon>
        <rect x="5" y="3" width="14" height="18" rx="2" />
        <line x1="8" y1="9" x2="16" y2="9" />
        <circle cx="12" cy="15" r="1" />
    </Icon>
);

const AppsIcon = () => (
    <Icon>
        <rect x="4" y="4" width="6" height="6" rx="1.5" />
        <rect x="14" y="4" width="6" height="6" rx="1.5" />
        <rect x="4" y="14" width="6" height="6" rx="1.5" />
        <rect x="14" y="14" width="6" height="6" rx="1.5" />
    </Icon>
);

export default function SettingPage() {
    const navigate = useNavigate();
    const user = auth.currentUser;
    const { tasks, notificationsEnabled, toggleNotifications, notifyMinutes, changeNotifyMinutes } = useOutletContext();
    const [isDark, setIsDark] = useDarkMode();
    const [chartTab, setChartTab] = useState("week");

    const PRESET_MINUTES = [60, 180, 360, 720, 1440, 4320];
    const isCustom = !PRESET_MINUTES.includes(notifyMinutes);
    const [customValue, setCustomValue] = useState(() => isCustom ? String(Math.round(notifyMinutes / 60)) : "");
    const [customUnit, setCustomUnit] = useState("hour");

    const totalTasks = tasks.length;
    const completedTasks = tasks.filter(t => t.completed).length;
    const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    const weeklyData = getWeeklyCompletions(tasks);
    const monthlyData = getMonthlyCompletions(tasks);
    const chartData = chartTab === "week" ? weeklyData : monthlyData;

    const thisWeekCount = weeklyData.reduce((sum, d) => sum + d.count, 0);
    const thisMonthCount = monthlyData.reduce((sum, d) => sum + d.count, 0);

    const handleLogout = async () => {
        if (!window.confirm("ログアウトしますか？")) return;
        await signOut(auth);
        navigate("/");
    };

    const requestNotificationPermission = async () => {
        if (!("Notification" in window)) {
            alert("このブラウザは通知に対応していません");
            return;
        }
        const perm = await Notification.requestPermission();
        if (perm === "granted") {
            toggleNotifications(true);
        } else {
            alert("通知が拒否されました。ブラウザの設定から許可してください。");
        }
    };

    const notifPermission = "Notification" in window ? Notification.permission : "unsupported";

    return (
        <div className={styles.page}>
            <h2 className={styles.pageTitle}>設定</h2>

            {/* ユーザー情報 */}
            <div className={styles.userCard}>
                <div className={styles.userAvatar}>
                    {user?.photoURL
                        ? <img src={user.photoURL} alt="avatar" className={styles.userPhoto} />
                        : <span>👤</span>
                    }
                </div>
                <div className={styles.userInfo}>
                    <div className={styles.userName}>
                        {user?.displayName || "ユーザー"}
                    </div>
                    <div className={styles.userEmail}>{user?.email}</div>
                </div>
            </div>

            {/* 実績 */}
            <section className={styles.section}>
                <div className={styles.sectionTitle}>実績</div>
                <div className={styles.statsCard}>
                    <div className={styles.statItem}>
                        <div className={styles.statNumber}>{completedTasks}</div>
                        <div className={styles.statLabel}>達成タスク</div>
                    </div>
                    <div className={styles.statDivider} />
                    <div className={styles.statItem}>
                        <div className={styles.statNumber}>{totalTasks}</div>
                        <div className={styles.statLabel}>総タスク数</div>
                    </div>
                    <div className={styles.statDivider} />
                    <div className={styles.statItem}>
                        <div className={styles.statNumber}>{completionRate}<span className={styles.statUnit}>%</span></div>
                        <div className={styles.statLabel}>達成率</div>
                    </div>
                </div>

                {/* グラフ */}
                <div className={styles.chartCard}>
                    <div className={styles.chartTabs}>
                        <button
                            className={`${styles.chartTab} ${chartTab === "week" ? styles.active : ""}`}
                            onClick={() => setChartTab("week")}
                        >週次</button>
                        <button
                            className={`${styles.chartTab} ${chartTab === "month" ? styles.active : ""}`}
                            onClick={() => setChartTab("month")}
                        >月次</button>
                    </div>
                    <StatsChart data={chartData} />
                    <div className={styles.chartSummary}>
                        {chartTab === "week"
                            ? `今週の完了: ${thisWeekCount}件`
                            : `過去4週の完了: ${thisMonthCount}件`
                        }
                    </div>
                </div>
            </section>

            {/* 外観 */}
            <section className={styles.section}>
                <div className={styles.sectionTitle}>外観</div>
                <div className={styles.card}>
                    <div className={styles.toggleRow}>
                        <span className={styles.rowIcon}><MoonIcon /></span>
                        <span className={styles.rowLabel}>ダークモード</span>
                        <label className={styles.toggleSwitch}>
                            <input
                                type="checkbox"
                                checked={isDark}
                                onChange={(e) => setIsDark(e.target.checked)}
                            />
                            <span className={styles.toggleSlider} />
                        </label>
                    </div>
                </div>
            </section>

            {/* 通知 */}
            <section className={styles.section}>
                <div className={styles.sectionTitle}>通知</div>
                <div className={styles.card}>
                    <div className={styles.toggleRow}>
                        <span className={styles.rowIcon}><BellIcon /></span>
                        <span className={styles.rowLabel}>
                            {notifPermission === "granted"
                                ? (notificationsEnabled ? "通知オン" : "通知オフ")
                                : "期限リマインダー"
                            }
                        </span>
                        {notifPermission === "granted" ? (
                            <label className={styles.toggleSwitch}>
                                <input
                                    type="checkbox"
                                    checked={notificationsEnabled}
                                    onChange={(e) => toggleNotifications(e.target.checked)}
                                />
                                <span className={styles.toggleSlider} />
                            </label>
                        ) : (
                            <button
                                className={`${styles.notifBtn} ${notificationsEnabled ? styles.notifEnabled : ""}`}
                                onClick={requestNotificationPermission}
                            >
                                {notifPermission === "denied" ? "ブロック済み" : "許可する"}
                            </button>
                        )}
                    </div>
                    {notificationsEnabled && notifPermission === "granted" && (
                        <>
                            <div className={styles.divider} />
                            <div className={styles.notifTimingRow}>
                                <span className={styles.notifTimingLabel}>通知タイミング</span>
                                <div className={styles.notifChips}>
                                    {[
                                        { label: "1時間前", minutes: 60 },
                                        { label: "3時間前", minutes: 180 },
                                        { label: "6時間前", minutes: 360 },
                                        { label: "12時間前", minutes: 720 },
                                        { label: "24時間前", minutes: 1440 },
                                        { label: "3日前", minutes: 4320 },
                                    ].map(opt => (
                                        <button
                                            key={opt.minutes}
                                            className={`${styles.notifChip} ${notifyMinutes === opt.minutes ? styles.notifChipActive : ""}`}
                                            onClick={() => changeNotifyMinutes(opt.minutes)}
                                        >
                                            {opt.label}
                                        </button>
                                    ))}
                                    <button
                                        className={`${styles.notifChip} ${isCustom ? styles.notifChipActive : ""}`}
                                        onClick={() => {
                                            setCustomValue("");
                                            setCustomUnit("hour");
                                            if (!isCustom) changeNotifyMinutes(-1);
                                        }}
                                    >
                                        カスタム
                                    </button>
                                </div>
                                {isCustom && (
                                    <div className={styles.customTimingRow}>
                                        <input
                                            type="number"
                                            min="1"
                                            className={styles.customTimingInput}
                                            value={customValue}
                                            onChange={(e) => setCustomValue(e.target.value)}
                                            placeholder="数値"
                                        />
                                        <select
                                            className={styles.customTimingSelect}
                                            value={customUnit}
                                            onChange={(e) => setCustomUnit(e.target.value)}
                                        >
                                            <option value="min">分前</option>
                                            <option value="hour">時間前</option>
                                            <option value="day">日前</option>
                                        </select>
                                        <button
                                            className={styles.customTimingBtn}
                                            onClick={() => {
                                                const v = Number(customValue);
                                                if (!v || v <= 0) return;
                                                const mins = customUnit === "min" ? v
                                                    : customUnit === "hour" ? v * 60
                                                        : v * 1440;
                                                changeNotifyMinutes(mins);
                                            }}
                                        >
                                            設定
                                        </button>
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </div>
            </section>

            {/* ツール */}
            <section className={styles.section}>
                <div className={styles.sectionTitle}>ツール</div>
                <div className={styles.card}>
                    <button className={styles.row} onClick={() => navigate(`/${ROUTES.MACRO}`)}>
                        <span className={styles.rowIcon}><RepeatIcon /></span>
                        <span className={styles.rowLabel}>マクロ（繰り返しタスク）</span>
                        <span className={styles.rowArrow}>›</span>
                    </button>
                </div>
            </section>

            {/* アカウント */}
            <section className={styles.section}>
                <div className={styles.sectionTitle}>アカウント</div>
                <div className={styles.card}>
                    <button className={`${styles.row} ${styles.danger}`} onClick={handleLogout}>
                        <span className={styles.rowIcon}><LogOutIcon /></span>
                        <span className={styles.rowLabel}>ログアウト</span>
                    </button>
                </div>
            </section>

            {/* アプリ情報 */}
            <section className={styles.section}>
                <div className={styles.sectionTitle}>アプリ情報</div>
                <div className={styles.card}>
                    <div className={`${styles.row} ${styles.rowStatic}`}>
                        <span className={styles.rowIcon}><InfoIcon /></span>
                        <span className={styles.rowLabel}>バージョン</span>
                        <span className={styles.rowValue}>v1.1.2</span>
                    </div>

                    <div className={styles.divider} />

                    <button className={styles.row} onClick={() => navigate(`/${ROUTES.CODE_REF}`)}>
                        <span className={styles.rowIcon}><TagIcon /></span>
                        <span className={styles.rowLabel}>コード参照</span>
                        <span className={styles.rowArrow}>›</span>
                    </button>

                    <div className={styles.divider} />

                    <button className={styles.row} onClick={() => navigate(`/${ROUTES.GUIDE}`)}>
                        <span className={styles.rowIcon}><GuideIcon /></span>
                        <span className={styles.rowLabel}>アプリの使い方</span>
                        <span className={styles.rowArrow}>›</span>
                    </button>

                    <div className={styles.divider} />

                    <button className={styles.row} onClick={() => navigate(`/${ROUTES.OTHER_APPS}`)}>
                        <span className={styles.rowIcon}><AppsIcon /></span>
                        <span className={styles.rowLabel}>他のおすすめのアプリ</span>
                        <span className={styles.rowArrow}>›</span>
                    </button>
                </div>
            </section>

        </div>
    );
}
