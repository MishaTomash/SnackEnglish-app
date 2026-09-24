import { create } from "zustand";
import type { StepPayload, StoryNodeContent } from "../entities/story/types";

// БЕЗ persist: це стан одного активного проходження, скидається при виході.

/** Мета вузла, що проходиться зараз. Кроки живуть окремо — у queue */
export type LessonNode = Omit<StoryNodeContent, "steps">;

export const DEFAULT_LESSON_LIVES = 3;

export interface LessonRuntimeState {
    node: LessonNode | null;
    queue: StepPayload[];
    stepIndex: number;
    lives: number;
    errorsInScene: number; // помилки за поточне проходження вузла-сцени

    startLesson: (node: StoryNodeContent, options?: { lives?: number }) => void;
    nextStep: () => void;
    insertSteps: (steps: StepPayload[]) => void;
    loseLife: () => void;
    resetLesson: () => void;
}

type RuntimeKeys = "node" | "queue" | "stepIndex" | "lives" | "errorsInScene";
type RuntimeData = Pick<LessonRuntimeState, RuntimeKeys>;

const initialState: RuntimeData = {
    node: null,
    queue: [],
    stepIndex: 0,
    lives: DEFAULT_LESSON_LIVES,
    errorsInScene: 0,
};

export const useLessonRuntimeStore = create<LessonRuntimeState>()((set) => ({
    ...initialState,

    startLesson: (node, options) => {
        const { steps, ...meta } = node;
        set({
            node: meta,
            queue: [...steps], // копія — insertSteps не мутує контент з API
            stepIndex: 0,
            lives: options?.lives ?? DEFAULT_LESSON_LIVES,
            errorsInScene: 0,
        });
    },

    // stepIndex === queue.length означає "урок пройдено" (див. selectIsFinished)
    nextStep: () =>
        set((state) =>
            state.node
                ? { stepIndex: Math.min(state.stepIndex + 1, state.queue.length) }
                : {},
        ),

    // Гілка з choice-кроку вставляється одразу ПІСЛЯ поточного кроку,
    // тож наступний nextStep() веде в неї
    insertSteps: (steps) =>
        set((state) => {
            if (!state.node || steps.length === 0) return {};
            const at = state.stepIndex + 1;
            return {
                queue: [...state.queue.slice(0, at), ...steps, ...state.queue.slice(at)],
            };
        }),

    loseLife: () =>
        set((state) =>
            state.node && state.lives > 0
                ? { lives: state.lives - 1, errorsInScene: state.errorsInScene + 1 }
                : {},
        ),

    resetLesson: () => set(initialState),
}));

// ==================== СЕЛЕКТОРИ ====================
// Похідні значення рахуються з стану, а не зберігаються в ньому

export const selectCurrentStep = (
    state: LessonRuntimeState,
): StepPayload | null => state.queue[state.stepIndex] ?? null;

export const selectIsFinished = (state: LessonRuntimeState): boolean =>
    state.node !== null && state.stepIndex >= state.queue.length;

export const selectIsOutOfLives = (state: LessonRuntimeState): boolean =>
    state.node !== null && state.lives <= 0;

/** 0..1 для прогрес-бару (після insertSteps знаменник зростає) */
export const selectProgress = (state: LessonRuntimeState): number =>
    state.queue.length === 0
        ? 0
        : Math.min(state.stepIndex / state.queue.length, 1);