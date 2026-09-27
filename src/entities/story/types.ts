// 📁 Файл: SnackEnglish-app/src/entities/story/types.ts
import type { EnglishLevel } from "../word/types";

// ==================== СТАТУСИ ====================

export type StoryNodeStatus = "locked" | "active" | "completed";

/** Розділ має ті самі три стани, що й вузол */
export type ChapterStatus = StoryNodeStatus;

// ==================== РОЗДІЛИ ====================

/** Елемент GET /api/stories */
export interface Chapter {
    id: string;
    slug: string;
    title: string;
    subtitle: string;
    cover: string; // емодзі
    /** Фото-обкладинка; порожньо — показується емодзі */
    coverImage?: string;
    accent: string; // hex
    level: EnglishLevel;
    order: number;
    totalNodes: number;
    doneNodes: number;
    status: ChapterStatus;
    locked: boolean;
}

/** Розділ у відповіді GET /api/stories/:chapterId (бекенд не віддає тут `locked`) */
export type ChapterSummary = Omit<Chapter, "locked">;

// ==================== ВУЗЛИ ====================

/** Легка версія вузла для мапи розділу — без steps */
export interface StoryNode {
    id: string;
    order: number;
    icon: string;
    label: string;
    npc: string;
    npcName: string;
    isBoss: boolean;
    status: StoryNodeStatus;
    completedAt: string | null; // ISO-рядок після JSON
}

export interface StoryCliffhanger {
    text: string;
}

/** Повний вузол GET /api/stories/:chapterId/nodes/:nodeId */
export interface StoryNodeContent {
    id: string;
    chapterId: string;
    order: number;
    icon: string;
    label: string;
    npc: string;
    npcName: string;
    isBoss: boolean;
    cliffhanger: StoryCliffhanger | null;
    steps: StepPayload[];
    status: StoryNodeStatus;
}

// ==================== КРОКИ ====================

export const STEP_TYPES = [
    "scene",
    "dialogue",
    "choice",
    "reply",
    "listen",
    "cards",
    "quiz",
    "build",
    "voice",
    "event",
] as const;

export type StepType = (typeof STEP_TYPES)[number];

// Форма полів збігається з валідатором backend/src/services/storyContentValidator.ts.
// Змінюєте тут — оновіть і валідатор, інакше адмінка відхилятиме контент.

// ---------- Пасивні кроки (без перевірки відповіді) ----------

export interface SceneStep {
    type: "scene";
    icon?: string; // емодзі
    text: string; // розмітка RichText: "Ти заходиш у <en>coffee shop</en>..."
}

/**
 * Хто говорить: Снекі (маскот), сам юзер або персонаж уроку (npc — бариста, офіціант…;
 * ім'я — npcName уроку). Кожен озвучується своїм голосом.
 */
export type DialogueSpeaker = "snacky" | "user" | "npc";

export interface DialogueLine {
    speaker: DialogueSpeaker;
    en: string; // озвучується; може містити <en>…</en>
    uk?: string; // переклад під реплікою
    emotion?: string; // "happy" | "scared" | … або прототипне "emo-scared" (див. toCookieState)
}

export interface DialogueStep {
    type: "dialogue";
    lines: DialogueLine[];
}

export interface FlashCardItem {
    en: string;
    uk: string;
    emoji?: string;
}

export interface CardsStep {
    type: "cards";
    title?: string; // "Нові слова"
    cards: FlashCardItem[];
}

/** Відомі ефекти; невідомий рядок з контенту просто ігнорується */
export type EventEffect = "flash" | "shake" | "rain";

export interface EventStep {
    type: "event";
    // (string & {}) — приймає будь-який рядок з БД, але лишає автодоповнення
    effect?: EventEffect | (string & {});
    icon?: string;
    text: string;
}

// ---------- Інтерактивні кроки ----------

/** Варіант сюжетного вибору. Правильного/неправильного немає */
export interface ChoiceOption {
    text: string; // RichText
    uk?: string;
    icon?: string;
    /** Гілка сюжету: кроки вставляються одразу після choice */
    outcome?: StepPayload[];
}

export interface ChoiceStep {
    type: "choice";
    prompt?: string;
    options: ChoiceOption[];
}

export type ReplyQuality = "good" | "ok" | "bad";

export interface ReplyOption {
    en: string;
    uk?: string;
    quality: ReplyQuality;
    /** Реакція Снекі саме на цю репліку; без неї — випадкова з пулу */
    reaction?: string;
    /** Емоція Снекі на цю репліку; без неї — за quality */
    emotion?: string;
}

export interface ReplyStep {
    type: "reply";
    prompt?: string; // що каже Снекі (en), на що відповідаємо
    promptUk?: string;
    emotion?: string; // емоція Снекі до відповіді
    options: ReplyOption[];
}

/** Правильна відповідь: індекс у options або сам текст варіанта */
export type CorrectAnswer = number | string;

export interface ListenStep {
    type: "listen";
    audio: string; // текст, який озвучується через speak()
    question?: string;
    options: string[];
    correct: CorrectAnswer;
}

export interface QuizStep {
    type: "quiz";
    question: string;
    npcPrompt?: string; // репліка-контекст перед питанням
    options: string[];
    correct: CorrectAnswer;
    explanation?: string; // показується після правильної відповіді
}

export interface BuildStep {
    type: "build";
    prompt?: string; // що скласти (зазвичай переклад українською)
    answer: string[] | string; // правильний порядок слів; рядок ділиться по пробілах
    distractors?: string[]; // зайві слова в банку
}

export interface VoiceStep {
    type: "voice";
    phrase: string; // що сказати англійською
    uk?: string;
}

export type StepPayload =
    | SceneStep
    | DialogueStep
    | ChoiceStep
    | ReplyStep
    | ListenStep
    | CardsStep
    | QuizStep
    | BuildStep
    | VoiceStep
    | EventStep;

/** Витягує варіант кроку за типом: StepOf<"quiz"> === QuizStep */
export type StepOf<T extends StepType> = Extract<StepPayload, { type: T }>;

// ==================== ВІДПОВІДІ API ====================

/** Рівень, для якого є контент, і скільки в ньому розділів */
export interface LevelSummary {
    level: EnglishLevel;
    chapters: number;
}

/** GET /api/stories?level=B1 — розділи одного рівня */
export interface ChaptersResponse {
    /** Рівень, розділи якого повернуто (запитаний, рівень юзера або перший доступний) */
    level: EnglishLevel;
    /** Рівень юзера з профілю; null — ще не визначений */
    userLevel: EnglishLevel | null;
    /** Рівні, для яких є контент — для перемикача */
    levels: LevelSummary[];
    chapters: Chapter[];
}

export interface ChapterNodesResponse {
    chapter: ChapterSummary;
    nodes: StoryNode[];
}

export interface CompleteNodeResponse {
    success: boolean;
    alreadyCompleted: boolean; // true — бали вже нараховувалися раніше, earnedXp = 0
    earnedXp: number;
    totalScore: number;
    weeklyScore: number;
    nextNodeId: string | null;
    chapterCompleted: boolean;
}