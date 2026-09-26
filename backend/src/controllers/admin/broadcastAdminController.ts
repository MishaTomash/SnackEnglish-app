// 📁 Файл: SnackEnglish-app/backend/src/controllers/admin/broadcastAdminController.ts
import type { NextFunction, Request, Response } from "express";
import multer from "multer";
import { bot } from "../../bot.js";
import { BroadcastLog } from "../../models/BroadcastLog.js";
import {
    cancelBroadcast,
    countAudience,
    getBroadcastProgress,
    isBroadcastRunning,
    parseAudience,
    sendBroadcastPreview,
    startBroadcast,
    validateContent,
} from "../../services/broadcastService.js";
import type { BroadcastContent } from "../../services/broadcastService.js";
import { logAdminError, sendError } from "./adminHelpers.js";

// Фото для розсилки — лише в пам'яті, у Telegram завантажується один раз
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024, files: 1, fields: 10 },
    fileFilter: (_req, file, callback) => callback(null, file.mimetype.startsWith("image/")),
});

export const receiveBroadcastPhoto = (req: Request, res: Response, next: NextFunction): void => {
    upload.single("photo")(req, res, (error: unknown) => {
        if (!error) {
            next();
            return;
        }
        if (error instanceof multer.MulterError) {
            sendError(res, error.code === "LIMIT_FILE_SIZE" ? 413 : 400, "Фото до 10 МБ");
            return;
        }
        next(error);
    });
};

/** Розбирає форму розсилки: текст, кнопка, фото, аудиторія */
const readForm = (req: Request) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const text = typeof body.text === "string" ? body.text : "";
    const buttonText = typeof body.buttonText === "string" ? body.buttonText.trim() : "";
    const buttonUrl = typeof body.buttonUrl === "string" ? body.buttonUrl.trim() : "";
    const openApp = body.buttonOpenApp === "true" || body.buttonOpenApp === true;

    const content: BroadcastContent = {
        text,
        photo: req.file ? { buffer: req.file.buffer, filename: req.file.originalname || "photo.jpg" } : undefined,
        button: buttonText ? { text: buttonText, url: buttonUrl || undefined, openApp } : undefined,
    };
    const audience = parseAudience(body.audienceType, body.level);
    return { content, audience };
};

// POST /api/admin/broadcast/estimate  { audienceType, level }
export const estimateBroadcast = async (req: Request, res: Response): Promise<void> => {
    try {
        const audience = parseAudience(req.body?.audienceType, req.body?.level);
        if (!audience) return sendError(res, 400, "Невідома аудиторія");
        res.json({ count: await countAudience(audience) });
    } catch (error) {
        logAdminError("broadcast:estimate", error);
        sendError(res, 500, "Не вдалося порахувати аудиторію");
    }
};

// POST /api/admin/broadcast/test — те саме повідомлення лише адміну
export const testBroadcast = async (req: Request, res: Response): Promise<void> => {
    try {
        const adminId = Number(process.env.VITE_ADMIN_ID || "0");
        if (!adminId) return sendError(res, 503, "VITE_ADMIN_ID не задано");

        const { content } = readForm(req);
        const invalid = validateContent(content);
        if (invalid) return sendError(res, 400, invalid);

        try {
            await sendBroadcastPreview(bot.telegram, adminId, content);
        } catch (error) {
            const description = error instanceof Error ? error.message : String(error);
            return sendError(res, 400, `Telegram відхилив повідомлення: ${description}`);
        }
        res.json({ success: true });
    } catch (error) {
        logAdminError("broadcast:test", error);
        sendError(res, 500, "Не вдалося надіслати тест");
    }
};

// POST /api/admin/broadcast/start — розсилка у фоні, прогрес — GET /broadcast/status
export const startBroadcastHandler = async (req: Request, res: Response): Promise<void> => {
    try {
        if (isBroadcastRunning()) return sendError(res, 409, "Розсилка вже триває");

        const { content, audience } = readForm(req);
        if (!audience) return sendError(res, 400, "Невідома аудиторія");
        const invalid = validateContent(content);
        if (invalid) return sendError(res, 400, invalid);

        const count = await countAudience(audience);
        if (count === 0) return sendError(res, 400, "У цій аудиторії немає жодного юзера");

        startBroadcast(bot.telegram, content, audience)
            .then((result) => console.log(`[broadcast] Надіслано ${result.success}, помилок ${result.failed}`))
            .catch((error: unknown) =>
                console.error("[broadcast] Зупинено:", error instanceof Error ? error.message : error),
            );

        req.logEvent("admin_broadcast_started", { audience: audience.type, count, hasPhoto: Boolean(content.photo) });
        res.json({ success: true, count });
    } catch (error) {
        logAdminError("broadcast:start", error);
        sendError(res, 500, "Не вдалося запустити розсилку");
    }
};

// GET /api/admin/broadcast/status
export const getBroadcastStatus = (_req: Request, res: Response): void => {
    res.json(getBroadcastProgress());
};

// POST /api/admin/broadcast/cancel
export const cancelBroadcastHandler = (_req: Request, res: Response): void => {
    if (!cancelBroadcast()) return sendError(res, 409, "Зараз немає активної розсилки");
    res.json({ success: true });
};

// GET /api/admin/broadcast/history
export const getBroadcastHistory = async (_req: Request, res: Response): Promise<void> => {
    try {
        const logs = await BroadcastLog.find().sort({ startedAt: -1 }).limit(20).lean();
        res.json(logs);
    } catch (error) {
        logAdminError("broadcast:history", error);
        sendError(res, 500, "Не вдалося завантажити історію");
    }
};