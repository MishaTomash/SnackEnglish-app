import { Router } from "express";
import {
  getUserUnits,
  completeStep,
  getPracticeWords,
  reviewWord,
} from "../controllers/progressController.js";
import {
  getLearningCategories,
  createDailyPlan,
  getNextDayNumber,
} from "../controllers/dailyPlanController.js";

const router = Router();

// Марштрути для Навчання (Categories & Daily Plans)
router.get("/categories", getLearningCategories);
router.get("/categories/next-day", getNextDayNumber); // ДОДАНО
router.post("/categories/admin", createDailyPlan);

// Маршрути для юнітів та кроків
router.get("/units", getUserUnits);
router.post("/step", completeStep);

// Маршрути для інтервального повторення
router.get("/practice", getPracticeWords);
router.post("/review", reviewWord);

export default router;
