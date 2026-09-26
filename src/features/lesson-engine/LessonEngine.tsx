// 📁 Файл: SnackEnglish-app/src/features/lesson-engine/LessonEngine.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import type { FC, ReactNode } from "react";
import type { StoryNodeContent } from "../../entities/story/types";
import { preloadVoices, stopSpeaking } from "../../shared/lib/speech";
import { Button } from "../../shared/ui/Button";
import { CookieMascot } from "../../shared/ui/CookieMascot";
import {
    DEFAULT_LESSON_LIVES,
    selectCurrentStep,
    selectIsFinished,
    selectIsOutOfLives,
    selectProgress,
    useLessonRuntimeStore,
} from "../../store/lessonRuntimeStore";
import { stepRegistry } from "./steps";
import type { StepComponentProps } from "./types";
import { StepCtaSlotContext } from "./ui/stepCtaSlot";
import { LessonNodeContext } from "./lib/lessonNodeContext";
import styles from "./steps/lessonEffects.module.css";

export interface LessonSummary {
    errors: number;
    livesLeft: number;
    perfect: boolean;
}

export interface LessonEngineProps {
    node: StoryNodeContent;
    /** Усі кроки пройдено (викликається один раз) */
    onComplete: (summary: LessonSummary) => void;
    /** Юзер вийшов з уроку (після підтвердження або з екрана поразки) */
    onExit: () => void;
    lives?: number;
}

interface EngineDialogProps {
    title: string;
    text: string;
    mascot: "thinking" | "sad";
    children: ReactNode;
}

const EngineDialog: FC<EngineDialogProps> = ({ title, text, mascot, children }) => (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/60 p-4 sm:items-center">
        <div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className={`w-full max-w-sm rounded-3xl border border-[var(--border-color)] bg-[var(--bg-card)] p-6 pb-[calc(env(safe-area-inset-bottom)+24px)] text-center shadow-2xl ${styles.bubbleIn}`}
        >
            <CookieMascot state={mascot} size={80} className="mx-auto" />
            <h2 className="mt-3 text-xl font-extrabold">{title}</h2>
            <p className="mt-1 text-[var(--text-muted)]">{text}</p>
            <div className="mt-5 flex flex-col gap-2">{children}</div>
        </div>
    </div>
);

/**
 * Прохід одного уроку: шапка (вихід, прогрес, життя), поточний крок,
 * футер-слот для CTA кроку. Стан — у lessonRuntimeStore.
 */
export const LessonEngine: FC<LessonEngineProps> = ({
    node,
    onComplete,
    onExit,
    lives = DEFAULT_LESSON_LIVES,
}) => {
    const startLesson = useLessonRuntimeStore((s) => s.startLesson);
    const resetLesson = useLessonRuntimeStore((s) => s.resetLesson);
    const nextStep = useLessonRuntimeStore((s) => s.nextStep);
    const loseLife = useLessonRuntimeStore((s) => s.loseLife);
    const insertSteps = useLessonRuntimeStore((s) => s.insertSteps);

    const activeNodeId = useLessonRuntimeStore((s) => s.node?.id ?? null);
    const step = useLessonRuntimeStore(selectCurrentStep);
    const stepIndex = useLessonRuntimeStore((s) => s.stepIndex);
    const livesLeft = useLessonRuntimeStore((s) => s.lives);
    const errors = useLessonRuntimeStore((s) => s.errorsInScene);
    const isFinished = useLessonRuntimeStore(selectIsFinished);
    const isOutOfLives = useLessonRuntimeStore(selectIsOutOfLives);
    const progress = useLessonRuntimeStore(selectProgress);

    const [slot, setSlot] = useState<HTMLElement | null>(null);
    // Персонаж уроку для кроків (репліки npc у діалозі)
    const nodeInfo = useMemo(() => ({ npc: node.npc, npcName: node.npcName }), [node.npc, node.npcName]);
    const [confirmExit, setConfirmExit] = useState(false);
    // Номер спроби: після "Почати знову" кроки монтуються заново навіть з тим самим stepIndex
    const [run, setRun] = useState(0);
    const completedRef = useRef(false);

    useEffect(() => {
        completedRef.current = false;
        startLesson(node, { lives });
        void preloadVoices();
        return () => {
            resetLesson();
            stopSpeaking();
        };
    }, [node, lives, startLesson, resetLesson]);

    // До першого startLesson у сторі може бути порожньо — не рендеримо чужий стан
    const isReady = activeNodeId === node.id;

    useEffect(() => {
        if (!isReady || !isFinished || completedRef.current) return;
        completedRef.current = true;
        stopSpeaking();
        onComplete({ errors, livesLeft, perfect: errors === 0 });
    }, [isReady, isFinished, errors, livesLeft, onComplete]);

    // Невідомий тип кроку (контент новіший за клієнт) — пропускаємо, а не зависаємо
    const Step = step
        ? (stepRegistry[step.type] as FC<StepComponentProps> | undefined)
        : undefined;
    useEffect(() => {
        if (isReady && step && !Step) {
            console.warn(`[LessonEngine] Unknown step type "${step.type}", skipping`);
            nextStep();
        }
    }, [isReady, step, Step, nextStep]);

    const restart = () => {
        completedRef.current = false;
        setRun((r) => r + 1);
        startLesson(node, { lives });
    };

    return (
        <div className="flex h-full flex-col bg-[var(--bg-app)] text-[var(--text-main)]">
            <header className="mx-auto flex w-full max-w-md items-center gap-3 px-4 pb-3 pt-[calc(env(safe-area-inset-top)+12px)]">
                <button
                    type="button"
                    onClick={() => setConfirmExit(true)}
                    aria-label="Вийти з уроку"
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xl text-[var(--text-muted)] hover:bg-[var(--bg-card)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-cta)]"
                >
                    ✕
                </button>
                <div
                    role="progressbar"
                    aria-label="Прогрес уроку"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.round(progress * 100)}
                    className="h-3 flex-1 overflow-hidden rounded-full bg-[var(--bg-card)]"
                >
                    <div
                        className="h-full rounded-full bg-[var(--accent-cta)] transition-[width] duration-500 ease-out"
                        style={{ width: `${Math.round(progress * 100)}%` }}
                    />
                </div>
                <div
                    aria-label={`Життя: ${livesLeft}`}
                    className="flex shrink-0 items-center gap-1 text-lg font-extrabold text-[var(--accent-error)]"
                >
                    <span aria-hidden="true">❤️</span>
                    <span>{livesLeft}</span>
                </div>
            </header>

            <main className="flex-1 overflow-y-auto px-5 py-4">
                <div className="mx-auto flex min-h-full max-w-md flex-col">
                    {isReady && step && Step && (
                        <LessonNodeContext.Provider value={nodeInfo}>
                            <StepCtaSlotContext.Provider value={slot}>
                                <Step
                                    key={`${run}-${stepIndex}`}
                                    step={step}
                                    onNext={nextStep}
                                    onLoseLife={loseLife}
                                    onInsertSteps={insertSteps}
                                />
                            </StepCtaSlotContext.Provider>
                        </LessonNodeContext.Provider>
                    )}
                </div>
            </main>

            {/* Сюди степи через портал рендерять свою головну кнопку */}
            <footer
                ref={setSlot}
                className="mx-auto w-full max-w-md px-5 pb-[calc(env(safe-area-inset-bottom)+16px)] pt-2"
            />

            {confirmExit && (
                <EngineDialog
                    title="Вийти з уроку?"
                    text="Прогрес цього уроку не збережеться."
                    mascot="thinking"
                >
                    <Button size="lg" onClick={() => setConfirmExit(false)}>
                        Продовжити урок
                    </Button>
                    <Button variant="ghost" onClick={onExit}>
                        Вийти
                    </Button>
                </EngineDialog>
            )}

            {isReady && isOutOfLives && !confirmExit && (
                <EngineDialog
                    title="Життя закінчились"
                    text="Не страшно — спробуй ще раз, Снекі вірить у тебе!"
                    mascot="sad"
                >
                    <Button size="lg" onClick={restart}>
                        Почати знову
                    </Button>
                    <Button variant="ghost" onClick={onExit}>
                        Вийти
                    </Button>
                </EngineDialog>
            )}
        </div>
    );
};