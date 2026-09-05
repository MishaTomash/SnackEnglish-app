import { Router } from "express";
import {
  getGamesList,
  createGameInvoice,
  createManualPaymentRequest,
} from "../controllers/gamesController.js";

const router = Router();

router.get("/", getGamesList);
router.post("/invoice", createGameInvoice);
router.post("/manual-payment", createManualPaymentRequest);

export default router;
