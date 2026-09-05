import { Router } from "express";
import {
  getMe,
  completeOnboarding,
  updateLevel,
  updateProfile,
  updateNickname,
} from "../controllers/userController.js";

const router = Router();

router.get("/me", getMe);
router.patch("/onboarding", completeOnboarding);
router.patch("/level", updateLevel);
router.patch("/profile", updateProfile);
router.patch("/nickname", updateNickname);

export default router;
