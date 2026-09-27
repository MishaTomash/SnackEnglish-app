// 📁 Файл: SnackEnglish-app/src/entities/story/adminTypes.ts
import type { EnglishLevel } from "../word/types";
import type { StepPayload, StepType } from "./types";

/** Розділ в адмінці (усі рівні, включно з чернетками) */
export interface AdminChapter {
    id: string;
    slug: string;
    title: string;
    subtitle: string;
    cover: string;
    /** Фото-обкладинка (/uploads/covers/…); порожньо — емодзі */
    coverImage?: string;
    accent: string;
    level: EnglishLevel;
    order: number;
    published: boolean;
    lessons: number;
}

/** Урок у списку адмінки — без кроків, лише зведення */
export interface AdminNode {
    id: string;
    slug: string;
    order: number;
    label: string;
    icon: string;
    isBoss: boolean;
    hasCliffhanger: boolean;
    stepsCount: number;
    stepTypes: StepType[];
}

/** Урок у форматі JSON, який адмін вставляє й редагує */
export interface LessonJson {
    slug?: string;
    label: string;
    icon?: string;
    npc?: string;
    npcName?: string;
    isBoss?: boolean;
    cliffhanger?: { text: string } | null;
    steps: StepPayload[];
}

export interface AdminNodeDetails {
    id: string;
    chapterId: string;
    order: number;
    lesson: LessonJson;
}

/** Помилка контенту: номер уроку (якщо вставлено масив), шлях у JSON і опис */
export interface ContentIssue {
    lesson?: number;
    path: string;
    message: string;
}

/** Поля форми розділу. Порожній slug — згенерується з назви */
export interface ChapterInput {
    title?: string;
    subtitle?: string;
    cover?: string;
    accent?: string;
    level?: EnglishLevel;
    slug?: string;
    published?: boolean;
}

export interface ValidateLessonsResponse {
    ok: boolean;
    lessons: number;
    issues: ContentIssue[];
}

export type MoveDirection = "up" | "down";