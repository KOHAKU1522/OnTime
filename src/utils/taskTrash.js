import {
    collection, doc, getDocs, query, runTransaction, where, writeBatch,
} from "firebase/firestore";
import { reportFirestoreError } from "./firestoreError";

// 取り消しできる時間（トーストの表示時間と同じ5秒）
export const UNDO_WINDOW_MS = 5000;
// 通信の遅れを見込んだ猶予
const UNDO_GRACE_MS = 3000;

const taskRef = (db, uid, taskId) => doc(db, "users", uid, "tasks", taskId);
const trashRef = (db, uid, taskId) => doc(db, "users", uid, "deletedTasks", taskId);

const newToken = () =>
    globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;

// タスクを即座にサーバーから削除し、取り消し用に deletedTasks/{taskId} へ退避する。
// 退避と削除は同じトランザクションで行うため、タブを閉じても「削除待ち」の状態は残らない。
// 戻り値: 復元に使うトークン（すでに削除済みなら null。二重削除は何もしない）
export async function deleteTaskWithUndo(db, uid, taskId) {
    const token = newToken();
    const now = Date.now();
    const deleted = await runTransaction(db, async (tx) => {
        const snap = await tx.get(taskRef(db, uid, taskId));
        if (!snap.exists()) return false;
        tx.set(trashRef(db, uid, taskId), {
            data: snap.data(),
            deleteToken: token,
            deletedAt: new Date(now),
            expiresAt: new Date(now + UNDO_WINDOW_MS),
        });
        tx.delete(taskRef(db, uid, taskId));
        return true;
    });
    return deleted ? token : null;
}

// 削除を取り消す。退避データのトークンが一致し、同じIDのタスクが存在しない場合だけ復元する。
// 二重の取り消しや、別の削除操作の退避データを誤って復元することはない。
// 戻り値: "restored" | "already" | "expired"
export async function restoreDeletedTask(db, uid, taskId, token) {
    return runTransaction(db, async (tx) => {
        const trashSnap = await tx.get(trashRef(db, uid, taskId));
        const taskSnap = await tx.get(taskRef(db, uid, taskId));
        if (!trashSnap.exists() || trashSnap.data().deleteToken !== token) return "already";
        if (taskSnap.exists()) return "already";
        const expiresAt = trashSnap.data().expiresAt?.toDate?.()?.getTime() ?? 0;
        if (Date.now() > expiresAt + UNDO_GRACE_MS) return "expired";
        tx.set(taskRef(db, uid, taskId), trashSnap.data().data);
        tx.delete(trashRef(db, uid, taskId));
        return "restored";
    });
}

// 取り消し期限を過ぎた退避データを削除する（アプリ起動時。サーバーでも1日1回整理する）
export async function purgeExpiredTrash(db, uid) {
    const cutoff = new Date(Date.now() - 60 * 1000);
    const snap = await getDocs(query(collection(db, "users", uid, "deletedTasks"), where("expiresAt", "<", cutoff)));
    if (snap.empty) return;
    const batch = writeBatch(db);
    snap.docs.slice(0, 450).forEach((d) => batch.delete(d.ref));
    await batch.commit();
}

// 削除してトーストに「元に戻す」を出す（TaskCard・ガントチャート共通）
export async function deleteTaskAndOfferUndo(db, uid, taskId, showToast) {
    let token;
    try {
        token = await deleteTaskWithUndo(db, uid, taskId);
    } catch (err) {
        // 退避先（deletedTasks）への書き込みが拒否された場合も permission-denied になる
        showToast?.(reportFirestoreError("タスクを削除できませんでした", err, `users/${uid}/deletedTasks/${taskId}`));
        return false;
    }
    if (!token) return true; // すでに削除済み（二重操作）

    showToast?.("タスクを削除しました", async () => {
        try {
            const result = await restoreDeletedTask(db, uid, taskId, token);
            if (result === "expired") showToast?.("取り消しできる時間を過ぎたため、復元できませんでした");
        } catch (err) {
            showToast?.(reportFirestoreError("元に戻せませんでした", err, `users/${uid}/deletedTasks/${taskId}`));
        }
    });
    return true;
}
