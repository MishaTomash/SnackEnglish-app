// 📁 Файл: SnackEnglish-app/backend/src/controllers/gamesController.ts
import crypto from "crypto";
import { Request, Response } from "express";
import { Game } from "../models/Game.js";
import { UserGamePurchase } from "../models/UserGamePurchase.js";
import { ManualPaymentRequest } from "../models/ManualPaymentRequest.js";
import { bot } from "../bot.js";
import { User } from "../models/User.js";
import { WORDS_BY_LEVEL } from "../duels/mockWords.js"; // Беремо слова зі статичного моку
import { getAppSettings } from "../services/settingsService.js";

/** Оплату вимкнено в адмінці — купувати нічого не можна, усі ігри безкоштовні */
const paymentsDisabled = async (res: Response): Promise<boolean> => {
  const settings = await getAppSettings();
  if (settings.paymentsEnabled) return false;
  res.status(403).json({ error: "Payments are disabled" });
  return true;
};

type PurchasableGameCheck =
  | { ok: true; game: NonNullable<Awaited<ReturnType<typeof Game.findOne>>>; priceStars: number }
  | { ok: false; status: number; error: string };

/**
 * Перевіряє, що гру можна купити: вона існує, платна, вже доступна (не "coming_soon")
 * і юзер її ще не має. Спільна для оплати Зірками та ручного переказу.
 */
const checkPurchasableGame = async (telegramId: number, gameId: unknown): Promise<PurchasableGameCheck> => {
  if (typeof gameId !== "string" || !gameId) {
    return { ok: false, status: 400, error: "Missing data" };
  }

  const game = await Game.findOne({ gameId });
  const priceStars = game?.priceStars;
  if (!game || game.isFree || !priceStars || game.get("status") === "coming_soon") {
    return { ok: false, status: 400, error: "Invalid game for purchase" };
  }

  const alreadyOwned = await UserGamePurchase.exists({ telegramId, gameId });
  if (alreadyOwned) {
    return { ok: false, status: 409, error: "Game already purchased" };
  }

  return { ok: true, game, priceStars };
};

export const getGamesList = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const telegramId = req.user?.id;
    if (!telegramId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const [games, purchases, settings] = await Promise.all([
      Game.find().lean(),
      UserGamePurchase.find({ telegramId }).lean(),
      getAppSettings(),
    ]);
    const purchasedGameIds = new Set(purchases.map((p) => p.gameId));

    // Оплату вимкнено — усі доступні ігри відкриті для всіх (код оплати лишається на майбутнє)
    const gamesWithStatus = games.map((game) => ({
      ...game,
      isPurchased: !settings.paymentsEnabled || game.isFree || purchasedGameIds.has(game.gameId),
    }));

    res.status(200).json(gamesWithStatus);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch games" });
  }
};

export const createGameInvoice = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const telegramId = req.user?.id;
    if (!telegramId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    if (await paymentsDisabled(res)) return;

    // ВИПРАВЛЕНО: можна було створити рахунок на гру "coming_soon" або вже куплену
    const check = await checkPurchasableGame(telegramId, req.body?.gameId);
    if (!check.ok) {
      res.status(check.status).json({ error: check.error });
      return;
    }
    const { game, priceStars } = check;
    const gameId = game.gameId;

    const payload = JSON.stringify({ gameId, telegramId });
    const invoiceLink = await bot.telegram.createInvoiceLink({
      title: game.title,
      description: `Купівля доступу до гри: ${game.title}`,
      payload: payload,
      provider_token: "", // Порожній токен для Telegram Stars
      currency: "XTR",
      prices: [{ label: game.title, amount: priceStars }],
    });

    res.status(200).json({ invoiceLink });
  } catch (error) {
    console.error("Invoice generation error:", error);
    res.status(500).json({ error: "Failed to generate invoice" });
  }
};

export const createManualPaymentRequest = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const telegramId = req.user?.id;
    if (!telegramId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    if (await paymentsDisabled(res)) return;

    // ВИПРАВЛЕНО: заявку можна було створити на неіснуючу, безкоштовну чи вже куплену гру
    const check = await checkPurchasableGame(telegramId, req.body?.gameId);
    if (!check.ok) {
      res.status(check.status).json({ error: check.error });
      return;
    }
    const gameId = check.game.gameId;

    const cardNumber = process.env.PAYMENT_CARD_NUMBER?.trim();
    if (!cardNumber) {
      // Раніше юзер бачив "Номер картки не налаштовано" замість картки
      console.error("[payments] PAYMENT_CARD_NUMBER не задано в .env");
      res.status(503).json({ error: "Manual payments are not configured" });
      return;
    }

    // ВИПРАВЛЕНО: кожен тап створював нову заявку з новим кодом — юзер плутався,
    // який код писати в призначенні платежу, а база засмічувалась.
    // Тепер для тієї ж гри повертаємо вже відкриту заявку.
    const existing = await ManualPaymentRequest.findOne({ telegramId, gameId, status: "pending" })
      .select("uniqueCode")
      .lean();
    if (existing?.uniqueCode) {
      res.status(200).json({ uniqueCode: existing.uniqueCode, cardNumber });
      return;
    }

    const uniqueCode = crypto.randomBytes(4).toString("hex").toUpperCase();
    await ManualPaymentRequest.create({ telegramId, gameId, uniqueCode });

    res.status(200).json({ uniqueCode, cardNumber });
  } catch (error) {
    console.error("Manual payment request error:", error);
    res.status(500).json({ error: "Failed to create request" });
  }
};

export const uploadPaymentReceipt = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const telegramId = req.user?.id;
    const { uniqueCode } = req.body;

    if (!telegramId || !uniqueCode || !req.file) {
      res.status(400).json({ error: "Missing data or file" });
      return;
    }
    if (await paymentsDisabled(res)) return;

    const request = await ManualPaymentRequest.findOne({
      uniqueCode,
      telegramId,
    });
    if (!request || request.status !== "pending") {
      res.status(400).json({ error: "Invalid request" });
      return;
    }

    const adminId = process.env.VITE_ADMIN_ID;
    if (!adminId) {
      // Раніше юзер бачив "успішно", хоча квитанція нікуди не йшла
      console.error("[payments] VITE_ADMIN_ID не задано — квитанцію нікому переслати");
      res.status(503).json({ error: "Manual payments are not configured" });
      return;
    }

    const [user, game] = await Promise.all([
      User.findOne({ telegramId }).select("username telegramFirstName").lean(),
      Game.findOne({ gameId: request.gameId }).select("title").lean(),
    ]);

    const caption = `📝 Новий ручний платіж (з додатку)!\nКористувач: @${user?.username || user?.telegramFirstName || telegramId}\nГра: ${game?.title ?? request.gameId}\nКод: ${uniqueCode}`;
    const extra = {
      caption,
      reply_markup: {
        inline_keyboard: [
          [
            { text: "✅ Підтвердити", callback_data: `approve_${request._id}` },
            { text: "❌ Відхилити", callback_data: `reject_${request._id}` },
          ],
        ],
      },
    };

    // ВИПРАВЛЕНО: файл більше не лежить на диску — надсилаємо прямо з пам'яті.
    // Фото (скріншот) — як фото; PDF-квитанцію банку або "незручне" фото — як документ.
    const file = { source: req.file.buffer, filename: req.file.originalname || "receipt" };
    let fileId: string;
    if (req.file.mimetype.startsWith("image/")) {
      try {
        const msg = await bot.telegram.sendPhoto(adminId, file, extra);
        fileId = msg.photo[msg.photo.length - 1].file_id;
      } catch {
        // Telegram відхиляє фото з дуже великими чи дивними розмірами — документ проходить завжди
        const msg = await bot.telegram.sendDocument(adminId, file, extra);
        fileId = msg.document.file_id;
      }
    } else {
      const msg = await bot.telegram.sendDocument(adminId, file, extra);
      fileId = msg.document.file_id;
    }

    request.screenshotFileId = fileId;
    await request.save();

    res.status(200).json({ success: true });
  } catch (error) {
    console.error("Receipt upload error:", error);
    res.status(500).json({ error: "Failed to upload receipt" });
  }
};

export const getPaymentHistory = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const telegramId = req.user?.id;
    if (!telegramId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const games = await Game.find().lean();
    const gameMap = new Map(games.map((g) => [g.gameId, g.title]));

    const manualRequests = await ManualPaymentRequest.find({
      telegramId,
    }).lean();
    const purchases = await UserGamePurchase.find({ telegramId }).lean();

    const history = [];

    for (const request of manualRequests) {
      history.push({
        id: request._id.toString(),
        gameTitle: gameMap.get(request.gameId) || "Невідома гра",
        method: "Ручний переказ",
        status: request.status,
        date: request.createdAt,
      });
    }

    for (const pur of purchases) {
      if (pur.telegramPaymentChargeId) {
        history.push({
          id: pur._id.toString(),
          gameTitle: gameMap.get(pur.gameId) || "Невідома гра",
          method: "Telegram Stars",
          status: "approved",
          date: pur.purchasedAt,
        });
      }
    }

    history.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );

    res.status(200).json(history);
  } catch (error) {
    console.error("Payment history error:", error);
    res.status(500).json({ error: "Failed to fetch history" });
  }
};

export const getWordsForGame = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const level = typeof req.query.level === "string" ? req.query.level : "";
    if (!level) {
      res.status(400).json({ error: "Level is required" });
      return;
    }

    // Тимчасовий фолбек на статичний мок слів
    const wordsByLevel = WORDS_BY_LEVEL as unknown as Record<string, Record<string, unknown>[] | undefined>;
    const allLevelWords = wordsByLevel[level] || wordsByLevel["A1"] || [];

    const withIds = allLevelWords.map((w, index) => ({
      ...w,
      id: w.id || `game_word_${index}`,
    }));

    // Чесне перемішування (Fisher–Yates): sort(() => 0.5 - Math.random()) дає перекіс
    for (let i = withIds.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [withIds[i], withIds[j]] = [withIds[j], withIds[i]];
    }
    const shuffled = withIds.slice(0, 20);

    req.logEvent("game_started", { level });

    res.status(200).json(shuffled);
  } catch (error) {
    console.error("Game words error:", error);
    res.status(500).json({ error: "Failed to fetch words for game" });
  }
};