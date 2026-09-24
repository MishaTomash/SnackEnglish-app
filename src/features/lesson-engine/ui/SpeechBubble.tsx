import type { FC } from "react";
import { stripRichText } from "../../../shared/lib/richText";
import { isSynthesisSupported, speak } from "../../../shared/lib/speech";
import { RichText } from "../../../shared/ui/RichText";

export interface SpeechBubbleProps {
    text: string; // en, RichText
    uk?: string;
    /** Показати кнопку озвучки (якщо синтез доступний) */
    speakable?: boolean;
}

/** Репліка персонажа-контексту: npcPrompt у quiz, prompt у reply */
export const SpeechBubble: FC<SpeechBubbleProps> = ({ text, uk, speakable = true }) => {
    const canSpeak = speakable && isSynthesisSupported();

    return (
        <div className="rounded-3xl rounded-tl-md border border-[var(--border-color)] bg-[var(--bg-card)] px-4 py-3 text-[var(--text-main)] shadow-md">
            <div className="flex items-start gap-2">
                <p className="text-lg font-semibold leading-snug">
                    <RichText text={text} />
                </p>
                {canSpeak && (
                    <button
                        type="button"
                        onClick={() => void speak(stripRichText(text))}
                        aria-label="Прослухати"
                        className="-mr-1 shrink-0 rounded-full p-1 leading-none opacity-70 hover:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-cta)]"
                    >
                        🔊
                    </button>
                )}
            </div>
            {uk && (
                <p className="mt-1 text-sm text-[var(--text-muted)]">
                    <RichText text={uk} />
                </p>
            )}
        </div>
    );
};