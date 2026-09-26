// 📁 Файл: SnackEnglish-app/backend/src/controllers/admin/dashboardController.ts
import type { Request, Response } from "express";
import { User } from "../../models/User.js";
import { AnalyticsEvent } from "../../models/AnalyticsEvent.js";
import { UserStoryProgress } from "../../models/index.js";
import { Game } from "../../models/Game.js";
import { UserGamePurchase } from "../../models/UserGamePurchase.js";
import { ManualPaymentRequest } from "../../models/ManualPaymentRequest.js";
import {
    DAY_MS,
    displayName,
    fillDays,
    getAdminTimezone,
    logAdminError,
    sendError,
    startOfDayAgo,
} from "./adminHelpers.js";
import type { DailyPoint } from "./adminHelpers.js";

/**
 * Дашборд: ключові цифри, графіки по днях, рівні, стріки, дохід, повернення юзерів.
 * Агрегації важкі, тож результат кешується на хвилину.
 */

const CACHE_TTL_MS = 60 * 1000;
const ALLOWED_PERIODS = [7, 14, 30, 90];

interface DashboardData {
    generatedAt: string;
    periodDays: number;
    users: {
        total: number;
        newToday: number;
        new7: number;
        new30: number;
        activeToday: number;
        active7: number;
        active30: number;
        onboarded: number;
        blocked: number;
    };
    series: {
        newUsers: DailyPoint[];
        activeUsers: DailyPoint[];
        lessonsCompleted: DailyPoint[];
    };
    levels: { level: string; count: number }[];
    streaks: { average: number; max: number; weekPlus: number; monthPlus: number };
    retention: { cohortSize: number; returned: number; rate: number };
    revenue: {
        starsTotal: number;
        starsPurchases: number;
        manualApproved: number;
        manualPending: number;
        byGame: { gameId: string; title: string; stars: number; manual: number }[];
    };
    week: {
        totalScore: number;
        players: number;
        top: { telegramId: number; name: string; score: number }[];
    };
    topEvents: { eventType: string; count: number }[];
}

const cache = new Map<number, { data: DashboardData; expiresAt: number }>();

export const clearDashboardCache = (): void => cache.clear();

type CountRow = { _id: string; count: number };

interface WeekTopRow {
    telegramId: number;
    username?: string | null;
    telegramFirstName?: string | null;
    customDisplayName?: string | null;
    weeklyScore?: number;
}

const buildDashboard = async (days: number): Promise<DashboardData> => {
    const tz = getAdminTimezone();
    const now = Date.now();
    const since = startOfDayAgo(days - 1);
    const today = startOfDayAgo(0);
    const weekAgo = new Date(now - 7 * DAY_MS);
    const monthAgo = new Date(now - 30 * DAY_MS);
    const dayFormat = (field: string) => ({ $dateToString: { format: "%Y-%m-%d", date: field, timezone: tz } });

    const [
        total,
        newToday,
        new7,
        new30,
        activeToday,
        active7,
        active30,
        onboarded,
        blocked,
        newUsersRows,
        activeRows,
        lessonRows,
        levelRows,
        streakRows,
        cohortSize,
        returned,
        starsRows,
        manualRows,
        manualPending,
        weekRows,
        weekTop,
        topEventRows,
        games,
    ] = await Promise.all([
        User.countDocuments(),
        User.countDocuments({ createdAt: { $gte: today } }),
        User.countDocuments({ createdAt: { $gte: weekAgo } }),
        User.countDocuments({ createdAt: { $gte: monthAgo } }),
        // lastActivityDate оновлюється при першому відкритті застосунку за день
        User.countDocuments({ lastActivityDate: { $gte: today } }),
        User.countDocuments({ lastActivityDate: { $gte: weekAgo } }),
        User.countDocuments({ lastActivityDate: { $gte: monthAgo } }),
        User.countDocuments({ onboardingCompleted: true }),
        User.countDocuments({ blocked: true }),
        User.aggregate<CountRow>([
            { $match: { createdAt: { $gte: since } } },
            { $group: { _id: dayFormat("$createdAt"), count: { $sum: 1 } } },
        ]),
        // Активні по днях — унікальні юзери з подіями аналітики
        AnalyticsEvent.aggregate<CountRow>([
            { $match: { createdAt: { $gte: since } } },
            { $group: { _id: { day: dayFormat("$createdAt"), user: "$telegramId" } } },
            { $group: { _id: "$_id.day", count: { $sum: 1 } } },
        ]),
        UserStoryProgress.aggregate<CountRow>([
            { $match: { status: "completed", completedAt: { $gte: since } } },
            { $group: { _id: dayFormat("$completedAt"), count: { $sum: 1 } } },
        ]),
        User.aggregate<{ _id: string | null; count: number }>([
            { $group: { _id: "$level", count: { $sum: 1 } } },
            { $sort: { count: -1 } },
        ]),
        User.aggregate<{ average: number; max: number; weekPlus: number; monthPlus: number }>([
            {
                $group: {
                    _id: null,
                    average: { $avg: "$streak" },
                    max: { $max: "$streak" },
                    weekPlus: { $sum: { $cond: [{ $gte: ["$streak", 7] }, 1, 0] } },
                    monthPlus: { $sum: { $cond: [{ $gte: ["$streak", 30] }, 1, 0] } },
                },
            },
        ]),
        // Повернення: юзери, що прийшли 7–14 днів тому. Повернулись — заходили через 7+ днів після реєстрації
        User.countDocuments({ createdAt: { $gte: new Date(now - 14 * DAY_MS), $lt: weekAgo } }),
        User.countDocuments({
            createdAt: { $gte: new Date(now - 14 * DAY_MS), $lt: weekAgo },
            $expr: { $gte: ["$lastActivityDate", { $add: ["$createdAt", 7 * DAY_MS] }] },
        }),
        UserGamePurchase.aggregate<{ _id: string; count: number }>([
            { $match: { telegramPaymentChargeId: { $type: "string" } } },
            { $group: { _id: "$gameId", count: { $sum: 1 } } },
        ]),
        ManualPaymentRequest.aggregate<{ _id: string; count: number }>([
            { $match: { status: "approved" } },
            { $group: { _id: "$gameId", count: { $sum: 1 } } },
        ]),
        ManualPaymentRequest.countDocuments({ status: "pending" }),
        User.aggregate<{ totalScore: number; players: number }>([
            { $match: { weeklyScore: { $gt: 0 } } },
            { $group: { _id: null, totalScore: { $sum: "$weeklyScore" }, players: { $sum: 1 } } },
        ]),
        User.find({ weeklyScore: { $gt: 0 } })
            .sort({ weeklyScore: -1, streak: -1, _id: 1 })
            .limit(5)
            .select("telegramId username telegramFirstName customDisplayName weeklyScore")
            .lean<WeekTopRow[]>(),
        AnalyticsEvent.aggregate<CountRow>([
            { $match: { createdAt: { $gte: weekAgo } } },
            { $group: { _id: "$eventType", count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 10 },
        ]),
        Game.find().select("gameId title priceStars").lean<{ gameId: string; title: string; priceStars?: number }[]>(),
    ]);

    const gameMap = new Map(games.map((g) => [g.gameId, g]));
    const byGameMap = new Map<string, { gameId: string; title: string; stars: number; manual: number }>();
    const ensureGame = (gameId: string) => {
        let row = byGameMap.get(gameId);
        if (!row) {
            row = { gameId, title: gameMap.get(gameId)?.title ?? gameId, stars: 0, manual: 0 };
            byGameMap.set(gameId, row);
        }
        return row;
    };

    let starsTotal = 0;
    let starsPurchases = 0;
    for (const row of starsRows) {
        const price = gameMap.get(row._id)?.priceStars ?? 0;
        starsTotal += price * row.count;
        starsPurchases += row.count;
        ensureGame(row._id).stars += row.count;
    }
    let manualApproved = 0;
    for (const row of manualRows) {
        manualApproved += row.count;
        ensureGame(row._id).manual += row.count;
    }

    const streak = streakRows[0];

    return {
        generatedAt: new Date().toISOString(),
        periodDays: days,
        users: { total, newToday, new7, new30, activeToday, active7, active30, onboarded, blocked },
        series: {
            newUsers: fillDays(newUsersRows, days),
            activeUsers: fillDays(activeRows, days),
            lessonsCompleted: fillDays(lessonRows, days),
        },
        levels: levelRows.map((row) => ({ level: row._id ?? "—", count: row.count })),
        streaks: {
            average: Math.round((streak?.average ?? 0) * 10) / 10,
            max: streak?.max ?? 0,
            weekPlus: streak?.weekPlus ?? 0,
            monthPlus: streak?.monthPlus ?? 0,
        },
        retention: {
            cohortSize,
            returned,
            rate: cohortSize > 0 ? Math.round((returned / cohortSize) * 1000) / 10 : 0,
        },
        revenue: {
            starsTotal,
            starsPurchases,
            manualApproved,
            manualPending,
            byGame: Array.from(byGameMap.values()).sort((a, b) => b.stars + b.manual - (a.stars + a.manual)),
        },
        week: {
            totalScore: weekRows[0]?.totalScore ?? 0,
            players: weekRows[0]?.players ?? 0,
            top: weekTop.map((u) => ({ telegramId: u.telegramId, name: displayName(u), score: u.weeklyScore ?? 0 })),
        },
        topEvents: topEventRows.map((row) => ({ eventType: row._id, count: row.count })),
    };
};

// GET /api/admin/dashboard?days=30
export const getDashboard = async (req: Request, res: Response): Promise<void> => {
    try {
        const requested = Number(req.query.days);
        const days = ALLOWED_PERIODS.includes(requested) ? requested : 30;
        const fresh = req.query.fresh === "1";

        const cached = cache.get(days);
        if (!fresh && cached && cached.expiresAt > Date.now()) {
            res.json(cached.data);
            return;
        }

        const data = await buildDashboard(days);
        cache.set(days, { data, expiresAt: Date.now() + CACHE_TTL_MS });
        res.json(data);
    } catch (error) {
        logAdminError("dashboard", error);
        sendError(res, 500, "Не вдалося зібрати статистику");
    }
};