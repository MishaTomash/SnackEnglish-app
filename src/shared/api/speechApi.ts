import axios from "axios";
import { apiClient } from "./apiClient";

/**
 * Серверне розпізнавання мовлення:
 * - GET  /api/speech/config     -> { mode } — який режим увімкнено на сервері (SPEECH_PROVIDER);
 * - POST /api/speech/transcribe -> { text } — multipart, поле "audio".
 * Авторизація Telegram додається інтерцептором apiClient, як і в інших запитах.
 */

/** Транскрипція довша за звичайні запити: запис + відповідь провайдера */
const TRANSCRIBE_TIMEOUT_MS = 25000;
const CONFIG_TIMEOUT_MS = 8000;

/**
 * Режим розпізнавання, який обрав сервер:
 * - "server"  — запис на клієнті, розпізнає бекенд (Groq або OpenAI);
 * - "browser" — безкоштовний Web Speech API браузера (лише Chrome/Edge, не Telegram);
 * - "off"     — розпізнавання вимкнене (немає жодного ключа): вправи лише пропускаються.
 */
export type SpeechMode = "server" | "browser" | "off";

const SPEECH_MODES: readonly SpeechMode[] = ["server", "browser", "off"];

let cachedMode: SpeechMode | null = null;
let modePromise: Promise<SpeechMode> | null = null;

/** Режим, якщо вже завантажений; null — ще не знаємо */
export const getCachedSpeechMode = (): SpeechMode | null => cachedMode;

/**
 * Один раз за сесію питає в сервера режим розпізнавання.
 * Якщо сервер недоступний — повертає "server" (помилку мережі юзер побачить при спробі),
 * а наступний виклик спробує ще раз.
 */
export function loadSpeechMode(): Promise<SpeechMode> {
    if (cachedMode) return Promise.resolve(cachedMode);
    if (modePromise) return modePromise;

    modePromise = apiClient
        .get<{ mode?: unknown }>("/speech/config", { timeout: CONFIG_TIMEOUT_MS })
        .then(({ data }) => {
            const mode = SPEECH_MODES.find((m) => m === data.mode) ?? "server";
            cachedMode = mode;
            return mode;
        })
        .catch((): SpeechMode => {
            modePromise = null;
            return "server";
        });

    return modePromise;
}

export type TranscribeErrorCode =
    | "network" // немає відповіді від сервера (офлайн, таймаут, обрив)
    | "rate-limited" // забагато спроб поспіль (429)
    | "too-large" // запис більший за ліміт сервера (413)
    | "server" // сервер відповів помилкою
    | "aborted";

export class TranscribeError extends Error {
    readonly code: TranscribeErrorCode;
    readonly status?: number;

    constructor(code: TranscribeErrorCode, status?: number) {
        super(`Transcription failed: ${code}${status ? ` (${status})` : ""}`);
        this.name = "TranscribeError";
        this.code = code;
        this.status = status;
    }
}

interface TranscribeResponse {
    text?: unknown;
}

// Розширення файлу підказує серверу (і провайдеру) контейнер запису
const extensionFor = (mimeType: string): string => {
    const base = mimeType.split(";")[0].trim().toLowerCase();
    if (base.endsWith("/mp4") || base.endsWith("/m4a") || base.endsWith("/x-m4a")) return "m4a";
    if (base.endsWith("/ogg")) return "ogg";
    if (base.endsWith("/wav") || base.endsWith("/x-wav")) return "wav";
    return "webm";
};

/** Відправляє запис на бекенд і повертає розпізнаний текст ("" — нічого не розпізнано) */
export async function transcribeAudio(blob: Blob, mimeType: string, signal?: AbortSignal): Promise<string> {
    const form = new FormData();
    form.append("audio", blob, `voice.${extensionFor(mimeType)}`);

    try {
        const { data } = await apiClient.post<TranscribeResponse>("/speech/transcribe", form, {
            signal,
            timeout: TRANSCRIBE_TIMEOUT_MS,
        });
        return typeof data.text === "string" ? data.text.trim() : "";
    } catch (error: unknown) {
        if (signal?.aborted || axios.isCancel(error)) throw new TranscribeError("aborted");

        if (axios.isAxiosError(error)) {
            const status = error.response?.status;
            if (status === undefined) throw new TranscribeError("network");
            if (status === 429) throw new TranscribeError("rate-limited", status);
            if (status === 413) throw new TranscribeError("too-large", status);
            throw new TranscribeError("server", status);
        }

        throw new TranscribeError("server");
    }
}