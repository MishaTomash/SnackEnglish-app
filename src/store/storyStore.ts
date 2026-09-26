// 📁 Файл: SnackEnglish-app/src/store/storyStore.ts
import { create } from "zustand";
import axios from "axios";
import * as storyApi from "../entities/story/api";
import type {
    Chapter,
    ChapterSummary,
    CompleteNodeResponse,
    LevelSummary,
    StoryNode,
} from "../entities/story/types";
import type { EnglishLevel } from "../entities/word/types";
import { useUserStore } from "./userStore";
import { parseDailyProgress, useDailyProgressStore } from "./dailyProgressStore";

// Без persist: прогрес живе на сервері, а збережені в localStorage
// статуси locked/active швидко ставали б неактуальними.

export interface StoryState {
    chapters: Chapter[];
    /** Рівень, розділи якого зараз у chapters */
    level: EnglishLevel | null;
    userLevel: EnglishLevel | null;
    /** Рівні, для яких є контент */
    levels: LevelSummary[];
    isLoading: boolean;
    error: string | null;

    currentChapter: ChapterSummary | null;
    currentChapterId: string | null; // що саме запитали (id або slug)
    currentChapterNodes: StoryNode[];
    isNodesLoading: boolean;

    /** Без level — поточний рівень у сторі, а якщо його ще немає — рівень юзера */
    fetchChapters: (level?: EnglishLevel) => Promise<void>;
    fetchChapterNodes: (chapterId: string) => Promise<void>;
    markNodeCompleted: (
        chapterId: string,
        nodeId: string,
    ) => Promise<CompleteNodeResponse | null>;
}

// Поля, які оптимістично змінює markNodeCompleted (окремий аліас — в один рядок)
type OptimisticSlice = Pick<StoryState, "chapters" | "currentChapter" | "currentChapterNodes">;

// ==================== ХЕЛПЕРИ ====================

const getErrorMessage = (error: unknown, fallback: string): string => {
    if (axios.isAxiosError<{ error?: string }>(error)) {
        return error.response?.data?.error ?? error.message;
    }
    if (error instanceof Error) return error.message;
    return fallback;
};

/** Бекенд приймає :chapterId і як id, і як slug */
const matchesChapter = (
    chapter: { id: string; slug: string },
    chapterId: string,
): boolean => chapter.id === chapterId || chapter.slug === chapterId.toLowerCase();

/**
 * Позначає вузол completed і відкриває наступний (locked -> active).
 * nextNodeId: undefined — взяти наступний за порядком; значення — від сервера.
 * Ідемпотентна: повторне застосування нічого не змінює.
 */
const applyNodeCompletion = (
    nodes: StoryNode[],
    nodeId: string,
    nextNodeId?: string | null,
): StoryNode[] => {
    const index = nodes.findIndex((n) => n.id === nodeId);
    if (index === -1) return nodes;

    const nextId =
        nextNodeId !== undefined ? nextNodeId : (nodes[index + 1]?.id ?? null);
    const now = new Date().toISOString();

    return nodes.map((n) => {
        if (n.id === nodeId && n.status !== "completed") {
            return { ...n, status: "completed", completedAt: now };
        }
        if (n.id === nextId && n.status === "locked") {
            return { ...n, status: "active" };
        }
        return n;
    });
};

/** +1 до doneNodes; якщо розділ завершено — відкриває наступний розділ */
const applyChapterProgress = (
    chapters: Chapter[],
    chapterId: string,
): Chapter[] => {
    const index = chapters.findIndex((c) => matchesChapter(c, chapterId));
    if (index === -1) return chapters;

    const chapter = chapters[index];
    const doneNodes = Math.min(chapter.doneNodes + 1, chapter.totalNodes);
    const isCompleted = chapter.totalNodes > 0 && doneNodes >= chapter.totalNodes;

    return chapters.map((c, i) => {
        if (i === index) {
            return { ...c, doneNodes, status: isCompleted ? "completed" : c.status };
        }
        if (i === index + 1 && isCompleted && c.status === "locked") {
            return { ...c, status: "active", locked: false };
        }
        return c;
    });
};

const bumpChapterSummary = (chapter: ChapterSummary): ChapterSummary => {
    const doneNodes = Math.min(chapter.doneNodes + 1, chapter.totalNodes);
    const isCompleted = chapter.totalNodes > 0 && doneNodes >= chapter.totalNodes;
    return {
        ...chapter,
        doneNodes,
        status: isCompleted ? "completed" : chapter.status,
    };
};

// Номер останнього запиту розділів: відповідь на застарілий запит
// (юзер швидко перемкнув рівень) ігнорується
let chaptersRequestId = 0;

// ==================== СТОР ====================

export const useStoryStore = create<StoryState>()((set, get) => ({
    chapters: [],
    level: null,
    userLevel: null,
    levels: [],
    isLoading: false,
    error: null,

    currentChapter: null,
    currentChapterId: null,
    currentChapterNodes: [],
    isNodesLoading: false,

    fetchChapters: async (level) => {
        const requestId = ++chaptersRequestId;
        const current = get();
        const targetLevel = level ?? current.level ?? undefined;
        const isSwitchingLevel = targetLevel !== undefined && targetLevel !== current.level;

        // Лоадер — при першому завантаженні або зміні рівня; інакше оновлюємо тихо,
        // щоб список не блимав після повернення з уроку
        set({
            isLoading: current.chapters.length === 0 || isSwitchingLevel,
            error: null,
            ...(isSwitchingLevel ? { chapters: [], level: targetLevel } : {}),
        });

        try {
            const data = await storyApi.getChapters(targetLevel);
            if (requestId !== chaptersRequestId) return;
            set({
                chapters: data.chapters,
                level: data.level,
                userLevel: data.userLevel,
                levels: data.levels,
                isLoading: false,
            });
        } catch (error) {
            if (requestId !== chaptersRequestId) return;
            set({
                error: getErrorMessage(error, "Failed to fetch chapters"),
                isLoading: false,
            });
        }
    },

    fetchChapterNodes: async (chapterId) => {
        const { currentChapter, currentChapterNodes } = get();
        const isSwitching =
            !currentChapter || !matchesChapter(currentChapter, chapterId);

        set({
            currentChapterId: chapterId,
            isNodesLoading: isSwitching || currentChapterNodes.length === 0,
            error: null,
            // Не показуємо мапу попереднього розділу, поки вантажиться новий
            ...(isSwitching ? { currentChapter: null, currentChapterNodes: [] } : {}),
        });

        try {
            const { chapter, nodes } = await storyApi.getChapterNodes(chapterId);
            // Юзер уже відкрив інший розділ — стару відповідь ігноруємо
            if (get().currentChapterId !== chapterId) return;
            set({
                currentChapter: chapter,
                currentChapterNodes: nodes,
                isNodesLoading: false,
            });
        } catch (error) {
            if (get().currentChapterId !== chapterId) return;
            set({
                error: getErrorMessage(error, "Failed to fetch chapter nodes"),
                isNodesLoading: false,
            });
        }
    },

    markNodeCompleted: async (chapterId, nodeId) => {
        const prev = get();
        const isCurrentChapter =
            prev.currentChapter !== null &&
            matchesChapter(prev.currentChapter, chapterId);
        const node = isCurrentChapter
            ? prev.currentChapterNodes.find((n) => n.id === nodeId)
            : undefined;

        // Оптимістично оновлюємо лише коли точно знаємо, що вузол ще не завершений
        const optimisticApplied = !!node && node.status !== "completed";
        let optimistic: OptimisticSlice | null = null;

        if (optimisticApplied && prev.currentChapter) {
            optimistic = {
                chapters: applyChapterProgress(prev.chapters, chapterId),
                currentChapter: bumpChapterSummary(prev.currentChapter),
                currentChapterNodes: applyNodeCompletion(
                    prev.currentChapterNodes,
                    nodeId,
                ),
            };
            set(optimistic);
        }

        try {
            const result = await storyApi.completeNode(chapterId, nodeId);

            // Сервер — джерело істини щодо того, який вузол відкрився наступним
            set((state) => ({
                currentChapterNodes:
                    state.currentChapter &&
                        matchesChapter(state.currentChapter, chapterId)
                        ? applyNodeCompletion(
                            state.currentChapterNodes,
                            nodeId,
                            result.nextNodeId,
                        )
                        : state.currentChapterNodes,
            }));

            // Окремий try: збій persist у userStore (переповнений / недоступний
            // localStorage) не повинен відкочувати вже збережене на сервері проходження
            try {
                // Кубки тижня — ті, що бачить юзер (головна, рейтинг)
                const weekly: unknown = "weeklyScore" in result ? result.weeklyScore : undefined;
                useUserStore.setState({
                    totalScore: result.totalScore,
                    ...(typeof weekly === "number" ? { weeklyScore: weekly } : {}),
                });
            } catch (syncError) {
                console.error("[storyStore] Failed to sync totalScore", syncError);
            }

            // Прогрес дня (ліміт, ціль, бонус) приходить разом із результатом уроку
            const daily = parseDailyProgress("daily" in result ? result.daily : undefined);
            if (daily) {
                useDailyProgressStore.getState().setDaily(daily);
                // Стрік рахується за уроками — одразу показуємо новий у шапці
                if (typeof daily.streak === "number") useUserStore.setState({ streak: daily.streak });
            }
            const words: unknown = "wordsLearnedCount" in result ? result.wordsLearnedCount : undefined;
            if (typeof words === "number") useUserStore.setState({ wordsLearnedCount: words });

            // Розблокування наступного розділу або невідомий заздалегідь стан —
            // тихо перечитуємо список розділів поточного рівня
            if (result.chapterCompleted || !optimisticApplied) {
                void get().fetchChapters();
            }

            return result;
        } catch (error) {
            // Відкат — лише для полів, які ніхто не встиг перезаписати свіжими даними
            if (optimistic) {
                const snapshot = optimistic;
                set((state) => ({
                    chapters:
                        state.chapters === snapshot.chapters ? prev.chapters : state.chapters,
                    currentChapter:
                        state.currentChapter === snapshot.currentChapter
                            ? prev.currentChapter
                            : state.currentChapter,
                    currentChapterNodes:
                        state.currentChapterNodes === snapshot.currentChapterNodes
                            ? prev.currentChapterNodes
                            : state.currentChapterNodes,
                }));
            }
            set({ error: getErrorMessage(error, "Failed to complete node") });
            return null;
        }
    },
}));