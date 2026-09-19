import { Router } from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import {
  getMe,
  completeOnboarding,
  updateLevel,
  updateProfile,
} from "../controllers/userController.js";
import {
  getLeaderboard,
  getGiveawayHistory,
  forceEndGiveaway,
} from "../controllers/leaderboardController.js";

const router = Router();

const uploadDir = path.join(process.cwd(), "uploads/avatars");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

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

const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

router.get("/me", getMe);
router.get("/leaderboard", getLeaderboard);
router.get("/giveaway-history", getGiveawayHistory);
router.post("/giveaway/force-end", forceEndGiveaway);
router.patch("/onboarding", completeOnboarding);
router.patch("/level", updateLevel);
router.patch("/profile", upload.single("avatar"), updateProfile);

export default router;
