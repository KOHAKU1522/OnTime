// index.js
import * as functions from "firebase-functions";
import admin from "firebase-admin";

admin.initializeApp();

// 1分ごとに期限が近いタスクを通知する例
export const notifyTaskDeadline = functions.pubsub
  .schedule("every 1 minutes")
  .onRun(async () => {
    try {
      const db = admin.firestore();
      const now = new Date();

      // ここでは全ユーザーのタスクを対象にする例
      const usersSnap = await db.collection("users").get();

      for (const userDoc of usersSnap.docs) {
        const userId = userDoc.id;
        const tasksSnap = await db.collection("users").doc(userId).collection("tasks").get();

        tasksSnap.docs.forEach(taskDoc => {
          const task = taskDoc.data();
          if (task.completed) return;

          const deadline = task.deadline?.toDate ? task.deadline.toDate() : new Date(task.deadline);
          const diffMs = deadline - now;
          const diffMinutes = diffMs / (1000 * 60);

          // ここでは24時間以内のタスクを通知する例
          if (diffMinutes > 0 && diffMinutes <= 1440) {
            console.log(`ユーザー ${userId} のタスク "${task.taskName}" が期限間近です`);
            // 実際の通知処理はここで追加（メールやPushなど）
          }
        });
      }

      return null;
    } catch (err) {
      console.error("notifyTaskDeadline error:", err);
      return null;
    }
  });