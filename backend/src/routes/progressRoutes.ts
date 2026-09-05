import { Router } from "express";
import {
  getUserUnits,
  completeStep,
  getPracticeWords,
  reviewWord,
} from "../controllers/progressController.js";

const router = Router();

// Маршрути для юнітів та кроків
router.get("/units", getUserUnits);
router.post("/step", completeStep);

// Маршрути для інтервального повторення
router.get("/practice", getPracticeWords);
router.post("/review", reviewWord);

export default router;
