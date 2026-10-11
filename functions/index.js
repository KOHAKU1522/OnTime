// index.js
import {onSchedule} from "firebase-functions/v2/scheduler";
import {logger} from "firebase-functions";
import admin from "firebase-admin";
import {getFirestore} from "firebase-admin/firestore";
import {
  buildMacroTask, isMacroDue, macroTaskId, todayKey,
} from "./macroSchedule.js";
import {resolveTimeZone} from "./timezone.js";

admin.initializeApp();

// ユーザー設定のタイムゾーン（未設定・不正値は Asia/Tokyo）
const getUserTimeZone = async (userRef) => {
  const snap = await userRef.collection("settings").doc("preferences").get();
  return resolveTimeZone(snap.data()?.timeZone);
};

// マクロからタスクを生成する。
// トランザクション内でマクロを読み直して判定し（設定変更・一時停止の直後でも最新の状態で判断）、
// タスクIDを「macro_{macroId}_{設定タイムゾーンの日付}」に固定するため、
// 定期実行のリトライやクライアント側の実行と重なっても同じ日に二重追加されない。
const runMacro = async (db, macroRef, now, timeZone) => {
  const taskRef = macroRef.parent.parent
      .collection("tasks").doc(macroTaskId(macroRef.id, now, timeZone));

  return db.runTransaction(async (tx) => {
    const [macroSnap, existing] = await Promise.all([
      tx.get(macroRef), tx.get(taskRef),
    ]);
    if (!macroSnap.exists) return false;
    const macro = macroSnap.data();
    if (existing.exists || !isMacroDue(macro, now, timeZone)) return false;

    tx.set(taskRef, buildMacroTask(macroRef.id, macro, now, timeZone));
    tx.update(macroRef, {
      lastTriggered: now,
      lastTriggeredKey: todayKey(now, timeZone),
    });
    return true;
  });
};

// アプリを開いていなくても、毎時マクロを確認してタスクを追加する
// （スケジュールの timeZone は起動時刻の基準。日付の判定はユーザーごとのタイムゾーンで行う）
export const runMacros = onSchedule(
    {schedule: "5 * * * *", timeZone: "Asia/Tokyo", retryCount: 1},
    async () => {
      const db = getFirestore();
      const now = new Date();
      const snap = await db.collectionGroup("macros").get();
      const timeZones = new Map();

      let created = 0;
      for (const macroDoc of snap.docs) {
        const userRef = macroDoc.ref.parent.parent;
        if (!userRef) continue;
        try {
          if (!timeZones.has(userRef.id)) {
            timeZones.set(userRef.id, await getUserTimeZone(userRef));
          }
          const timeZone = timeZones.get(userRef.id);
          // 明らかに対象外のものはトランザクションを開かずに飛ばす
          if (!isMacroDue(macroDoc.data(), now, timeZone)) continue;
          if (await runMacro(db, macroDoc.ref, now, timeZone)) created++;
        } catch (err) {
          logger.error("runMacro failed", {path: macroDoc.ref.path, err});
        }
      }
      logger.info("runMacros done", {checked: snap.size, created});
    },
);

// 取り消し期限を過ぎた削除済みタスクの退避データを整理する（1日1回）
export const purgeDeletedTasks = onSchedule(
    {schedule: "30 4 * * *", timeZone: "Asia/Tokyo", retryCount: 1},
    async () => {
      const db = getFirestore();
      const cutoff = Date.now() - 60 * 60 * 1000;
      const snap = await db.collectionGroup("deletedTasks").get();
      const stale = snap.docs.filter((d) => {
        const expiresAt = d.data().expiresAt?.toDate?.();
        return !expiresAt || expiresAt.getTime() < cutoff;
      });
      for (let i = 0; i < stale.length; i += 400) {
        const batch = db.batch();
        stale.slice(i, i + 400).forEach((d) => batch.delete(d.ref));
        await batch.commit();
      }
      logger.info("purgeDeletedTasks done", {purged: stale.length});
    },
);
