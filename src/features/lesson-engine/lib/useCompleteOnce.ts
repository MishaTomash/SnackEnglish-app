import { useCallback, useRef } from "react";

/**
 * Обгортка над onNext, що спрацьовує лише раз за життя кроку.
 * Захищає від подвійного тапу по CTA, який інакше перескочив би крок.
 */
export function useCompleteOnce(onNext: () => void): () => void {
    const doneRef = useRef(false);

    return useCallback(() => {
        if (doneRef.current) return;
        doneRef.current = true;
        onNext();
    }, [onNext]);
}