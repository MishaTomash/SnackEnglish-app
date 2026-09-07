import { Router } from "express";
import { inviteToDuel } from "../controllers/duelController.js";

const router = Router();

router.post("/invite", inviteToDuel);

export default router;
