import { useEffect, useRef, useState } from "react";
import type { FC } from "react";
import { stripRichText } from "../../../shared/lib/richText";
import {
    bestMatch,
    getSpeechMode,
    isRecognitionSupported,
    isSynthesisSupported,
    listen,
    ListenError,
    loadSpeechMode,
    speak,
    stopListening,
    stopSpeaking,
    wordDiff,
} from "../../../shared/lib/speech";
import type { ListenErrorCode, ListenPhase, SpeechMode, WordDiffResult } from "../../../shared/lib/speech";
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
 * саме по собі (шум, акцент, мікрофон), і карати за це гравця несправедливо.
 */
const VOICE_COSTS_LIFE = false;

/** Після скількох невдалих спроб з'являється "Пропустити" */
const ATTEMPTS_BEFORE_SKIP = 2;

/** Максимальна довжина запису фрази */
const MAX_RECORD_MS = 6000;

// Мікрофон недоступний або сервіс не відповідає — одразу дозволяємо пропуск
const BLOCKING_ERRORS: ReadonlySet<ListenErrorCode> = new Set([
    "not-supported",
    "not-allowed",
    "audio-capture",
    "network",
    "server",
    "rate-limited",
    "language-not-supported",
]);

const ERROR_MESSAGES: Partial<Record<ListenErrorCode, string>> = {
    "not-allowed":
        "Немає дозволу на мікрофон. Дозволь доступ у налаштуваннях Telegram або браузера і спробуй ще раз — або пропусти вправу.",
    "audio-capture": "Мікрофон не знайдено або він зайнятий іншою програмою.",
    "no-speech": "Не почули 🤔 Скажи фразу трохи голосніше й ближче до мікрофона.",
    network: "Немає зв'язку з сервером. Перевір інтернет і спробуй ще раз.",
    server: "Сервіс розпізнавання тимчасово не працює. Спробуй пізніше або пропусти вправу.",
    "rate-limited": "Забагато спроб поспіль. Зачекай хвилинку і спробуй знову.",
    "language-not-supported": "Розпізнавання англійської недоступне на цьому пристрої.",
};

// Чому розпізнавання недоступне — залежить від режиму, який обрав сервер
const NOT_SUPPORTED_MESSAGES: Record<SpeechMode, string> = {
    server: "Тут не вийде записати голос: ця версія Telegram чи браузера не дає доступу до мікрофона. Пропусти вправу — життя не зніметься.",
    browser: "Безкоштовне розпізнавання голосу працює лише в браузерах Chrome та Edge. Тут вправу можна пропустити — життя не зніметься.",
    off: "Вправи з голосом зараз вимкнені. Пропусти цю — життя не зніметься.",
};

/** У режимі "browser" помилка "network" майже завжди означає Telegram/WebView, а не інтернет */
const BROWSER_NETWORK_MESSAGE =
    "Розпізнавання браузера тут не працює (так буває в Telegram). Пропусти вправу — життя не зніметься.";

type MicState = "idle" | ListenPhase;

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
 * Вимова: юзер натискає мікрофон і каже фразу. Запис іде на сервер, розпізнаний
 * текст порівнюється з еталоном (bestMatch) тут, на клієнті. Показується пословний розбір.
 * Якщо запис голосу в цьому середовищі неможливий — крок можна пропустити.
 */
export const VoiceStep: StepComponent<"voice"> = ({ step, onNext, onLoseLife }) => {
    const phrase = stripRichText(asText(step.phrase));
    const check = useStepCheck(onNext, onLoseLife);
    // Режим розпізнавання з сервера; null — ще завантажується (зазвичай частки секунди)
    const [speechMode, setSpeechMode] = useState<SpeechMode | null>(() => getSpeechMode());
    const [micState, setMicState] = useState<MicState>("idle");
    const [diff, setDiff] = useState<WordDiffResult | null>(null);
    const [error, setError] = useState<ListenErrorCode | null>(null);
    // Невдалі спроби: неправильна фраза або "не почули"
    const [failedAttempts, setFailedAttempts] = useState(0);
    const abortRef = useRef<AbortController | null>(null);
    // Анімацію рівня звуку оновлюємо напряму в DOM — без ререндеру 60 разів на секунду
    const levelRingRef = useRef<HTMLSpanElement | null>(null);
    const timeBarRef = useRef<HTMLDivElement | null>(null);

    const modeReady = speechMode !== null;
    const recordingSupported = modeReady && isRecognitionSupported();
    const canSpeak = isSynthesisSupported();
    const isRecording = micState === "recording";
    const isProcessing = micState === "processing";

    useEffect(() => {
        if (speechMode) return;
        let alive = true;
        void loadSpeechMode().then((mode) => {
            if (alive) setSpeechMode(mode);
        });
        return () => {
            alive = false;
        };
    }, [speechMode]);

    // Вихід з кроку — зупинити і мікрофон (з запитом на сервер), і озвучку
    useEffect(
        () => () => {
            abortRef.current?.abort();
            stopSpeaking();
        },
        [],
    );

    const handleLevel = (level: number, elapsedMs: number) => {
        if (levelRingRef.current) {
            levelRingRef.current.style.transform = `scale(${1 + level * 0.45})`;
        }
        if (timeBarRef.current) {
            const left = Math.max(0, 1 - elapsedMs / MAX_RECORD_MS);
            timeBarRef.current.style.width = `${left * 100}%`;
        }
    };

    const startListening = async () => {
        if (isRecording) {
            stopListening(); // повторний тап — "я закінчив", розпізнати записане
            return;
        }
        if (isProcessing) return;
        if (check.phase === "wrong") check.retry(); // тап по мікрофону після помилки = нова спроба
        setError(null);
        setDiff(null);
        setMicState("recording");

        const controller = new AbortController();
        abortRef.current = controller;

        try {
            const result = await listen({
                signal: controller.signal,
                timeoutMs: MAX_RECORD_MS,
                onLevel: handleLevel,
                onPhase: (phase) => {
                    if (!controller.signal.aborted) setMicState(phase);
                },
            });
            const match = bestMatch(result.alternatives, [phrase]);
            setDiff(wordDiff(phrase, match?.input ?? result.transcript));
            const passed = (match?.score ?? 0) >= VOICE_PASS_THRESHOLD;
            if (!passed) setFailedAttempts((n) => n + 1);
            check.resolve(passed ? "correct" : "wrong", { costsLife: VOICE_COSTS_LIFE });
        } catch (e) {
            if (controller.signal.aborted) return; // крок закрито — нічого не оновлюємо
            const code = e instanceof ListenError ? e.code : "unknown";
            if (code === "aborted") return;
            if (code === "no-speech" || code === "unknown") setFailedAttempts((n) => n + 1);
            setError(code);
        } finally {
            if (!controller.signal.aborted) setMicState("idle");
        }
    };

    const handleRetry = () => {
        setDiff(null);
        setError(null);
        check.retry();
    };

    const canSkip =
        (modeReady && !recordingSupported) ||
        (error !== null && BLOCKING_ERRORS.has(error)) ||
        failedAttempts >= ATTEMPTS_BEFORE_SKIP ||
        check.attempt >= ATTEMPTS_BEFORE_SKIP;

    const micDisabled = !recordingSupported || isProcessing || check.phase === "correct";

    const errorMessage =
        error === "network" && speechMode === "browser"
            ? BROWSER_NETWORK_MESSAGE
            : error
                ? (ERROR_MESSAGES[error] ?? "Не вдалося розпізнати. Спробуй ще раз.")
                : "";

    const hint = !speechMode
        ? "Готую мікрофон…"
        : !recordingSupported
            ? NOT_SUPPORTED_MESSAGES[speechMode]
            : isRecording
                ? "Слухаю… Натисни ⏹, коли закінчиш"
                : isProcessing
                    ? "Розпізнаю…"
                    : error
                        ? errorMessage
                        : check.phase === "correct"
                            ? ""
                            : "Натисни мікрофон і скажи фразу";

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
                        disabled={isRecording}
                        aria-label="Прослухати зразок"
                        className="shrink-0 rounded-full p-1 text-xl leading-none opacity-70 hover:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-cta)] disabled:opacity-30"
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
                    aria-pressed={isRecording}
                    aria-busy={isProcessing}
                    aria-label={isRecording ? "Зупинити запис" : isProcessing ? "Розпізнаю" : "Почати запис"}
                    className={`relative flex h-24 w-24 items-center justify-center rounded-full border-b-4 text-4xl transition-all focus:outline-none focus-visible:ring-4 focus-visible:ring-[var(--accent-cta)]/50 active:translate-y-1 active:border-b-0 disabled:opacity-40 ${isRecording
                        ? "border-[var(--accent-error-hover)] bg-[var(--accent-error)]"
                        : "border-[var(--accent-cta-active)] bg-[var(--accent-cta)]"
                        } ${isProcessing ? "disabled:opacity-80" : ""}`}
                >
                    {isRecording && (
                        <>
                            {/* Кільце, що дихає в такт голосу */}
                            <span
                                ref={levelRingRef}
                                className="absolute inset-0 rounded-full bg-[var(--accent-error)]/35 transition-transform duration-75"
                                aria-hidden="true"
                            />
                            <span
                                className="absolute inset-0 rounded-full bg-[var(--accent-error)]/30 motion-safe:animate-ping"
                                aria-hidden="true"
                            />
                        </>
                    )}
                    {isProcessing ? (
                        <span
                            className="relative h-9 w-9 rounded-full border-4 border-[var(--text-accent)] border-t-transparent motion-safe:animate-spin"
                            aria-hidden="true"
                        />
                    ) : (
                        <span className="relative" aria-hidden="true">
                            {isRecording ? "⏹" : "🎤"}
                        </span>
                    )}
                </button>

                {/* Скільки часу на запис лишилось */}
                <div
                    className={`h-1.5 w-32 overflow-hidden rounded-full bg-[var(--bg-card)] transition-opacity ${isRecording ? "opacity-100" : "opacity-0"}`}
                    aria-hidden="true"
                >
                    {isRecording && (
                        <div
                            ref={timeBarRef}
                            className="h-full rounded-full bg-[var(--accent-error)]"
                            style={{ width: "100%" }}
                        />
                    )}
                </div>

                <p className="min-h-5 max-w-xs text-center text-sm text-[var(--text-muted)]" aria-live="polite">
                    {hint}
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
            ) : canSkip && !isRecording && !isProcessing ? (
                <StepCta label="Пропустити" onClick={check.complete} />
            ) : check.phase === "wrong" && !isRecording && !isProcessing ? (
                <StepCta label="Спробувати ще" onClick={handleRetry} />
            ) : null}
        </div>
    );
};