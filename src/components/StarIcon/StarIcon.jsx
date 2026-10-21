const ICON_PATHS = {
    star: "M12 3.5 14.6 9l5.9.8-4.25 4.15 1 5.85L12 17.05l-5.25 2.75 1-5.85L3.5 9.8 9.4 9 12 3.5Z",
    heart: "M20.8 8.8c0 5.2-8.8 11-8.8 11s-8.8-5.8-8.8-11A4.8 4.8 0 0 1 12 6.3a4.8 4.8 0 0 1 8.8 2.5Z",
    bookmark: "M6 3.5h12v17l-6-4-6 4v-17Z",
};

export default function StarIcon({ name = "star", active = false, size = 20, className }) {
    const path = ICON_PATHS[name] ?? ICON_PATHS.star;

    return (
        <svg
            className={className}
            viewBox="0 0 24 24"
            width={size}
            height={size}
            fill={active ? "currentColor" : "none"}
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            focusable="false"
        >
            <path d={path} />
        </svg>
    );
}