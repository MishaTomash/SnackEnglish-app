import path from "path";
import dotenv from "dotenv";

// Гарантоване завантаження .env файлу з поточної робочої директорії
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

import { Telegraf, Markup } from "telegraf";
import { User } from "./models/User.js";
import { Game } from "./models/Game.js";
import { UserGamePurchase } from "./models/UserGamePurchase.js";
import { ManualPaymentRequest } from "./models/ManualPaymentRequest.js";

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

// --- СПОСІБ 1: TELEGRAM STARS ---

bot.on("pre_checkout_query", async (ctx) => {
  try {
    const payload = JSON.parse(ctx.preCheckoutQuery.invoice_payload);
    const { gameId, telegramId } = payload;

    const existingPurchase = await UserGamePurchase.findOne({
      telegramId,
      gameId,
    });
    if (existingPurchase) {
      return ctx.answerPreCheckoutQuery(false, "Ви вже придбали цю гру.");
    }

    const game = await Game.findOne({ gameId });
    if (!game) {
      return ctx.answerPreCheckoutQuery(false, "Гру не знайдено.");
    }

    await ctx.answerPreCheckoutQuery(true);
  } catch (error) {
    console.error("Pre-checkout error:", error);
    await ctx.answerPreCheckoutQuery(false, "Помилка перевірки.");
  }
});

bot.on("successful_payment", async (ctx) => {
  try {
    if (!("successful_payment" in ctx.message)) return;

    const paymentInfo = ctx.message.successful_payment;
    const payload = JSON.parse(paymentInfo.invoice_payload);
    const { gameId, telegramId } = payload;

    await UserGamePurchase.create({
      telegramId,
      gameId,
      telegramPaymentChargeId: paymentInfo.telegram_payment_charge_id,
    });

    await ctx.reply(
      "✨ Дякуємо за покупку! Гру успішно розблоковано в додатку.",
    );
  } catch (error) {
    console.error("Payment registration error:", error);
  }
});

// --- СПОСІБ 2: РУЧНИЙ ПЕРЕКАЗ ---

bot.on("photo", async (ctx) => {
  try {
    if (!("photo" in ctx.message)) return;

    const caption = ("caption" in ctx.message ? ctx.message.caption : "") || "";
    const match = caption.match(/([A-F0-9]{8})/i);

    const manualRequests = await ManualPaymentRequest.find({
      telegramId: ctx.from.id,
      status: "pending",
    });

    if (manualRequests.length === 0) return;

    let targetRequest = match
      ? manualRequests.find((r) => r.uniqueCode === match[1].toUpperCase())
      : manualRequests.length === 1
        ? manualRequests[0]
        : null;

    if (!targetRequest) {
      return ctx.reply(
        "Не знайдено заявки. Вкажіть правильний 8-значний код у підписі до фото.",
      );
    }

    const photos = ctx.message.photo;
    const fileId = photos[photos.length - 1].file_id;

    targetRequest.screenshotFileId = fileId;
    await targetRequest.save();

    await ctx.reply(
      "Скріншот отримано! Очікуйте на підтвердження адміністратора.",
    );

    const adminId = process.env.VITE_ADMIN_ID;
    if (adminId) {
      const user = await User.findOne({ telegramId: ctx.from.id });
      const game = await Game.findOne({ gameId: targetRequest.gameId });

      await ctx.telegram.sendPhoto(adminId, fileId, {
        caption: `📝 Новий ручний платіж!\nКористувач: @${user?.nickname || ctx.from.username}\nГра: ${game?.title}\nКод: ${targetRequest.uniqueCode}`,
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "✅ Підтвердити",
                callback_data: `approve_${targetRequest._id}`,
              },
              {
                text: "❌ Відхилити",
                callback_data: `reject_${targetRequest._id}`,
              },
            ],
          ],
        },
      });
    }
  } catch (error) {
    console.error("Photo processing error:", error);
  }
});

bot.action(/^(approve|reject)_(.+)$/, async (ctx) => {
  try {
    const action = ctx.match[1];
    const requestId = ctx.match[2];
    const adminId = Number(process.env.VITE_ADMIN_ID);

    if (ctx.from?.id !== adminId) {
      return ctx.answerCbQuery("Відмовлено в доступі.");
    }

    const request = await ManualPaymentRequest.findById(requestId);
    if (!request || request.status !== "pending") {
      return ctx.answerCbQuery("Заявка вже оброблена або не існує.");
    }

    if (action === "approve") {
      request.status = "approved";
      await request.save();

      await UserGamePurchase.create({
        telegramId: request.telegramId,
        gameId: request.gameId,
      });
      await ctx.telegram.sendMessage(
        request.telegramId,
        "✅ Вашу оплату підтверджено! Гра розблокована.",
      );

      const caption =
        ctx.callbackQuery.message && "caption" in ctx.callbackQuery.message
          ? ctx.callbackQuery.message.caption
          : "";
      await ctx.editMessageCaption(`${caption}\n\n✅ ПІДТВЕРДЖЕНО`);
    } else {
      request.status = "rejected";
      await request.save();

      await ctx.telegram.sendMessage(
        request.telegramId,
        "❌ Вашу оплату відхилено. Зверніться до підтримки, якщо сталася помилка.",
      );

      const caption =
        ctx.callbackQuery.message && "caption" in ctx.callbackQuery.message
          ? ctx.callbackQuery.message.caption
          : "";
      await ctx.editMessageCaption(`${caption}\n\n❌ ВІДХИЛЕНО`);
    }

    await ctx.answerCbQuery();
  } catch (error) {
    console.error("Admin action processing error:", error);
  }
});
