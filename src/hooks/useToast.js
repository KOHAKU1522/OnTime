import { useState, useCallback } from "react";

export function useToast() {
    const [toast, setToast] = useState(null);

    const showToast = useCallback((message, onUndo) => {
        setToast({ message, onUndo, id: Date.now() });
    }, []);

    const dismissToast = useCallback(() => {
        setToast(null);
    }, []);

    return { toast, showToast, dismissToast };
}
