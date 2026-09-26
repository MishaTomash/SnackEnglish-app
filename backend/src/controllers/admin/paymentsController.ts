// 📁 Файл: SnackEnglish-app/backend/src/controllers/admin/paymentsController.ts
import type { Request, Response } from "express";
import type { Types } from "mongoose";
import { bot } from "../../bot.js";
import { User } from "../../models/User.js";
import { Game } from "../../models/Game.js";
import { UserGamePurchase } from "../../models/UserGamePurchase.js";
import { ManualPaymentRequest } from "../../models/ManualPaymentRequest.js";
import { resolveManualPayment } from "../../services/paymentService.js";
import { displayName, isObjectIdString, logAdminError, parseLimit, parsePage, sendError } from "./adminHelpers.js";

const STATUSES = ["pending", "approved", "rejected"];
const MAX_RECEIPT_BYTES = 20 * 1024 * 1024; // ліміт getFile у Telegram Bot API

interface NameRow {
    telegramId: number;
    username?: string | null;
    telegramFirstName?: string | null;
    customDisplayName?: string | null;
}

interface PaymentRequestRow {
    _id: Types.ObjectId;
    telegramId: number;
    gameId: string;
    uniqueCode: string;
    status: string;
    screenshotFileId?: string | null;
    createdAt?: Date;
}

const loadNames = async (telegramIds: number[]): Promise<Map<number, string>> => {
    if (telegramIds.length === 0) return new Map();
    const users = await User.find({ telegramId: { $in: telegramIds } })
        .select("telegramId username telegramFirstName customDisplayName")
        .lean<NameRow[]>();
    return new Map(users.map((u) => [u.telegramId, displayName(u)]));
};

const loadGameTitles = async (): Promise<Map<string, { title: string; priceStars?: number }>> => {
    const games = await Game.find().select("gameId title priceStars").lean<{ gameId: string; title: string; priceStars?: number }[]>();
    return new Map(games.map((g) => [g.gameId, { title: g.title, priceStars: g.priceStars }]));
};

// GET /api/admin/payments?status=pending|approved|rejected|all&page=
export const listPayments = async (req: Request, res: Response): Promise<void> => {
    try {
        const page = parsePage(req.query.page);
        const limit = parseLimit(req.query.limit, 20, 50);
        const status = typeof req.query.status === "string" ? req.query.status : "pending";
        const filter: Record<string, string> = STATUSES.includes(status) ? { status } : {};

        const [requests, total, pendingCount] = await Promise.all([
            ManualPaymentRequest.find(filter)
                .sort({ createdAt: -1 })
                .skip((page - 1) * limit)
                .limit(limit)
                .lean<PaymentRequestRow[]>(),
            ManualPaymentRequest.countDocuments(filter),
            ManualPaymentRequest.countDocuments({ status: "pending" }),
        ]);

        const [names, games] = await Promise.all([
            loadNames(Array.from(new Set(requests.map((r) => r.telegramId)))),
            loadGameTitles(),
        ]);

        res.json({
            payments: requests.map((r) => ({
                id: r._id.toString(),
                telegramId: r.telegramId,
                userName: names.get(r.telegramId) ?? `#${r.telegramId}`,
                gameId: r.gameId,
                gameTitle: games.get(r.gameId)?.title ?? r.gameId,
                uniqueCode: r.uniqueCode,
                status: r.status,
                hasReceipt: Boolean(r.screenshotFileId),
                createdAt: r.createdAt ?? null,
            })),
            total,
            pendingCount,
            page,
            pages: Math.max(1, Math.ceil(total / limit)),
        });
    } catch (error) {
        logAdminError("payments:list", error);
        sendError(res, 500, "Не вдалося завантажити оплати");
    }
};

/**
 * GET /api/admin/payments/:id/receipt — квитанція через наш сервер.
 * Пряме посилання Telegram на файл містить токен бота, тому клієнту його не віддаємо.
 */
export const getReceipt = async (req: Request, res: Response): Promise<void> => {
    try {
        const id = req.params.id;
        if (!isObjectIdString(id)) return sendError(res, 400, "Невірний id");

        const request = await ManualPaymentRequest.findById(id).select("screenshotFileId").lean<{ screenshotFileId?: string | null }>();
        if (!request?.screenshotFileId) return sendError(res, 404, "Квитанції немає");

        const link = await bot.telegram.getFileLink(request.screenshotFileId);
        const response = await fetch(link, { signal: AbortSignal.timeout(20000) });
        if (!response.ok) return sendError(res, 502, "Telegram не віддав файл");

        const buffer = Buffer.from(await response.arrayBuffer());
        if (buffer.length > MAX_RECEIPT_BYTES) return sendError(res, 413, "Файл завеликий");

        const contentType = response.headers.get("content-type") || "application/octet-stream";
        res.setHeader("Content-Type", contentType);
        res.setHeader("Cache-Control", "private, max-age=3600");
        res.send(buffer);
    } catch (error) {
        logAdminError("payments:receipt", error);
        sendError(res, 500, "Не вдалося завантажити квитанцію");
    }
};

// POST /api/admin/payments/:id/resolve  { action: "approve" | "reject" }
export const resolvePayment = async (req: Request, res: Response): Promise<void> => {
    try {
        const id = req.params.id;
        const action: unknown = req.body?.action;
        if (!isObjectIdString(id)) return sendError(res, 400, "Невірний id");
        if (action !== "approve" && action !== "reject") return sendError(res, 400, "action: approve або reject");

        const request = await resolveManualPayment(id, action);
        if (!request) return sendError(res, 409, "Заявку вже оброблено або її не існує");

        req.logEvent("admin_payment_resolved", { requestId: id, action });
        res.json({ success: true, status: request.status });
    } catch (error) {
        logAdminError("payments:resolve", error);
        sendError(res, 500, "Не вдалося обробити заявку");
    }
};

// GET /api/admin/purchases — останні покупки за Зірки
export const listPurchases = async (req: Request, res: Response): Promise<void> => {
    try {
        const limit = parseLimit(req.query.limit, 30, 100);
        const purchases = await UserGamePurchase.find({ telegramPaymentChargeId: { $type: "string" } })
            .sort({ purchasedAt: -1 })
            .limit(limit)
            .lean<{ _id: Types.ObjectId; telegramId: number; gameId: string; purchasedAt?: Date }[]>();

        const [names, games] = await Promise.all([
            loadNames(Array.from(new Set(purchases.map((p) => p.telegramId)))),
            loadGameTitles(),
        ]);

        res.json(
            purchases.map((p) => ({
                id: p._id.toString(),
                telegramId: p.telegramId,
                userName: names.get(p.telegramId) ?? `#${p.telegramId}`,
                gameTitle: games.get(p.gameId)?.title ?? p.gameId,
                stars: games.get(p.gameId)?.priceStars ?? 0,
                purchasedAt: p.purchasedAt ?? null,
            })),
        );
    } catch (error) {
        logAdminError("purchases", error);
        sendError(res, 500, "Не вдалося завантажити покупки");
    }
};