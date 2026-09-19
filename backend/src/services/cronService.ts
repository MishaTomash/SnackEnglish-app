import cron from "node-cron";
import { bot } from "../bot.js";
import { User, UserProgress } from "../models/index.js";
import { processGiveawayEnd } from "../controllers/leaderboardController.js";

export function initCronJobs(): void {
  const appUrl = process.env.VITE_APP_URL ?? "http://localhost:5173";

  // Задача 1: Щодня о 10:00 — нагадування про слова на повторення
  cron.schedule("0 10 * * *", async () => {
    console.log(
      "[CRON] Запуск щоденного нагадування про слова на повторення...",
    );
    try {
      const now = new Date();
      const overdueProgress = await UserProgress.find({
        nextReviewDate: { $lte: now },
      }).select("userId");
      const userWordCountMap = new Map<string, number>();

      overdueProgress.forEach((item) => {
        const key = item.userId.toString();
        userWordCountMap.set(key, (userWordCountMap.get(key) ?? 0) + 1);
      });

      for (const [userId, count] of userWordCountMap.entries()) {
        const user = await User.findById(userId);
        if (!user || !user.telegramId) continue;
        try {
          await bot.telegram.sendMessage(
            user.telegramId,
            `Час для англійського перекусу! 🍪\n\nСьогодні на тебе чекає слів для повторення: ${count}.\nКілька хвилин щодня — і вони закріпляться назавжди!`,
            {
              reply_markup: {
                inline_keyboard: [
                  [{ text: "Повторити слова 🧠", web_app: { url: appUrl } }],
                ],
              },
            },
          );
        } catch (e) {
          console.warn(
            `Не вдалося надіслати повідомлення користувачу ${user.telegramId}`,
          );
        }
      }
    } catch (error) {
      console.error("[CRON Error] Помилка нагадування слів:", error);
    }
  });

  // Задача 2: Щодня о 19:00 — нагадування про збереження Streak
  cron.schedule("0 19 * * *", async () => {
    console.log("[CRON] Запуск нагадування про Streak...");
    try {
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const inactiveUsers = await User.find({
        streak: { $gt: 0 },
        lastActivityDate: { $lte: oneDayAgo },
      });

      for (const user of inactiveUsers) {
        if (!user.telegramId) continue;
        try {
          await bot.telegram.sendMessage(
            user.telegramId,
            `Не втрачай свій вогник! 🔥\n\nТвоя поточна серія — ${user.streak} ${
              user.streak === 1 ? "день" : user.streak < 5 ? "дні" : "днів"
            }.\nПройди хоча б один крок сьогодні, щоб зберегти прогрес!`,
            {
              reply_markup: {
                inline_keyboard: [
                  [{ text: "Врятувати серію ⚡", web_app: { url: appUrl } }],
                ],
              },
            },
          );
        } catch (e) {}
      }
    } catch (error) {
      console.error("[CRON Error] Помилка нагадування Streak:", error);
    }
  });

  // Задача 3: Щодня о 00:01 — Скидання втрачених стріків та відновлення HP
  cron.schedule("1 0 * * *", async () => {
    console.log(
      "[CRON] Скидання втрачених стріків та відновлення життів (HP)...",
    );
    try {
      const startOfYesterday = new Date();
      startOfYesterday.setDate(startOfYesterday.getDate() - 1);
      startOfYesterday.setHours(0, 0, 0, 0);

      // ДОДАНО: Сповіщення користувачам про те, що стрік втрачено
      const usersLosingStreak = await User.find({
        streak: { $gt: 0 },
        $or: [
          { lastActivityDate: { $lt: startOfYesterday } },
          { lastActivityDate: null },
        ],
      });

      for (const user of usersLosingStreak) {
        if (!user.telegramId) continue;
        try {
          await bot.telegram.sendMessage(
            user.telegramId,
            `Ой, твій вогник згас 😢\nАле сьогодні ідеальний день, щоб почати нову серію!\n\nЗаходь у SnackEnglish та повертай свій темп!`,
            {
              reply_markup: {
                inline_keyboard: [
                  [{ text: "Почати нову серію 🚀", web_app: { url: appUrl } }],
                ],
              },
            },
          );
        } catch (e) {}
      }

      // Скидання стріку в базі
      const inactiveResult = await User.updateMany(
        {
          streak: { $gt: 0 },
          $or: [
            { lastActivityDate: { $lt: startOfYesterday } },
            { lastActivityDate: null },
          ],
        },
        { $set: { streak: 0 } },
      );
      console.log(
        `[CRON] Скинуто стрік для ${inactiveResult.modifiedCount} користувачів.`,
      );

      await User.updateMany({ hp: { $lt: 5 } }, { $set: { hp: 5 } });
    } catch (error) {
      console.error("[CRON Error] Помилка скидання стріку та HP:", error);
    }
  });

  // Задача 4: Щонеділі о 20:00 — Завершення тижневого розіграшу
  cron.schedule("0 20 * * 0", async () => {
    console.log("[CRON] Запуск підсумків тижневого розіграшу...");
    try {
      await processGiveawayEnd();
      console.log("[CRON] Тижневий розіграш успішно завершено.");
    } catch (error) {
      console.error("[CRON Error] Помилка завершення розіграшу:", error);
    }
  });
}
