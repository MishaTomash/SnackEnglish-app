import { Router } from "express";
import { broadcastToAll } from "../controllers/adminController.js";
import { authMiddleware } from "../middlewares/authMiddleware.js";

const router = Router();

router.post("/broadcast", authMiddleware, broadcastToAll);

export default router;
