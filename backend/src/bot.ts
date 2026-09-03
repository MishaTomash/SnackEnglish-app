import path from "path";
import dotenv from "dotenv";

// Гарантоване завантаження .env файлу з поточної робочої директорії
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

import { Telegraf, Markup } from "telegraf";
import { User } from "./models/User.js";

const botToken = process.env.BOT_TOKEN;

if (!botToken) {
  throw new Error("BOT_TOKEN is not defined in environment variables");
}

export const bot = new Telegraf(botToken);

bot.start(async (ctx) => {
  try {
    const telegramUser = ctx.from;
    if (!telegramUser) return;

    // Перевіряємо чи створюємо користувача в базі
    let user = await User.findOne({ telegramId: telegramUser.id });

    if (!user) {
      user = await User.create({
        telegramId: telegramUser.id,
        username: telegramUser.username ?? undefined,
        level: null,
        weakAreas: [],
        streak: 1,
        onboardingCompleted: false,
      });
    }

    const appUrl = process.env.VITE_APP_URL?.trim();
    console.log(
      `[BOT /start] Користувач: ${telegramUser.id}, VITE_APP_URL:`,
      appUrl,
    );

    // Telegram дозволяє web_app кнопки лише з валідним HTTPS посиланням
    if (!appUrl || !appUrl.startsWith("https://")) {
      console.error(
        `[BOT ERROR] Неможливо створити WebApp кнопку: VITE_APP_URL має починатися з 'https://'. Поточне значення: '${appUrl}'`,
      );
      await ctx.reply(
        `Привіт, ${telegramUser.first_name}! 🍪\n\nСервер ще налаштовує захищене HTTPS-з'єднання. Будь ласка, перевірте VITE_APP_URL у файлі .env.`,
      );
      return;
    }

    await ctx.reply(
      `Привіт, ${telegramUser.first_name}! 🍪\n\nЛаскаво просимо до SnackEnglish — твоїх щоденних швидких та смачних уроків англійської.\n\nНатискай кнопку нижче, щоб відкрити застосунок та спробувати свій перший снек!`,
      Markup.inlineKeyboard([
        [Markup.button.webApp("Відкрити SnackEnglish 🚀", appUrl)],
      ]),
    );
  } catch (error: unknown) {
    console.error("Помилка в обробнику /start бота:", error);
    await ctx.reply(
      "Сталася помилка при запуску. Будь ласка, спробуйте пізніше.",
    );
  }
});
