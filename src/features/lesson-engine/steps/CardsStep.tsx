import { useEffect, useMemo, useState } from "react";
import type { FlashCardItem } from "../../../entities/story/types";
import { hapticSelection } from "../../../shared/lib/haptics";
import { speak, stopSpeaking } from "../../../shared/lib/speech";
import { FlashCard } from "../../../shared/ui/FlashCard";
import { useCompleteOnce } from "../lib/useCompleteOnce";
import type { StepComponent } from "../types";
import { StepCta } from "../ui/StepCta";
import styles from "./lessonEffects.module.css";

const sanitizeCards = (cards: unknown): FlashCardItem[] =>
    Array.isArray(cards)
        ? cards.filter(
            (card): card is FlashCardItem =>
                typeof card === "object" &&
                card !== null &&
                typeof (card as FlashCardItem).en === "string" &&
                typeof (card as FlashCardItem).uk === "string",
        )
        : [];

/**
 * Флешкартки по одній. Щоб піти далі, картку треба перевернути хоча б раз.
 * Кожен фліп озвучує англійське слово. Точки — прогрес; до вже побачених
 * карток можна повернутися.
 */
export const CardsStep: StepComponent<"cards"> = ({ step, onNext }) => {
    const cards = useMemo(() => sanitizeCards(step.cards), [step.cards]);
    const [index, setIndex] = useState(0);
    const [maxSeen, setMaxSeen] = useState(0);
    const [flipped, setFlipped] = useState<ReadonlySet<number>>(() => new Set());
    const complete = useCompleteOnce(onNext);

    useEffect(() => () => stopSpeaking(), []);

    const card = cards[index];
    const isLast = index >= cards.length - 1;
    const canContinue = !card || flipped.has(index);

    const handleFlip = () => {
        if (!card) return;
        setFlipped((prev) => new Set(prev).add(index));
        void speak(card.en);
    };

    const goTo = (target: number) => {
        setIndex(target);
        setMaxSeen((prev) => Math.max(prev, target));
        hapticSelection();
    };

    const handleCta = () => {
        if (!card || isLast) complete();
        else goTo(index + 1);
    };

    const ctaLabel = !canContinue ? "Переверни картку" : isLast ? "Далі" : "Наступна";

    return (
        <div className="flex flex-1 flex-col">
            {step.title && (
                <h2 className="pb-4 text-center text-lg font-bold text-[var(--text-muted)]">
                    {step.title}
                </h2>
            )}

            {card && (
                <div className="flex flex-1 flex-col items-center justify-center gap-5">
                    {/* key: нова картка монтується неперевернутою */}
                    <div key={index} className={`w-full max-w-sm ${styles.fadeIn}`}>
                        <FlashCard
                            front={card.en}
                            back={card.uk}
                            emoji={card.emoji}
                            onFlip={handleFlip}
                            className="h-64 w-full"
                        />
                    </div>

                    {cards.length > 1 && (
                        <div className="flex items-center gap-2" aria-label="Прогрес карток">
                            {cards.map((_, i) => {
                                const isCurrent = i === index;
                                const isReachable = i <= maxSeen && !isCurrent;
                                return (
                                    <button
                                        key={i}
                                        type="button"
                                        disabled={!isReachable}
                                        onClick={() => goTo(i)}
                                        aria-label={`Картка ${i + 1} з ${cards.length}`}
                                        aria-current={isCurrent ? "step" : undefined}
                                        className={`h-2.5 rounded-full transition-all duration-300 disabled:cursor-default ${isCurrent
                                                ? "w-6 bg-[var(--accent-cta)]"
                                                : flipped.has(i)
                                                    ? "w-2.5 bg-[var(--accent-cta)]/50"
                                                    : "w-2.5 bg-[var(--border-color)]"
                                            }`}
                                    />
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            <StepCta label={ctaLabel} disabled={!canContinue} onClick={handleCta} />
        </div>
    );
};