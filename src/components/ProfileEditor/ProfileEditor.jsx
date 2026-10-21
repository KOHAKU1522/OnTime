import { useRef, useState } from "react";
import styles from "./ProfileEditor.module.css";

// ????????????????????????JPEG????????
async function readIcon(file) {
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
        throw new Error("JPEG・PNG・WebPの画像を選択してください");
    }
    if (file.size > 5 * 1024 * 1024) throw new Error("画像は5MB以下にしてください");
    const url = URL.createObjectURL(file);
    try {
        const image = new Image();
        image.src = url;
        await image.decode();
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = 128;
        const context = canvas.getContext("2d");
        if (!context) throw new Error("画像を処理できませんでした");
        context.fillStyle = "#fff";
        context.fillRect(0, 0, 128, 128);
        const size = Math.min(image.naturalWidth, image.naturalHeight);
        context.drawImage(image, (image.naturalWidth - size) / 2, (image.naturalHeight - size) / 2, size, size, 0, 0, 128, 128);
        const result = canvas.toDataURL("image/jpeg", 0.8);
        if (result.length > 100000) throw new Error("画像を小さくして再度お試しください");
        return result;
    } finally {
        URL.revokeObjectURL(url);
    }
}

export default function ProfileEditor({ user, settings, updateSettings, showToast }) {
    const [editing, setEditing] = useState(false);
    const [name, setName] = useState("");
    const [image, setImage] = useState(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const fileRef = useRef(null);

    const open = () => {
        setName(settings.profileName ?? user.displayName ?? "");
        setImage(settings.profileImage);
        setError("");
        setEditing(true);
    };

    const selectImage = async (event) => {
        const file = event.target.files?.[0];
        event.target.value = "";
        if (!file) return;
        setBusy(true);
        setError("");
        try {
            setImage(await readIcon(file));
        } catch (err) {
            setError(err.message || "画像を読み込めませんでした");
        } finally {
            setBusy(false);
        }
    };

    const save = async (event) => {
        event.preventDefault();
        if (busy) return;
        const trimmed = name.trim();
        if (!trimmed) {
            setError("名前を入力してください");
            return;
        }
        setBusy(true);
        setError("");
        try {
            const ok = await updateSettings({ profileName: trimmed, profileImage: image });
            if (ok) {
                setEditing(false);
                showToast("プロフィールを保存しました");
            } else {
                setError("保存できませんでした。もう一度お試しください");
            }
        } catch {
            setError("保存できませんでした。もう一度お試しください");
        } finally {
            setBusy(false);
        }
    };

    if (!editing) return <button className={styles.editButton} onClick={open}>名前・アイコンを編集</button>;
    const preview = image ?? user.photoURL;
    return (
        <form className={styles.editor} onSubmit={save} aria-label="プロフィール編集" aria-busy={busy}>
            <fieldset disabled={busy} className={styles.fields}>
                <legend>プロフィール編集</legend>
                <div className={styles.imageRow}>
                    <div className={styles.avatar}>
                        {preview ? <img src={preview} alt="アイコンのプレビュー" /> : <span aria-label="標準アイコン">👤</span>}
                    </div>
                    <button type="button" className={styles.button} onClick={() => fileRef.current?.click()}>画像を選択</button>
                    <button type="button" className={styles.button} onClick={() => setImage("")}>画像を削除</button>
                </div>
                <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={selectImage} className={styles.fileInput} aria-label="プロフィール画像" />
                <p className={styles.hint}>JPEG・PNG・WebP、5MBまで。中央を正方形に切り抜きます。</p>
                <label htmlFor="profileName">名前</label>
                <input id="profileName" className={styles.nameInput} value={name} onChange={e => setName(e.target.value)} maxLength={50} required autoComplete="nickname" autoFocus />
                <div className={styles.actions}>
                    <button type="button" className={styles.button} onClick={() => setEditing(false)}>キャンセル</button>
                    <button type="submit" className={styles.saveButton}>保存する</button>
                </div>
            </fieldset>
            {busy && <p className={styles.hint} role="status">処理中…</p>}
            {error && <p className={styles.error} role="alert">{error}</p>}
        </form>
    );
}
