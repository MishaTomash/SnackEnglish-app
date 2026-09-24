import { useMemo, useState } from "react";
import type { ReplyOption, ReplyQuality } from "../../../entities/story/types";
import { hapticSelection } from "../../../shared/lib/haptics";
import { stripRichText } from "../../../shared/lib/richText";
import { speak } from "../../../shared/lib/speech";
import { CookieMascot, toCookieState } from "../../../shared/ui/CookieMascot";
import type { CookieState } from "../../../shared/ui/CookieMascot";
import { RichText } from "../../../shared/ui/RichText";
import { StepFeedback } from "../StepFeedback";
import { objectsWithText } from "../lib/sanitize";
import type { FeedbackKind } from "../lib/snekieReactions";
import { useStepCheck } from "../lib/useStepCheck";
import type { StepComponent } from "../types";
import { OptionButton } from "../ui/OptionButton";
import type { OptionState } from "../ui/OptionButton";
import { SpeechBubble } from "../ui/SpeechBubble";
import { StepCta } from "../ui/StepCta";

const QUALITY_TO_KIND: Record<ReplyQuality, FeedbackKind> = {
    good: "correct",
    ok: "almost",
    bad: "wrong",
};

const QUALITY_TO_MASCOT: Record<ReplyQuality, CookieState> = {
    good: "happy",
    ok: "thinking",
    bad: "sad",
};

const KIND_TO_OPTION_STATE: Record<FeedbackKind, OptionState> = {
    correct: "correct",
    almost: "selected",
    wrong: "wrong",
};

const toQuality = (value: unknown): ReplyQuality =>
    value === "good" || value === "ok" ? value : "bad";

/**
 * Вибір репліки у розмові. good — далі; ok — "майже" без втрати життя;
 * bad — мінус життя. В обох останніх випадках можна спробувати ще раз,
 * уже випробувані варіанти блокуються.
 */
export const ReplyStep: StepComponent<"reply"> = ({ step, onNext, onLoseLife }) => {
    const options = useMemo(() => objectsWithText<ReplyOption>(step.options, "en"), [step.options]);
    const [selected, setSelected] = useState<number | null>(null);
    const [tried, setTried] = useState<ReadonlySet<number>>(() => new Set());
    const check = useStepCheck(onNext, onLoseLife);

    const chosen = selected === null ? undefined : options[selected];
    const resultKind = check.phase === "answering" ? null : check.phase;
    const chosenQuality = chosen ? toQuality(chosen.quality) : null;

    // Великий маскот реагує на відповідь; до відповіді — емоція з контенту
    const mascotState =
        resultKind && chosen && chosenQuality
            ? toCookieState(chosen.emotion, QUALITY_TO_MASCOT[chosenQuality])
            : toCookieState(step.emotion);

    const handleCta = () => {
        if (check.phase === "correct") return check.complete();
        if (!check.isAnswering) {
            setSelected(null);
            return check.retry();
        }
        if (!chosen || selected === null) {
            if (options.length === 0) check.complete(); // битий крок не блокує урок
            return;
        }

        void speak(stripRichText(chosen.en));
        const kind = QUALITY_TO_KIND[toQuality(chosen.quality)];
        if (kind !== "correct") setTried((prev) => new Set(prev).add(selected));
        check.resolve(kind);
    };

    const ctaLabel =
        check.phase === "correct" ? "Далі" : check.isAnswering ? "Відповісти" : "Спробувати ще";

    return (
        <div className="flex flex-1 flex-col">
            <div className="flex items-end gap-3 pb-5">
                <CookieMascot state={mascotState} size={72} className="shrink-0" />
                {step.prompt && (
                    <div className="min-w-0 flex-1">
                        <SpeechBubble text={step.prompt} uk={step.promptUk} />
                    </div>
                )}
            </div>

            <div className="flex flex-col gap-3">
                {options.map((option, i) => {
                    const isChosen = i === selected;
                    const state: OptionState =
                        isChosen && resultKind
                            ? KIND_TO_OPTION_STATE[resultKind]
                            : isChosen
                                ? "selected"
                                : "idle";
                    return (
                        <OptionButton
                            key={i}
                            state={state}
                            disabled={!check.isAnswering || tried.has(i)}
                            onClick={() => {
                                setSelected(i);
                                hapticSelection();
                            }}
                        >
                            <span className="min-w-0">
                                <RichText text={option.en} />
                                {option.uk && (
                                    <span className="block text-sm font-normal text-[var(--text-muted)]">
                                        {option.uk}
                                    </span>
                                )}
                            </span>
                        </OptionButton>
                    );
                })}
            </div>

            {resultKind && chosen && (
                <StepFeedback
                    kind={resultKind}
                    message={chosen.reaction}
                    showMascot={false}
                />
            )}

            <StepCta
                label={ctaLabel}
                disabled={check.isAnswering && selected === null && options.length > 0}
                onClick={handleCta}
            />
        </div>
    );
};