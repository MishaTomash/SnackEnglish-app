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
        username: telegramUser.username ?? null,
        level: null,
        weakAreas: [],
        streak: 1,
        onboardingCompleted: false,
      });
    }

    const appUrl = process.env.VITE_APP_URL ?? "http://localhost:5173";

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
