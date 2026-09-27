// 📁 Файл: SnackEnglish-app/backend/src/services/richMessage.ts
import { TelegramError } from "telegraf";
import type { Telegram } from "telegraf";
import type { ButtonStyle } from "./buttonStyle.js";

/*
 * Rich Messages (Telegram Bot API 10.1–10.3): структуровані повідомлення з заголовками,
 * абзацами й КНОПКАМИ ВСЕРЕДИНІ повідомлення (а не окремим блоком під ним).
 * Telegraf 4.16 ще не має sendRichMessage — викликаємо API напряму.
 * Формат звірено з типами node-telegram-bot-api 2.1.0 і перевірено вживу (варіант А).
 *
 * Усі повідомлення бота йдуть через sendRich/editRich: якщо Telegram не прийняв
 * rich-повідомлення — автоматично надсилається звичайне (HTML + кнопки під ним).
 */

// ==================== ТИПИ ====================

export type RichText = string | RichTextNode | RichText[];
type RichTextNode =
    | { type: "bold" | "italic" | "underline" | "strikethrough" | "code"; text: RichText }
    | { type: "url"; text: RichText; url: string };

export interface RichButton {
    text: string;
    style?: ButtonStyle;
    web_app?: { url: string };
    callback_data?: string;
    url?: string;
}

export type RichBlock =
    | { type: "heading"; text: RichText; size: number }
    | { type: "paragraph"; text: RichText }
    | { type: "divider" }
    | { type: "photo"; photo: { type: "photo"; media: string } }
    | { type: "buttons"; buttons: RichButton[]; align?: "left" | "center" | "right" };

export interface InputRichMessage {
    blocks: RichBlock[];
}

/** Рядки кнопок звичайної inline-клавіатури (Markup…reply_markup.inline_keyboard) */
export type KeyboardRows = ReadonlyArray<ReadonlyArray<object>>;

// ==================== КОНСТРУКТОРИ ====================

/** Окремий шматок форматування загортаємо в масив — саме такий формат перевірено вживу */
const asRichText = (text: RichText): RichText => (typeof text === "object" && !Array.isArray(text) ? [text] : text);

export const bold = (text: RichText): RichTextNode => ({ type: "bold", text });
export const italic = (text: RichText): RichTextNode => ({ type: "italic", text });
export const heading = (text: RichText, size = 3): RichBlock => ({ type: "heading", text: asRichText(text), size });
export const paragraph = (text: RichText): RichBlock => ({ type: "paragraph", text: asRichText(text) });
export const divider = (): RichBlock => ({ type: "divider" });

/** Рядки кнопок inline-клавіатури → блоки кнопок (кольори зберігаються) */
export const buttonBlocksFromKeyboard = (rows: KeyboardRows): RichBlock[] =>
    rows
        .map((row) => ({
            type: "buttons" as const,
            buttons: row.map((raw) => {
                const b = raw as RichButton;
                const button: RichButton = { text: b.text };
                if (b.style) button.style = b.style;
                if (b.web_app) button.web_app = b.web_app;
                else if (b.callback_data) button.callback_data = b.callback_data;
                else if (b.url) button.url = b.url;
                return button;
            }),
        }))
        .filter((block) => block.buttons.length > 0);

// ==================== HTML → БЛОКИ ====================

const decodeEntities = (value: string): string =>
    value
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&amp;/g, "&");

const INLINE_TAGS: Record<string, "bold" | "italic" | "underline" | "strikethrough" | "code"> = {
    b: "bold",
    strong: "bold",
    i: "italic",
    em: "italic",
    u: "underline",
    ins: "underline",
    s: "strikethrough",
    del: "strikethrough",
    code: "code",
};

/** Один рядок Telegram-HTML (<b>, <i>, <u>, <s>, <code>, <a href>) → RichText */
export const htmlLineToRich = (html: string): RichText[] => {
    type Frame = { node: { type: string; url?: string }; children: RichText[] };
    const root: RichText[] = [];
    const stack: Frame[] = [];
    const current = (): RichText[] => (stack.length ? stack[stack.length - 1].children : root);
    const close = (): void => {
        const frame = stack.pop();
        if (!frame) return;
        const text: RichText = frame.children.length === 1 ? frame.children[0] : frame.children;
        current().push({ ...frame.node, text } as RichTextNode);
    };

    const tagPattern = /<(\/?)([a-z]+)((?:\s[^>]*)?)>/gi;
    let last = 0;
    for (let match = tagPattern.exec(html); match; match = tagPattern.exec(html)) {
        if (match.index > last) current().push(decodeEntities(html.slice(last, match.index)));
        last = tagPattern.lastIndex;

        const [, closing, rawTag, attributes] = match;
        const tag = rawTag.toLowerCase();
        const type = tag === "a" ? "url" : INLINE_TAGS[tag];
        if (!type) continue; // невідомий тег — лишаємо тільки текст

        if (!closing) {
            const href = tag === "a" ? attributes.match(/href\s*=\s*"([^"]*)"/i)?.[1] : undefined;
            if (tag === "a" && !href) continue;
            stack.push({ node: href ? { type, url: decodeEntities(href) } : { type }, children: [] });
        } else {
            const index = stack.map((f) => f.node.type).lastIndexOf(type);
            if (index === -1) continue;
            while (stack.length > index) close();
        }
    }
    if (last < html.length) current().push(decodeEntities(html.slice(last)));
    while (stack.length) close();
    return root.filter((part) => part !== "");
};

/**
 * Текст Telegram-HTML → блоки у стилі "варіант А":
 * кожен рядок — окремий абзац, порожній рядок між розділами — тонкий роздільник.
 */
export const htmlToBlocks = (html: string): RichBlock[] => {
    const blocks: RichBlock[] = [];
    const sections = html.replace(/\r\n/g, "\n").trim().split(/\n\s*\n/);
    sections.forEach((section, index) => {
        if (index > 0) blocks.push(divider());
        for (const line of section.split("\n")) {
            const rich = htmlLineToRich(line.trim());
            if (rich.length > 0) blocks.push(paragraph(rich));
        }
    });
    // Перший рядок повністю жирний ("<b>Як усе працює 🍪</b>") — це заголовок, як у картці прогресу
    const first = blocks[0];
    if (first?.type === "paragraph" && Array.isArray(first.text) && first.text.length === 1) {
        const only = first.text[0];
        if (typeof only === "object" && !Array.isArray(only) && only.type === "bold") {
            blocks[0] = heading(only.text);
            if (blocks[1]?.type === "divider") blocks.splice(1, 1); // під заголовком роздільник зайвий
        }
    }
    return blocks;
};

// ==================== НИЖНЯ КНОПКА «ГОЛОВНА» ====================

/**
 * Необов'язково: власна анімована іконка кнопки (custom emoji). Працює, лише якщо
 * власник бота має Telegram Premium. ID емодзі: перешли емодзі боту @RawDataBot
 * і скопіюй custom_emoji_id, потім додай у .env: HOME_BUTTON_EMOJI_ID=5368324170671202286
 */
const HOME_ICON_ID = process.env.HOME_BUTTON_EMOJI_ID?.trim() || "";

/** Текст кнопки. З власною іконкою звичайне емодзі 🏠 зайве */
export const HOME_BUTTON = HOME_ICON_ID ? "Головна" : "🏠 Головна";

/**
 * Одна синя кнопка внизу чату: з будь-якого місця одним тапом — на картку прогресу.
 * Кнопки rich-повідомлень живуть усередині них, тож нижня клавіатура вільна.
 */
export const HOME_KEYBOARD = {
    keyboard: [[{ text: HOME_BUTTON, style: "primary", ...(HOME_ICON_ID ? { icon_custom_emoji_id: HOME_ICON_ID } : {}) }]],
    resize_keyboard: true,
    is_persistent: true,
    input_field_placeholder: "Тисни «Головна» — там твій прогрес 🍪",
};

// ==================== НАДСИЛАННЯ ====================

type CallApi = (method: string, payload: object) => Promise<unknown>;
const callApi = (telegram: Telegram, method: string, payload: object): Promise<unknown> =>
    (telegram.callApi as unknown as CallApi).call(telegram, method, payload);

/** Надсилає rich-повідомлення як є; помилку Telegram кидає далі */
export const sendRichMessage = (
    telegram: Telegram,
    chatId: number,
    richMessage: InputRichMessage,
    replyMarkup?: object,
): Promise<unknown> =>
    callApi(telegram, "sendRichMessage", {
        chat_id: chatId,
        rich_message: richMessage,
        ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
    });

/** Юзер заблокував бота або ліміт Telegram — повторювати звичайним повідомленням марно */
const isFinalError = (error: unknown): boolean =>
    error instanceof TelegramError && (error.code === 403 || error.code === 429);

let fallbackLogged = false;
const logFallback = (error: unknown): void => {
    // Раз на запуск — щоб не засмічувати логи, якщо Telegram масово відхиляє rich
    if (fallbackLogged) return;
    fallbackLogged = true;
    console.error("[bot] Rich-повідомлення не прийнято, шлю звичайні:", error instanceof Error ? error.message : error);
};

export interface RichContent {
    /** Текст у Telegram-HTML (як для звичайних повідомлень) */
    html: string;
    /** Кнопки (рядки inline-клавіатури, з кольорами) */
    rows?: KeyboardRows;
    /** Картинка зверху (URL або file_id) */
    photo?: string;
    /** Показати нижню клавіатуру «Головна» (для особистих чатів) */
    home?: boolean;
}

/**
 * Надсилає повідомлення у форматі rich (кнопки всередині). Якщо Telegram не прийняв —
 * звичайне повідомлення (або фото з підписом) з тими самими кнопками під ним.
 */
export const sendRich = async (telegram: Telegram, chatId: number, content: RichContent): Promise<void> => {
    const blocks: RichBlock[] = [
        ...(content.photo ? [{ type: "photo", photo: { type: "photo", media: content.photo } } as RichBlock] : []),
        ...htmlToBlocks(content.html),
        ...buttonBlocksFromKeyboard(content.rows ?? []),
    ];
    try {
        await sendRichMessage(telegram, chatId, { blocks }, content.home ? HOME_KEYBOARD : undefined);
        return;
    } catch (error) {
        if (isFinalError(error)) throw error;
        logFallback(error);
    }

    const inline = content.rows && content.rows.length > 0 ? { inline_keyboard: content.rows } : undefined;
    const replyMarkup = (inline ?? (content.home ? HOME_KEYBOARD : undefined)) as never;
    if (content.photo) {
        try {
            await telegram.sendPhoto(chatId, content.photo, { caption: content.html, parse_mode: "HTML", reply_markup: replyMarkup });
            return;
        } catch (error) {
            if (isFinalError(error)) throw error;
            // Картинка недоступна — надсилаємо текст
        }
    }
    await telegram.sendMessage(chatId, content.html, { parse_mode: "HTML", reply_markup: replyMarkup });
};

/**
 * Змінює вже надіслане повідомлення (напр., перемикач нагадувань, відповідь на заявку).
 * Rich-повідомлення редагується як rich, звичайне — як звичайне.
 */
export const editRich = async (
    telegram: Telegram,
    chatId: number,
    messageId: number,
    content: Omit<RichContent, "photo" | "home">,
): Promise<void> => {
    const blocks = [...htmlToBlocks(content.html), ...buttonBlocksFromKeyboard(content.rows ?? [])];
    try {
        await callApi(telegram, "editMessageText", { chat_id: chatId, message_id: messageId, rich_message: { blocks } });
        return;
    } catch (error) {
        if (isFinalError(error)) throw error;
    }
    const inline = content.rows && content.rows.length > 0 ? { inline_keyboard: content.rows } : undefined;
    await telegram.editMessageText(chatId, messageId, undefined, content.html, {
        parse_mode: "HTML",
        ...(inline ? { reply_markup: inline as never } : {}),
    });
};