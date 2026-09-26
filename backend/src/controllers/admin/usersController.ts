// 📁 Файл: SnackEnglish-app/backend/src/controllers/admin/usersController.ts
import type { Request, Response } from "express";
import type { QueryFilter, Types, UpdateQuery } from "mongoose";
import { TelegramError } from "telegraf";
import { User } from "../../models/User.js";
import type { IUser } from "../../models/User.js";
import { AnalyticsEvent } from "../../models/AnalyticsEvent.js";
import { UserStoryProgress } from "../../models/index.js";
import { Friendship } from "../../models/Friendship.js";
import { Like } from "../../models/Like.js";
import { Game } from "../../models/Game.js";
import { UserGamePurchase } from "../../models/UserGamePurchase.js";
import { ManualPaymentRequest } from "../../models/ManualPaymentRequest.js";
import { bot } from "../../bot.js";
import { invalidateBlockedCache } from "../../middlewares/authMiddleware.js";
import { getUserPosition, invalidateLeaderboardCache } from "../leaderboardController.js";
import {
    escapeRegex,
    isLevel,
    logAdminError,
    parseLimit,
    parsePage,
    parseTelegramId,
    sendError,
} from "./adminHelpers.js";

const LIST_FIELDS =
    "telegramId username telegramFirstName customDisplayName customAvatarUrl telegramPhotoUrl level streak hp weeklyScore totalScore blocked onboardingCompleted lastActivityDate createdAt";

const SORT_FIELDS = new Set(["createdAt", "lastActivityDate", "weeklyScore", "totalScore", "streak"]);
const MAX_SCORE_DELTA = 100000;
const MAX_MESSAGE_LENGTH = 4096;

interface AdminUserRow {
    _id: Types.ObjectId;
    telegramId: number;
    username?: string | null;
    telegramFirstName?: string | null;
    customDisplayName?: string | null;
    customAvatarUrl?: string | null;
    telegramPhotoUrl?: string | null;
    level?: string | null;
    streak?: number;
    hp?: number;
    weeklyScore?: number;
    totalScore?: number;
    blocked?: boolean;
    onboardingCompleted?: boolean;
    lastActivityDate?: Date | null;
    createdAt?: Date;
}

const getAdminId = (): number => Number(process.env.VITE_ADMIN_ID || "0");

// GET /api/admin/users?search=&status=&level=&onboarding=&sort=&order=&page=&limit=
export const listUsers = async (req: Request, res: Response): Promise<void> => {
    try {
        const page = parsePage(req.query.page);
        const limit = parseLimit(req.query.limit, 20, 100);
        const filter: QueryFilter<IUser> = {};

        const search = typeof req.query.search === "string" ? req.query.search.trim().replace(/^@/, "").slice(0, 64) : "";
        if (search) {
            const regex = new RegExp(escapeRegex(search), "i");
            const or: QueryFilter<IUser>[] = [
                { username: regex },
                { telegramFirstName: regex },
                { customDisplayName: regex },
            ];
            if (/^\d+$/.test(search)) or.push({ telegramId: Number(search) });
            filter.$or = or;
        }

        if (req.query.status === "blocked") filter.blocked = true;
        if (req.query.status === "active") filter.blocked = { $ne: true };
        if (isLevel(req.query.level)) filter.level = req.query.level;
        if (req.query.onboarding === "done") filter.onboardingCompleted = true;
        if (req.query.onboarding === "pending") filter.onboardingCompleted = { $ne: true };

        const sortField = typeof req.query.sort === "string" && SORT_FIELDS.has(req.query.sort) ? req.query.sort : "createdAt";
        const sortOrder = req.query.order === "asc" ? 1 : -1;

        const [users, total] = await Promise.all([
            User.find(filter)
                .select(LIST_FIELDS)
                .sort({ [sortField]: sortOrder, _id: sortOrder })
                .skip((page - 1) * limit)
                .limit(limit)
                .lean<AdminUserRow[]>(),
            User.countDocuments(filter),
        ]);

        res.json({ users, total, page, pages: Math.max(1, Math.ceil(total / limit)) });
    } catch (error) {
        logAdminError("users:list", error);
        sendError(res, 500, "Не вдалося завантажити юзерів");
    }
};

// GET /api/admin/users/:telegramId
export const getUserDetail = async (req: Request, res: Response): Promise<void> => {
    try {
        const telegramId = parseTelegramId(req.params.telegramId);
        if (!telegramId) return sendError(res, 400, "Невірний telegramId");

        const user = await User.findOne({ telegramId }).select(`${LIST_FIELDS} weakAreas`).lean<AdminUserRow>();
        if (!user) return sendError(res, 404, "Юзера не знайдено");

        const [lessonsCompleted, friendsCount, likesReceived, purchases, payments, events, rank, games] =
            await Promise.all([
                UserStoryProgress.countDocuments({ userId: user._id, status: "completed" }),
                Friendship.countDocuments({
                    $or: [{ userId: user._id }, { friendId: user._id }],
                    status: "accepted",
                }),
                Like.countDocuments({ targetId: user._id }),
                UserGamePurchase.find({ telegramId })
                    .sort({ purchasedAt: -1 })
                    .lean<{ gameId: string; purchasedAt?: Date; telegramPaymentChargeId?: string | null }[]>(),
                ManualPaymentRequest.find({ telegramId })
                    .sort({ createdAt: -1 })
                    .limit(20)
                    .lean<{ _id: Types.ObjectId; gameId: string; uniqueCode: string; status: string; createdAt?: Date }[]>(),
                AnalyticsEvent.find({ telegramId })
                    .sort({ createdAt: -1 })
                    .limit(30)
                    .lean<{ _id: Types.ObjectId; eventType: string; metadata?: unknown; createdAt?: Date }[]>(),
                getUserPosition({ _id: user._id, weeklyScore: user.weeklyScore, streak: user.streak }),
                Game.find().select("gameId title").lean<{ gameId: string; title: string }[]>(),
            ]);

        const titles = new Map(games.map((g) => [g.gameId, g.title]));

        res.json({
            user,
            stats: { lessonsCompleted, friendsCount, likesReceived, weeklyRank: rank },
            purchases: purchases.map((p) => ({
                gameId: p.gameId,
                title: titles.get(p.gameId) ?? p.gameId,
                purchasedAt: p.purchasedAt ?? null,
                method: p.telegramPaymentChargeId ? "stars" : "manual",
            })),
            payments: payments.map((p) => ({
                id: p._id.toString(),
                gameTitle: titles.get(p.gameId) ?? p.gameId,
                uniqueCode: p.uniqueCode,
                status: p.status,
                createdAt: p.createdAt ?? null,
            })),
            events: events.map((e) => ({
                id: e._id.toString(),
                eventType: e.eventType,
                metadata: e.metadata ?? null,
                createdAt: e.createdAt ?? null,
            })),
        });
    } catch (error) {
        logAdminError("users:detail", error);
        sendError(res, 500, "Не вдалося завантажити юзера");
    }
};

// PATCH /api/admin/users/:telegramId  { blocked?, level?, hp?, streak?, scoreDelta? }
export const updateUser = async (req: Request, res: Response): Promise<void> => {
    try {
        const telegramId = parseTelegramId(req.params.telegramId);
        if (!telegramId) return sendError(res, 400, "Невірний telegramId");
        const body = (req.body ?? {}) as Record<string, unknown>;

        const $set: Record<string, unknown> = {};
        const update: UpdateQuery<IUser> = {};

        if (body.blocked !== undefined) {
            if (typeof body.blocked !== "boolean") return sendError(res, 400, "blocked має бути true/false");
            if (body.blocked && telegramId === getAdminId()) return sendError(res, 400, "Не можна заблокувати себе");
            $set.blocked = body.blocked;
        }
        if (body.level !== undefined) {
            if (body.level !== null && !isLevel(body.level)) return sendError(res, 400, "Невірний рівень");
            $set.level = body.level;
        }
        if (body.hp !== undefined) {
            const hp = Number(body.hp);
            if (!Number.isInteger(hp) || hp < 0 || hp > 5) return sendError(res, 400, "Життя — від 0 до 5");
            $set.hp = hp;
        }
        if (body.streak !== undefined) {
            const streak = Number(body.streak);
            if (!Number.isInteger(streak) || streak < 0 || streak > 10000) return sendError(res, 400, "Невірний стрік");
            $set.streak = streak;
        }

        let scoreDelta = 0;
        if (body.scoreDelta !== undefined) {
            scoreDelta = Number(body.scoreDelta);
            if (!Number.isInteger(scoreDelta) || Math.abs(scoreDelta) > MAX_SCORE_DELTA) {
                return sendError(res, 400, `Зміна кубків — ціле число до ±${MAX_SCORE_DELTA}`);
            }
            // Кубки тижня і за весь час змінюються разом, як при звичайному нарахуванні
            if (scoreDelta !== 0) update.$inc = { weeklyScore: scoreDelta, totalScore: scoreDelta };
        }

        if (Object.keys($set).length > 0) update.$set = $set;
        if (!update.$set && !update.$inc) return sendError(res, 400, "Немає змін");

        const updated = await User.findOneAndUpdate({ telegramId }, update, { returnDocument: "after" })
            .select(LIST_FIELDS)
            .lean<AdminUserRow>();
        if (!updated) return sendError(res, 404, "Юзера не знайдено");

        // Кубки не можуть піти в мінус після зняття
        if (scoreDelta < 0 && ((updated.weeklyScore ?? 0) < 0 || (updated.totalScore ?? 0) < 0)) {
            await User.updateOne({ telegramId, weeklyScore: { $lt: 0 } }, { $set: { weeklyScore: 0 } });
            await User.updateOne({ telegramId, totalScore: { $lt: 0 } }, { $set: { totalScore: 0 } });
            updated.weeklyScore = Math.max(0, updated.weeklyScore ?? 0);
            updated.totalScore = Math.max(0, updated.totalScore ?? 0);
        }

        if ($set.blocked !== undefined) invalidateBlockedCache(telegramId);
        if (scoreDelta !== 0) invalidateLeaderboardCache();

        req.logEvent("admin_user_updated", { targetTelegramId: telegramId, fields: Object.keys(body) });
        res.json({ user: updated });
    } catch (error) {
        logAdminError("users:update", error);
        sendError(res, 500, "Не вдалося оновити юзера");
    }
};

// POST /api/admin/users/:telegramId/message  { text }
export const messageUser = async (req: Request, res: Response): Promise<void> => {
    try {
        const telegramId = parseTelegramId(req.params.telegramId);
        if (!telegramId) return sendError(res, 400, "Невірний telegramId");

        const text: unknown = req.body?.text;
        if (typeof text !== "string" || !text.trim()) return sendError(res, 400, "Порожнє повідомлення");
        if (text.length > MAX_MESSAGE_LENGTH) return sendError(res, 400, `До ${MAX_MESSAGE_LENGTH} символів`);

        if (!(await User.exists({ telegramId }))) return sendError(res, 404, "Юзера не знайдено");

        try {
            await bot.telegram.sendMessage(telegramId, text, { parse_mode: "HTML" });
        } catch (error) {
            if (error instanceof TelegramError && error.code === 403) {
                return sendError(res, 409, "Юзер заблокував бота — повідомлення не доставити");
            }
            if (error instanceof TelegramError && error.code === 400) {
                return sendError(res, 400, `Telegram відхилив текст: ${error.description}`);
            }
            throw error;
        }

        res.json({ success: true });
    } catch (error) {
        logAdminError("users:message", error);
        sendError(res, 500, "Не вдалося надіслати повідомлення");
    }
};

// POST /api/admin/users/:telegramId/games  { gameId, grant }
export const setUserGame = async (req: Request, res: Response): Promise<void> => {
    try {
        const telegramId = parseTelegramId(req.params.telegramId);
        if (!telegramId) return sendError(res, 400, "Невірний telegramId");

        const gameId: unknown = req.body?.gameId;
        const grant: unknown = req.body?.grant;
        if (typeof gameId !== "string" || typeof grant !== "boolean") return sendError(res, 400, "Потрібні gameId і grant");

        const [userExists, game] = await Promise.all([
            User.exists({ telegramId }),
            Game.findOne({ gameId }).select("gameId").lean(),
        ]);
        if (!userExists) return sendError(res, 404, "Юзера не знайдено");
        if (!game) return sendError(res, 404, "Гру не знайдено");

        if (grant) {
            await UserGamePurchase.updateOne(
                { telegramId, gameId },
                { $setOnInsert: { purchasedAt: new Date() } },
                { upsert: true },
            );
        } else {
            await UserGamePurchase.deleteOne({ telegramId, gameId });
        }

        req.logEvent("admin_game_access", { targetTelegramId: telegramId, gameId, grant });
        res.json({ success: true });
    } catch (error) {
        logAdminError("users:games", error);
        sendError(res, 500, "Не вдалося змінити доступ до гри");
    }
};

// ==================== CSV ====================

/** Екранування для CSV + захист від формул Excel (=, +, -, @ на початку) */
const csvCell = (value: unknown): string => {
    let text = value === null || value === undefined ? "" : value instanceof Date ? value.toISOString() : String(value);
    if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
    return /[",\n\r;]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

// POST /api/admin/users/export — CSV приходить адміну в чат з ботом
export const exportUsers = async (req: Request, res: Response): Promise<void> => {
    try {
        const adminId = getAdminId();
        if (!adminId) return sendError(res, 503, "VITE_ADMIN_ID не задано");

        const header = [
            "telegramId",
            "username",
            "firstName",
            "displayName",
            "level",
            "streak",
            "weeklyScore",
            "totalScore",
            "onboarding",
            "blocked",
            "lastActivity",
            "createdAt",
        ];
        const lines: string[] = [header.join(",")];

        const cursor = User.find().select(LIST_FIELDS).sort({ createdAt: 1 }).lean<AdminUserRow[]>().cursor();
        for await (const u of cursor) {
            lines.push(
                [
                    u.telegramId,
                    u.username,
                    u.telegramFirstName,
                    u.customDisplayName,
                    u.level,
                    u.streak ?? 0,
                    u.weeklyScore ?? 0,
                    u.totalScore ?? 0,
                    u.onboardingCompleted ? "yes" : "no",
                    u.blocked ? "yes" : "no",
                    u.lastActivityDate,
                    u.createdAt,
                ]
                    .map(csvCell)
                    .join(","),
            );
        }

        const date = new Date().toISOString().slice(0, 10);
        // BOM — щоб Excel правильно показав кирилицю
        const buffer = Buffer.from(`\uFEFF${lines.join("\n")}`, "utf-8");
        await bot.telegram.sendDocument(
            adminId,
            { source: buffer, filename: `snackenglish-users-${date}.csv` },
            { caption: `👥 Юзери: ${lines.length - 1}` },
        );

        res.json({ success: true, count: lines.length - 1 });
    } catch (error) {
        logAdminError("users:export", error);
        sendError(res, 500, "Не вдалося вивантажити юзерів");
    }
};

// GET /api/admin/games — для видачі доступу до гри
export const listGames = async (_req: Request, res: Response): Promise<void> => {
    try {
        const games = await Game.find()
            .select("gameId title isFree priceStars")
            .lean<{ gameId: string; title: string; isFree?: boolean; priceStars?: number }[]>();
        res.json(games);
    } catch (error) {
        logAdminError("games", error);
        sendError(res, 500, "Не вдалося завантажити ігри");
    }
};