import { Router } from "express";
import {
    createChapter,
    createNodes,
    deleteChapter,
    deleteNode,
    getNode,
    listChapters,
    listNodes,
    moveChapter,
    moveNode,
    updateChapter,
    updateNode,
    validateLessonsHandler,
} from "../controllers/storyAdminController.js";

// authMiddleware + adminOnly підключаються при монтуванні в index.ts:
// app.use("/api/stories/admin", authMiddleware, adminOnly, storyAdminRoutes)
const router = Router();

// Розділи
router.get("/chapters", listChapters);
router.post("/chapters", createChapter);
router.patch("/chapters/:chapterId", updateChapter);
router.delete("/chapters/:chapterId", deleteChapter);
router.post("/chapters/:chapterId/move", moveChapter);

// Уроки
router.get("/chapters/:chapterId/nodes", listNodes);
router.post("/chapters/:chapterId/nodes", createNodes);
router.post("/lessons/validate", validateLessonsHandler);
router.get("/nodes/:nodeId", getNode);
router.put("/nodes/:nodeId", updateNode);
router.delete("/nodes/:nodeId", deleteNode);
router.post("/nodes/:nodeId/move", moveNode);

export default router;