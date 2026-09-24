import { useEffect, useRef, useState } from "react";
import type { FC } from "react";
import { stripRichText } from "../../../shared/lib/richText";
import {
    bestMatch,
    isRecognitionSupported,
    isSynthesisSupported,
    listen,
    ListenError,
    speak,
    stopListening,
    stopSpeaking,
    wordDiff,
} from "../../../shared/lib/speech";
import type { ListenErrorCode, WordDiffResult } from "../../../shared/lib/speech";
import { RichText } from "../../../shared/ui/RichText";
import { StepFeedback } from "../StepFeedback";
import { asText } from "../lib/sanitize";
import { useStepCheck } from "../lib/useStepCheck";
import type { StepComponent } from "../types";
import { StepCta } from "../ui/StepCta";

/** Поріг схожості сказаного з еталоном (bestMatch), як у прототипі */
export const VOICE_PASS_THRESHOLD = 0.55;

/**
 * Чи знімати життя за невдалу спробу. Вимкнено: розпізнавання мовлення помиляється
 * саме по собі (шум, акцент, WebView), і карати за це гравця несправедливо.
 */
const VOICE_COSTS_LIFE = false;

/** Після скількох невдалих спроб з'являється "Пропустити" */
const ATTEMPTS_BEFORE_SKIP = 2;

// Коли мікрофон недоступний у принципі — одразу дозволяємо пропуск
const BLOCKING_ERRORS: ReadonlySet<ListenErrorCode> = new Set([
    "not-supported",
    "not-allowed",
    "audio-capture",
    "language-not-supported",
]);

const ERROR_MESSAGES: Partial<Record<ListenErrorCode, string>> = {
    "not-allowed": "Немає доступу до мікрофона. Дозволь його в налаштуваннях або пропусти вправу.",
    "audio-capture": "Мікрофон не знайдено.",
    "no-speech": "Нічого не почув 🤔 Натисни мікрофон і скажи фразу.",
    network: "Проблема з мережею під час розпізнавання. Спробуй ще раз.",
    "language-not-supported": "Розпізнавання англійської недоступне на цьому пристрої.",
};

const DiffLine: FC<{ diff: WordDiffResult }> = ({ diff }) => (
    <p className="flex flex-wrap gap-x-1.5 gap-y-1 text-base" aria-label="Що вдалося розпізнати">
        {diff.tokens.map((token, i) => (
            <span
                key={i}
                className={
                    token.status === "match"
                        ? "font-semibold text-[var(--accent-success)]"
                        : token.status === "missing"
                            ? "text-[var(--text-muted)] underline decoration-dotted"
                            : "text-[var(--accent-error)] line-through"
                }
            >
                {token.word}
            </span>
        ))}
    </p>
);

/**
 * Вимова: юзер натискає мікрофон і каже фразу; кращий із варіантів розпізнавання
 * порівнюється з еталоном (bestMatch). Показується пословний розбір.
 * Без розпізнавання мовлення (частина WebView) крок можна пропустити.
 */
export const VoiceStep: StepComponent<"voice"> = ({ step, onNext, onLoseLife }) => {
    const phrase = stripRichText(asText(step.phrase));
    const check = useStepCheck(onNext, onLoseLife);
    const [isListening, setIsListening] = useState(false);
    const [diff, setDiff] = useState<WordDiffResult | null>(null);
    const [error, setError] = useState<ListenErrorCode | null>(null);
    const abortRef = useRef<AbortController | null>(null);

    const recognitionSupported = isRecognitionSupported();
    const canSpeak = isSynthesisSupported();

    // Вихід з кроку — зупинити і мікрофон, і озвучку
    useEffect(
        () => () => {
            abortRef.current?.abort();
            stopSpeaking();
        },
        [],
    );

    const startListening = async () => {
        if (isListening) {
            stopListening(); // повторний тап — "я закінчив", віддати почуте
            return;
        }
        if (check.phase === "wrong") check.retry(); // тап по мікрофону після помилки = нова спроба
        setError(null);
        setDiff(null);
        setIsListening(true);

        const controller = new AbortController();
        abortRef.current = controller;

        try {
            const result = await listen({ signal: controller.signal });
            const match = bestMatch(result.alternatives, [phrase]);
            setDiff(wordDiff(phrase, match?.input ?? result.transcript));
            check.resolve((match?.score ?? 0) >= VOICE_PASS_THRESHOLD ? "correct" : "wrong", {
                costsLife: VOICE_COSTS_LIFE,
            });
        } catch (e) {
            if (controller.signal.aborted) return; // крок закрито — нічого не оновлюємо
            const code = e instanceof ListenError ? e.code : "unknown";
            if (code !== "aborted") setError(code);
        } finally {
            if (!controller.signal.aborted) setIsListening(false);
        }
    };

    const handleRetry = () => {
        setDiff(null);
        check.retry();
    };

    const canSkip =
        !recognitionSupported ||
        (error !== null && BLOCKING_ERRORS.has(error)) ||
        check.attempt >= ATTEMPTS_BEFORE_SKIP;

    const micDisabled = !recognitionSupported || check.phase === "correct";

    return (
        <div className="flex flex-1 flex-col">
            <p className="pb-2 text-center text-sm font-bold uppercase tracking-wide text-[var(--text-muted)]">
                Скажи вголос
            </p>

            <div className="flex items-start justify-center gap-2 pb-1">
                <p className="text-center text-2xl font-extrabold text-[var(--text-main)]">
                    <RichText text={asText(step.phrase)} />
                </p>
                {canSpeak && (
                    <button
                        type="button"
                        onClick={() => void speak(phrase)}
                        aria-label="Прослухати зразок"
                        className="shrink-0 rounded-full p-1 text-xl leading-none opacity-70 hover:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-cta)]"
                    >
                        🔊
                    </button>
                )}
            </div>
            {step.uk && (
                <p className="pb-6 text-center text-[var(--text-muted)]">
                    <RichText text={asText(step.uk)} />
                </p>
            )}

            <div className="flex flex-col items-center gap-3 py-4">
                <button
                    type="button"
                    onClick={() => void startListening()}
                    disabled={micDisabled}
                    aria-pressed={isListening}
                    aria-label={isListening ? "Зупинити запис" : "Почати запис"}
                    className={`relative flex h-24 w-24 items-center justify-center rounded-full border-b-4 text-4xl transition-all focus:outline-none focus-visible:ring-4 focus-visible:ring-[var(--accent-cta)]/50 active:translate-y-1 active:border-b-0 disabled:opacity-40 ${isListening
                            ? "border-[var(--accent-error-hover)] bg-[var(--accent-error)]"
                            : "border-[var(--accent-cta-active)] bg-[var(--accent-cta)]"
                        }`}
                >
                    {isListening && (
                        <span className="absolute inset-0 animate-ping rounded-full bg-[var(--accent-error)]/40" aria-hidden="true" />
                    )}
                    <span className="relative" aria-hidden="true">
                        {isListening ? "⏹" : "🎤"}
                    </span>
                </button>
                <p className="min-h-5 text-sm text-[var(--text-muted)]" aria-live="polite">
                    {!recognitionSupported
                        ? "Розпізнавання мовлення недоступне на цьому пристрої."
                        : isListening
                            ? "Слухаю…"
                            : error
                                ? (ERROR_MESSAGES[error] ?? "Не вдалося розпізнати. Спробуй ще раз.")
                                : check.phase === "correct"
                                    ? ""
                                    : "Натисни і скажи фразу"}
                </p>
            </div>

            {diff && diff.tokens.length > 0 && (
                <div className="rounded-2xl bg-[var(--bg-card)] p-3">
                    <DiffLine diff={diff} />
                </div>
            )}

            {check.phase === "correct" && <StepFeedback kind="correct" />}
            {check.phase === "wrong" && (
                <StepFeedback
                    kind="wrong"
                    detail={diff ? `Збіг слів: ${diff.matched} з ${diff.total}` : undefined}
                />
            )}

            {check.phase === "correct" ? (
                <StepCta label="Далі" onClick={check.complete} />
            ) : canSkip ? (
                <StepCta label="Пропустити" onClick={check.complete} />
            ) : check.phase === "wrong" ? (
                <StepCta label="Спробувати ще" onClick={handleRetry} />
            ) : null}
        </div>
    );
};