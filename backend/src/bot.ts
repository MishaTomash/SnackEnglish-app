// 📁 Файл: SnackEnglish-app/backend/src/bot.ts
import path from "path";
import dotenv from "dotenv";

// Гарантоване завантаження .env файлу з поточної робочої директорії
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

import { Telegraf, Markup } from "telegraf";
import type { Context } from "telegraf";
import { withStyle } from "./services/buttonStyle.js";
import { editRich, HOME_KEYBOARD, sendRich, sendRichMessage } from "./services/richMessage.js";
import { User } from "./models/User.js";
import { Game } from "./models/Game.js";
import { UserGamePurchase } from "./models/UserGamePurchase.js";
import { ManualPaymentRequest } from "./models/ManualPaymentRequest.js";
import { Friendship } from "./models/Friendship.js";
import { broadcastMessage, isBroadcastRunning } from "./services/broadcastService.js";
import { getAppSettings } from "./services/settingsService.js";
import { applyReferral } from "./services/referralService.js";
import {
  buildHelpText,
  buildInvite,
  buildRemindersText,
  buildStatusCard,
  buildTopText,
  buildWelcomeText,
  escapeHtml,
  hasValidAppUrl,
  getAppUrl,
  loadUserSnapshot,
  remindersKeyboard,
  setupBotProfile,
  statusKeyboard,
  buildStatusRich,
  welcomeKeyboard,
} from "./services/botUi.js";

const botToken = process.env.BOT_TOKEN;

if (!botToken) {
  throw new Error("BOT_TOKEN is not defined in environment variables");
}

export const bot = new Telegraf(botToken);

// "Обличчя" бота: опис до /start, команди в меню, кнопка "🍪 Вчити" біля поля вводу
void setupBotProfile(bot.telegram);

/** Привітання за часом доби (час сервера — Київ) */
const greetingByTime = (): string => {
  const hour = new Date().getHours();
  if (hour < 5) return "Доброї ночі";
  if (hour < 12) return "Доброго ранку";
  if (hour < 18) return "Доброго дня";
  return "Доброго вечора";
};

/**
 * Картка прогресу з кнопками — для /start, /progress і відповіді на довільний текст.
 * Спершу — як Rich Message (кнопки всередині повідомлення); якщо Telegram його не прийняв —
 * звичайне повідомлення з кнопками під ним, щоб юзер завжди отримав картку.
 * footer — звичайний текст (без HTML), показується курсивом наприкінці.
 */
const sendStatusCard = async (ctx: Context, greeting: string, footer = ""): Promise<void> => {
  if (!ctx.from || !ctx.chat) return;
  const snapshot = await loadUserSnapshot(ctx.from.id, ctx.from.first_name);
  if (!snapshot) {
    await ctx.reply("Натисни /start, щоб почати 🍪");
    return;
  }
  try {
    await sendRichMessage(ctx.telegram, ctx.chat.id, buildStatusRich(snapshot, greeting, footer), HOME_KEYBOARD);
    return;
  } catch (error) {
    console.error("[bot] Rich-картку не надіслано, шлю звичайну:", error instanceof Error ? error.message : error);
  }
  const footerHtml = footer ? `\n\n<i>${escapeHtml(footer)}</i>` : "";
  await ctx.reply(`${buildStatusCard(snapshot, greeting)}${footerHtml}`, { parse_mode: "HTML", ...statusKeyboard(snapshot) });
};

/** Привітання новачка — з картинкою, якщо її задано в адмінці */
const sendWelcome = async (ctx: Context, text: string, imageUrl: string): Promise<void> => {
  if (!ctx.chat) return;
  await sendRich(ctx.telegram, ctx.chat.id, {
    html: text,
    photo: imageUrl || undefined,
    rows: welcomeKeyboard().reply_markup.inline_keyboard,
    home: true,
  });
};

bot.start(async (ctx) => {
  try {
    // Бот працює в особистому чаті; у групах /start ігноруємо
    if (ctx.chat?.type !== "private") return;
    const telegramUser = ctx.from;
    if (!telegramUser) return;

    let user = await User.findOne({ telegramId: telegramUser.id });
    const isNewUser = !user;

    if (!user) {
      user = await User.create({
        telegramId: telegramUser.id,
        username: telegramUser.username ?? undefined,
        telegramFirstName: telegramUser.first_name ?? undefined,
        level: null,
        weakAreas: [],
        // Стрік рахується за уроками — починається з першого уроку
        streak: 0,
        hp: 5,
        lastActivityDate: new Date(),
        onboardingCompleted: false,
        wordsBackfilled: true,
      });
    } else if (user.botBlockedAt) {
      // Юзер знову написав боту — отже, розблокував його: нагадування знову можна слати
      await User.updateOne({ _id: user._id }, { $set: { botBlockedAt: null } });
    }

    // Запрошення від друга: t.me/<бот>?start=ref_<код>. Лише для нових юзерів
    const startPayload = ctx.payload;
    let invitedByFriend = false;
    if (isNewUser && startPayload && startPayload.startsWith("ref_")) {
      invitedByFriend = await applyReferral(user._id, startPayload.slice(4)).catch(() => false);
    }

    if (!hasValidAppUrl()) {
      await ctx.reply(
        `Привіт, ${telegramUser.first_name}! 🍪\n\nСервер ще налаштовує захищене HTTPS-з'єднання. Будь ласка, перевірте VITE_APP_URL у файлі .env.`,
      );
      return;
    }
    const appUrl = getAppUrl();

    const payload = ctx.payload;

    // 1. ЯКЩО ЦЕ ЗАПРОШЕННЯ НА ДУЕЛЬ
    if (payload && payload.startsWith("duel_")) {
      const roomId = payload.replace("duel_", "");
      const webAppUrl = `${appUrl}?startapp=duel_${roomId}`;

      await sendRich(ctx.telegram, ctx.chat.id, {
        html: `⚔️ <b>${escapeHtml(telegramUser.first_name)}</b>, тебе викликали на дуель!\n\nТицяй кнопку нижче, щоб приєднатися та показати свої знання:`,
        rows: [[withStyle(Markup.button.webApp("Приєднатися 🚀", webAppUrl), "primary")]],
        home: true,
      });
      return;
    }

    // 2. НОВАЧОК — знайомство зі Снекі
    if (isNewUser) {
      const settings = await getAppSettings();
      const text = buildWelcomeText(
        telegramUser.first_name,
        invitedByFriend && settings.referralBonus > 0 ? settings.referralBonus : null,
      );
      await sendWelcome(ctx, text, settings.botWelcomeImage);
      return;
    }

    // 3. ТОЙ, ХТО ПОВЕРНУВСЯ — картка прогресу й кнопка "Продовжити"
    await sendStatusCard(ctx, greetingByTime());
  } catch (error: unknown) {
    console.error("Помилка в обробнику /start бота:", error);
    await ctx.reply(
      "Сталася помилка при запуску. Будь ласка, спробуйте пізніше.",
    );
  }
});

// ==================== КОМАНДИ ====================

// /progress (і старе /profile) — картка прогресу
bot.command(["progress", "profile"], async (ctx) => {
  try {
    await sendStatusCard(ctx, "Твій прогрес");
  } catch (error) {
    console.error("Помилка команди /progress:", error);
  }
});

const sendTop = async (ctx: Context): Promise<void> => {
  if (!ctx.from) return;
  if (!ctx.chat) return;
  const text = await buildTopText(ctx.from.id);
  await sendRich(ctx.telegram, ctx.chat.id, {
    html: text,
    rows: hasValidAppUrl()
      ? [[withStyle(Markup.button.webApp("🏆 Відкрити рейтинг", `${getAppUrl().replace(/\/$/, "")}/leaderboard`), "primary")]]
      : [],
    home: true,
  });
};

const sendInvite = async (ctx: Context): Promise<void> => {
  if (!ctx.from) return;
  const invite = await buildInvite(ctx.from.id);
  if (!invite) {
    await ctx.reply("Натисни /start, щоб почати 🍪");
    return;
  }
  if (!ctx.chat) return;
  await sendRich(ctx.telegram, ctx.chat.id, { html: invite.text, rows: invite.keyboard.reply_markup.inline_keyboard, home: true });
};

const sendReminders = async (ctx: Context): Promise<void> => {
  if (!ctx.from) return;
  const user = await User.findOne({ telegramId: ctx.from.id }).select("remindersEnabled").lean<{ remindersEnabled?: boolean }>();
  const enabled = user?.remindersEnabled !== false;
  if (!ctx.chat) return;
  await sendRich(ctx.telegram, ctx.chat.id, {
    html: buildRemindersText(enabled),
    rows: remindersKeyboard(enabled).reply_markup.inline_keyboard,
    home: true,
  });
};

const sendHelp = async (ctx: Context): Promise<void> => {
  if (!ctx.chat) return;
  await sendRich(ctx.telegram, ctx.chat.id, {
    html: await buildHelpText(),
    rows: hasValidAppUrl() ? [[withStyle(Markup.button.webApp("🚀 До уроків", getAppUrl()), "primary")]] : [],
    home: true,
  });
};

bot.command("top", (ctx) => sendTop(ctx).catch((error) => console.error("Помилка /top:", error)));
bot.command("invite", (ctx) => sendInvite(ctx).catch((error) => console.error("Помилка /invite:", error)));
bot.command("reminders", (ctx) => sendReminders(ctx).catch((error) => console.error("Помилка /reminders:", error)));
bot.command("help", (ctx) => sendHelp(ctx).catch((error) => console.error("Помилка /help:", error)));

// Нижня кнопка «🏠 Головна» — картка прогресу з будь-якого місця, без пошуку /start.
// Обидва варіанти тексту — щоб кнопка працювала і з власною іконкою, і без неї
bot.hears(["🏠 Головна", "Головна"], (ctx) => sendStatusCard(ctx, greetingByTime()).catch((error) => console.error("Помилка «Головна»:", error)));

// Кнопки під повідомленнями бота
bot.action(/^ui:(top|invite|help|reminders|progress)$/, async (ctx) => {
  try {
    await ctx.answerCbQuery();
    const action = ctx.match[1];
    if (action === "top") await sendTop(ctx);
    else if (action === "invite") await sendInvite(ctx);
    else if (action === "help") await sendHelp(ctx);
    else if (action === "reminders") await sendReminders(ctx);
    else await sendStatusCard(ctx, "Твій прогрес");
  } catch (error) {
    console.error("Помилка кнопки бота:", error);
  }
});

// Увімкнути / вимкнути нагадування — змінюємо те саме повідомлення
bot.action(/^ui:remind_(on|off)$/, async (ctx) => {
  try {
    const enabled = ctx.match[1] === "on";
    await User.updateOne({ telegramId: ctx.from?.id }, { $set: { remindersEnabled: enabled } });
    await ctx.answerCbQuery(enabled ? "Нагадування увімкнено 🔔" : "Нагадування вимкнено 🔕");
    const messageId = ctx.callbackQuery?.message?.message_id;
    if (ctx.chat && messageId) {
      await editRich(ctx.telegram, ctx.chat.id, messageId, {
        html: buildRemindersText(enabled),
        rows: remindersKeyboard(enabled).reply_markup.inline_keyboard,
      });
    }
  } catch (error) {
    console.error("Помилка перемикання нагадувань:", error);
  }
});

// НОВА КОМАНДА: /copy — розсилка повідомлення, на яке адмін відповів, усім користувачам
bot.command("copy", async (ctx) => {
  try {
    const adminId = Number(process.env.VITE_ADMIN_ID);
    if (ctx.from?.id !== adminId) {
      return ctx.reply("Ця команда доступна лише адміністратору.");
    }

    const message = ctx.message;
    const repliedMessage =
      "reply_to_message" in message ? message.reply_to_message : undefined;

    if (!repliedMessage) {
      return ctx.reply(
        "Відповідай командою /copy на повідомлення, яке потрібно розіслати.",
      );
    }

    const sourceChatId = message.chat.id;
    const sourceMessageId = repliedMessage.message_id;

    // Одна розсилка за раз — інакше юзери отримали б повідомлення двічі
    if (isBroadcastRunning()) {
      return ctx.reply("⏳ Попередня розсилка ще триває. Дочекайся її завершення.");
    }

    await ctx.reply("📨 Розсилку розпочато, це може зайняти деякий час...");

    void broadcastMessage(ctx.telegram, sourceChatId, sourceMessageId)
      .then((result) =>
        ctx.reply(
          `✅ Розсилку завершено.\nУспішно: ${result.success}\nНе вдалося: ${result.failed}`,
        ),
      )
      .catch((error: unknown) =>
        ctx.reply(`⚠️ Розсилку зупинено: ${error instanceof Error ? error.message : "невідома помилка"}`),
      );
  } catch (error) {
    console.error("Помилка команди /copy:", error);
  }
});

// --- СПОСІБ 1: TELEGRAM STARS ---

bot.on("pre_checkout_query", async (ctx) => {
  try {
    // Оплату вимкнено в адмінці — старе посилання на рахунок не повинно списати Зірки
    const settings = await getAppSettings();
    if (!settings.paymentsEnabled) {
      return ctx.answerPreCheckoutQuery(false, "Оплата зараз вимкнена — усі ігри безкоштовні 🎉");
    }

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

    // ВИПРАВЛЕНО: create падав з помилкою дубліката, якщо гру вже відкрили вручну
    // (або Telegram надіслав подію повторно) — юзер заплатив, але не бачив підтвердження.
    // upsert: запис створюється один раз, повтор нічого не ламає.
    await UserGamePurchase.updateOne(
      { telegramId, gameId },
      {
        $set: { telegramPaymentChargeId: paymentInfo.telegram_payment_charge_id },
        $setOnInsert: { purchasedAt: new Date() },
      },
      { upsert: true },
    );

    await ctx.reply(
      "✨ Дякуємо за покупку! Гру успішно розблоковано в додатку.",
    );
  } catch (error) {
    console.error("Payment registration error:", error);
  }
});

// --- СПОСІБ 2: РУЧНИЙ ПЕРЕКАЗ ---

bot.on("photo", async (ctx, next) => {
  try {
    if (!("photo" in ctx.message)) return next();

    const caption = ("caption" in ctx.message ? ctx.message.caption : "") || "";
    const match = caption.match(/([A-F0-9]{8})/i);

    const manualRequests = await ManualPaymentRequest.find({
      telegramId: ctx.from.id,
      status: "pending",
    });

    if (manualRequests.length === 0) return next();

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
        caption: `📝 Новий ручний платіж!\nКористувач: @${user?.username || user?.telegramFirstName || ctx.from.username}\nГра: ${game?.title}\nКод: ${targetRequest.uniqueCode}`,
        reply_markup: {
          inline_keyboard: [
            [
              withStyle(
                {
                  text: "✅ Підтвердити",
                  callback_data: `approve_${targetRequest._id}`,
                },
                "success",
              ),
              withStyle(
                {
                  text: "❌ Відхилити",
                  callback_data: `reject_${targetRequest._id}`,
                },
                "danger",
              ),
            ],
          ],
        },
      });
    }
  } catch (error) {
    console.error("Photo processing error:", error);
    return next();
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

    // ВИПРАВЛЕНО: атомарно pending -> approved/rejected. Раніше подвійне натискання
    // кнопки могло обробити заявку двічі (дві покупки, два повідомлення юзеру)
    const request = await ManualPaymentRequest.findOneAndUpdate(
      { _id: requestId, status: "pending" },
      { $set: { status: action === "approve" ? "approved" : "rejected" } },
      { returnDocument: "after" },
    );
    if (!request) {
      return ctx.answerCbQuery("Заявка вже оброблена або не існує.");
    }

    if (action === "approve") {
      // upsert: якщо юзер тим часом купив гру Зірками — не падаємо на дублікаті
      await UserGamePurchase.updateOne(
        { telegramId: request.telegramId, gameId: request.gameId },
        { $setOnInsert: { purchasedAt: new Date() } },
        { upsert: true },
      );
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

/** Замінює заявку в друзі на результат (кнопки прибираються) */
const editFriendRequest = async (ctx: Context, html: string): Promise<void> => {
  const messageId = ctx.callbackQuery?.message?.message_id;
  if (ctx.chat && messageId) await editRich(ctx.telegram, ctx.chat.id, messageId, { html });
};

bot.action(/^f_(acc|rej)_(.+)$/, async (ctx) => {
  try {
    const action = ctx.match[1];
    const friendshipId = ctx.match[2];

    const friendship =
      await Friendship.findById(friendshipId).populate("requestedBy");
    if (!friendship || friendship.status !== "pending") {
      return ctx.answerCbQuery("Заявка вже оброблена або не існує.");
    }

    const currentUser = await User.findOne({ telegramId: ctx.from?.id });
    if (
      !currentUser ||
      (friendship.userId.toString() !== currentUser._id.toString() &&
        friendship.friendId.toString() !== currentUser._id.toString())
    ) {
      return ctx.answerCbQuery("Це не ваша заявка.");
    }

    const requester = friendship.requestedBy as any;
    const reqFirstName = requester.telegramFirstName;
    const reqUsername = requester.username ? `@${requester.username}` : null;
    let reqName =
      reqFirstName && reqUsername
        ? `${reqFirstName} (${reqUsername})`
        : reqFirstName || reqUsername || `ID: ${requester.telegramId}`;
    const reqSafeName = reqName
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    const myFirstName = currentUser.telegramFirstName;
    const myUsername = currentUser.username ? `@${currentUser.username}` : null;
    let myName =
      myFirstName && myUsername
        ? `${myFirstName} (${myUsername})`
        : myFirstName || myUsername || `ID: ${currentUser.telegramId}`;
    const mySafeName = myName
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    if (action === "acc") {
      friendship.status = "accepted";
      await friendship.save();
      await editFriendRequest(ctx, `✅ Ви додали <b>${reqSafeName}</b> у друзі!`);

      await sendRich(ctx.telegram, requester.telegramId, {
        html: `🎉 <b>${mySafeName}</b> прийняв(ла) вашу заявку в друзі!`,
      });
    } else {
      await friendship.deleteOne();
      await editFriendRequest(ctx, `❌ Ви відхилили заявку від <b>${reqSafeName}</b>.`);
    }

    await ctx.answerCbQuery();
  } catch (error) {
    console.error("Помилка обробки заявки в друзі через бота:", error);
    await ctx.answerCbQuery("Сталася помилка.");
  }
});

// ФОЛБЕК: довільні повідомлення в особистому чаті
bot.on("message", async (ctx, next) => {
  if (ctx.chat.type !== "private") return next();
  const message = ctx.message;

  try {
    if ("voice" in message || "video_note" in message) {
      await sendRich(ctx.telegram, ctx.chat.id, {
        html: "Голосові я поки не слухаю 🙈\n\nАле в уроках є вправи «Скажи вголос» — там Снекі перевірить твою вимову! 🎤",
        rows: hasValidAppUrl() ? [[withStyle(Markup.button.webApp("🎤 До уроків", getAppUrl()), "primary")]] : [],
        home: true,
      });
      return;
    }
    if ("sticker" in message || "animation" in message) {
      await sendRich(ctx.telegram, ctx.chat.id, {
        html: "Класний стікер! 😄🍪 А тепер — маленький урок?",
        rows: hasValidAppUrl() ? [[withStyle(Markup.button.webApp("🚀 Відкрити SnackEnglish", getAppUrl()), "primary")]] : [],
        home: true,
      });
      return;
    }
    if ("text" in message) {
      // Невідома команда — підказуємо, які є
      if (message.text.startsWith("/")) {
        await sendHelp(ctx);
        return;
      }
      await sendStatusCard(ctx, "Я тут", "Я не чат-бот для розмов, але допоможу з англійською — тисни кнопку 👇");
      return;
    }
  } catch (error) {
    console.error("Помилка відповіді на повідомлення:", error);
    return;
  }
  return next();
});