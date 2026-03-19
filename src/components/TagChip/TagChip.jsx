import { useState, useEffect, useRef } from "react";
import { TAG_COLORS, getTagColorKey, setTagColorKey, getTagStyle } from "../../utils/tagColors";
import styles from "./TagChip.module.css";

export default function TagChip({ tag, onRemove, onSelect, readonly = false }) {
    const [colorKey, setColorKey] = useState(() => getTagColorKey(tag));
    const [showPicker, setShowPicker] = useState(false);
    const ref = useRef(null);

    const colorDef = TAG_COLORS.find(c => c.key === colorKey) ?? TAG_COLORS[0];
    const tagStyle = getTagStyle(tag);

    // カラーキーが変わったら再計算
    const currentStyle = {
        backgroundColor: tagStyle.backgroundColor,
        color: tagStyle.color,
    };

    useEffect(() => {
        if (!showPicker) return;
        const handler = (e) => {
            if (ref.current && !ref.current.contains(e.target)) {
                setShowPicker(false);
            }
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, [showPicker]);

    const pickColor = (key) => {
        setTagColorKey(tag, key);
        setColorKey(key);
        setShowPicker(false);
    };

    const handleChipClick = (e) => {
        e.stopPropagation();
        if (onSelect) { onSelect(tag); return; }
        if (readonly) return;
        setShowPicker(v => !v);
    };

    return (
        <div className={styles.wrapper} ref={ref}>
            <span
                className={`${styles.chip} ${!readonly || onSelect ? styles.clickable : ""}`}
                style={currentStyle}
                onClick={handleChipClick}
            >
                {!readonly && <span className={styles.colorDotSmall} style={{ backgroundColor: tagStyle.color }} />}
                {tag}
                {onRemove && (
                    <button
                        className={styles.removeBtn}
                        style={{ color: tagStyle.color }}
                        onClick={(e) => { e.stopPropagation(); onRemove(tag); }}
                    >
                        ×
                    </button>
                )}
            </span>

            {showPicker && (
                <div className={styles.picker}>
                    <div className={styles.pickerLabel}>色を選択</div>
                    <div className={styles.colorGrid}>
                        {TAG_COLORS.map(c => {
                            const isDark = document.documentElement.getAttribute("data-theme") === "dark";
                            const swatchBg = isDark ? c.darkBg : c.bg;
                            const swatchText = isDark ? c.darkText : c.text;
                            return (
                                <button
                                    key={c.key}
                                    className={`${styles.swatch} ${colorKey === c.key ? styles.swatchActive : ""}`}
                                    style={{
                                        backgroundColor: swatchBg,
                                        color: swatchText,
                                        outline: colorKey === c.key ? `2px solid ${swatchText}` : "2px solid transparent",
                                    }}
                                    onClick={(e) => { e.stopPropagation(); pickColor(c.key); }}
                                    title={c.key}
                                />
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
