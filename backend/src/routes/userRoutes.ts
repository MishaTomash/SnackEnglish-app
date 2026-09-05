import { Router } from "express";
// ДОДАЙ updateLevel у цей список імпортів:
import {
  getMe,
  completeOnboarding,
  updateLevel,
} from "../controllers/userController.js";

const router = Router();

router.get("/me", getMe);
router.patch("/onboarding", completeOnboarding);
router.patch("/level", updateLevel);

export default router;
