// 📁 Файл: SnackEnglish-app/backend/src/routes/userRoutes.ts
import { Router } from "express";
import type { NextFunction, Request, Response } from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import {
  getMe,
  completeOnboarding,
  updateLevel,
  updateProfile,
  getAllUsersAdmin,
  toggleUserBlock,
  getAnalyticsSummary,
  getRecentEvents,
  getActivityWeek,
  getReferralInfo,
} from "../controllers/userController.js";
import {
  getLeaderboard,
  getGiveawayHistory,
  forceEndGiveaway,
} from "../controllers/leaderboardController.js";
import { getAppConfig, trackSupportClick } from "../controllers/appConfigController.js";
import { adminOnly } from "../middlewares/authMiddleware.js";
import { userRateLimit } from "../middlewares/userRateLimit.js";

const router = Router();

const uploadDir = path.join(process.cwd(), "uploads/avatars");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// memoryStorage, щоб обробити файл через sharp перед збереженням
const upload = multer({
  storage: multer.memoryStorage(),
  // 5 МБ досить для фото з телефона; аватар однаково стискається до 300x300
  limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 10 },
  // Лише зображення: інакше sharp падав на довільному файлі з 500
  fileFilter: (_req, file, callback) => {
    callback(null, file.mimetype.startsWith("image/"));
  },
});

/** Помилки multer (завеликий файл тощо) — зрозуміла відповідь замість 500 */
const receiveAvatar = (req: Request, res: Response, next: NextFunction): void => {
  upload.single("avatar")(req, res, (error: unknown) => {
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

// Обробка аватара (sharp) навантажує процесор — обмежуємо лише запити з файлом.
// Звичайні оновлення профілю (зняття життя після помилки) не обмежуються.
const avatarLimit = userRateLimit({ windowMs: 10 * 60 * 1000, max: 10 });
const limitAvatarUploads = (req: Request, res: Response, next: NextFunction): void => {
  if (req.file) avatarLimit(req, res, next);
  else next();
};

router.get("/me", getMe);
router.get("/app-config", getAppConfig);
router.get("/activity-week", getActivityWeek);
router.get("/referral", getReferralInfo);
router.post("/support-click", trackSupportClick);
router.get("/leaderboard", getLeaderboard);
router.get("/giveaway-history", getGiveawayHistory);
router.patch("/onboarding", completeOnboarding);
router.patch("/level", updateLevel);
router.patch("/profile", receiveAvatar, limitAvatarUploads, updateProfile);

// Адмін-only
// ВИПРАВЛЕНО: завершити розіграш міг БУДЬ-ЯКИЙ юзер — не було adminOnly
router.post("/giveaway/force-end", adminOnly, forceEndGiveaway);
router.get("/admin/users", adminOnly, getAllUsersAdmin);
router.patch("/admin/users/:telegramId/block", adminOnly, toggleUserBlock);
router.get("/admin/analytics", adminOnly, getAnalyticsSummary);
router.get("/admin/events", adminOnly, getRecentEvents);

export default router;