import { Router } from "express";
import type { NextFunction, Request, Response } from "express";
import multer from "multer";
import { userRateLimit } from "../middlewares/userRateLimit.js";
import {
    getSpeechMode,
    isSupportedAudioMime,
    transcribeAudio,
    TranscriptionError,
} from "../services/transcriptionService.js";
import type { TranscriptionErrorCode } from "../services/transcriptionService.js";

/**
 * Розпізнавання мовлення для кроку "Скажи вголос".
 * Монтується з authMiddleware: app.use("/api/speech", authMiddleware, speechRoutes).
 * GET  /config     -> { mode: "server" | "browser" | "off" } (SPEECH_PROVIDER у .env)
 * POST /transcribe — multipart, поле "audio" (до ~1 МБ) -> { text }.
 */
const router = Router();

/** 6 с запису opus/aac — це 25–100 КБ; 1 МБ із великим запасом */
const MAX_AUDIO_BYTES = 1024 * 1024;

// memoryStorage: аудіо живе лише в пам'яті на час запиту, на диск не потрапляє
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_AUDIO_BYTES, files: 1, fields: 5, parts: 6 },
});

// Ліміти на юзера: вистачає на урок із запасом, але не дає одному юзеру
// вичерпати безкоштовний ліміт Groq чи баланс OpenAI для всіх
const perMinuteLimit = userRateLimit({ windowMs: 60 * 1000, max: 15 });
const perDayLimit = userRateLimit({ windowMs: 24 * 60 * 60 * 1000, max: 300 });

const STATUS_BY_ERROR: Record<TranscriptionErrorCode, number> = {
    bad_audio: 400,
    not_configured: 503,
    upstream_rate_limited: 503,
    upstream_error: 502,
    timeout: 504,
};

/** Приймає файл і перетворює помилки multer на зрозумілі відповіді */
const receiveAudio = (req: Request, res: Response, next: NextFunction): void => {
    upload.single("audio")(req, res, (error: unknown) => {
        if (!error) {
            next();
            return;
        }
        if (error instanceof multer.MulterError) {
            if (error.code === "LIMIT_FILE_SIZE") {
                res.status(413).json({ error: "audio_too_large" });
                return;
            }
            res.status(400).json({ error: "bad_request", message: error.message });
            return;
        }
        next(error);
    });
};

// Клієнт питає один раз за сесію, щоб знати, як розпізнавати голос
router.get("/config", (_req: Request, res: Response): void => {
    res.json({ mode: getSpeechMode() });
});

router.post(
    "/transcribe",
    perMinuteLimit,
    perDayLimit,
    receiveAudio,
    async (req: Request, res: Response): Promise<void> => {
        const file = req.file;

        if (!file || file.size === 0) {
            res.status(400).json({ error: "audio_missing" });
            return;
        }
        if (!isSupportedAudioMime(file.mimetype)) {
            res.status(415).json({ error: "unsupported_audio" });
            return;
        }

        try {
            const text = await transcribeAudio(file.buffer, file.mimetype);
            res.json({ text });
        } catch (error: unknown) {
            if (error instanceof TranscriptionError) {
                // Лише код і службове повідомлення — без аудіо й без розпізнаного тексту
                console.error(`[speech] ${error.code}: ${error.message}`);
                res.status(STATUS_BY_ERROR[error.code]).json({ error: error.code });
                return;
            }
            console.error("[speech] Unexpected error:", error instanceof Error ? error.message : "unknown");
            res.status(500).json({ error: "internal_error" });
        }
    },
);

export default router;