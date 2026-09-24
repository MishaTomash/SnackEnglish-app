import { useEffect, useMemo, useRef, useState } from "react";
import type { FC } from "react";
import {
    INITIAL_PLACEMENT_STATE,
    PLACEMENT_LEVELS,
    answerPlacement,
    currentQuestion,
    placementResult,
} from "../lib/levelPlacement";
import type { PlacementLevel, PlacementState } from "../lib/levelPlacement";
import { shuffle } from "../lib/shuffle";
import { Button } from "./Button";
import { CookieMascot } from "./CookieMascot";

export interface LevelPlacementTestProps {
    /** Тест пройдено — визначений рівень */
    onFinish: (level: PlacementLevel) => void;
    /** Юзер вийшов з тесту */
    onCancel: () => void;
}

/** Затримка після тапу — юзер бачить, що вибір прийнято */
const ANSWER_DELAY_MS = 250;
const IDK = "__idk__"; // "Не знаю" рахується як неправильна відповідь

/**
 * Короткий тест рівня англійської (A1–C2). Правильність відповідей не
 * показується — це визначення рівня, а не урок.
 */
export const LevelPlacementTest: FC<LevelPlacementTestProps> = ({ onFinish, onCancel }) => {
    const [state, setState] = useState<PlacementState>(INITIAL_PLACEMENT_STATE);
    const [selected, setSelected] = useState<string | null>(null);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const finishedRef = useRef(false);

    const question = currentQuestion(state);
    const level = PLACEMENT_LEVELS[state.levelIndex];

    // Порядок варіантів перемішується один раз для кожного питання
    const options = useMemo(
        () => (question ? shuffle(question.options) : []),
        [question],
    );

    useEffect(() => () => {
        if (timerRef.current) clearTimeout(timerRef.current);
    }, []);

    // Тест завершено — повідомляємо батьківський компонент рівно один раз
    useEffect(() => {
        if (state.finished && !finishedRef.current) {
            finishedRef.current = true;
            onFinish(placementResult(state));
        }
    }, [state, onFinish]);

    const answer = (option: string) => {
        if (!question || selected !== null) return; // захист від подвійного тапу
        setSelected(option);
        timerRef.current = setTimeout(() => {
            setState((prev) => answerPlacement(prev, option === question.answer));
            setSelected(null);
        }, ANSWER_DELAY_MS);
    };

    const ladderProgress = Math.round((state.levelIndex / PLACEMENT_LEVELS.length) * 100);

    return (
        <div className="mx-auto flex min-h-[100dvh] w-full max-w-md flex-col px-5 pb-[calc(env(safe-area-inset-bottom)+20px)] pt-[calc(env(safe-area-inset-top)+12px)] text-[var(--text-main)]">
            <header className="flex items-center gap-3">
                <button
                    type="button"
                    onClick={onCancel}
                    aria-label="Вийти з тесту"
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xl text-[var(--text-muted)] hover:bg-[var(--bg-card)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-cta)]"
                >
                    ✕
                </button>
                <div
                    role="progressbar"
                    aria-label="Прогрес тесту"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={ladderProgress}
                    className="h-3 flex-1 overflow-hidden rounded-full bg-[var(--bg-card)]"
                >
                    <div
                        className="h-full rounded-full bg-[var(--accent-cta)] transition-[width] duration-500 ease-out"
                        style={{ width: `${Math.max(ladderProgress, 4)}%` }}
                    />
                </div>
                <span className="shrink-0 rounded-full bg-[var(--bg-card)] px-3 py-1 text-sm font-extrabold" aria-label={`Рівень питання: ${level}`}>
                    {level}
                </span>
            </header>

            {question ? (
                <main className="flex flex-1 flex-col">
                    <div className="flex flex-col items-center gap-3 pb-6 pt-8 text-center">
                        <CookieMascot state="thinking" size={72} />
                        <p className="text-sm text-[var(--text-muted)]">
                            Питання {state.answered + 1} · обери правильний варіант
                        </p>
                        <h1 className="text-2xl font-extrabold leading-snug">{question.prompt}</h1>
                    </div>

                    <div className="flex flex-col gap-3">
                        {options.map((option) => (
                            <button
                                key={option}
                                type="button"
                                onClick={() => answer(option)}
                                disabled={selected !== null}
                                aria-pressed={selected === option}
                                className={`w-full rounded-2xl border-2 border-b-4 px-4 py-3.5 text-left text-lg font-semibold transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-cta)] active:translate-y-0.5 active:border-b-2 ${selected === option
                                        ? "border-[var(--accent-cta)] bg-[var(--accent-cta)]/15"
                                        : "border-[var(--border-color)] bg-[var(--bg-card)] hover:bg-[var(--bg-card-elevated)]"
                                    }`}
                            >
                                {option}
                            </button>
                        ))}
                    </div>

                    <div className="mt-auto pt-6">
                        <Button variant="ghost" className="w-full" onClick={() => answer(IDK)} disabled={selected !== null}>
                            Не знаю
                        </Button>
                    </div>
                </main>
            ) : (
                <main className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
                    <CookieMascot state="celebrating" size={96} />
                    <p className="text-lg font-bold">Рахуємо результат…</p>
                </main>
            )}
        </div>
    );
};