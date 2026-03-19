import styles from "./Footer.module.css";
import { useNavigate, useLocation } from "react-router-dom";
import { ROUTES } from "../../const";

const HomeIcon = ({ active }) => (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
);

const CalendarIcon = ({ active }) => (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
);

const MacroIcon = ({ active }) => (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round">
        <polyline points="17 1 21 5 17 9" />
        <path d="M3 11V9a4 4 0 014-4h14" />
        <polyline points="7 23 3 19 7 15" />
        <path d="M21 13v2a4 4 0 01-4 4H3" />
    </svg>
);

const SettingIcon = ({ active }) => (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
    </svg>
);

const NAV_ITEMS = [
    { route: ROUTES.HOME, label: "ホーム", Icon: HomeIcon },
    { route: ROUTES.CALENDAR, label: "カレンダー", Icon: CalendarIcon },
    { route: ROUTES.MACRO, label: "マクロ", Icon: MacroIcon },
    { route: ROUTES.SETTING, label: "設定", Icon: SettingIcon },
];

export default function Footer() {
    const navigate = useNavigate();
    const location = useLocation();

    const moveTo = (route) => {
        navigate(route);
        window.scrollTo(0, 0);
    };

    return (
        <footer className={styles.footer}>
            <ul className={styles.footerItems}>
                {NAV_ITEMS.map(({ route, label, Icon }) => {
                    const active = location.pathname === `/${route}` || location.pathname === route;
                    return (
                        <li key={route} className={styles.footerItem}>
                            <button
                                className={`${styles.footerButton} ${active ? styles.active : ""}`}
                                onClick={() => moveTo(route)}
                            >
                                <Icon active={active} />
                            </button>
                            <span className={`${styles.footerName} ${active ? styles.activeText : ""}`}>
                                {label}
                            </span>
                            {active && <div className={styles.activeDot} />}
                        </li>
                    );
                })}
            </ul>
        </footer>
    );
}
