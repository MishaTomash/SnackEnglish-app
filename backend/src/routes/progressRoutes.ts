import { Router } from "express";
import {
  completeLesson,
  getPracticeWords,
  reviewWord,
} from "../controllers/progressController.js";
import {
  getLearningCategories,
  createDailyPlan,
  getNextDayNumber,
  completeDailyPlan,
} from "../controllers/dailyPlanController.js";

const router = Router();

// Марштрути для Навчання (Categories & Daily Plans)
router.get("/categories", getLearningCategories);
router.get("/categories/next-day", getNextDayNumber);
router.post("/categories/admin", createDailyPlan);
router.post("/categories/complete-day", completeDailyPlan);

// Маршрути для проходження уроку
router.post("/lesson-complete", completeLesson);

// Маршрути для інтервального повторення
router.get("/practice", getPracticeWords);
router.post("/review", reviewWord);

export default router;
