// 📁 Файл: SnackEnglish-app/src/features/lesson-engine/steps/DialogueStep.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import type { FC } from "react";
import type { DialogueLine } from "../../../entities/story/types";
import { isSynthesisSupported, speak, stopSpeaking } from "../../../shared/lib/speech";
import { CookieMascot, toCookieState } from "../../../shared/ui/CookieMascot";
import { RichText } from "../../../shared/ui/RichText";
import { useCompleteOnce } from "../lib/useCompleteOnce";
import type { StepComponent } from "../types";
import { StepCta } from "../ui/StepCta";
import { useLessonNode } from "../lib/lessonNodeContext";
import styles from "./lessonEffects.module.css";

// Дані з БД зберігаються як Mixed — відкидаємо биті репліки, а не падаємо
const sanitizeLines = (lines: unknown): DialogueLine[] =>
    Array.isArray(lines)
        ? lines.filter(
            (line): line is DialogueLine =>
                typeof line === "object" &&
                line !== null &&
                typeof (line as DialogueLine).en === "string",
        )
        : [];

interface BubbleProps {
    line: DialogueLine;
    canSpeak: boolean;
    /** Ім'я персонажа уроку — над його репліками */
    npcName: string;
}

const Bubble: FC<BubbleProps> = ({ line, canSpeak, npcName }) => {
    const isUser = line.speaker === "user";
    const isNpc = line.speaker === "npc";

    return (
        <div className={`flex ${isUser ? "justify-end" : "justify-start"} ${styles.bubbleIn}`}>
            <div
                className={`max-w-[85%] rounded-3xl px-4 py-3 shadow-md ${isUser
                    ? "rounded-br-md bg-[var(--accent-cta)] text-[var(--text-accent)]"
                    : isNpc
                        ? "rounded-bl-md border border-sky-500/40 bg-sky-500/10 text-[var(--text-main)]"
                        : "rounded-bl-md border border-[var(--border-color)] bg-[var(--bg-card)] text-[var(--text-main)]"
                    }`}
            >
                {isNpc && (
                    <p className="mb-1 text-xs font-extrabold uppercase tracking-wide text-sky-400">
                        {npcName || "Персонаж"}
                    </p>
                )}
                <div className="flex items-start gap-2">
                    <p className="text-lg font-semibold leading-snug">
                        <RichText
                            text={line.en}
                            // На помаранчевій бульбашці юзера акцентний колір зливається з фоном
                            wordClassName={isUser ? "font-extrabold decoration-current" : undefined}
                        />
                    </p>
                    {canSpeak && (
                        <button
                            type="button"
                            onClick={() => void speak(line.en)}
                            aria-label="Прослухати репліку"
                            className="-mr-1 shrink-0 rounded-full p-1 text-base leading-none opacity-70 transition-opacity hover:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-current"
                        >
                            🔊
                        </button>
                    )}
                </div>
                {line.uk && (
                    <p className={`mt-1 text-sm ${isUser ? "opacity-80" : "text-[var(--text-muted)]"}`}>
                        <RichText
                            text={line.uk}
                            wordClassName={isUser ? "font-bold decoration-current" : undefined}
                        />
                    </p>
                )}
            </div>
        </div>
    );
};

/**
 * Діалог: репліки з'являються по одній (CTA відкриває наступну),
 * кожна нова озвучується. Маскот показує емоцію останньої репліки Снекі.
 */
export const DialogueStep: StepComponent<"dialogue"> = ({ step, onNext }) => {
    const lines = useMemo(() => sanitizeLines(step.lines), [step.lines]);
    const [visibleCount, setVisibleCount] = useState(() => Math.min(1, lines.length));
    const complete = useCompleteOnce(onNext);
    const lastBubbleRef = useRef<HTMLDivElement>(null);
    const canSpeak = isSynthesisSupported();

    const visibleLines = lines.slice(0, visibleCount);
    const currentLine = visibleLines[visibleLines.length - 1];
    // Маскот реагує лише на репліки Снекі (не юзера й не персонажа уроку)
    const lastSnackyLine = [...visibleLines].reverse().find((l) => l.speaker === "snacky");
    const { npcName } = useLessonNode();
    const isLastLine = visibleCount >= lines.length;

    // Нова репліка: озвучити і прокрутити до неї
    useEffect(() => {
        if (!currentLine) return;
        void speak(currentLine.en);
        lastBubbleRef.current?.scrollIntoView?.({ behavior: "smooth", block: "nearest" });
    }, [currentLine]);

    // Вихід з кроку — замовкнути
    useEffect(() => () => stopSpeaking(), []);

    const handleCta = () => {
        if (isLastLine) complete();
        else setVisibleCount((count) => Math.min(count + 1, lines.length));
    };

    return (
        <div className="flex flex-1 flex-col">
            <div className="flex justify-center pb-4">
                <CookieMascot state={toCookieState(lastSnackyLine?.emotion)} size={88} />
            </div>

            <div className="flex flex-col gap-3" aria-live="polite">
                {visibleLines.map((line, i) => (
                    <div key={i} ref={i === visibleLines.length - 1 ? lastBubbleRef : undefined}>
                        <Bubble line={line} canSpeak={canSpeak} npcName={npcName} />
                    </div>
                ))}
            </div>

            <StepCta onClick={handleCta} />
        </div>
    );
};