// 📁 Файл: SnackEnglish-app/backend/src/controllers/admin/contentController.ts
import type { Request, Response } from "express";
import type { Types } from "mongoose";
import { Chapter, PUBLISHED_FILTER, StoryNode, UserStoryProgress } from "../../models/index.js";
import { logAdminError, sendError } from "./adminHelpers.js";

/**
 * Воронка по урокам: скільки юзерів почали й завершили кожен вузол.
 * Показує, де юзери "відвалюються" — там урок заважкий або нецікавий.
 * Агрегація по всій колекції прогресу — кешуємо на 5 хвилин.
 */
const CACHE_TTL_MS = 5 * 60 * 1000;

interface ContentNode {
    id: string;
    order: number;
    label: string;
    icon: string | null;
    isBoss: boolean;
    started: number;
    completed: number;
}

interface ContentChapter {
    id: string;
    title: string;
    level: string;
    order: number;
    published: boolean;
    nodes: ContentNode[];
    startedUsers: number;
    finishedUsers: number;
}

interface NodeRow {
    _id: Types.ObjectId;
    chapterId: Types.ObjectId;
    order?: number;
    label?: string;
    icon?: string;
    isBoss?: boolean;
}

let cache: { data: ContentChapter[]; generatedAt: string; expiresAt: number } | null = null;

export const clearContentCache = (): void => {
    cache = null;
};

// GET /api/admin/content
export const getContentStats = async (req: Request, res: Response): Promise<void> => {
    try {
        if (req.query.fresh !== "1" && cache && cache.expiresAt > Date.now()) {
            res.json({ chapters: cache.data, generatedAt: cache.generatedAt });
            return;
        }

        const [chapters, publishedIds, nodes, progress] = await Promise.all([
            Chapter.find()
                .select("title level order")
                .sort({ level: 1, order: 1 })
                .lean<{ _id: Types.ObjectId; title?: string; level?: string; order?: number }[]>(),
            Chapter.find(PUBLISHED_FILTER).select("_id").lean<{ _id: Types.ObjectId }[]>(),
            StoryNode.find()
                .select("chapterId order label icon isBoss")
                .sort({ order: 1 })
                .lean<NodeRow[]>(),
            UserStoryProgress.aggregate<{ _id: Types.ObjectId; started: number; completed: number }>([
                {
                    $group: {
                        _id: "$nodeId",
                        started: { $sum: { $cond: [{ $ne: ["$status", "locked"] }, 1, 0] } },
                        completed: { $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] } },
                    },
                },
            ]),
        ]);

        const published = new Set(publishedIds.map((c) => String(c._id)));
        const progressMap = new Map(progress.map((p) => [String(p._id), p]));
        const nodesByChapter = new Map<string, ContentNode[]>();

        for (const node of nodes) {
            const key = String(node.chapterId);
            const stats = progressMap.get(String(node._id));
            const list = nodesByChapter.get(key) ?? [];
            list.push({
                id: String(node._id),
                order: node.order ?? list.length,
                label: node.label || `Урок ${list.length + 1}`,
                icon: node.icon ?? null,
                isBoss: Boolean(node.isBoss),
                started: stats?.started ?? 0,
                completed: stats?.completed ?? 0,
            });
            nodesByChapter.set(key, list);
        }

        const data: ContentChapter[] = chapters.map((chapter) => {
            const chapterNodes = nodesByChapter.get(String(chapter._id)) ?? [];
            return {
                id: String(chapter._id),
                title: chapter.title || "Без назви",
                level: chapter.level || "—",
                order: chapter.order ?? 0,
                published: published.has(String(chapter._id)),
                nodes: chapterNodes,
                startedUsers: chapterNodes[0]?.started ?? 0,
                finishedUsers: chapterNodes[chapterNodes.length - 1]?.completed ?? 0,
            };
        });

        const generatedAt = new Date().toISOString();
        cache = { data, generatedAt, expiresAt: Date.now() + CACHE_TTL_MS };
        res.json({ chapters: data, generatedAt });
    } catch (error) {
        logAdminError("content", error);
        sendError(res, 500, "Не вдалося зібрати статистику контенту");
    }
};