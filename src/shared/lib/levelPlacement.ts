/**
 * Тест визначення рівня: питання і логіка підрахунку.
 *
 * Як працює: рівні йдуть знизу вгору (A1 → C2), на кожному — до 3 питань.
 * Рівень зараховано, якщо правильних відповідей щонайменше 2 з 3; тоді тест
 * переходить на наступний рівень. Щойно рівень не зараховано — тест завершується.
 * Результат — найвищий зарахований рівень (або A1, якщо не зараховано жодного).
 *
 * Тест закінчується достроково, коли результат рівня вже відомий:
 * 2 правильні поспіль — рівень зараховано без третього питання,
 * 2 помилки поспіль — тест завершено. Тому зазвичай він коротший за 18 питань.
 */

// Той самий набір, що й EnglishLevel у entities/word/types — типи сумісні
export type PlacementLevel = "A1" | "A2" | "B1" | "B2" | "C1" | "C2";

export const PLACEMENT_LEVELS: readonly PlacementLevel[] = ["A1", "A2", "B1", "B2", "C1", "C2"];

export const QUESTIONS_PER_LEVEL = 3;
export const PASS_THRESHOLD = 2;

export interface PlacementQuestion {
    /** Речення з пропуском "___" або питання */
    prompt: string;
    /** 4 варіанти; порядок на екрані перемішується */
    options: readonly string[];
    answer: string;
}

export const PLACEMENT_QUESTIONS: Record<PlacementLevel, readonly PlacementQuestion[]> = {
    A1: [
        { prompt: "I ___ a student.", options: ["am", "is", "are", "be"], answer: "am" },
        { prompt: "She ___ two brothers.", options: ["has", "have", "is", "having"], answer: "has" },
        { prompt: "___ you like coffee?", options: ["Do", "Does", "Are", "Is"], answer: "Do" },
    ],
    A2: [
        { prompt: "Yesterday I ___ to the cinema.", options: ["went", "go", "gone", "going"], answer: "went" },
        { prompt: "There isn't ___ milk in the fridge.", options: ["any", "some", "many", "a"], answer: "any" },
        {
            prompt: "This book is ___ than that one.",
            options: ["more interesting", "interestinger", "most interesting", "the interesting"],
            answer: "more interesting",
        },
    ],
    B1: [
        { prompt: "I ___ here since 2020.", options: ["have lived", "live", "am living", "lived"], answer: "have lived" },
        {
            prompt: "If it rains tomorrow, we ___ at home.",
            options: ["will stay", "stay", "would stay", "stayed"],
            answer: "will stay",
        },
        { prompt: "The letter ___ yesterday.", options: ["was sent", "sent", "has sent", "is sending"], answer: "was sent" },
    ],
    B2: [
        {
            prompt: "If I ___ more time, I would learn Japanese.",
            options: ["had", "have", "would have", "will have"],
            answer: "had",
        },
        { prompt: "She suggested ___ a taxi.", options: ["taking", "to take", "take", "took"], answer: "taking" },
        {
            prompt: "By the time we arrived, the film ___.",
            options: ["had already started", "already started", "has already started", "was already start"],
            answer: "had already started",
        },
    ],
    C1: [
        {
            prompt: "Hardly ___ the house when it started to rain.",
            options: ["had I left", "I had left", "I left", "did I leave"],
            answer: "had I left",
        },
        { prompt: "It's high time we ___ a decision.", options: ["made", "make", "will make", "have made"], answer: "made" },
        {
            prompt: "The results were ___ disappointing that the project was cancelled.",
            options: ["so", "such", "too", "very"],
            answer: "so",
        },
    ],
    C2: [
        {
            prompt: "Not until the report was published ___ the scale of the problem.",
            options: ["did people realise", "people realised", "people did realise", "realised people"],
            answer: "did people realise",
        },
        {
            prompt: "His explanation was so ___ that nobody could follow it.",
            options: ["convoluted", "concise", "lucid", "straightforward"],
            answer: "convoluted",
        },
        {
            prompt: "She has a real ___ for languages — she speaks six fluently.",
            options: ["flair", "flare", "flavour", "fluency"],
            answer: "flair",
        },
    ],
};

export interface PlacementState {
    levelIndex: number; // поточний рівень у PLACEMENT_LEVELS
    questionIndex: number; // номер питання в межах рівня
    correctInLevel: number;
    passedLevel: PlacementLevel | null; // найвищий зарахований
    answered: number; // усього відповідей
    finished: boolean;
}

export const INITIAL_PLACEMENT_STATE: PlacementState = {
    levelIndex: 0,
    questionIndex: 0,
    correctInLevel: 0,
    passedLevel: null,
    answered: 0,
    finished: false,
};

export const currentQuestion = (state: PlacementState): PlacementQuestion | null =>
    state.finished
        ? null
        : (PLACEMENT_QUESTIONS[PLACEMENT_LEVELS[state.levelIndex]][state.questionIndex] ?? null);

/** Наступний стан після відповіді. Чиста функція — легко тестувати */
export function answerPlacement(state: PlacementState, isCorrect: boolean): PlacementState {
    if (state.finished) return state;

    const level = PLACEMENT_LEVELS[state.levelIndex];
    const correctInLevel = state.correctInLevel + (isCorrect ? 1 : 0);
    const questionIndex = state.questionIndex + 1;
    const remaining = QUESTIONS_PER_LEVEL - questionIndex;
    const answered = state.answered + 1;

    // Рівень зараховано
    if (correctInLevel >= PASS_THRESHOLD) {
        const isLastLevel = state.levelIndex >= PLACEMENT_LEVELS.length - 1;
        return {
            levelIndex: isLastLevel ? state.levelIndex : state.levelIndex + 1,
            questionIndex: 0,
            correctInLevel: 0,
            passedLevel: level,
            answered,
            finished: isLastLevel,
        };
    }

    // Рівень уже не зарахувати — тест завершено
    if (correctInLevel + remaining < PASS_THRESHOLD) {
        return { ...state, correctInLevel, questionIndex, answered, finished: true };
    }

    return { ...state, correctInLevel, questionIndex, answered };
}

export const placementResult = (state: PlacementState): PlacementLevel => state.passedLevel ?? "A1";