// 📁 Файл: SnackEnglish-app/backend/src/controllers/admin/settingsController.ts
import type { Request, Response } from "express";
import { AnalyticsEvent } from "../../models/AnalyticsEvent.js";
import { getAppSettings, updateAppSettings } from "../../services/settingsService.js";
import { DAY_MS, logAdminError, sendError } from "./adminHelpers.js";

/** Скільки подій певного типу за останні N днів */
const countEvents = (eventType: string, days: number): Promise<number> =>
    AnalyticsEvent.countDocuments({ eventType, createdAt: { $gte: new Date(Date.now() - days * DAY_MS) } });

// GET /api/admin/settings — налаштування + як вони працюють (статистика за 7/30 днів)
export const getSettings = async (_req: Request, res: Response): Promise<void> => {
    try {
        const [settings, supportClicks7, supportClicks30, limitHits7, goalsReached7] = await Promise.all([
            getAppSettings(),
            countEvents("support_click", 7),
            countEvents("support_click", 30),
            countEvents("daily_limit_hit", 7),
            countEvents("daily_goal_reached", 7),
        ]);
        res.json({ settings, stats: { supportClicks7, supportClicks30, limitHits7, goalsReached7 } });
    } catch (error) {
        logAdminError("settings:get", error);
        sendError(res, 500, "Не вдалося завантажити налаштування");
    }
};

// PATCH /api/admin/settings
export const updateSettings = async (req: Request, res: Response): Promise<void> => {
    try {
        const result = await updateAppSettings(req.body);
        if (!result.ok) return sendError(res, 400, result.error);
        req.logEvent("admin_settings_updated", { fields: Object.keys((req.body ?? {}) as object) });
        res.json({ settings: result.data });
    } catch (error) {
        logAdminError("settings:update", error);
        sendError(res, 500, "Не вдалося зберегти налаштування");
    }
};