import { useCallback, useEffect, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import { logFirestoreError } from "../utils/firestoreError";
import { watchTasks } from "../utils/taskSubscription";

export function useTasks(user) {
    const uid = user?.uid;
    const [attempt, setAttempt] = useState(0);
    const [state, setState] = useState(null);
    const retryTasks = useCallback(() => setAttempt(n => n + 1), []);
    useEffect(() => {
        if (!uid) return;
        const ref = collection(db, "users", uid, "tasks");
        return watchTasks({
            listen: (next, error) => onSnapshot(ref, { includeMetadataChanges: true }, next, error),
            onState: next => setState({ ...next, uid, attempt }),
            onError: error => logFirestoreError("タスクの購読", error, "users/{uid}/tasks"),
        });
    }, [uid, attempt]);
    // Hide the previous account's data immediately, before effect cleanup runs.
    const current = state?.uid === uid && state?.attempt === attempt ? state : null;
    return {
        tasks: uid ? current?.tasks ?? [] : [],
        tasksStatus: user === undefined ? "loading" : !uid ? "ready" : current?.status ?? "loading",
        tasksError: current?.error ?? null,
        retryTasks,
    };
}
