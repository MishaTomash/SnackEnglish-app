import crypto from "crypto";
import { Request, Response } from "express";
import { Game } from "../models/Game.js";
import { UserGamePurchase } from "../models/UserGamePurchase.js";
import { ManualPaymentRequest } from "../models/ManualPaymentRequest.js";
import { bot } from "../bot.js";
import { User } from "../models/User.js";

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

    const games = await Game.find().lean();
    const purchases = await UserGamePurchase.find({ telegramId }).lean();
    const purchasedGameIds = new Set(purchases.map((p) => p.gameId));

    const gamesWithStatus = games.map((game) => ({
      ...game,
      isPurchased: game.isFree || purchasedGameIds.has(game.gameId),
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
    const { gameId } = req.body;

    if (!telegramId || !gameId) {
      res.status(400).json({ error: "Missing data" });
      return;
    }

    const game = await Game.findOne({ gameId });
    if (!game || game.isFree || !game.priceStars) {
      res.status(400).json({ error: "Invalid game for invoice" });
      return;
    }

    const payload = JSON.stringify({ gameId, telegramId });
    const invoiceLink = await bot.telegram.createInvoiceLink({
      title: game.title,
      description: `Купівля доступу до гри: ${game.title}`,
      payload: payload,
      provider_token: "", // Порожній токен для Telegram Stars
      currency: "XTR",
      prices: [{ label: game.title, amount: game.priceStars }],
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
    const { gameId } = req.body;

    if (!telegramId || !gameId) {
      res.status(400).json({ error: "Missing data" });
      return;
    }

    const uniqueCode = crypto.randomBytes(4).toString("hex").toUpperCase();
    await ManualPaymentRequest.create({ telegramId, gameId, uniqueCode });

    const cardNumber =
      process.env.PAYMENT_CARD_NUMBER || "Номер картки не налаштовано в .env";

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

    const request = await ManualPaymentRequest.findOne({
      uniqueCode,
      telegramId,
    });
    if (!request || request.status !== "pending") {
      res.status(400).json({ error: "Invalid request" });
      return;
    }

    const user = await User.findOne({ telegramId });
    const game = await Game.findOne({ gameId: request.gameId });
    const adminId = process.env.VITE_ADMIN_ID;

    if (adminId) {
      // Відправляємо фото адміну безпосередньо з файлової системи
      const msg = await bot.telegram.sendPhoto(
        adminId,
        { source: req.file.path },
        {
          caption: `📝 Новий ручний платіж (з додатку)!\nКористувач: @${user?.nickname || telegramId}\nГра: ${game?.title}\nКод: ${uniqueCode}`,
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: "✅ Підтвердити",
                  callback_data: `approve_${request._id}`,
                },
                {
                  text: "❌ Відхилити",
                  callback_data: `reject_${request._id}`,
                },
              ],
            ],
          },
        },
      );

      // Оновлюємо заявку, зберігаючи file_id з Telegram
      request.screenshotFileId = msg.photo[msg.photo.length - 1].file_id;
      request.status = "pending";
      await request.save();
    }

    res.status(200).json({ success: true });
  } catch (error) {
    console.error("Receipt upload error:", error);
    res.status(500).json({ error: "Failed to upload receipt" });
  }
};
