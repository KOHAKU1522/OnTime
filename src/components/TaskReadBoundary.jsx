import { firestoreErrorMessage } from "../utils/firestoreError";

export default function TaskReadBoundary({ status, error, onRetry, children }) {
    if (status === "loading") return <p role="status">タスクを読み込んでいます…</p>;
    if (status === "error") return (
        <div role="alert">
            <p>{firestoreErrorMessage("タスクを読み込めませんでした", error)}</p>
            <button type="button" onClick={onRetry}>再試行</button>
        </div>
    );
    return children;
}
