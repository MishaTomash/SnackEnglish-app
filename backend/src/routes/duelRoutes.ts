import { Router } from "express";
import {
  inviteToDuel,
  getInviteState,
  respondToInvite,
} from "../controllers/duelController.js";

const router = Router();

router.post("/invite", inviteToDuel);
router.get("/:roomCode", getInviteState);
router.post("/:roomCode/respond", respondToInvite);

export default router;
