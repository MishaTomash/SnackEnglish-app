import { Router } from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import {
  getGamesList,
  createGameInvoice,
  createManualPaymentRequest,
  uploadPaymentReceipt,
  getPaymentHistory,
  getWordsForGame, // ДОДАНО
} from "../controllers/gamesController.js";

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const dir = "uploads/receipts";
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({ storage });
const router = Router();

router.get("/", getGamesList);
router.get("/payments", getPaymentHistory);
router.get("/words", getWordsForGame); // ТЕПЕР ПРАЦЮВАТИМЕ
router.post("/invoice", createGameInvoice);
router.post("/manual-payment", createManualPaymentRequest);
router.post("/receipt", upload.single("receipt"), uploadPaymentReceipt);

export default router;
