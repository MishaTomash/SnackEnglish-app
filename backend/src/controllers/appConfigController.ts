// 📁 Файл: SnackEnglish-app/backend/src/controllers/appConfigController.ts
import type { Request, Response } from "express";
import { getAppSettings, toPublicConfig } from "../services/settingsService.js";
import { createUserQuota } from "../middlewares/userRateLimit.js";

/** Звідки натиснули "Підтримати" — для статистики в адмінці */
const SUPPORT_PLACES = new Set(["victory", "giveaway", "settings", "other"]);

// Статистика кліків не повинна засмічуватись спамом
const clickQuota = createUserQuota({ windowMs: 60 * 1000, max: 20 });

// GET /api/user/app-config — налаштування, потрібні застосунку
export const getAppConfig = async (_req: Request, res: Response): Promise<void> => {
    try {
        res.setHeader("Cache-Control", "no-store");
        res.json(toPublicConfig(await getAppSettings()));
    } catch (error) {
        console.error("[app-config] Error:", error instanceof Error ? error.message : error);
        res.status(500).json({ error: "Failed to load app config" });
    }
};

// POST /api/user/support-click { place } — юзер натиснув "Підтримати"
export const trackSupportClick = (req: Request, res: Response): void => {
    const place = typeof req.body?.place === "string" && SUPPORT_PLACES.has(req.body.place) ? req.body.place : "other";
    if (req.user?.id && clickQuota(String(req.user.id))) {
        req.logEvent("support_click", { place });
    }
    res.status(204).end();
};