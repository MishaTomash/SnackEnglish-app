import { Router } from "express";
import multer from "multer";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import { sendFeedback } from "../controllers/feedbackController.js";

const router = Router();

// memoryStorage — файли НЕ зберігаються на диску/БД, лише йдуть у Telegram
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 3 },
});

router.post("/", authMiddleware, upload.array("photos", 3), sendFeedback);

export default router;
