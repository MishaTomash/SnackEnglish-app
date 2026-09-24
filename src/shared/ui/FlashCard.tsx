import { useState } from "react";
import type { FC } from "react";
import { Card } from "./Card";

export interface FlashCardProps {
    front: string; // слово англійською
    back: string; // переклад
    emoji?: string;
    /** Викликається на кожен фліп; isFlipped — стан ПІСЛЯ фліпу */
    onFlip?: (isFlipped: boolean) => void;
    /** Розміри задаються тут (за замовчуванням w-full h-56) */
    className?: string;
}

// Спільна основа обох сторін: Card, розтягнута на весь контейнер,
// зі схованою зворотною стороною (інакше при повороті видно дзеркальний текст)
const FACE_CLASSES =
    "absolute inset-0 flex flex-col items-center justify-center gap-3 text-center [backface-visibility:hidden] [-webkit-backface-visibility:hidden]";

export const FlashCard: FC<FlashCardProps> = ({
    front,
    back,
    emoji,
    onFlip,
    className = "w-full h-56",
}) => {
    const [isFlipped, setIsFlipped] = useState(false);

    const handleClick = () => {
        const next = !isFlipped;
        setIsFlipped(next);
        onFlip?.(next);
    };

    return (
        <button
            type="button"
            onClick={handleClick}
            aria-pressed={isFlipped}
            aria-label={isFlipped ? `${back}. Показати слово` : `${front}. Показати переклад`}
            className={`group relative block rounded-3xl [perspective:1000px] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-cta)] active:scale-[0.98] ${className}`}
        >
            <div
                className={`relative h-full w-full transition-transform duration-500 ease-out motion-reduce:transition-none [transform-style:preserve-3d] ${isFlipped ? "[transform:rotateY(180deg)]" : ""
                    }`}
            >
                {/* Лицьова сторона: емодзі + слово */}
                <Card aria-hidden={isFlipped} className={`${FACE_CLASSES} group-hover:bg-[var(--bg-card-elevated)]`}>
                    {emoji && (
                        <span className="text-6xl leading-none" aria-hidden="true">
                            {emoji}
                        </span>
                    )}
                    <span className="text-3xl font-extrabold break-words">{front}</span>
                    <span className="text-xs text-[var(--text-muted)]">Торкнись, щоб перевернути</span>
                </Card>

                {/* Зворотна сторона: переклад */}
                <Card
                    aria-hidden={!isFlipped}
                    className={`${FACE_CLASSES} [transform:rotateY(180deg)]`}
                    // Через style, а не класи: інакше bg/border конфліктували б з класами Card
                    style={{
                        backgroundColor: "var(--bg-card-elevated)",
                        borderColor: "var(--accent-cta)",
                    }}
                >
                    {emoji && (
                        <span className="text-3xl leading-none opacity-80" aria-hidden="true">
                            {emoji}
                        </span>
                    )}
                    <span className="text-2xl font-bold text-[var(--accent-cta)] break-words">{back}</span>
                    <span className="text-sm text-[var(--text-muted)]">{front}</span>
                </Card>
            </div>
        </button>
    );
};