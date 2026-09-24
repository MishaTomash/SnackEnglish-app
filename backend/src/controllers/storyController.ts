import { Request, Response } from "express";
import { Types } from "mongoose";
import {
    User,
    Chapter,
    PUBLISHED_FILTER,
    StoryNode,
    UserStoryProgress,
    type StoryNodeStatus,
} from "../models/index.js";

// Та сама величина, що й за урок у progressController.completeLesson
const STORY_NODE_REWARD = 10;

const OBJECT_ID_RE = /^[a-f0-9]{24}$/i;

const LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;
type Level = (typeof LEVELS)[number];

const isLevel = (value: unknown): value is Level =>
    typeof value === "string" && (LEVELS as readonly string[]).includes(value);

type ChapterStatus = "locked" | "active" | "completed";

interface ChapterState {
    totalNodes: number;
    doneNodes: number;
    status: ChapterStatus;
}

// ==================== ХЕЛПЕРИ ====================

/**
 * Повертає _id юзера в БД або сам відправляє 401/404 і повертає null.
 */
const requireDbUserId = async (
    req: Request,
    res: Response,
): Promise<Types.ObjectId | null> => {
    const telegramId = req.user?.id;
    if (!telegramId) {
        res.status(401).json({ error: "Unauthorized" });
        return null;
    }

    const user = await User.findOne({ telegramId }).select("_id").lean();
    if (!user) {
        res.status(404).json({ error: "User not found" });
        return null;
    }

    return user._id as Types.ObjectId;
};

/** :chapterId у URL може бути як ObjectId, так і slug. Чернетки юзерам не видно */
const findChapter = (param: string) => {
    const slug = param.toLowerCase();
    return OBJECT_ID_RE.test(param)
        ? Chapter.findOne({ $or: [{ _id: param }, { slug }], ...PUBLISHED_FILTER }).lean()
        : Chapter.findOne({ slug, ...PUBLISHED_FILTER }).lean();
};

const isDuplicateKeyError = (error: unknown): boolean =>
    (error as { code?: number } | null)?.code === 11000;

/**
 * Рахує стан опублікованих розділів одного рівня для юзера. Кожен рівень — окремий ланцюжок:
 *  - перший розділ рівня завжди відкритий;
 *  - наступний відкривається, коли попередній завершено на 100%;
 *  - розділ, який юзер уже почав (є записи прогресу), лишається відкритим,
 *    навіть якщо в попередній розділ пізніше додали нові вузли.
 */
const computeChapterStates = async (userId: Types.ObjectId, level: Level) => {
    const chapters = await Chapter.find({ level, ...PUBLISHED_FILTER }).sort({ order: 1 }).lean();
    const chapterIds = chapters.map((c) => c._id);

    const [nodeCounts, progressCounts] = await Promise.all([
        StoryNode.aggregate<{ _id: Types.ObjectId; total: number }>([
            { $match: { chapterId: { $in: chapterIds } } },
            { $group: { _id: "$chapterId", total: { $sum: 1 } } },
        ]),
        UserStoryProgress.aggregate<{
            _id: Types.ObjectId;
            started: number;
            done: number;
        }>([
            { $match: { userId, chapterId: { $in: chapterIds } } },
            {
                $group: {
                    _id: "$chapterId",
                    started: { $sum: 1 },
                    done: {
                        $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] },
                    },
                },
            },
        ]),
    ]);

    const totalMap = new Map(nodeCounts.map((c) => [String(c._id), c.total]));
    const progressMap = new Map(progressCounts.map((p) => [String(p._id), p]));

    const states = new Map<string, ChapterState>();
    let prevCompleted = true; // перший розділ рівня завжди відкритий

    for (const chapter of chapters) {
        const id = String(chapter._id);
        const totalNodes = totalMap.get(id) ?? 0;
        const progress = progressMap.get(id);
        const doneNodes = Math.min(progress?.done ?? 0, totalNodes);
        // Порожній розділ (контент ще не залитий) не вважається завершеним
        const isCompleted = totalNodes > 0 && doneNodes >= totalNodes;
        const isUnlocked = prevCompleted || (progress?.started ?? 0) > 0;

        states.set(id, {
            totalNodes,
            doneNodes,
            status: !isUnlocked ? "locked" : isCompleted ? "completed" : "active",
        });
        prevCompleted = isCompleted;
    }

    return { chapters, states };
};

/**
 * Знаходить розділ за :chapterId і перевіряє, що він відкритий для юзера.
 * Інакше сам відправляє 404/403 і повертає null.
 */
const requireUnlockedChapter = async (
    req: Request,
    res: Response,
    userId: Types.ObjectId,
) => {
    const chapter = await findChapter(String(req.params.chapterId));
    if (!chapter) {
        res.status(404).json({ error: "Chapter not found" });
        return null;
    }

    const { states } = await computeChapterStates(userId, chapter.level);
    const state = states.get(String(chapter._id));

    if (!state || state.status === "locked") {
        res.status(403).json({ error: "Forbidden: Chapter is locked" });
        return null;
    }

    return { chapter, state };
};

/**
 * Повертає вузли розділу (без steps) зі статусами юзера.
 * Лениво створює відсутні записи прогресу (як completeLesson через upsert):
 * перший вузол — active, кожен наступний — active лише якщо попередній completed.
 * Також "лікує" вузол, що лишився locked після завершеного попереднього
 * (наприклад, якщо completeNode впав між двома записами).
 */
const syncNodeStatuses = async (
    userId: Types.ObjectId,
    chapterId: Types.ObjectId,
) => {
    const [nodes, progress] = await Promise.all([
        StoryNode.find({ chapterId }).sort({ order: 1 }).select("-steps").lean(),
        UserStoryProgress.find({ userId, chapterId })
            .select("nodeId status completedAt")
            .lean(),
    ]);

    const progressMap = new Map(progress.map((p) => [String(p.nodeId), p]));
    const ops: Parameters<typeof UserStoryProgress.bulkWrite>[0] = [];
    const result: {
        node: (typeof nodes)[number];
        status: StoryNodeStatus;
        completedAt: Date | null;
    }[] = [];

    let prevStatus: StoryNodeStatus | null = null;

    for (const [index, node] of nodes.entries()) {
        const existing = progressMap.get(String(node._id));
        const shouldBeOpen: boolean = index === 0 || prevStatus === "completed";
        let status: StoryNodeStatus;

        if (!existing) {
            status = shouldBeOpen ? "active" : "locked";
            ops.push({
                updateOne: {
                    filter: { userId, chapterId, nodeId: node._id },
                    update: { $setOnInsert: { status } },
                    upsert: true,
                },
            });
        } else if (existing.status === "locked" && shouldBeOpen) {
            status = "active";
            ops.push({
                updateOne: {
                    filter: { _id: existing._id, status: "locked" },
                    update: { $set: { status: "active" } },
                },
            });
        } else {
            status = existing.status;
        }

        result.push({ node, status, completedAt: existing?.completedAt ?? null });
        prevStatus = status;
    }

    if (ops.length > 0) {
        try {
            await UserStoryProgress.bulkWrite(ops, { ordered: false });
        } catch (error) {
            // Паралельний запит уже створив ці записи — це нормально
            if (!isDuplicateKeyError(error)) throw error;
        }
    }

    return result;
};

// ==================== ЕНДПОІНТИ ====================

// GET /api/stories?level=B1
// Без level — рівень юзера; якщо для нього ще немає контенту — перший доступний
export const getChapters = async (
    req: Request,
    res: Response,
): Promise<void> => {
    try {
        const userId = await requireDbUserId(req, res);
        if (!userId) return;

        const [user, levelCounts] = await Promise.all([
            User.findById(userId).select("level").lean(),
            Chapter.aggregate<{ _id: string; chapters: number }>([
                { $match: PUBLISHED_FILTER },
                { $group: { _id: "$level", chapters: { $sum: 1 } } },
            ]),
        ]);

        const countByLevel = new Map(levelCounts.map((l) => [l._id, l.chapters]));
        const levels = LEVELS.filter((l) => countByLevel.has(l)).map((l) => ({
            level: l,
            chapters: countByLevel.get(l) ?? 0,
        }));

        const requested =
            typeof req.query.level === "string" ? req.query.level.toUpperCase() : null;
        const userLevel = isLevel(user?.level) ? user.level : null;
        const level: Level = isLevel(requested)
            ? requested
            : userLevel && countByLevel.has(userLevel)
                ? userLevel
                : (levels[0]?.level ?? userLevel ?? "A1");

        const { chapters, states } = await computeChapterStates(userId, level);

        res.status(200).json({
            level,
            userLevel,
            levels,
            chapters: chapters.map((chapter) => {
                const state = states.get(String(chapter._id))!;
                return {
                    id: String(chapter._id),
                    slug: chapter.slug,
                    title: chapter.title,
                    subtitle: chapter.subtitle,
                    cover: chapter.cover,
                    accent: chapter.accent,
                    level: chapter.level,
                    order: chapter.order,
                    totalNodes: state.totalNodes,
                    doneNodes: state.doneNodes,
                    status: state.status,
                    locked: state.status === "locked",
                };
            }),
        });
    } catch (error) {
        console.error("[getChapters] Error:", error);
        res.status(500).json({ error: "Failed to fetch chapters" });
    }
};

// GET /api/stories/:chapterId
export const getChapterNodes = async (
    req: Request,
    res: Response,
): Promise<void> => {
    try {
        const userId = await requireDbUserId(req, res);
        if (!userId) return;

        const access = await requireUnlockedChapter(req, res, userId);
        if (!access) return;
        const { chapter, state } = access;

        const nodes = await syncNodeStatuses(userId, chapter._id as Types.ObjectId);

        res.status(200).json({
            chapter: {
                id: String(chapter._id),
                slug: chapter.slug,
                title: chapter.title,
                subtitle: chapter.subtitle,
                cover: chapter.cover,
                accent: chapter.accent,
                level: chapter.level,
                order: chapter.order,
                totalNodes: state.totalNodes,
                doneNodes: state.doneNodes,
                status: state.status,
            },
            nodes: nodes.map(({ node, status, completedAt }) => ({
                id: String(node._id),
                order: node.order,
                icon: node.icon,
                label: node.label,
                npc: node.npc,
                npcName: node.npcName,
                isBoss: node.isBoss,
                status,
                completedAt,
            })),
        });
    } catch (error) {
        console.error("[getChapterNodes] Error:", error);
        res.status(500).json({ error: "Failed to fetch chapter nodes" });
    }
};

// GET /api/stories/:chapterId/nodes/:nodeId
export const getNodeContent = async (
    req: Request,
    res: Response,
): Promise<void> => {
    try {
        const userId = await requireDbUserId(req, res);
        if (!userId) return;

        const nodeId = String(req.params.nodeId);
        if (!OBJECT_ID_RE.test(nodeId)) {
            res.status(404).json({ error: "Node not found" });
            return;
        }

        const access = await requireUnlockedChapter(req, res, userId);
        if (!access) return;
        const chapterId = access.chapter._id as Types.ObjectId;

        const nodes = await syncNodeStatuses(userId, chapterId);
        const entry = nodes.find((n) => String(n.node._id) === nodeId);

        if (!entry) {
            res.status(404).json({ error: "Node not found" });
            return;
        }
        if (entry.status === "locked") {
            res.status(403).json({ error: "Forbidden: Node is locked" });
            return;
        }

        const node = await StoryNode.findOne({ _id: nodeId, chapterId }).lean();
        if (!node) {
            res.status(404).json({ error: "Node not found" });
            return;
        }

        res.status(200).json({
            id: String(node._id),
            chapterId: String(chapterId),
            order: node.order,
            icon: node.icon,
            label: node.label,
            npc: node.npc,
            npcName: node.npcName,
            isBoss: node.isBoss,
            cliffhanger: node.cliffhanger ?? null,
            steps: node.steps,
            status: entry.status,
        });
    } catch (error) {
        console.error("[getNodeContent] Error:", error);
        res.status(500).json({ error: "Failed to fetch node content" });
    }
};

// POST /api/stories/:chapterId/nodes/:nodeId/complete
export const completeNode = async (
    req: Request,
    res: Response,
): Promise<void> => {
    try {
        const userId = await requireDbUserId(req, res);
        if (!userId) return;

        const nodeId = String(req.params.nodeId);
        if (!OBJECT_ID_RE.test(nodeId)) {
            res.status(404).json({ error: "Node not found" });
            return;
        }

        const access = await requireUnlockedChapter(req, res, userId);
        if (!access) return;
        const chapterId = access.chapter._id as Types.ObjectId;

        const nodes = await syncNodeStatuses(userId, chapterId);
        const index = nodes.findIndex((n) => String(n.node._id) === nodeId);

        if (index === -1) {
            res.status(404).json({ error: "Node not found" });
            return;
        }
        if (nodes[index].status === "locked") {
            res.status(403).json({ error: "Forbidden: Node is locked" });
            return;
        }

        const nextNode = nodes[index + 1]?.node ?? null;
        const chapterCompleted = nodes.every(
            (n, i) => i === index || n.status === "completed",
        );

        // Атомарно: active -> completed. Якщо запис уже completed (повторне
        // проходження або подвійний клік) — бали НЕ нараховуються вдруге.
        const flipped = await UserStoryProgress.findOneAndUpdate(
            { userId, chapterId, nodeId, status: "active" },
            { $set: { status: "completed", completedAt: new Date() } },
            { returnDocument: "after" },
        );

        if (!flipped) {
            const user = await User.findById(userId)
                .select("totalScore weeklyScore")
                .lean();
            res.status(200).json({
                success: true,
                alreadyCompleted: true,
                earnedXp: 0,
                totalScore: user?.totalScore ?? 0,
                weeklyScore: user?.weeklyScore ?? 0,
                nextNodeId: nextNode ? String(nextNode._id) : null,
                chapterCompleted,
            });
            return;
        }

        // Відкриваємо наступний вузол (запис уже існує після syncNodeStatuses)
        if (nextNode) {
            await UserStoryProgress.updateOne(
                { userId, chapterId, nodeId: nextNode._id, status: "locked" },
                { $set: { status: "active" } },
            );
        }

        // Нарахування балів — той самий патерн, що й у completeLesson
        const updatedUser = await User.findByIdAndUpdate(
            userId,
            {
                $inc: { totalScore: STORY_NODE_REWARD, weeklyScore: STORY_NODE_REWARD },
            },
            { returnDocument: "after" },
        );

        req.logEvent("story_node_completed", {
            chapterId: String(chapterId),
            nodeId,
            isBoss: nodes[index].node.isBoss,
            chapterCompleted,
        });

        res.status(200).json({
            success: true,
            alreadyCompleted: false,
            earnedXp: STORY_NODE_REWARD,
            totalScore: updatedUser?.totalScore ?? 0,
            weeklyScore: updatedUser?.weeklyScore ?? 0,
            nextNodeId: nextNode ? String(nextNode._id) : null,
            chapterCompleted,
        });
    } catch (error) {
        console.error("[completeNode] Error:", error);
        res.status(500).json({ error: "Failed to complete node" });
    }
};