import { useMemo } from "react";
import { RichText } from "../../../shared/ui/RichText";
import { StepFeedback } from "../StepFeedback";
import { asText, toOptionTexts } from "../lib/sanitize";
import { useSingleChoiceCheck } from "../lib/useSingleChoiceCheck";
import type { StepComponent } from "../types";
import { OptionButton } from "../ui/OptionButton";
import { SpeechBubble } from "../ui/SpeechBubble";
import { StepCta } from "../ui/StepCta";

/** Класичний тест: питання (+ опційна репліка-контекст) і один правильний варіант */
export const QuizStep: StepComponent<"quiz"> = ({ step, onNext, onLoseLife }) => {
    const options = useMemo(() => toOptionTexts(step.options), [step.options]);
    const quiz = useSingleChoiceCheck({ options, correct: step.correct, onNext, onLoseLife });
    const npcPrompt = asText(step.npcPrompt);

    return (
        <div className="flex flex-1 flex-col">
            {npcPrompt && (
                <div className="pb-4">
                    <SpeechBubble text={npcPrompt} />
                </div>
            )}

            <p className="pb-5 text-xl font-bold text-[var(--text-main)]">
                <RichText text={asText(step.question)} />
            </p>

            <div className="flex flex-col gap-3">
                {options.map((option, i) => (
                    <OptionButton
                        key={i}
                        state={quiz.optionState(i)}
                        disabled={quiz.isOptionDisabled(i)}
                        onClick={() => quiz.select(i)}
                    >
                        <RichText text={option} />
                    </OptionButton>
                ))}
            </div>

            {quiz.phase === "correct" && (
                <StepFeedback
                    kind="correct"
                    detail={step.explanation ? <RichText text={asText(step.explanation)} /> : undefined}
                />
            )}
            {quiz.phase === "wrong" && <StepFeedback kind="wrong" />}

            <StepCta label={quiz.ctaLabel} disabled={quiz.ctaDisabled} onClick={quiz.handleCta} />
        </div>
    );
};