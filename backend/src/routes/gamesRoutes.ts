import { Router } from "express";
import type { NextFunction, Request, Response } from "express";
import multer from "multer";
import {
  getGamesList,
  createGameInvoice,
  createManualPaymentRequest,
  uploadPaymentReceipt,
  getPaymentHistory,
  getWordsForGame,
} from "../controllers/gamesController.js";
import { userRateLimit } from "../middlewares/userRateLimit.js";

/**
 * ВИПРАВЛЕНО: квитанції зберігались на диск у uploads/receipts без обмежень,
 * а index.ts віддає /uploads публічно — фото банківських квитанцій юзерів були
 * доступні будь-кому за посиланням і ніколи не видалялись.
 * Тепер файл лише в пам'яті: одразу йде адміну в Telegram (там і зберігається).
 */
const MAX_RECEIPT_BYTES = 10 * 1024 * 1024; // ліміт Telegram для фото

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_RECEIPT_BYTES, files: 1, fields: 5 },
  // Скріншот або PDF-квитанція з банківського застосунку
  fileFilter: (_req, file, callback) => {
    callback(null, file.mimetype.startsWith("image/") || file.mimetype === "application/pdf");
  },
});

/** Помилки multer (завеликий файл) — зрозуміла відповідь замість 500 */
const receiveReceipt = (req: Request, res: Response, next: NextFunction): void => {
  upload.single("receipt")(req, res, (error: unknown) => {
    if (!error) {
      next();
      return;
    }
    if (error instanceof multer.MulterError) {
      const status = error.code === "LIMIT_FILE_SIZE" ? 413 : 400;
      res.status(status).json({ error: error.code });
      return;
    }
    next(error);
  });
};

// Оплати й квитанції йдуть адміну в Telegram — обмежуємо, щоб не засипали чат і базу
const paymentLimit = userRateLimit({ windowMs: 10 * 60 * 1000, max: 20 });
const receiptLimit = userRateLimit({ windowMs: 10 * 60 * 1000, max: 5 });

const router = Router();

router.get("/", getGamesList);
router.get("/payments", getPaymentHistory);
router.get("/words", getWordsForGame);
router.post("/invoice", paymentLimit, createGameInvoice);
router.post("/manual-payment", paymentLimit, createManualPaymentRequest);
router.post("/receipt", receiptLimit, receiveReceipt, uploadPaymentReceipt);

export default router;