// 📁 Файл: SnackEnglish-app/backend/src/services/ttsService.ts
import crypto from "crypto";
import path from "path";
import { mkdir, unlink, writeFile } from "fs/promises";
import type { Types } from "mongoose";
import { AudioClip } from "../models/AudioClip.js";
import { StoryNode } from "../models/index.js";
import { getAppSettings } from "./settingsService.js";
import type { AppSettingsData } from "./settingsService.js";
import { notifyAdmin } from "./alertService.js";

/**
 * Озвучка уроків через OpenAI TTS.
 *
 * Кожна англійська фраза озвучується ОДИН раз і зберігається файлом (uploads/tts/<hash>.mp3).
 * Юзери слухають готовий файл — повторні прослуховування нічого не коштують.
 * Урок отримує мапу "фраза -> файл" (getNodeContent), а speak() на клієнті грає файл,
 * якщо він є, інакше — голос телефона, як раніше.
 */

const OPENAI_SPEECH_URL = "https://api.openai.com/v1/audio/speech";
const REQUEST_TIMEOUT_MS = 30000;
const MAX_PHRASE_LENGTH = 400;
const MAX_PHRASES_PER_NODE = 300;
const JOB_CONCURRENCY = 2;

export const TTS_DIR = path.join(process.cwd(), "uploads", "tts");
const TTS_URL_PREFIX = "/uploads/tts/";

/** Орієнтовна ціна за 1M символів тексту, $ (gpt-4o-mini-tts ≈ $0.015/хв аудіо) */
const PRICE_PER_MILLION_CHARS: Record<string, number> = {
    "gpt-4o-mini-tts": 16,
    "tts-1": 15,
    "tts-1-hd": 30,
};

export const estimateCostUsd = (chars: number, model: string): number =>
    (chars / 1_000_000) * (PRICE_PER_MILLION_CHARS[model] ?? 16);

export const isTtsConfigured = (): boolean => Boolean(process.env.OPENAI_API_KEY?.trim());

// ==================== ФРАЗИ ====================

/** Текст для озвучки: без розмітки, з нормальними пробілами й апострофами */
export const cleanSpeechText = (raw: string): string =>
    raw
        .replace(/<[^>]*>/g, " ")
        .replace(/[’‘`´]/g, "'")
        .replace(/\s+/g, " ")
        .trim();

/**
 * Ключ пошуку фрази — ТАКИЙ САМИЙ рахує клієнт (speech.ts → speechKey).
 * Регістр не важить: "Hello!" і "hello!" звучать однаково.
 */
export const speechKey = (raw: string): string => cleanSpeechText(raw).toLowerCase();

// Поля, у яких не буває фраз для озвучки (службові значення, імена, українські підписи)
const SKIP_KEYS = new Set([
    "type", "id", "_id", "icon", "emotion", "mood", "mascot", "image", "img", "sound", "audio",
    "color", "accent", "cover", "slug", "kind", "variant", "mode", "style", "npc", "npcName",
    "speaker", "character", "name", "title", "label", "subtitle", "animation", "effect", "layout",
    "status", "level", "correct", "correctId", "answerId", "uk", "hint", "explanation", "translation",
]);

const CYRILLIC = /[а-яіїєґё]/i;
const LATIN_LETTER = /[a-z]/i;

/** Схоже на англійську фразу, а не на службове значення ("dialogue", "btn_ok") */
const looksLikeEnglish = (value: string): boolean => {
    if (CYRILLIC.test(value) || !LATIN_LETTER.test(value)) return false;
    if (/^[a-z0-9]+[_-][a-z0-9_-]+$/i.test(value)) return false; // ідентифікатори
    if (/^https?:\/\//i.test(value)) return false;
    return (value.match(/[a-z]/gi)?.length ?? 0) >= 2;
};

const addPhrase = (found: Map<string, string>, raw: string): void => {
    const text = cleanSpeechText(raw);
    if (!text || text.length > MAX_PHRASE_LENGTH || !looksLikeEnglish(text)) return;
    const key = text.toLowerCase();
    if (!found.has(key)) found.set(key, text);
};

/**
 * Усі англійські фрази з кроків уроку: слова в <en>…</en>, поля "en" і англійські рядки.
 * Повертає мапу "ключ -> текст".
 */
export const extractSpeakablePhrases = (value: unknown, found: Map<string, string> = new Map(), depth = 0): Map<string, string> => {
    if (depth > 10 || value === null || value === undefined || found.size >= MAX_PHRASES_PER_NODE) return found;

    if (typeof value === "string") {
        // Змішаний текст ("Снекі каже <en>Hello</en>") — озвучуємо лише англійські вставки
        const markups = Array.from(value.matchAll(/<en>([\s\S]*?)<\/en>/gi));
        markups.forEach((m) => addPhrase(found, m[1]));
        // Повністю англійський рядок (репліка, фраза для вимови) — озвучуємо цілком
        if (!CYRILLIC.test(value)) addPhrase(found, value);
        return found;
    }
    if (Array.isArray(value)) {
        value.forEach((item) => extractSpeakablePhrases(item, found, depth + 1));
        return found;
    }
    if (typeof value === "object") {
        for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
            if (SKIP_KEYS.has(key)) continue;
            extractSpeakablePhrases(item, found, depth + 1);
        }
    }
    return found;
};

// ==================== РОЛІ ====================

/** Хто вимовляє фразу: від цього залежить голос */
export type SpeechRole = "narrator" | "snacky" | "user" | "npc";

export interface SpeechItem {
    key: string;
    text: string;
    role: SpeechRole;
    /** Емоція репліки з уроку (happy, scared, sleeping…) — для інтонації */
    style?: string;
}

// ==================== ІНТОНАЦІЯ ====================

/** Характер мовця (лише gpt-4o-mini-tts — вона розуміє інструкції) */
const PERSONAS: Record<SpeechRole, string> = {
    narrator: "",
    snacky: "You are Snekie, a small, friendly and playful cookie character.",
    user: "You are a young English learner speaking naturally and politely.",
    npc: "You are a character in a story, speaking naturally to a visitor.",
};

/** Емоції з уроків (як у CookieMascot) -> як говорити */
const EMOTION_STYLES: Record<string, string> = {
    happy: "Sound cheerful and warm, with a smile in your voice.",
    excited: "Sound excited and energetic.",
    celebrating: "Sound joyful and triumphant.",
    thinking: "Sound thoughtful and a little hesitant.",
    surprised: "Sound genuinely surprised.",
    scared: "Sound nervous and frightened, voice a little shaky.",
    sad: "Sound sad and soft.",
    // Без "slowly": модель і так уповільнює сонний голос — з підказкою виходило задовго
    sleeping: "Sound sleepy and drowsy, softly, as if just woken up, with a hint of a yawn — but keep a natural pace, don't drag the words.",
    sleepy: "Sound sleepy and drowsy, softly, as if just woken up, with a hint of a yawn — but keep a natural pace, don't drag the words.",
    angry: "Sound annoyed and grumpy.",
};

/** "emo-scared" (старий формат уроків) -> "scared" */
const normalizeEmotion = (value: unknown): string | undefined => {
    if (typeof value !== "string") return undefined;
    const emotion = value.trim().toLowerCase().replace(/^emo-/, "");
    return emotion && EMOTION_STYLES[emotion] ? emotion : undefined;
};

const ELLIPSIS = /…|\.\.\./;
const INTERJECTION = /\b(m{2,}|h+m+|u+h+|u+m+|a+h+|o+h+|e+r+m*|shh+|w+o+w+)\b/i;

/**
 * Інструкція для конкретної фрази: загальна (з адмінки) + характер мовця + емоція
 * + підказки для пауз ("…") і вигуків ("Mmm", "Uh"). Для tts-1 — порожньо (не підтримує).
 */
export const instructionsFor = (item: SpeechItem, s: AppSettingsData): string => {
    if (s.ttsModel !== "gpt-4o-mini-tts") return "";
    const parts = [s.ttsInstructions, PERSONAS[item.role]];
    if (item.style) parts.push(EMOTION_STYLES[item.style] ?? "");
    if (ELLIPSIS.test(item.text)) {
        parts.push("The ellipses are short hesitation pauses: pause only briefly at each one; never read them aloud.");
    }
    if (INTERJECTION.test(item.text)) {
        parts.push("Say interjections like 'Mmm', 'Hmm', 'Uh', 'Oh' as natural sounds, not as spelled-out words.");
    }
    return parts.filter(Boolean).join(" ");
};

/** Текст для моделі: "…" -> "..." (модель краще робить паузи) */
const speechInput = (text: string): string => text.replace(/…/g, "...");

/** Голос для ролі: власний голос персонажа або основний */
export const voiceForRole = (role: SpeechRole, s: AppSettingsData): string => {
    if (role === "snacky") return s.ttsVoiceSnacky || s.ttsVoice;
    if (role === "user") return s.ttsVoiceUser || s.ttsVoice;
    if (role === "npc") return s.ttsVoiceNpc || s.ttsVoice;
    return s.ttsVoice;
};

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

const addItem = (items: Map<string, SpeechItem>, raw: unknown, role: SpeechRole, style?: string): void => {
    if (typeof raw !== "string" || items.size >= MAX_PHRASES_PER_NODE) return;
    const text = cleanSpeechText(raw);
    if (!text || text.length > MAX_PHRASE_LENGTH || !looksLikeEnglish(text)) return;
    const key = text.toLowerCase();
    // Перша роль "виграє": репліка персонажа важливіша за ту саму фразу в іншому місці
    if (!items.has(key)) items.set(key, { key, text, role, ...(style ? { style } : {}) });
};

/**
 * Текст із розміткою: слова в <en>…</en> (їх натискають — говорить диктор)
 * і, якщо рядок повністю англійський, — весь рядок голосом wholeRole.
 */
const addRich = (items: Map<string, SpeechItem>, raw: unknown, wholeRole: SpeechRole | null, style?: string): void => {
    if (typeof raw !== "string") return;
    if (wholeRole && !CYRILLIC.test(raw)) addItem(items, raw, wholeRole, style);
    for (const match of raw.matchAll(/<en>([\s\S]*?)<\/en>/gi)) addItem(items, match[1], "narrator");
};

const walkSteps = (list: unknown, items: Map<string, SpeechItem>, depth: number): void => {
    if (!Array.isArray(list) || depth > 4) return;
    for (const step of list) {
        if (!isRecord(step)) continue;
        switch (step.type) {
            case "scene":
            case "event":
                addRich(items, step.text, null);
                break;
            case "dialogue":
                if (Array.isArray(step.lines)) {
                    for (const line of step.lines) {
                        if (!isRecord(line)) continue;
                        const role: SpeechRole = line.speaker === "user" ? "user" : line.speaker === "npc" ? "npc" : "snacky";
                        addRich(items, line.en, role, normalizeEmotion(line.emotion));
                    }
                }
                break;
            case "cards":
                if (Array.isArray(step.cards)) step.cards.forEach((card) => isRecord(card) && addItem(items, card.en, "narrator"));
                break;
            case "choice":
                addRich(items, step.prompt, null);
                if (Array.isArray(step.options)) {
                    for (const option of step.options) {
                        if (!isRecord(option)) continue;
                        addRich(items, option.text, "user");
                        walkSteps(option.outcome, items, depth + 1);
                    }
                }
                break;
            case "reply":
                addRich(items, step.prompt, "snacky", normalizeEmotion(step.emotion));
                if (Array.isArray(step.options)) step.options.forEach((o) => isRecord(o) && addRich(items, o.en, "user"));
                break;
            case "listen":
                addItem(items, step.audio, "narrator");
                if (Array.isArray(step.options)) step.options.forEach((o) => addRich(items, o, "narrator"));
                break;
            case "quiz":
                addRich(items, step.npcPrompt, "npc");
                addRich(items, step.question, null);
                addRich(items, step.explanation, null);
                if (Array.isArray(step.options)) step.options.forEach((o) => addRich(items, o, "narrator"));
                break;
            case "build":
                addItem(items, Array.isArray(step.answer) ? step.answer.join(" ") : step.answer, "narrator");
                break;
            case "voice":
                addRich(items, step.phrase, "narrator");
                break;
            default:
                break;
        }
    }
};

/**
 * Усі фрази уроку для озвучки з роллю мовця. Спершу — за структурою кроків
 * (Снекі, юзер, персонаж уроку, диктор), потім страховка: будь-які інші англійські рядки.
 */
export const collectSpeechItems = (steps: unknown): Map<string, SpeechItem> => {
    const items = new Map<string, SpeechItem>();
    walkSteps(steps, items, 0);
    extractSpeakablePhrases(steps).forEach((text, key) => {
        if (!items.has(key) && items.size < MAX_PHRASES_PER_NODE) items.set(key, { key, text, role: "narrator" });
    });
    return items;
};

/**
 * hash файлу: фраза + модель + голос + звучання (інструкція для mini-tts, швидкість для tts-1).
 * Без особливої інструкції (диктор) hash той самий, що й раніше — старі файли лишаються дійсними.
 */
export const clipHash = (
    key: string,
    s: Pick<AppSettingsData, "ttsModel" | "ttsSpeed" | "ttsInstructions">,
    voice: string,
    instructions: string = s.ttsInstructions,
): string => {
    const style = s.ttsModel === "gpt-4o-mini-tts" ? instructions : String(s.ttsSpeed);
    return crypto.createHash("sha1").update(`${s.ttsModel}|${voice}|${style}|${key}`).digest("hex");
};

const hashOf = (item: SpeechItem, s: AppSettingsData): string =>
    clipHash(item.key, s, voiceForRole(item.role, s), instructionsFor(item, s));

// ==================== ГЕНЕРАЦІЯ ====================

export class TtsError extends Error {
    readonly code: "not_configured" | "rate_limited" | "limit_reached" | "upstream";

    constructor(code: TtsError["code"], message?: string) {
        super(message ?? code);
        this.name = "TtsError";
        this.code = code;
    }
}

/** Витрати на озвучку в поточному календарному місяці, $ */
export const getMonthSpendUsd = async (): Promise<number> => {
    const start = new Date();
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
    const rows = await AudioClip.aggregate<{ total: number }>([
        { $match: { createdAt: { $gte: start } } },
        { $group: { _id: null, total: { $sum: "$costUsd" } } },
    ]);
    return rows[0]?.total ?? 0;
};

/** Запит до OpenAI: текст -> mp3 (Buffer) */
export const synthesize = async (
    text: string,
    s: AppSettingsData,
    voice: string = s.ttsVoice,
    instructions: string = s.ttsInstructions,
): Promise<Buffer> => {
    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) throw new TtsError("not_configured", "OPENAI_API_KEY не задано");

    const body: Record<string, unknown> = {
        model: s.ttsModel,
        voice,
        input: speechInput(text),
        response_format: "mp3",
    };
    // gpt-4o-mini-tts керується інструкцією; speed працює лише для tts-1 / tts-1-hd
    if (s.ttsModel === "gpt-4o-mini-tts") {
        if (instructions) body.instructions = instructions;
    } else {
        body.speed = s.ttsSpeed;
    }

    const response = await fetch(OPENAI_SPEECH_URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    }).catch((error: unknown) => {
        throw new TtsError("upstream", error instanceof Error ? error.message : "network error");
    });

    if (!response.ok) {
        let message = response.statusText;
        try {
            const data: unknown = await response.json();
            const nested = typeof data === "object" && data !== null && "error" in data ? (data as { error: unknown }).error : null;
            if (typeof nested === "object" && nested !== null && "message" in nested) message = String((nested as { message: unknown }).message);
        } catch {
            // тіло не JSON
        }
        throw new TtsError(response.status === 429 ? "rate_limited" : "upstream", `OpenAI ${response.status}: ${message.slice(0, 300)}`);
    }

    return Buffer.from(await response.arrayBuffer());
};

/** Озвучує фразу голосом ролі й зберігає файл + запис; повертає адресу файлу */
const generateClip = async (item: SpeechItem, s: AppSettingsData): Promise<string> => {
    const { key, text } = item;
    const voice = voiceForRole(item.role, s);
    const instructions = instructionsFor(item, s);
    const hash = clipHash(key, s, voice, instructions);
    const audio = await synthesize(text, s, voice, instructions);

    await mkdir(TTS_DIR, { recursive: true });
    await writeFile(path.join(TTS_DIR, `${hash}.mp3`), audio);

    const url = `${TTS_URL_PREFIX}${hash}.mp3`;
    await AudioClip.updateOne(
        { hash },
        {
            $set: {
                key,
                text,
                ttsModel: s.ttsModel,
                voice,
                role: item.role,
                url,
                bytes: audio.length,
                chars: text.length,
                costUsd: estimateCostUsd(text.length, s.ttsModel),
            },
        },
        { upsert: true },
    );
    return url;
};

// ==================== МАПА ДЛЯ УРОКУ ====================

/** "ключ фрази -> адреса файлу" для кроків уроку (лише вже озвучені фрази) */
export const getAudioMapForSteps = async (steps: unknown, s: AppSettingsData): Promise<Record<string, string>> => {
    const items = collectSpeechItems(steps);
    if (items.size === 0) return {};

    const byHash = new Map<string, string>();
    items.forEach((item) => byHash.set(hashOf(item, s), item.key));

    const clips = await AudioClip.find({ hash: { $in: Array.from(byHash.keys()) } })
        .select("hash url")
        .lean<{ hash: string; url: string }[]>();

    const map: Record<string, string> = {};
    clips.forEach((clip) => {
        const key = byHash.get(clip.hash);
        if (key) map[key] = clip.url;
    });
    return map;
};

// ==================== СТАН ДЛЯ АДМІНКИ ====================

export interface NodePhraseStatus {
    key: string;
    text: string;
    role: SpeechRole;
    style?: string;
    url: string | null;
}

interface NodeRow {
    _id: Types.ObjectId;
    chapterId: Types.ObjectId;
    order?: number;
    label?: string;
    steps?: unknown;
}

/** Фрази вузла зі статусом озвучки */
export const getNodePhrases = async (nodeId: string, s: AppSettingsData): Promise<NodePhraseStatus[]> => {
    const node = await StoryNode.findById(nodeId).select("steps").lean<{ steps?: unknown }>();
    if (!node) return [];
    const items = collectSpeechItems(node.steps);
    const map = await getAudioMapForSteps(node.steps, s);
    return Array.from(items.values(), (item) => ({ ...item, url: map[item.key] ?? null }));
};

export interface NodeTtsSummary {
    id: string;
    chapterId: string;
    order: number;
    label: string;
    total: number;
    ready: number;
    missingChars: number;
    totalChars: number;
}

/** Зведення по всіх вузлах: скільки фраз, скільки озвучено, скільки символів лишилось */
export const getTtsSummary = async (s: AppSettingsData): Promise<NodeTtsSummary[]> => {
    const nodes = await StoryNode.find().select("chapterId order label steps").sort({ order: 1 }).lean<NodeRow[]>();

    const perNode = nodes.map((node) => {
        const items = collectSpeechItems(node.steps);
        const hashes = Array.from(items.values(), (item) => ({ hash: hashOf(item, s), chars: item.text.length }));
        return { node, hashes };
    });

    const allHashes = perNode.flatMap((n) => n.hashes.map((h) => h.hash));
    const ready = new Set(
        (await AudioClip.find({ hash: { $in: allHashes } }).select("hash").lean<{ hash: string }[]>()).map((c) => c.hash),
    );

    return perNode.map(({ node, hashes }) => ({
        id: String(node._id),
        chapterId: String(node.chapterId),
        order: node.order ?? 0,
        label: node.label || "Урок",
        total: hashes.length,
        ready: hashes.filter((h) => ready.has(h.hash)).length,
        missingChars: hashes.filter((h) => !ready.has(h.hash)).reduce((sum, h) => sum + h.chars, 0),
        totalChars: hashes.reduce((sum, h) => sum + h.chars, 0),
    }));
};

// ==================== ФОНОВЕ ЗАВДАННЯ ====================

export interface TtsJobProgress {
    running: boolean;
    scope: string | null;
    total: number;
    done: number;
    failed: number;
    spentUsd: number;
    startedAt: Date | null;
    finishedAt: Date | null;
    status: "idle" | "running" | "completed" | "cancelled" | "failed" | "limit_reached";
    error: string | null;
}

let job: TtsJobProgress = {
    running: false,
    scope: null,
    total: 0,
    done: 0,
    failed: 0,
    spentUsd: 0,
    startedAt: null,
    finishedAt: null,
    status: "idle",
    error: null,
};
let cancelRequested = false;

export const getTtsJob = (): TtsJobProgress => ({ ...job });

export const cancelTtsJob = (): boolean => {
    if (!job.running) return false;
    cancelRequested = true;
    return true;
};

export type TtsScope =
    | { type: "all" }
    | { type: "chapter"; id: string }
    | { type: "node"; id: string }
    | { type: "nodes"; ids: string[] };

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/** Фрази без озвучки в межах scope */
export const collectMissing = async (scope: TtsScope, s: AppSettingsData): Promise<SpeechItem[]> => {
    const filter =
        scope.type === "node"
            ? { _id: scope.id }
            : scope.type === "nodes"
                ? { _id: { $in: scope.ids } }
                : scope.type === "chapter"
                    ? { chapterId: scope.id }
                    : {};
    const nodes = await StoryNode.find(filter).select("steps").lean<{ steps?: unknown }[]>();

    // Одна фраза може бути в кількох уроках — озвучуємо один раз (для кожного голосу)
    const byHash = new Map<string, SpeechItem>();
    nodes.forEach((node) => collectSpeechItems(node.steps).forEach((item) => byHash.set(hashOf(item, s), item)));

    const existing = new Set(
        (await AudioClip.find({ hash: { $in: Array.from(byHash.keys()) } }).select("hash").lean<{ hash: string }[]>()).map((c) => c.hash),
    );
    return Array.from(byHash.entries())
        .filter(([hash]) => !existing.has(hash))
        .map(([, item]) => item);
};

/**
 * Озвучує всі фрази без аудіо в межах scope у фоні (прогрес — getTtsJob).
 * Зупиняється, якщо досягнуто місячного ліміту витрат.
 */
export const startTtsJob = async (scope: TtsScope, label: string): Promise<{ total: number }> => {
    if (job.running) throw new Error("Озвучка вже триває");
    if (!isTtsConfigured()) throw new TtsError("not_configured", "OPENAI_API_KEY не задано");

    const settings = await getAppSettings();
    const missing = await collectMissing(scope, settings);

    job = {
        running: true,
        scope: label,
        total: missing.length,
        done: 0,
        failed: 0,
        spentUsd: 0,
        startedAt: new Date(),
        finishedAt: null,
        status: "running",
        error: null,
    };
    cancelRequested = false;

    void (async () => {
        // Об'єкт, бо статус змінюють паралельні воркери (TypeScript не відстежує зміни змінних у замиканнях)
        const outcome: { status: TtsJobProgress["status"]; error: string | null } = { status: "completed", error: null };
        try {
            let monthSpend = await getMonthSpendUsd();
            let index = 0;

            const worker = async (): Promise<void> => {
                while (index < missing.length) {
                    if (cancelRequested) {
                        if (outcome.status === "completed") outcome.status = "cancelled";
                        return;
                    }
                    const phrase = missing[index++];
                    const cost = estimateCostUsd(phrase.text.length, settings.ttsModel);
                    if (settings.ttsMonthlyLimitUsd > 0 && monthSpend + cost > settings.ttsMonthlyLimitUsd) {
                        outcome.status = "limit_reached";
                        outcome.error = `Досягнуто місячного ліміту $${settings.ttsMonthlyLimitUsd}`;
                        cancelRequested = true;
                        return;
                    }

                    for (let attempt = 0; attempt < 3; attempt++) {
                        try {
                            await generateClip(phrase, settings);
                            monthSpend += cost;
                            job.spentUsd += cost;
                            job.done += 1;
                            break;
                        } catch (genError) {
                            if (genError instanceof TtsError && genError.code === "rate_limited" && attempt < 2) {
                                await sleep(5000 * (attempt + 1));
                                continue;
                            }
                            if (genError instanceof TtsError && genError.code === "not_configured") throw genError;
                            job.failed += 1;
                            outcome.error = genError instanceof Error ? genError.message : String(genError);
                            break;
                        }
                    }
                }
            };

            await Promise.all(Array.from({ length: JOB_CONCURRENCY }, () => worker()));
        } catch (runError) {
            outcome.status = "failed";
            outcome.error = runError instanceof Error ? runError.message : String(runError);
            notifyAdmin("Озвучка уроків зупинилась з помилкою", runError);
        } finally {
            job.running = false;
            job.status = outcome.status;
            job.error = outcome.error;
            job.finishedAt = new Date();
            cancelRequested = false;
            if (outcome.status === "limit_reached") {
                notifyAdmin(`Озвучку зупинено: ${outcome.error ?? "ліміт"}. Збільш ліміт в адмінці → Озвучка.`);
            }
        }
    })();

    return { total: missing.length };
};

/** Перегенерувати одну фразу (наприклад, якщо звучить невдало) голосом її ролі */
export const regeneratePhrase = async (text: string, role: SpeechRole = "narrator", style?: string): Promise<string> => {
    const settings = await getAppSettings();
    const key = speechKey(text);
    const emotion = normalizeEmotion(style);
    const item: SpeechItem = { key, text: cleanSpeechText(text), role, ...(emotion ? { style: emotion } : {}) };
    const hash = hashOf(item, settings);
    const month = await getMonthSpendUsd();
    const cost = estimateCostUsd(text.length, settings.ttsModel);
    if (settings.ttsMonthlyLimitUsd > 0 && month + cost > settings.ttsMonthlyLimitUsd) {
        throw new TtsError("limit_reached", `Досягнуто місячного ліміту $${settings.ttsMonthlyLimitUsd}`);
    }
    await AudioClip.deleteOne({ hash });
    return generateClip(item, settings);
};

/** Видаляє файли, які не використовуються жодним уроком з поточним голосом (після зміни голосу) */
export const cleanupUnusedClips = async (): Promise<{ removed: number; freedBytes: number }> => {
    const settings = await getAppSettings();
    const nodes = await StoryNode.find().select("steps").lean<{ steps?: unknown }[]>();
    const needed = new Set<string>();
    nodes.forEach((node) => collectSpeechItems(node.steps).forEach((item) => needed.add(hashOf(item, settings))));

    const unused = await AudioClip.find({ hash: { $nin: Array.from(needed) } })
        .select("hash bytes")
        .lean<{ hash: string; bytes?: number }[]>();

    let freedBytes = 0;
    for (const clip of unused) {
        await unlink(path.join(TTS_DIR, `${clip.hash}.mp3`)).catch(() => undefined);
        freedBytes += clip.bytes ?? 0;
    }
    await AudioClip.deleteMany({ hash: { $in: unused.map((c) => c.hash) } });
    return { removed: unused.length, freedBytes };
};

/** Автоозвучка нових фраз (cron удень): лише якщо увімкнено й ключ є */
export const autoGenerateMissing = async (): Promise<void> => {
    const settings = await getAppSettings();
    if (!settings.ttsEnabled || !settings.ttsAutoGenerate || !isTtsConfigured() || job.running) return;
    const missing = await collectMissing({ type: "all" }, settings);
    if (missing.length === 0) return;
    await startTtsJob({ type: "all" }, "автоозвучка нових фраз");
};

/**
 * Після збереження уроку в адмінці — одразу озвучити його нові фрази у фоні.
 * Якщо зараз уже йде інша озвучка, нові фрази підхопить автоозвучка (cron кожні 30 хв).
 */
export const voiceNewContent = (nodeIds: string[]): void => {
    if (nodeIds.length === 0) return;
    void (async () => {
        const settings = await getAppSettings();
        if (!settings.ttsEnabled || !settings.ttsAutoGenerate || !isTtsConfigured() || job.running) return;
        const missing = await collectMissing({ type: "nodes", ids: nodeIds }, settings);
        if (missing.length === 0) return;
        await startTtsJob({ type: "nodes", ids: nodeIds }, "нові фрази уроку");
    })().catch((error: unknown) => console.error("[tts] Автоозвучка після збереження:", error));
};