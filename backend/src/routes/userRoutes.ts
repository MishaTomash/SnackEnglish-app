import { Router } from "express";
import { getMe, completeOnboarding } from "../controllers/userController.js";

const router = Router();

router.get("/me", getMe);
router.patch("/onboarding", completeOnboarding);
router.patch("/level", updateLevel);

export default router;
