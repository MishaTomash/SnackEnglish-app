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
      await telegram.copyMessage(user.telegramId, fromChatId, messageId);
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
