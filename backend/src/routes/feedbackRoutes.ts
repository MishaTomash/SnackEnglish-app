import { Router } from "express";
import type { NextFunction, Request, Response } from "express";
import multer from "multer";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import { userRateLimit } from "../middlewares/userRateLimit.js";
import { sendFeedback } from "../controllers/feedbackController.js";

const router = Router();

// memoryStorage — файли НЕ зберігаються на диску/БД, лише йдуть у Telegram
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 3 },
  // Лише зображення: інакше в Telegram адміну можна надіслати що завгодно
  fileFilter: (_req, file, callback) => {
    callback(null, file.mimetype.startsWith("image/"));
  },
});

// Відгуки йдуть адміну в Telegram — без ліміту один юзер міг би засипати чат
const feedbackLimit = userRateLimit({ windowMs: 10 * 60 * 1000, max: 5 });

/** Помилки multer (завеликий файл, забагато файлів) — зрозуміла відповідь замість 500 */
const receivePhotos = (req: Request, res: Response, next: NextFunction): void => {
  upload.array("photos", 3)(req, res, (error: unknown) => {
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

router.post("/", authMiddleware, feedbackLimit, receivePhotos, sendFeedback);

export default router;