// 📁 Файл: SnackEnglish-app/backend/src/controllers/admin/ttsController.ts
import type { Request, Response } from "express";
import type { Types } from "mongoose";
import { AudioClip } from "../../models/AudioClip.js";
import { Chapter } from "../../models/index.js";
import { getAppSettings, TTS_MINI_ONLY_VOICES, TTS_MODELS, TTS_VOICES } from "../../services/settingsService.js";
import type { AppSettingsData } from "../../services/settingsService.js";
import {
    cancelTtsJob,
    cleanupUnusedClips,
    estimateCostUsd,
    getMonthSpendUsd,
    getNodePhrases,
    getTtsJob,
    getTtsSummary,
    isTtsConfigured,
    regeneratePhrase,
    startTtsJob,
    synthesize,
    TtsError,
} from "../../services/ttsService.js";
import type { SpeechRole } from "../../services/ttsService.js";

const SPEECH_ROLES: readonly SpeechRole[] = ["narrator", "snacky", "user", "npc"];
import { isObjectIdString, logAdminError, sendError } from "./adminHelpers.js";

const MAX_PREVIEW_LENGTH = 300;

const ttsErrorStatus = (error: unknown): number =>
    error instanceof TtsError
        ? error.code === "not_configured"
            ? 503
            : error.code === "limit_reached"
                ? 402
                : error.code === "rate_limited"
                    ? 429
                    : 502
        : 500;

// GET /api/admin/tts/overview — усе для вкладки "Озвучка"
export const getTtsOverview = async (_req: Request, res: Response): Promise<void> => {
    try {
        const settings = await getAppSettings();
        const [nodes, chapters, monthSpendUsd, totals] = await Promise.all([
            getTtsSummary(settings),
            Chapter.find().select("title level order").sort({ level: 1, order: 1 }).lean<{ _id: Types.ObjectId; title?: string; level?: string; order?: number }[]>(),
            getMonthSpendUsd(),
            AudioClip.aggregate<{ clips: number; bytes: number; costUsd: number }>([
                { $group: { _id: null, clips: { $sum: 1 }, bytes: { $sum: "$bytes" }, costUsd: { $sum: "$costUsd" } } },
            ]),
        ]);

        const missingChars = nodes.reduce((sum, n) => sum + n.missingChars, 0);

        res.json({
            configured: isTtsConfigured(),
            settings: pickTtsSettings(settings),
            options: { models: TTS_MODELS, voices: TTS_VOICES, miniOnlyVoices: TTS_MINI_ONLY_VOICES },
            totals: {
                phrases: nodes.reduce((sum, n) => sum + n.total, 0),
                ready: nodes.reduce((sum, n) => sum + n.ready, 0),
                missingChars,
                totalChars: nodes.reduce((sum, n) => sum + n.totalChars, 0),
                missingCostUsd: estimateCostUsd(missingChars, settings.ttsModel),
                monthSpendUsd,
                allTimeCostUsd: totals[0]?.costUsd ?? 0,
                storedClips: totals[0]?.clips ?? 0,
                storedMb: Math.round(((totals[0]?.bytes ?? 0) / 1024 / 1024) * 10) / 10,
            },
            chapters: chapters.map((c) => {
                const chapterNodes = nodes.filter((n) => n.chapterId === String(c._id));
                return {
                    id: String(c._id),
                    title: c.title || "Без назви",
                    level: c.level || "—",
                    total: chapterNodes.reduce((sum, n) => sum + n.total, 0),
                    ready: chapterNodes.reduce((sum, n) => sum + n.ready, 0),
                    missingCostUsd: estimateCostUsd(
                        chapterNodes.reduce((sum, n) => sum + n.missingChars, 0),
                        settings.ttsModel,
                    ),
                    nodes: chapterNodes.map((n) => ({ id: n.id, order: n.order, label: n.label, total: n.total, ready: n.ready })),
                };
            }),
            job: getTtsJob(),
        });
    } catch (error) {
        logAdminError("tts:overview", error);
        sendError(res, 500, "Не вдалося зібрати стан озвучки");
    }
};

const pickTtsSettings = (s: AppSettingsData) => ({
    ttsEnabled: s.ttsEnabled,
    ttsModel: s.ttsModel,
    ttsVoice: s.ttsVoice,
    ttsVoiceSnacky: s.ttsVoiceSnacky,
    ttsVoiceUser: s.ttsVoiceUser,
    ttsVoiceNpc: s.ttsVoiceNpc,
    ttsSpeed: s.ttsSpeed,
    ttsInstructions: s.ttsInstructions,
    ttsAutoGenerate: s.ttsAutoGenerate,
    ttsMonthlyLimitUsd: s.ttsMonthlyLimitUsd,
    ttsPlaybackRate: s.ttsPlaybackRate,
});

// GET /api/admin/tts/nodes/:nodeId — фрази уроку зі статусом
export const getTtsNode = async (req: Request, res: Response): Promise<void> => {
    try {
        const nodeId = req.params.nodeId;
        if (!isObjectIdString(nodeId)) return sendError(res, 400, "Невірний id уроку");
        res.json({ phrases: await getNodePhrases(nodeId, await getAppSettings()) });
    } catch (error) {
        logAdminError("tts:node", error);
        sendError(res, 500, "Не вдалося завантажити фрази");
    }
};

// POST /api/admin/tts/generate { scope: "all" | "chapter" | "node", id? }
export const generateTts = async (req: Request, res: Response): Promise<void> => {
    try {
        const scope: unknown = req.body?.scope;
        const id: unknown = req.body?.id;
        if (scope !== "all" && !((scope === "chapter" || scope === "node") && isObjectIdString(id))) {
            return sendError(res, 400, "scope: all, або chapter/node з id");
        }
        const result = await startTtsJob(
            scope === "all" ? { type: "all" } : { type: scope, id: id as string },
            scope === "all" ? "усі уроки" : scope === "chapter" ? "розділ" : "урок",
        );
        req.logEvent("admin_tts_started", { scope, count: result.total });
        res.json(result);
    } catch (error) {
        logAdminError("tts:generate", error);
        sendError(res, error instanceof TtsError ? ttsErrorStatus(error) : 409, error instanceof Error ? error.message : "Не вдалося запустити");
    }
};

// GET /api/admin/tts/job
export const getTtsJobStatus = (_req: Request, res: Response): void => {
    res.json(getTtsJob());
};

// POST /api/admin/tts/job/cancel
export const cancelTtsJobHandler = (_req: Request, res: Response): void => {
    if (!cancelTtsJob()) return sendError(res, 409, "Зараз озвучка не триває");
    res.json({ success: true });
};

// POST /api/admin/tts/regenerate { text }
export const regenerateTts = async (req: Request, res: Response): Promise<void> => {
    try {
        const text: unknown = req.body?.text;
        const role: unknown = req.body?.role;
        if (typeof text !== "string" || !text.trim() || text.length > 400) return sendError(res, 400, "Потрібен текст до 400 символів");
        const speechRole = SPEECH_ROLES.find((r) => r === role) ?? "narrator";
        const style = typeof req.body?.style === "string" ? req.body.style.slice(0, 30) : undefined;
        res.json({ url: await regeneratePhrase(text, speechRole, style) });
    } catch (error) {
        logAdminError("tts:regenerate", error);
        sendError(res, ttsErrorStatus(error), error instanceof Error ? error.message : "Не вдалося перегенерувати");
    }
};

// POST /api/admin/tts/preview { text, model?, voice?, speed?, instructions? } -> audio/mpeg (не зберігається)
export const previewTts = async (req: Request, res: Response): Promise<void> => {
    try {
        const body = (req.body ?? {}) as Record<string, unknown>;
        const text = typeof body.text === "string" ? body.text.trim() : "";
        if (!text || text.length > MAX_PREVIEW_LENGTH) return sendError(res, 400, `Текст зразка — до ${MAX_PREVIEW_LENGTH} символів`);

        const base = await getAppSettings();
        const settings: AppSettingsData = {
            ...base,
            ttsModel: typeof body.model === "string" && (TTS_MODELS as readonly string[]).includes(body.model) ? body.model : base.ttsModel,
            ttsVoice: typeof body.voice === "string" && (TTS_VOICES as readonly string[]).includes(body.voice) ? body.voice : base.ttsVoice,
            ttsSpeed: Number.isFinite(Number(body.speed)) ? Math.min(1.5, Math.max(0.5, Number(body.speed))) : base.ttsSpeed,
            ttsInstructions: typeof body.instructions === "string" ? body.instructions.slice(0, 600) : base.ttsInstructions,
        };
        if (settings.ttsModel !== "gpt-4o-mini-tts" && TTS_MINI_ONLY_VOICES.includes(settings.ttsVoice)) {
            return sendError(res, 400, `Голос «${settings.ttsVoice}» є лише в gpt-4o-mini-tts`);
        }

        const audio = await synthesize(text, settings);
        res.setHeader("Content-Type", "audio/mpeg");
        res.setHeader("Cache-Control", "no-store");
        res.send(audio);
    } catch (error) {
        logAdminError("tts:preview", error);
        sendError(res, ttsErrorStatus(error), error instanceof Error ? error.message : "Не вдалося озвучити зразок");
    }
};

// POST /api/admin/tts/cleanup — прибрати файли старого голосу
export const cleanupTts = async (_req: Request, res: Response): Promise<void> => {
    try {
        const result = await cleanupUnusedClips();
        res.json({ removed: result.removed, freedMb: Math.round((result.freedBytes / 1024 / 1024) * 10) / 10 });
    } catch (error) {
        logAdminError("tts:cleanup", error);
        sendError(res, 500, "Не вдалося прибрати файли");
    }
};