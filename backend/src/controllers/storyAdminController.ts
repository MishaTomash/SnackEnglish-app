// 📁 Файл: SnackEnglish-app/backend/src/controllers/storyAdminController.ts
import { Request, Response } from "express";
import type { Types } from "mongoose";
import { Chapter, StoryNode, UserStoryProgress } from "../models/index.js";
import {
    LEVELS,
    RESERVED_SLUGS,
    validateChapterInput,
    validateLessons,
    type ContentIssue,
    type LessonContent,
} from "../services/storyContentValidator.js";
import { slugify, uniqueSlug } from "../utils/slugify.js";
import { voiceNewContent } from "../services/ttsService.js";

/**
 * Адмін-API історій. Монтується під /api/stories/admin з authMiddleware + adminOnly.
 *
 * Розділ створюється формою, уроки — JSON-ом (один урок-об'єкт або масив).
 * Контент перевіряється тим самим валідатором, що описує формат кроків;
 * у разі помилок нічого не записується, а у відповіді — повний список issues.
 */

const OBJECT_ID_RE = /^[a-f0-9]{24}$/i;

// Мінімальні форми документів: DTO-функції приймають і .lean(), і .toObject()
// (у mongoose 8 і 9 їхні типи відрізняються)
interface ChapterLike {
    _id: unknown;
    slug: string;
    title: string;
    subtitle?: string;
    cover: string;
    accent: string;
    level: string;
    order: number;
    published?: boolean;
}

interface NodeLike {
    _id: unknown;
    slug: string;
    order: number;
    label: string;
    icon: string;
    npc?: string;
    npcName?: string;
    isBoss: boolean;
    cliffhanger?: { text?: string } | null;
    steps: unknown[];
}

// ==================== ХЕЛПЕРИ ====================

const sendIssues = (res: Response, issues: ContentIssue[], status = 400): void => {
    res.status(status).json({ error: "Validation failed", issues });
};

const isDuplicateKeyError = (error: unknown): boolean =>
    (error as { code?: number } | null)?.code === 11000;

const levelIndex = (level: string) => LEVELS.indexOf(level as (typeof LEVELS)[number]);

function loadChapter(id: string) {
    return OBJECT_ID_RE.test(id) ? Chapter.findById(id).lean() : Promise.resolve(null);
}

function loadNode(id: string) {
    return OBJECT_ID_RE.test(id) ? StoryNode.findById(id).lean() : Promise.resolve(null);
}

const toChapterDto = (chapter: ChapterLike, lessons: number) => ({
    id: String(chapter._id),
    slug: chapter.slug,
    title: chapter.title,
    subtitle: chapter.subtitle ?? "",
    cover: chapter.cover,
    accent: chapter.accent,
    level: chapter.level,
    order: chapter.order,
    published: chapter.published !== false,
    lessons,
});

const toNodeDto = (node: NodeLike) => {
    const steps = (node.steps ?? []) as { type?: string }[];
    return {
        id: String(node._id),
        slug: node.slug,
        order: node.order,
        label: node.label,
        icon: node.icon,
        isBoss: node.isBoss,
        hasCliffhanger: !!node.cliffhanger?.text,
        stepsCount: steps.length,
        stepTypes: [...new Set(steps.map((s) => s.type).filter(Boolean))],
    };
};

/** Урок у тому самому форматі, в якому адмін його вставляє (для редагування JSON) */
const toLessonJson = (node: NodeLike) => ({
    slug: node.slug,
    label: node.label,
    icon: node.icon,
    ...(node.npc ? { npc: node.npc } : {}),
    ...(node.npcName ? { npcName: node.npcName } : {}),
    ...(node.isBoss ? { isBoss: true } : {}),
    ...(node.cliffhanger?.text ? { cliffhanger: { text: node.cliffhanger.text } } : {}),
    steps: node.steps,
});

const lessonFields = (lesson: LessonContent) => ({
    label: lesson.label,
    icon: lesson.icon,
    npc: lesson.npc,
    npcName: lesson.npcName,
    isBoss: lesson.isBoss,
    steps: lesson.steps,
});

const countLessons = (chapterId: Types.ObjectId) => StoryNode.countDocuments({ chapterId });

/** Тимчасовий від'ємний order: обмін місцями не впирається в unique-індекс */
const tempOrder = () => -1 - (Date.now() % 1_000_000_000);

const parseDirection = (req: Request): "up" | "down" | null => {
    const direction = (req.body as { direction?: unknown } | undefined)?.direction;
    return direction === "up" || direction === "down" ? direction : null;
};

// ==================== РОЗДІЛИ ====================

// GET /api/stories/admin/chapters — усі розділи всіх рівнів, включно з чернетками
export const listChapters = async (_req: Request, res: Response): Promise<void> => {
    try {
        const [chapters, counts] = await Promise.all([
            Chapter.find().lean(),
            StoryNode.aggregate<{ _id: Types.ObjectId; lessons: number }>([
                { $group: { _id: "$chapterId", lessons: { $sum: 1 } } },
            ]),
        ]);
        const countMap = new Map(counts.map((c) => [String(c._id), c.lessons]));

        chapters.sort((a, b) => levelIndex(a.level) - levelIndex(b.level) || a.order - b.order);
        res.status(200).json({
            chapters: chapters.map((c) => toChapterDto(c, countMap.get(String(c._id)) ?? 0)),
        });
    } catch (error) {
        console.error("[admin.listChapters] Error:", error);
        res.status(500).json({ error: "Failed to fetch chapters" });
    }
};

// POST /api/stories/admin/chapters — новий розділ (чернетка) у кінці свого рівня
export const createChapter = async (req: Request, res: Response): Promise<void> => {
    try {
        const { value, issues } = validateChapterInput(req.body, { partial: false });
        if (issues.length > 0) return sendIssues(res, issues);

        const taken = new Set([
            ...RESERVED_SLUGS,
            ...(await Chapter.find().select("slug").lean()).map((c) => c.slug),
        ]);
        if (value.slug && taken.has(value.slug)) {
            return sendIssues(res, [{ path: "slug", message: `"${value.slug}" уже зайнятий` }], 409);
        }
        const slug = value.slug ?? uniqueSlug(slugify(value.title ?? "", "chapter"), taken);

        const last = await Chapter.findOne({ level: value.level }).sort({ order: -1 }).select("order").lean();
        const created = await Chapter.create({
            slug,
            title: value.title,
            subtitle: value.subtitle ?? "",
            cover: value.cover ?? "📖",
            accent: value.accent ?? "#E8A33D",
            level: value.level,
            order: (last?.order ?? 0) + 1,
            published: false, // публікується окремо, коли є уроки
        });

        res.status(201).json({ chapter: toChapterDto(created.toObject(), 0) });
    } catch (error) {
        if (isDuplicateKeyError(error)) {
            return sendIssues(res, [{ path: "slug", message: "slug уже зайнятий — спробуйте ще раз" }], 409);
        }
        console.error("[admin.createChapter] Error:", error);
        res.status(500).json({ error: "Failed to create chapter" });
    }
};

// PATCH /api/stories/admin/chapters/:chapterId — редагування полів і публікація
export const updateChapter = async (req: Request, res: Response): Promise<void> => {
    try {
        const chapter = await loadChapter(String(req.params.chapterId));
        if (!chapter) {
            res.status(404).json({ error: "Chapter not found" });
            return;
        }

        const { value, issues } = validateChapterInput(req.body, { partial: true });
        if (issues.length > 0) return sendIssues(res, issues);

        const update: Record<string, unknown> = { ...value };

        if (value.slug && value.slug !== chapter.slug) {
            const clash = await Chapter.exists({ slug: value.slug, _id: { $ne: chapter._id } });
            if (clash) return sendIssues(res, [{ path: "slug", message: `"${value.slug}" уже зайнятий` }], 409);
        }

        // Перехід на інший рівень — у кінець ланцюжка нового рівня
        if (value.level && value.level !== chapter.level) {
            const last = await Chapter.findOne({ level: value.level }).sort({ order: -1 }).select("order").lean();
            update.order = (last?.order ?? 0) + 1;
        }

        const lessons = await countLessons(chapter._id);
        // Порожній опублікований розділ ніколи не завершиться і заблокує наступні
        if (value.published === true && lessons === 0) {
            return sendIssues(res, [
                { path: "published", message: "не можна опублікувати розділ без уроків — спершу додайте уроки" },
            ]);
        }

        const updated = await Chapter.findByIdAndUpdate(chapter._id, { $set: update }, { returnDocument: "after" }).lean();
        if (!updated) {
            res.status(404).json({ error: "Chapter not found" });
            return;
        }
        res.status(200).json({ chapter: toChapterDto(updated, lessons) });
    } catch (error) {
        if (isDuplicateKeyError(error)) {
            return sendIssues(res, [{ path: "slug", message: "slug уже зайнятий" }], 409);
        }
        console.error("[admin.updateChapter] Error:", error);
        res.status(500).json({ error: "Failed to update chapter" });
    }
};

// DELETE /api/stories/admin/chapters/:chapterId — розділ, його уроки й прогрес юзерів
export const deleteChapter = async (req: Request, res: Response): Promise<void> => {
    try {
        const chapter = await loadChapter(String(req.params.chapterId));
        if (!chapter) {
            res.status(404).json({ error: "Chapter not found" });
            return;
        }
        const [progress, nodes] = await Promise.all([
            UserStoryProgress.deleteMany({ chapterId: chapter._id }),
            StoryNode.deleteMany({ chapterId: chapter._id }),
        ]);
        await Chapter.deleteOne({ _id: chapter._id });

        res.status(200).json({
            success: true,
            deletedLessons: nodes.deletedCount,
            deletedProgress: progress.deletedCount,
        });
    } catch (error) {
        console.error("[admin.deleteChapter] Error:", error);
        res.status(500).json({ error: "Failed to delete chapter" });
    }
};

// POST /api/stories/admin/chapters/:chapterId/move { direction: "up" | "down" }
export const moveChapter = async (req: Request, res: Response): Promise<void> => {
    try {
        const direction = parseDirection(req);
        const chapter = await loadChapter(String(req.params.chapterId));
        if (!chapter || !direction) {
            res.status(chapter ? 400 : 404).json({ error: chapter ? "direction must be up|down" : "Chapter not found" });
            return;
        }

        const neighbor = await Chapter.findOne({
            level: chapter.level,
            order: direction === "up" ? { $lt: chapter.order } : { $gt: chapter.order },
        })
            .sort({ order: direction === "up" ? -1 : 1 })
            .lean();

        if (neighbor) {
            await Chapter.updateOne({ _id: chapter._id }, { $set: { order: tempOrder() } });
            await Chapter.updateOne({ _id: neighbor._id }, { $set: { order: chapter.order } });
            await Chapter.updateOne({ _id: chapter._id }, { $set: { order: neighbor.order } });
        }
        res.status(200).json({ success: true, moved: !!neighbor });
    } catch (error) {
        console.error("[admin.moveChapter] Error:", error);
        res.status(500).json({ error: "Failed to move chapter" });
    }
};

// ==================== УРОКИ ====================

// GET /api/stories/admin/chapters/:chapterId/nodes
export const listNodes = async (req: Request, res: Response): Promise<void> => {
    try {
        const chapter = await loadChapter(String(req.params.chapterId));
        if (!chapter) {
            res.status(404).json({ error: "Chapter not found" });
            return;
        }
        const nodes = await StoryNode.find({ chapterId: chapter._id }).sort({ order: 1 }).lean();
        res.status(200).json({
            chapter: toChapterDto(chapter, nodes.length),
            nodes: nodes.map(toNodeDto),
        });
    } catch (error) {
        console.error("[admin.listNodes] Error:", error);
        res.status(500).json({ error: "Failed to fetch lessons" });
    }
};

// POST /api/stories/admin/lessons/validate { data } — перевірка без запису
export const validateLessonsHandler = (req: Request, res: Response): void => {
    const data = (req.body as { data?: unknown } | undefined)?.data;
    const { lessons, issues } = validateLessons(data);
    res.status(200).json({
        ok: issues.length === 0,
        lessons: issues.length === 0 ? lessons.length : 0,
        issues,
    });
};

// POST /api/stories/admin/chapters/:chapterId/nodes { data } — урок або масив уроків у кінець розділу
export const createNodes = async (req: Request, res: Response): Promise<void> => {
    try {
        const chapter = await loadChapter(String(req.params.chapterId));
        if (!chapter) {
            res.status(404).json({ error: "Chapter not found" });
            return;
        }

        const data = (req.body as { data?: unknown } | undefined)?.data;
        const { lessons, issues } = validateLessons(data);
        if (issues.length > 0) return sendIssues(res, issues);

        const existing = await StoryNode.find({ chapterId: chapter._id }).select("slug order").lean();
        const taken = new Set(existing.map((n) => n.slug));

        // Явний slug, що вже є в розділі — помилка; інакше генеруємо з назви
        const clashes: ContentIssue[] = [];
        lessons.forEach((lesson, i) => {
            if (lesson.slug && taken.has(lesson.slug)) {
                clashes.push({
                    ...(lessons.length > 1 ? { lesson: i + 1 } : {}),
                    path: "slug",
                    message: `урок зі slug "${lesson.slug}" уже є в цьому розділі`,
                });
            }
        });
        if (clashes.length > 0) return sendIssues(res, clashes, 409);

        let nextOrder = existing.reduce((max, n) => Math.max(max, n.order), 0) + 1;
        const docs = lessons.map((lesson) => {
            const slug = lesson.slug ?? uniqueSlug(slugify(lesson.label, "lesson"), taken);
            taken.add(slug);
            return {
                chapterId: chapter._id,
                slug,
                order: nextOrder++,
                ...lessonFields(lesson),
                ...(lesson.cliffhanger ? { cliffhanger: lesson.cliffhanger } : {}),
            };
        });

        const created = await StoryNode.insertMany(docs);
        // Нові фрази озвучуються одразу у фоні (якщо озвучку увімкнено в адмінці)
        voiceNewContent(created.map((n) => String(n._id)));
        res.status(201).json({ nodes: created.map((n) => toNodeDto(n.toObject())) });
    } catch (error) {
        if (isDuplicateKeyError(error)) {
            return sendIssues(res, [{ path: "slug", message: "конфлікт slug або порядку — оновіть сторінку й спробуйте ще раз" }], 409);
        }
        console.error("[admin.createNodes] Error:", error);
        res.status(500).json({ error: "Failed to create lessons" });
    }
};

// GET /api/stories/admin/nodes/:nodeId — урок у форматі JSON для редагування
export const getNode = async (req: Request, res: Response): Promise<void> => {
    try {
        const node = await loadNode(String(req.params.nodeId));
        if (!node) {
            res.status(404).json({ error: "Lesson not found" });
            return;
        }
        res.status(200).json({
            id: String(node._id),
            chapterId: String(node.chapterId),
            order: node.order,
            lesson: toLessonJson(node),
        });
    } catch (error) {
        console.error("[admin.getNode] Error:", error);
        res.status(500).json({ error: "Failed to fetch lesson" });
    }
};

// PUT /api/stories/admin/nodes/:nodeId { data } — замінити вміст уроку (прогрес юзерів зберігається)
export const updateNode = async (req: Request, res: Response): Promise<void> => {
    try {
        const node = await loadNode(String(req.params.nodeId));
        if (!node) {
            res.status(404).json({ error: "Lesson not found" });
            return;
        }

        const data = (req.body as { data?: unknown } | undefined)?.data;
        const { lessons, issues } = validateLessons(data, { allowArray: false });
        if (issues.length > 0) return sendIssues(res, issues);
        const lesson = lessons[0];

        const slug = lesson.slug ?? node.slug;
        if (slug !== node.slug) {
            const clash = await StoryNode.exists({ chapterId: node.chapterId, slug, _id: { $ne: node._id } });
            if (clash) return sendIssues(res, [{ path: "slug", message: `урок зі slug "${slug}" уже є в цьому розділі` }], 409);
        }

        const fields = { ...lessonFields(lesson), slug };
        const updated = await StoryNode.findByIdAndUpdate(
            node._id,
            lesson.cliffhanger
                ? { $set: { ...fields, cliffhanger: lesson.cliffhanger } }
                : { $set: fields, $unset: { cliffhanger: "" } },
            { returnDocument: "after" },
        ).lean();
        if (!updated) {
            res.status(404).json({ error: "Lesson not found" });
            return;
        }

        voiceNewContent([String(updated._id)]);
        res.status(200).json({ node: toNodeDto(updated), lesson: toLessonJson(updated) });
    } catch (error) {
        if (isDuplicateKeyError(error)) {
            return sendIssues(res, [{ path: "slug", message: "slug уже зайнятий у цьому розділі" }], 409);
        }
        console.error("[admin.updateNode] Error:", error);
        res.status(500).json({ error: "Failed to update lesson" });
    }
};

// DELETE /api/stories/admin/nodes/:nodeId — урок і прогрес по ньому
export const deleteNode = async (req: Request, res: Response): Promise<void> => {
    try {
        const node = await loadNode(String(req.params.nodeId));
        if (!node) {
            res.status(404).json({ error: "Lesson not found" });
            return;
        }

        await UserStoryProgress.deleteMany({ nodeId: node._id });
        await StoryNode.deleteOne({ _id: node._id });

        // Останній урок видалено з опублікованого розділу — знімаємо з публікації,
        // інакше порожній розділ заблокує всі наступні розділи рівня
        let chapterUnpublished = false;
        if ((await countLessons(node.chapterId)) === 0) {
            const result = await Chapter.updateOne(
                { _id: node.chapterId, published: { $ne: false } },
                { $set: { published: false } },
            );
            chapterUnpublished = result.modifiedCount > 0;
        }

        res.status(200).json({ success: true, chapterUnpublished });
    } catch (error) {
        console.error("[admin.deleteNode] Error:", error);
        res.status(500).json({ error: "Failed to delete lesson" });
    }
};

// POST /api/stories/admin/nodes/:nodeId/move { direction: "up" | "down" }
export const moveNode = async (req: Request, res: Response): Promise<void> => {
    try {
        const direction = parseDirection(req);
        const node = await loadNode(String(req.params.nodeId));
        if (!node || !direction) {
            res.status(node ? 400 : 404).json({ error: node ? "direction must be up|down" : "Lesson not found" });
            return;
        }

        const neighbor = await StoryNode.findOne({
            chapterId: node.chapterId,
            order: direction === "up" ? { $lt: node.order } : { $gt: node.order },
        })
            .sort({ order: direction === "up" ? -1 : 1 })
            .select("_id order")
            .lean();

        if (neighbor) {
            await StoryNode.updateOne({ _id: node._id }, { $set: { order: tempOrder() } });
            await StoryNode.updateOne({ _id: neighbor._id }, { $set: { order: node.order } });
            await StoryNode.updateOne({ _id: node._id }, { $set: { order: neighbor.order } });
        }
        res.status(200).json({ success: true, moved: !!neighbor });
    } catch (error) {
        console.error("[admin.moveNode] Error:", error);
        res.status(500).json({ error: "Failed to move lesson" });
    }
};