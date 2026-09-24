import axios from "axios";
import { apiClient } from "../../shared/api/apiClient";
import type {
    AdminChapter,
    AdminNode,
    AdminNodeDetails,
    ChapterInput,
    ContentIssue,
    LessonJson,
    MoveDirection,
    ValidateLessonsResponse,
} from "./adminTypes";

const BASE = "/stories/admin";

/** Сервер відхилив дані: у issues — що саме і де не так */
export class AdminValidationError extends Error {
    readonly issues: ContentIssue[];

    constructor(message: string, issues: ContentIssue[]) {
        super(message);
        this.name = "AdminValidationError";
        this.issues = issues;
    }
}

/** Людське повідомлення для будь-якої помилки запиту адмінки */
export function adminErrorMessage(error: unknown): string {
    if (error instanceof AdminValidationError) return "Є помилки — виправте їх і спробуйте ще раз.";
    if (axios.isAxiosError<{ error?: string }>(error)) {
        if (error.response?.status === 403) return "Немає доступу: ця дія лише для адміністратора.";
        if (error.response?.status === 404) return "Не знайдено — можливо, його вже видалили.";
        if (error.response?.status === 413) return "Завеликий текст — розбийте уроки на кілька частин.";
        return error.response?.data?.error ?? "Помилка мережі. Спробуйте ще раз.";
    }
    return error instanceof Error ? error.message : "Невідома помилка";
}

async function request<T>(promise: Promise<{ data: T }>): Promise<T> {
    try {
        return (await promise).data;
    } catch (error) {
        if (axios.isAxiosError<{ error?: string; issues?: ContentIssue[] }>(error)) {
            const issues = error.response?.data?.issues;
            if (Array.isArray(issues)) {
                throw new AdminValidationError(error.response?.data?.error ?? "Validation failed", issues);
            }
        }
        throw error;
    }
}

// ==================== РОЗДІЛИ ====================

export async function listChapters(): Promise<AdminChapter[]> {
    return (await request(apiClient.get<{ chapters: AdminChapter[] }>(`${BASE}/chapters`))).chapters;
}

export async function createChapter(input: ChapterInput): Promise<AdminChapter> {
    return (await request(apiClient.post<{ chapter: AdminChapter }>(`${BASE}/chapters`, input))).chapter;
}

export async function updateChapter(chapterId: string, input: ChapterInput): Promise<AdminChapter> {
    return (
        await request(
            apiClient.patch<{ chapter: AdminChapter }>(`${BASE}/chapters/${encodeURIComponent(chapterId)}`, input),
        )
    ).chapter;
}

export async function deleteChapter(
    chapterId: string,
): Promise<{ deletedLessons: number; deletedProgress: number }> {
    return request(apiClient.delete(`${BASE}/chapters/${encodeURIComponent(chapterId)}`));
}

export async function moveChapter(chapterId: string, direction: MoveDirection): Promise<void> {
    await request(apiClient.post(`${BASE}/chapters/${encodeURIComponent(chapterId)}/move`, { direction }));
}

// ==================== УРОКИ ====================

export async function listNodes(chapterId: string): Promise<{ chapter: AdminChapter; nodes: AdminNode[] }> {
    return request(apiClient.get(`${BASE}/chapters/${encodeURIComponent(chapterId)}/nodes`));
}

/** Перевірка JSON без запису. data — урок-об'єкт або масив уроків */
export async function validateLessons(data: unknown): Promise<ValidateLessonsResponse> {
    return request(apiClient.post<ValidateLessonsResponse>(`${BASE}/lessons/validate`, { data }));
}

/** Додає урок або масив уроків у кінець розділу. Помилки — AdminValidationError */
export async function createNodes(chapterId: string, data: unknown): Promise<AdminNode[]> {
    return (
        await request(
            apiClient.post<{ nodes: AdminNode[] }>(`${BASE}/chapters/${encodeURIComponent(chapterId)}/nodes`, { data }),
        )
    ).nodes;
}

export async function getNode(nodeId: string): Promise<AdminNodeDetails> {
    return request(apiClient.get<AdminNodeDetails>(`${BASE}/nodes/${encodeURIComponent(nodeId)}`));
}

/** Замінює вміст уроку (один об'єкт). Прогрес юзерів по уроку зберігається */
export async function updateNode(nodeId: string, data: unknown): Promise<{ node: AdminNode; lesson: LessonJson }> {
    return request(apiClient.put(`${BASE}/nodes/${encodeURIComponent(nodeId)}`, { data }));
}

export async function deleteNode(nodeId: string): Promise<{ chapterUnpublished: boolean }> {
    return request(apiClient.delete(`${BASE}/nodes/${encodeURIComponent(nodeId)}`));
}

export async function moveNode(nodeId: string, direction: MoveDirection): Promise<void> {
    await request(apiClient.post(`${BASE}/nodes/${encodeURIComponent(nodeId)}/move`, { direction }));
}