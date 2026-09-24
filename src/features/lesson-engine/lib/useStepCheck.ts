import { useCallback, useRef, useState } from "react";
import { hapticNotify } from "../../../shared/lib/haptics";
import type { FeedbackKind } from "./snekieReactions";
import { useCompleteOnce } from "./useCompleteOnce";

export type CheckPhase = "answering" | FeedbackKind;

interface ResolveOptions {
    /** За замовчуванням життя знімає лише "wrong" */
    costsLife?: boolean;
}

/**
 * Спільний цикл кроку з перевіркою: відповідь -> результат -> (далі | повтор).
 * Результат фіксується один раз за спробу: подвійний тап по "Перевірити"
 * не зніме два життя.
 */
export function useStepCheck(onNext: () => void, onLoseLife?: () => void) {
    const [phase, setPhase] = useState<CheckPhase>("answering");
    const [attempt, setAttempt] = useState(0); // кількість невдалих спроб
    const lockedRef = useRef(false);
    const complete = useCompleteOnce(onNext);

    const resolve = useCallback(
        (result: FeedbackKind, { costsLife }: ResolveOptions = {}) => {
            if (lockedRef.current) return;
            lockedRef.current = true;
            setPhase(result);

            if (result === "correct") {
                hapticNotify("success");
                return;
            }
            setAttempt((count) => count + 1);
            hapticNotify(result === "wrong" ? "error" : "warning");
            if (costsLife ?? result === "wrong") onLoseLife?.();
        },
        [onLoseLife],
    );

    const retry = useCallback(() => {
        lockedRef.current = false;
        setPhase("answering");
    }, []);

    return {
        phase,
        attempt,
        isAnswering: phase === "answering",
        resolve,
        retry,
        complete,
    };
}