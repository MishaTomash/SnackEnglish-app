// 📁 Файл: SnackEnglish-app/backend/src/services/wordsService.ts
import type { Types } from "mongoose";
import { User } from "../models/User.js";
import { StoryNode, UserStoryProgress } from "../models/index.js";

/**
 * Лічильник "вивчених слів": унікальні англійські слова й фрази з пройдених уроків.
 * Беремо їх із розмітки <en>…</en> у текстах кроків і з полів "en" (картки, варіанти).
 * Раніше лічильник ніде не збільшувався — на головній завжди було "0 слів".
 */

const EN_MARKUP = /<en>([\s\S]*?)<\/en>/gi;
const MAX_WORD_LENGTH = 40;
const MAX_DEPTH = 8;

const normalizeWord = (raw: string): string | null => {
    const word = raw
        .replace(/<[^>]*>/g, "")
        .replace(/[.,!?;:"«»“”()]+/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();
    // Лише латиниця (англійське), без надто довгих речень
    if (!word || word.length > MAX_WORD_LENGTH || !/^[a-z][a-z' -]*$/.test(word)) return null;
    return word;
};

/** Рекурсивно збирає слова з довільної структури кроків уроку */
export const extractWords = (value: unknown, found: Set<string> = new Set(), depth = 0): Set<string> => {
    if (depth > MAX_DEPTH || value === null || value === undefined) return found;

    if (typeof value === "string") {
        for (const match of value.matchAll(EN_MARKUP)) {
            const word = normalizeWord(match[1]);
            if (word) found.add(word);
        }
        return found;
    }
    if (Array.isArray(value)) {
        value.forEach((item) => extractWords(item, found, depth + 1));
        return found;
    }
    if (typeof value === "object") {
        for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
            // Поле "en" (картка слова) — саме слово без розмітки
            if (key === "en" && typeof item === "string") {
                const word = normalizeWord(item);
                if (word) found.add(word);
            } else {
                extractWords(item, found, depth + 1);
            }
        }
    }
    return found;
};

/** Оновлює лічильник за фактичною кількістю унікальних слів */
// Слова з нових уроків + слова зі старої версії бота (перенесені юзери не повинні побачити "0 слів")
const syncWordsCount = async (userId: Types.ObjectId): Promise<number> => {
    const user = await User.findById(userId)
        .select("+learnedWords legacyWordsCount")
        .lean<{ learnedWords?: string[]; legacyWordsCount?: number }>();
    const count = (user?.learnedWords?.length ?? 0) + (user?.legacyWordsCount ?? 0);
    await User.updateOne({ _id: userId }, { $set: { wordsLearnedCount: count } });
    return count;
};

/** Додає слова з щойно пройденого уроку; повертає нову кількість */
export const addWordsFromNode = async (userId: Types.ObjectId, nodeId: string): Promise<number> => {
    const node = await StoryNode.findById(nodeId).select("steps").lean<{ steps?: unknown }>();
    const words = Array.from(extractWords(node?.steps));
    if (words.length > 0) {
        await User.updateOne({ _id: userId }, { $addToSet: { learnedWords: { $each: words } } });
    }
    return syncWordsCount(userId);
};

/**
 * Одноразово рахує слова з усіх уроків, пройдених до оновлення.
 * Викликається з getMe, поки wordsBackfilled не true.
 */
export const backfillWords = async (userId: Types.ObjectId): Promise<number> => {
    const completed = await UserStoryProgress.find({ userId, status: "completed" })
        .select("nodeId")
        .lean<{ nodeId: Types.ObjectId }[]>();

    const words = new Set<string>();
    if (completed.length > 0) {
        const nodes = await StoryNode.find({ _id: { $in: completed.map((c) => c.nodeId) } })
            .select("steps")
            .lean<{ steps?: unknown }[]>();
        nodes.forEach((node) => extractWords(node.steps, words));
    }

    if (words.size > 0) {
        await User.updateOne({ _id: userId }, { $addToSet: { learnedWords: { $each: Array.from(words) } } });
    }
    await User.updateOne({ _id: userId }, { $set: { wordsBackfilled: true } });
    return syncWordsCount(userId);
};