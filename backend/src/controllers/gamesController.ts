import crypto from "crypto";
import { Request, Response } from "express";
import { Game } from "../models/Game.js";
import { UserGamePurchase } from "../models/UserGamePurchase.js";
import { ManualPaymentRequest } from "../models/ManualPaymentRequest.js";
import { bot } from "../bot.js";

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
