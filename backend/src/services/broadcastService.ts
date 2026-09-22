import type { Telegram } from "telegraf";
import { User } from "../models/User.js";

// Затримка між відправками (мс), щоб не перевищити ліміти Telegram і уникнути бану за спам
const BROADCAST_DELAY_MS = 60;

export interface BroadcastResult {
  success: number;
  failed: number;
}

/**
 * Копіює одне повідомлення (текст/фото/відео/аудіо/опитування — будь-який тип)
 * усім користувачам бота з інтервалом між відправками.
 * Заразом прибирає стару reply-клавіатуру (наприклад, залишену попередньою
 * версією бота), якщо вона в користувача ще відображається.
 */
export const broadcastMessage = async (
  telegram: Telegram,
  fromChatId: number,
  messageId: number,
): Promise<BroadcastResult> => {
  const users = await User.find({}, { telegramId: 1 }).lean();

  let success = 0;
  let failed = 0;

  for (const user of users) {
    try {
      await telegram.copyMessage(user.telegramId, fromChatId, messageId, {
        reply_markup: { remove_keyboard: true },
      });
      success += 1;
    } catch (error) {
      failed += 1;
      console.error(
        `Broadcast: не вдалося надіслати користувачу ${user.telegramId}:`,
        error,
      );
    }

    await new Promise((resolve) => setTimeout(resolve, BROADCAST_DELAY_MS));
  }

  return { success, failed };
};

/**
 * Надсилає текстове повідомлення усім користувачам бота з інтервалом між відправками.
 * Заразом прибирає стару reply-клавіатуру, якщо вона в користувача ще відображається.
 */
export const broadcastText = async (
  telegram: Telegram,
  text: string,
): Promise<BroadcastResult> => {
  const users = await User.find({}, { telegramId: 1 }).lean();

  let success = 0;
  let failed = 0;

  for (const user of users) {
    try {
      await telegram.sendMessage(user.telegramId, text, {
        parse_mode: "HTML",
        reply_markup: { remove_keyboard: true },
      });
      success += 1;
    } catch (error) {
      failed += 1;
      console.error(
        `Broadcast: не вдалося надіслати текст користувачу ${user.telegramId}:`,
        error,
      );
    }

    await new Promise((resolve) => setTimeout(resolve, BROADCAST_DELAY_MS));
  }

  return { success, failed };
};
