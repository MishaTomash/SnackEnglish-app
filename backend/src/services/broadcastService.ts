// 📁 Файл: SnackEnglish-app/backend/src/services/broadcastService.ts
import { TelegramError } from "telegraf";
import type { Telegram } from "telegraf";
import type { InlineKeyboardMarkup, ReplyKeyboardRemove } from "telegraf/types";
import type { QueryFilter } from "mongoose";
import { User } from "../models/User.js";
import type { IUser, UserEnglishLevel } from "../models/User.js";
import { BroadcastLog } from "../models/BroadcastLog.js";

// Затримка між відправками (мс), щоб не перевищити ліміти Telegram (~30 повідомлень/с)
const BROADCAST_DELAY_MS = 60;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Ліміти Telegram: текст повідомлення і підпис до фото */
export const MAX_TEXT_LENGTH = 4096;
export const MAX_CAPTION_LENGTH = 1024;

export interface BroadcastResult {
  success: number;
  failed: number;
}

// ==================== АУДИТОРІЯ ====================

export type BroadcastAudience =
  | { type: "all" }
  | { type: "active7" } // заходили за останні 7 днів
  | { type: "inactive7" } // не заходили 7+ днів — для "повернення"
  | { type: "no_onboarding" } // не пройшли онбординг
  | { type: "level"; level: NonNullable<UserEnglishLevel> };

const LEVELS: readonly NonNullable<UserEnglishLevel>[] = ["A1", "A2", "B1", "B2", "C1", "C2"];

const isUserLevel = (value: unknown): value is NonNullable<UserEnglishLevel> =>
  typeof value === "string" && (LEVELS as readonly string[]).includes(value);

/** Розбирає аудиторію з тіла запиту; невідоме — null */
export const parseAudience = (type: unknown, level?: unknown): BroadcastAudience | null => {
  switch (type) {
    case undefined:
    case "":
    case "all":
      return { type: "all" };
    case "active7":
    case "inactive7":
    case "no_onboarding":
      return { type };
    case "level":
      return isUserLevel(level) ? { type: "level", level } : null;
    default:
      return null;
  }
};

export const describeAudience = (audience: BroadcastAudience): string =>
  audience.type === "level" ? `level:${audience.level}` : audience.type;

/** Фільтр MongoDB для аудиторії. Заблокованих адміном не беремо ніколи */
export const audienceFilter = (audience: BroadcastAudience): QueryFilter<IUser> => {
  const base: QueryFilter<IUser> = { blocked: { $ne: true } };
  const weekAgo = new Date(Date.now() - 7 * DAY_MS);
  switch (audience.type) {
    case "active7":
      return { ...base, lastActivityDate: { $gte: weekAgo } };
    case "inactive7":
      return { ...base, $or: [{ lastActivityDate: { $lt: weekAgo } }, { lastActivityDate: null }] };
    case "no_onboarding":
      return { ...base, onboardingCompleted: { $ne: true } };
    case "level":
      return { ...base, level: audience.level };
    default:
      return base;
  }
};

export const countAudience = (audience: BroadcastAudience): Promise<number> =>
  User.countDocuments(audienceFilter(audience));

// ==================== ВМІСТ ====================

export interface BroadcastButton {
  text: string;
  /** Звичайне посилання (https://...) */
  url?: string;
  /** Кнопка, що відкриває застосунок (VITE_APP_URL) */
  openApp?: boolean;
}

export interface BroadcastContent {
  /** HTML: <b>, <i>, <u>, <s>, <a href>, <code> */
  text: string;
  photo?: { buffer: Buffer; filename: string };
  button?: BroadcastButton;
}

type ReplyMarkup = InlineKeyboardMarkup | ReplyKeyboardRemove;

const buildReplyMarkup = (button?: BroadcastButton): ReplyMarkup => {
  if (!button) return { remove_keyboard: true }; // заразом прибираємо стару reply-клавіатуру
  const appUrl = process.env.VITE_APP_URL?.trim() || "";
  if (button.openApp && appUrl) {
    return { inline_keyboard: [[{ text: button.text, web_app: { url: appUrl } }]] };
  }
  return { inline_keyboard: [[{ text: button.text, url: button.url || appUrl }]] };
};

/** Перевіряє вміст до старту; повертає текст помилки або null */
export const validateContent = (content: BroadcastContent): string | null => {
  const text = content.text.trim();
  if (!text && !content.photo) return "Потрібен текст або фото";
  if (content.photo && text.length > MAX_CAPTION_LENGTH) {
    return `Підпис до фото — до ${MAX_CAPTION_LENGTH} символів`;
  }
  if (!content.photo && text.length > MAX_TEXT_LENGTH) return `Текст — до ${MAX_TEXT_LENGTH} символів`;
  if (content.button) {
    if (!content.button.text.trim() || content.button.text.length > 64) return "Текст кнопки — 1–64 символи";
    if (content.button.openApp) {
      if (!process.env.VITE_APP_URL?.trim()) return "VITE_APP_URL не задано — кнопку застосунку не створити";
    } else if (!content.button.url || !/^https:\/\/\S+$/i.test(content.button.url)) {
      return "Посилання кнопки має починатися з https://";
    }
  }
  return null;
};

/**
 * Відправник одного повідомлення. Фото завантажується в Telegram лише один раз:
 * після першої успішної відправки далі використовується його file_id.
 */
const createSender = (telegram: Telegram, content: BroadcastContent) => {
  const replyMarkup = buildReplyMarkup(content.button);
  const text = content.text.trim();
  let photoRef: string | { source: Buffer; filename: string } | null = content.photo
    ? { source: content.photo.buffer, filename: content.photo.filename }
    : null;

  return async (chatId: number): Promise<void> => {
    if (photoRef) {
      const msg = await telegram.sendPhoto(chatId, photoRef, {
        caption: text || undefined,
        parse_mode: "HTML",
        reply_markup: replyMarkup,
      });
      if (typeof photoRef !== "string") photoRef = msg.photo[msg.photo.length - 1].file_id;
      return;
    }
    await telegram.sendMessage(chatId, text, { parse_mode: "HTML", reply_markup: replyMarkup });
  };
};

// ==================== ПРОГРЕС ====================

export interface BroadcastProgress {
  running: boolean;
  kind: "text" | "photo" | "copy" | null;
  audience: string | null;
  total: number;
  sent: number;
  failed: number;
  startedAt: Date | null;
  finishedAt: Date | null;
  status: "idle" | "running" | "completed" | "cancelled" | "failed";
  error: string | null;
}

let progress: BroadcastProgress = {
  running: false,
  kind: null,
  audience: null,
  total: 0,
  sent: 0,
  failed: 0,
  startedAt: null,
  finishedAt: null,
  status: "idle",
  error: null,
};
let cancelRequested = false;

export const getBroadcastProgress = (): BroadcastProgress => ({ ...progress });
export const isBroadcastRunning = (): boolean => progress.running;

/** Просить зупинити поточну розсилку (вона зупиниться після поточного повідомлення) */
export const cancelBroadcast = (): boolean => {
  if (!progress.running) return false;
  cancelRequested = true;
  return true;
};

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/** Помилка в самому тексті (HTML-розмітка) — вона буде однаковою для всіх, далі слати немає сенсу */
const isMessageFormatError = (error: unknown): boolean =>
  error instanceof TelegramError &&
  error.code === 400 &&
  /can't parse entities|message is too long|caption is too long/i.test(error.description);

const errorText = (error: unknown): string =>
  error instanceof TelegramError ? error.description : error instanceof Error ? error.message : String(error);

interface RunOptions {
  kind: "text" | "photo" | "copy";
  audience: BroadcastAudience;
  textPreview: string;
  buttonText: string | null;
}

/**
 * Спільний цикл розсилки: юзери потоком (cursor), а не всі в пам'ять; на 429 чекаємо
 * retry_after і повторюємо; помилки "бот заблокований" лише рахуються.
 * Одночасно може йти лише одна розсилка.
 */
const runBroadcast = async (
  send: (telegramId: number) => Promise<unknown>,
  options: RunOptions,
): Promise<BroadcastResult> => {
  if (progress.running) throw new Error("Broadcast is already running");

  const filter = audienceFilter(options.audience);
  progress = {
    running: true,
    kind: options.kind,
    audience: describeAudience(options.audience),
    total: 0,
    sent: 0,
    failed: 0,
    startedAt: new Date(),
    finishedAt: null,
    status: "running",
    error: null,
  };
  cancelRequested = false;

  let status: BroadcastProgress["status"] = "completed";
  let error: string | null = null;

  try {
    progress.total = await User.countDocuments(filter);
    const cursor = User.find(filter).select("telegramId").lean<{ telegramId: number }[]>().cursor();

    for await (const user of cursor) {
      if (cancelRequested) {
        status = "cancelled";
        break;
      }
      if (!user.telegramId) continue;

      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          await send(user.telegramId);
          progress.sent += 1;
          break;
        } catch (sendError) {
          if (isMessageFormatError(sendError)) throw sendError; // текст зламаний для всіх
          const retryAfter = sendError instanceof TelegramError ? sendError.parameters?.retry_after : undefined;
          if (retryAfter && attempt === 0) {
            await sleep((retryAfter + 1) * 1000);
            continue;
          }
          progress.failed += 1;
          break;
        }
      }

      await sleep(BROADCAST_DELAY_MS);
    }
  } catch (runError) {
    status = "failed";
    error = errorText(runError);
  } finally {
    progress.running = false;
    progress.status = status;
    progress.error = error;
    progress.finishedAt = new Date();
    cancelRequested = false;

    // Історія: помилка запису не має ламати розсилку
    BroadcastLog.create({
      kind: options.kind,
      textPreview: options.textPreview.slice(0, 300),
      audience: describeAudience(options.audience),
      buttonText: options.buttonText,
      total: progress.total,
      sent: progress.sent,
      failed: progress.failed,
      status,
      error,
      startedAt: progress.startedAt ?? new Date(),
      finishedAt: progress.finishedAt,
    }).catch((logError: unknown) => console.error("[broadcast] Не вдалося записати історію:", errorText(logError)));
  }

  if (status === "failed") throw new Error(error ?? "Broadcast failed");
  return { success: progress.sent, failed: progress.failed };
};

// ==================== ПУБЛІЧНІ ФУНКЦІЇ ====================

/** Розсилка з адмін-панелі: текст / фото, кнопка, аудиторія */
export const startBroadcast = (
  telegram: Telegram,
  content: BroadcastContent,
  audience: BroadcastAudience,
): Promise<BroadcastResult> =>
  runBroadcast(createSender(telegram, content), {
    kind: content.photo ? "photo" : "text",
    audience,
    textPreview: content.text,
    buttonText: content.button?.text ?? null,
  });

/** Тест: те саме повідомлення лише одному чату (адміну) — щоб побачити, як воно виглядає */
export const sendBroadcastPreview = (telegram: Telegram, chatId: number, content: BroadcastContent): Promise<void> =>
  createSender(telegram, content)(chatId);

/**
 * Копіює одне повідомлення (текст/фото/відео/аудіо/опитування — будь-який тип)
 * усім користувачам бота (команда /copy у боті).
 */
export const broadcastMessage = (
  telegram: Telegram,
  fromChatId: number,
  messageId: number,
): Promise<BroadcastResult> =>
  runBroadcast(
    (telegramId) =>
      telegram.copyMessage(telegramId, fromChatId, messageId, {
        reply_markup: { remove_keyboard: true },
      }),
    { kind: "copy", audience: { type: "all" }, textPreview: "(копія повідомлення з чату)", buttonText: null },
  );

/** Текст усім (старий ендпоінт POST /api/admin/broadcast) */
export const broadcastText = (telegram: Telegram, text: string): Promise<BroadcastResult> =>
  startBroadcast(telegram, { text }, { type: "all" });