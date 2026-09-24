import { useMemo, useState } from "react";
import { hapticSelection } from "../../../shared/lib/haptics";
import type { OptionState } from "../ui/OptionButton";
import { resolveCorrectIndex } from "./sanitize";
import { useStepCheck } from "./useStepCheck";

interface Params {
    options: readonly string[];
    correct: unknown;
    onNext: () => void;
    onLoseLife?: () => void;
}

/**
 * Логіка "один правильний варіант" для quiz і listen:
 * вибір -> "Перевірити" -> правильно ("Далі") | неправильно (-1 життя, "Спробувати ще").
 * Уже спробувані хибні варіанти блокуються, тож урок завжди можна пройти.
 */
export function useSingleChoiceCheck({ options, correct, onNext, onLoseLife }: Params) {
    const correctIndex = useMemo(
        () => resolveCorrectIndex(options, correct),
        [options, correct],
    );
    const [selected, setSelected] = useState<number | null>(null);
    const [tried, setTried] = useState<ReadonlySet<number>>(() => new Set());
    const check = useStepCheck(onNext, onLoseLife);

    const select = (index: number) => {
        if (!check.isAnswering || tried.has(index)) return;
        setSelected(index);
        hapticSelection();
    };

    const optionState = (index: number): OptionState => {
        if (index !== selected) return "idle";
        if (check.phase === "correct") return "correct";
        if (check.phase === "wrong") return "wrong";
        return "selected";
    };

    const isOptionDisabled = (index: number) => !check.isAnswering || tried.has(index);

    const handleCta = () => {
        if (check.phase === "correct") return check.complete();
        if (check.phase === "wrong") {
            setSelected(null);
            return check.retry();
        }
        if (selected === null) return;

        if (correctIndex === -1) {
            // Биті дані (правильний варіант не знайдено) не повинні блокувати урок
            console.warn("[lesson-engine] correct answer not found in options", { options, correct });
            check.resolve("correct");
        } else if (selected === correctIndex) {
            check.resolve("correct");
        } else {
            setTried((prev) => new Set(prev).add(selected));
            check.resolve("wrong");
        }
    };

    const ctaLabel =
        check.phase === "correct" ? "Далі" : check.phase === "wrong" ? "Спробувати ще" : "Перевірити";

    return {
        phase: check.phase,
        select,
        optionState,
        isOptionDisabled,
        handleCta,
        ctaLabel,
        ctaDisabled: check.isAnswering && selected === null,
    };
}