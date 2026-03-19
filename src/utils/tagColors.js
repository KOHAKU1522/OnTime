export const TAG_COLORS = [
    { key: "blue",   bg: "#dbeafe", text: "#1d4ed8", darkBg: "#1e3a5f", darkText: "#93c5fd" },
    { key: "purple", bg: "#ede9fe", text: "#6d28d9", darkBg: "#3b2d6e", darkText: "#c4b5fd" },
    { key: "green",  bg: "#dcfce7", text: "#15803d", darkBg: "#14532d", darkText: "#86efac" },
    { key: "orange", bg: "#ffedd5", text: "#c2410c", darkBg: "#431407", darkText: "#fdba74" },
    { key: "red",    bg: "#fee2e2", text: "#b91c1c", darkBg: "#450a0a", darkText: "#fca5a5" },
    { key: "pink",   bg: "#fce7f3", text: "#9d174d", darkBg: "#4a044e", darkText: "#f9a8d4" },
    { key: "yellow", bg: "#fef9c3", text: "#854d0e", darkBg: "#422006", darkText: "#fde047" },
    { key: "teal",   bg: "#ccfbf1", text: "#0f766e", darkBg: "#042f2e", darkText: "#5eead4" },
    { key: "gray",   bg: "#f3f4f6", text: "#374151", darkBg: "#1f2937", darkText: "#9ca3af" },
];

function loadColorMap() {
    try {
        return JSON.parse(localStorage.getItem("tagColorMap") || "{}");
    } catch {
        return {};
    }
}

function hashIndex(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = (hash * 31 + str.charCodeAt(i)) % TAG_COLORS.length;
    }
    return Math.abs(hash);
}

export function getTagColorKey(tagName) {
    const map = loadColorMap();
    if (map[tagName]) return map[tagName];
    return TAG_COLORS[hashIndex(tagName)].key;
}

export function setTagColorKey(tagName, colorKey) {
    const map = loadColorMap();
    map[tagName] = colorKey;
    localStorage.setItem("tagColorMap", JSON.stringify(map));
}

export function getTagColorDef(tagName) {
    const key = getTagColorKey(tagName);
    return TAG_COLORS.find(c => c.key === key) ?? TAG_COLORS[0];
}

export function isDarkMode() {
    return document.documentElement.getAttribute("data-theme") === "dark";
}

export function getTagStyle(tagName) {
    const def = getTagColorDef(tagName);
    const dark = isDarkMode();
    return {
        backgroundColor: dark ? def.darkBg : def.bg,
        color: dark ? def.darkText : def.text,
    };
}
