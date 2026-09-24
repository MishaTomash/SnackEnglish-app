import { Router } from "express";
import {
    getChapters,
    getChapterNodes,
    getNodeContent,
    completeNode,
} from "../controllers/storyController.js";

// authMiddleware підключається при монтуванні в index.ts
// (app.use("/api/stories", authMiddleware, storyRoutes)) — як для profile/user/games
const router = Router();

router.get("/", getChapters);
router.get("/:chapterId", getChapterNodes);
router.get("/:chapterId/nodes/:nodeId", getNodeContent);
router.post("/:chapterId/nodes/:nodeId/complete", completeNode);

export default router;