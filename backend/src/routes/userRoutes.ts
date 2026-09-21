import { Router } from "express";
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
} from "../controllers/userController.js";
import {
  getLeaderboard,
  getGiveawayHistory,
  forceEndGiveaway,
} from "../controllers/leaderboardController.js";
import { adminOnly } from "../middlewares/authMiddleware.js";

const router = Router();

const uploadDir = path.join(process.cwd(), "uploads/avatars");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// ЗМІНЕНО: Використовуємо memoryStorage, щоб обробити файл перед збереженням
const storage = multer.memoryStorage();

const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

router.get("/me", getMe);
router.get("/leaderboard", getLeaderboard);
router.get("/giveaway-history", getGiveawayHistory);
router.post("/giveaway/force-end", forceEndGiveaway);
router.patch("/onboarding", completeOnboarding);
router.patch("/level", updateLevel);
router.patch("/profile", upload.single("avatar"), updateProfile);

// Адмін-only
router.get("/admin/users", adminOnly, getAllUsersAdmin);
router.patch("/admin/users/:telegramId/block", adminOnly, toggleUserBlock);
router.get("/admin/analytics", adminOnly, getAnalyticsSummary);
router.get("/admin/events", adminOnly, getRecentEvents);

export default router;
