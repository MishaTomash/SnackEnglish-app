import { Router } from "express";
import {
  getUserUnits,
  completeStep,
  getPracticeWords,
  reviewWord,
} from "../controllers/progressController.js";

const router = Router();

router.get("/units", getUserUnits);
router.post("/step", completeStep);
router.get("/practice", getPracticeWords);
router.post("/review", reviewWord);

export default router;
