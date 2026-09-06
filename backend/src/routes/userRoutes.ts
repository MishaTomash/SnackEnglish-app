import { Router } from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import {
  getMe,
  completeOnboarding,
  updateLevel,
  updateProfile,
  updateNickname,
} from "../controllers/userController.js";
// ДОДАНО: Імпортуємо контролер лідерборду
import { getLeaderboard } from "../controllers/leaderboardController.js";

const router = Router();

// ВИПРАВЛЕННЯ 1: Абсолютний шлях, щоб multer і express.static точно дивились в одну папку
const uploadDir = path.join(process.cwd(), "uploads/avatars");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Налаштування multer для збереження на диск
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(
      null,
      `${req.user?.id}-${uniqueSuffix}${path.extname(file.originalname)}`,
    );
  },
});

// ВИПРАВЛЕННЯ 2: Збільшуємо ліміт розміру файлу до 10MB
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

router.get("/me", getMe);
// ДОДАНО: Підключаємо ендпоінт для отримання лідерборду
router.get("/leaderboard", getLeaderboard);
router.patch("/onboarding", completeOnboarding);
router.patch("/level", updateLevel);
router.patch("/profile", upload.single("avatar"), updateProfile);
router.patch("/nickname", updateNickname);

export default router;
