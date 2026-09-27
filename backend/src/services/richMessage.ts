// 📁 Файл: SnackEnglish-app/backend/src/services/richMessage.ts
import type { Telegram } from "telegraf";
import type { ButtonStyle } from "./buttonStyle.js";

/*
 * Rich Messages (Telegram Bot API 10.1–10.3): структуровані повідомлення з заголовками,
 * абзацами й КНОПКАМИ ВСЕРЕДИНІ повідомлення (а не окремим блоком під ним).
 * Telegraf 4.16 ще не має методу sendRichMessage — викликаємо API напряму.
 * Формат звірено з типами node-telegram-bot-api 2.1.0 (InputRichMessage, RichMessageButton).
 */

/** Текст: рядок або послідовність шматків (звичайний текст, жирний, курсив) */
export type RichText = string | RichTextNode | RichText[];
type RichTextNode = { type: "bold" | "italic"; text: RichText };

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
    | { type: "buttons"; buttons: RichButton[]; align?: "left" | "center" | "right" };

export interface InputRichMessage {
    blocks: RichBlock[];
}

export const bold = (text: RichText): RichTextNode => ({ type: "bold", text });
export const italic = (text: RichText): RichTextNode => ({ type: "italic", text });
/** Окремий шматок форматування загортаємо в масив — саме такий формат перевірено вживу */
const asRichText = (text: RichText): RichText => (typeof text === "object" && !Array.isArray(text) ? [text] : text);

export const heading = (text: RichText, size = 3): RichBlock => ({ type: "heading", text: asRichText(text), size });
export const paragraph = (text: RichText): RichBlock => ({ type: "paragraph", text: asRichText(text) });
export const divider = (): RichBlock => ({ type: "divider" });

/**
 * Рядки кнопок звичайної inline-клавіатури → блоки кнопок rich-повідомлення.
 * Так кнопки (з кольорами) описуються в одному місці й працюють в обох форматах.
 */
export const buttonBlocksFromKeyboard = (rows: ReadonlyArray<ReadonlyArray<object>>): RichBlock[] =>
    rows
        .map((row) => ({
            type: "buttons" as const,
            buttons: row.map((raw) => {
                const b = raw as RichButton & { hide?: boolean };
                const button: RichButton = { text: b.text };
                if (b.style) button.style = b.style;
                if (b.web_app) button.web_app = b.web_app;
                else if (b.callback_data) button.callback_data = b.callback_data;
                else if (b.url) button.url = b.url;
                return button;
            }),
        }))
        .filter((block) => block.buttons.length > 0);

/** Надсилає rich-повідомлення. Помилку Telegram кидає далі — викликач вирішує, що робити */
export const sendRichMessage = (telegram: Telegram, chatId: number, richMessage: InputRichMessage): Promise<unknown> =>
    (telegram.callApi as unknown as (method: string, payload: object) => Promise<unknown>).call(
        telegram,
        "sendRichMessage",
        { chat_id: chatId, rich_message: richMessage },
    );