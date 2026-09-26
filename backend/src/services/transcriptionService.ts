/**
 * Транскрипція голосу через OpenAI-сумісний Audio API.
 * Провайдери:
 * - groq   — безкоштовний тариф (без картки, з лімітами на акаунт), whisper-large-v3-turbo;
 * - openai — платний, gpt-4o-mini-transcribe або whisper-1.
 * Режим обирається в .env через SPEECH_PROVIDER (groq | openai | browser | off).
 * Якщо ключі є для обох провайдерів, другий автоматично підхоплює, коли перший
 * недоступний (закінчився баланс, ліміт, збій).
 *
 * Аудіо приходить буфером у пам'яті й одразу йде провайдеру: на диск нічого
 * не пишемо і ні аудіо, ні розпізнаний текст не логуємо.
 * Використовує вбудовані fetch / FormData / Blob (Node 18+), без SDK.
 */

const REQUEST_TIMEOUT_MS = 15000;

export type SpeechProviderId = "groq" | "openai";

/** Що бачить клієнт: розпізнає сервер, браузер, або вправи вимкнені */
export type SpeechMode = "server" | "browser" | "off";

interface SpeechProvider {
    id: SpeechProviderId;
    url: string;
    /** Змінна .env з ключем */
    apiKeyEnv: string;
    /** Змінна .env, якою можна замінити модель */
    modelEnv: string;
    defaultModel: string;
}

const PROVIDERS: Record<SpeechProviderId, SpeechProvider> = {
    groq: {
        id: "groq",
        url: "https://api.groq.com/openai/v1/audio/transcriptions",
        apiKeyEnv: "GROQ_API_KEY",
        modelEnv: "GROQ_TRANSCRIBE_MODEL",
        defaultModel: "whisper-large-v3-turbo",
    },
    openai: {
        id: "openai",
        url: "https://api.openai.com/v1/audio/transcriptions",
        apiKeyEnv: "OPENAI_API_KEY",
        modelEnv: "OPENAI_TRANSCRIBE_MODEL",
        defaultModel: "gpt-4o-mini-transcribe",
    },
};

export type TranscriptionErrorCode =
    | "not_configured" // немає жодного ключа
    | "bad_audio" // провайдер не зміг прочитати файл
    | "upstream_rate_limited" // ліміт або закінчився баланс у провайдера
    | "upstream_error" // інша помилка провайдера або мережі
    | "timeout";

export class TranscriptionError extends Error {
    readonly code: TranscriptionErrorCode;

    constructor(code: TranscriptionErrorCode, message?: string) {
        super(message ?? code);
        this.name = "TranscriptionError";
        this.code = code;
    }
}

// ==================== НАЛАШТУВАННЯ ====================

const readEnv = (name: string): string => process.env[name]?.trim() ?? "";

const hasKey = (provider: SpeechProvider): boolean => readEnv(provider.apiKeyEnv) !== "";

/** Значення SPEECH_PROVIDER; порожнє — автовибір */
const configuredProvider = (): string => readEnv("SPEECH_PROVIDER").toLowerCase();

/**
 * Провайдери в порядку спроб: обраний у SPEECH_PROVIDER, далі інший як запасний.
 * Без SPEECH_PROVIDER спершу безкоштовний Groq. Провайдери без ключа пропускаються.
 */
export const getProviderChain = (): SpeechProvider[] => {
    const order: SpeechProviderId[] = configuredProvider() === "openai" ? ["openai", "groq"] : ["groq", "openai"];
    return order.map((id) => PROVIDERS[id]).filter(hasKey);
};

/** Режим для клієнта (GET /api/speech/config) */
export const getSpeechMode = (): SpeechMode => {
    const provider = configuredProvider();
    if (provider === "browser") return "browser";
    if (provider === "off") return "off";
    return getProviderChain().length > 0 ? "server" : "off";
};

// ==================== ФОРМАТИ ====================

// Провайдер визначає контейнер за розширенням імені файлу
const FILE_NAME_BY_MIME: Record<string, string> = {
    "audio/webm": "audio.webm",
    "video/webm": "audio.webm", // деякі Chromium позначають аудіо-webm як video
    "audio/mp4": "audio.m4a", // iOS Safari / WKWebView
    "video/mp4": "audio.m4a",
    "audio/m4a": "audio.m4a",
    "audio/x-m4a": "audio.m4a",
    "audio/ogg": "audio.ogg",
    "audio/wav": "audio.wav",
    "audio/x-wav": "audio.wav",
    "audio/mpeg": "audio.mp3",
};

const baseMimeType = (mimeType: string): string => mimeType.split(";")[0].trim().toLowerCase();

export const isSupportedAudioMime = (mimeType: string): boolean =>
    baseMimeType(mimeType) in FILE_NAME_BY_MIME;

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null;

/** Коротке повідомлення з тіла помилки провайдера (без будь-яких даних юзера) */
const readProviderError = async (response: Response): Promise<string> => {
    try {
        const body: unknown = await response.json();
        if (isRecord(body) && isRecord(body.error) && typeof body.error.message === "string") {
            return body.error.message.slice(0, 300);
        }
    } catch {
        // тіло не JSON
    }
    return response.statusText;
};

// ==================== ТРАНСКРИПЦІЯ ====================

const transcribeWith = async (provider: SpeechProvider, audio: Buffer, baseType: string, fileName: string): Promise<string> => {
    const form = new FormData();
    // Копія в Uint8Array: Blob приймає лише ArrayBuffer-представлення, не Buffer з пулу
    form.append("file", new Blob([new Uint8Array(audio)], { type: baseType }), fileName);
    form.append("model", readEnv(provider.modelEnv) || provider.defaultModel);
    form.append("language", "en");
    form.append("response_format", "json");
    form.append("temperature", "0");
    // prompt з еталонною фразою навмисно НЕ передаємо: модель "дотягувала" б сказане до правильної відповіді

    const response = await fetch(provider.url, {
        method: "POST",
        headers: { Authorization: `Bearer ${readEnv(provider.apiKeyEnv)}` },
        body: form,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    }).catch((error: unknown) => {
        const isTimeout = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
        throw new TranscriptionError(isTimeout ? "timeout" : "upstream_error", `${provider.id}: network error`);
    });

    if (!response.ok) {
        const details = await readProviderError(response);
        // Надто короткий запис (клік, тиша) — це не помилка, а "нічого не сказано"
        if (response.status === 400 && /too short/i.test(details)) return "";
        if (response.status === 400) throw new TranscriptionError("bad_audio", `${provider.id}: ${details}`);
        if (response.status === 429) throw new TranscriptionError("upstream_rate_limited", `${provider.id}: ${details}`);
        throw new TranscriptionError("upstream_error", `${provider.id} ${response.status}: ${details}`);
    }

    const data: unknown = await response.json();
    return isRecord(data) && typeof data.text === "string" ? data.text.trim() : "";
};

/**
 * Повертає розпізнаний англійський текст; "" — у записі нічого не розпізнано.
 * Пробує провайдерів по черзі; bad_audio не повторює (інший провайдер теж не прочитає).
 */
export async function transcribeAudio(audio: Buffer, mimeType: string): Promise<string> {
    const chain = getProviderChain();
    if (chain.length === 0) {
        throw new TranscriptionError("not_configured", "Set GROQ_API_KEY or OPENAI_API_KEY");
    }

    const baseType = baseMimeType(mimeType);
    const fileName = FILE_NAME_BY_MIME[baseType];
    if (!fileName) throw new TranscriptionError("bad_audio", `Unsupported audio type: ${baseType}`);

    let lastError: unknown = null;
    for (const provider of chain) {
        try {
            return await transcribeWith(provider, audio, baseType, fileName);
        } catch (error: unknown) {
            if (error instanceof TranscriptionError && error.code === "bad_audio") throw error;
            lastError = error;
            if (provider !== chain[chain.length - 1]) {
                const reason = error instanceof TranscriptionError ? error.code : "unknown";
                console.warn(`[speech] ${provider.id} недоступний (${reason}), пробую запасний провайдер`);
            }
        }
    }
    throw lastError;
}