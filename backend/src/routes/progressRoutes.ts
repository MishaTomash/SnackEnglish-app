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
  completeDailyPlan,
} from "../controllers/dailyPlanController.js";

const router = Router();

router.get("/categories", getLearningCategories);
router.get("/categories/next-day", getNextDayNumber);
router.post("/categories/admin", createDailyPlan);
router.post("/categories/complete-day", completeDailyPlan); // ДОДАНО

router.get("/units", getUserUnits);
router.post("/step", completeStep);

router.get("/practice", getPracticeWords);
router.post("/review", reviewWord);

export default router;
