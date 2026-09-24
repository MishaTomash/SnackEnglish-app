import { useEffect, useMemo } from "react";
import { isSynthesisSupported, speak, stopSpeaking } from "../../../shared/lib/speech";
import { Button } from "../../../shared/ui/Button";
import { RichText } from "../../../shared/ui/RichText";
import { StepFeedback } from "../StepFeedback";
import { asText, toOptionTexts } from "../lib/sanitize";
import { useSingleChoiceCheck } from "../lib/useSingleChoiceCheck";
import type { StepComponent } from "../types";
import { OptionButton } from "../ui/OptionButton";
import { StepCta } from "../ui/StepCta";

const SLOW_RATE = 0.6;

/**
 * Аудіювання: фраза озвучується автоматично, є повтор і повільний режим.
 * Без синтезу мовлення фраза показується текстом, щоб крок лишався прохідним.
 */
export const ListenStep: StepComponent<"listen"> = ({ step, onNext, onLoseLife }) => {
    const audio = asText(step.audio);
    const options = useMemo(() => toOptionTexts(step.options), [step.options]);
    const listen = useSingleChoiceCheck({ options, correct: step.correct, onNext, onLoseLife });
    const canSpeak = isSynthesisSupported();

    useEffect(() => {
        if (audio) void speak(audio);
        return () => stopSpeaking();
    }, [audio]);

    return (
        <div className="flex flex-1 flex-col">
            <p className="pb-4 text-center text-lg font-bold text-[var(--text-muted)]">
                {asText(step.question) || "Послухай і обери, що почув"}
            </p>

            {canSpeak ? (
                <div className="flex justify-center gap-3 pb-6">
                    <Button variant="primary" size="md" onClick={() => void speak(audio)} aria-label="Прослухати ще раз">
                        🔊 Ще раз
                    </Button>
                    <Button variant="secondary" size="md" onClick={() => void speak(audio, { rate: SLOW_RATE })} aria-label="Прослухати повільно">
                        🐢 Повільно
                    </Button>
                </div>
            ) : (
                <div className="mb-6 rounded-2xl border border-dashed border-[var(--border-color)] p-4 text-center">
                    <p className="text-xs text-[var(--text-muted)]">Озвучка недоступна на цьому пристрої — прочитай фразу:</p>
                    <p className="mt-1 text-lg font-semibold">
                        <RichText text={audio} />
                    </p>
                </div>
            )}

            <div className="flex flex-col gap-3">
                {options.map((option, i) => (
                    <OptionButton
                        key={i}
                        state={listen.optionState(i)}
                        disabled={listen.isOptionDisabled(i)}
                        onClick={() => listen.select(i)}
                    >
                        <RichText text={option} />
                    </OptionButton>
                ))}
            </div>

            {listen.phase === "correct" && (
                // Після правильної відповіді показуємо, що саме звучало
                <StepFeedback kind="correct" detail={canSpeak && audio ? <>«{audio}»</> : undefined} />
            )}
            {listen.phase === "wrong" && <StepFeedback kind="wrong" />}

            <StepCta label={listen.ctaLabel} disabled={listen.ctaDisabled} onClick={listen.handleCta} />
        </div>
    );
};