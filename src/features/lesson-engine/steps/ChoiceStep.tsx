import { useMemo, useRef, useState } from "react";
import type { ChoiceOption } from "../../../entities/story/types";
import { hapticSelection } from "../../../shared/lib/haptics";
import { RichText } from "../../../shared/ui/RichText";
import { objectsWithText, sanitizeSteps } from "../lib/sanitize";
import { useCompleteOnce } from "../lib/useCompleteOnce";
import type { StepComponent } from "../types";
import { OptionButton } from "../ui/OptionButton";
import { StepCta } from "../ui/StepCta";
import styles from "./lessonEffects.module.css";

/**
 * Сюжетний вибір без правильної відповіді. Гілка (outcome) вставляється
 * одразу після цього кроку, потім onNext() веде в неї.
 */
export const ChoiceStep: StepComponent<"choice"> = ({ step, onNext, onInsertSteps }) => {
    const options = useMemo(() => objectsWithText<ChoiceOption>(step.options, "text"), [step.options]);
    const [selected, setSelected] = useState<number | null>(null);
    const complete = useCompleteOnce(onNext);
    // Замок на весь вибір, а не лише на onNext: інакше подвійний тап вставив би гілку двічі
    const confirmedRef = useRef(false);

    const handleConfirm = () => {
        const option = selected === null ? undefined : options[selected];
        if (confirmedRef.current || (options.length > 0 && !option)) return;
        confirmedRef.current = true;

        const branch = sanitizeSteps(option?.outcome);
        if (branch.length > 0) onInsertSteps?.(branch);
        complete();
    };

    return (
        <div className="flex flex-1 flex-col">
            {step.prompt && (
                <p className={`pb-5 text-center text-xl font-bold text-[var(--text-main)] ${styles.fadeIn}`}>
                    <RichText text={step.prompt} />
                </p>
            )}

            <div className="flex flex-col gap-3">
                {options.map((option, i) => (
                    <OptionButton
                        key={i}
                        state={selected === i ? "selected" : "idle"}
                        onClick={() => {
                            setSelected(i);
                            hapticSelection();
                        }}
                    >
                        {option.icon && (
                            <span className="text-2xl leading-none" aria-hidden="true">
                                {option.icon}
                            </span>
                        )}
                        <span className="min-w-0">
                            <RichText text={option.text} />
                            {option.uk && (
                                <span className="block text-sm font-normal text-[var(--text-muted)]">{option.uk}</span>
                            )}
                        </span>
                    </OptionButton>
                ))}
            </div>

            <StepCta
                label="Обрати"
                disabled={options.length > 0 && selected === null}
                onClick={handleConfirm}
            />
        </div>
    );
};