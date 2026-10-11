import { collection, doc, getDocs, runTransaction } from "firebase/firestore";
import { buildMacroTask, isMacroDue, macroTaskId, todayKey } from "./macroSchedule";

// functions/index.js の runMacros と同じ判定（macroSchedule.js を共有）。
// サーバーの定期実行が主で、こちらはアプリ起動時の補完。
// 同じタスクIDとトランザクション内の再判定により二重追加されない。
export async function runMacrosForUser(db, uid, timeZone, now = new Date()) {
    const snap = await getDocs(collection(db, "users", uid, "macros"));

    for (const macroDoc of snap.docs) {
        if (!isMacroDue(macroDoc.data(), now, timeZone)) continue;

        const macroRef = macroDoc.ref;
        const taskRef = doc(db, "users", uid, "tasks", macroTaskId(macroDoc.id, now, timeZone));

        await runTransaction(db, async (tx) => {
            const macroSnap = await tx.get(macroRef);
            const existing = await tx.get(taskRef);
            if (!macroSnap.exists() || existing.exists()) return;
            const macro = macroSnap.data();
            if (!isMacroDue(macro, now, timeZone)) return;

            tx.set(taskRef, buildMacroTask(macroDoc.id, macro, now, timeZone));
            tx.update(macroRef, { lastTriggered: now, lastTriggeredKey: todayKey(now, timeZone) });
        });
    }
}
