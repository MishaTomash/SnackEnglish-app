// 📁 Файл: SnackEnglish-app/backend/src/routes/adminRoutes.ts
import { Router } from "express";
import { broadcastToAll } from "../controllers/adminController.js";
import { adminOnly, authMiddleware } from "../middlewares/authMiddleware.js";
import { getDashboard } from "../controllers/admin/dashboardController.js";
import {
    exportUsers,
    getUserDetail,
    listGames,
    listUsers,
    messageUser,
    setUserGame,
    updateUser,
} from "../controllers/admin/usersController.js";
import {
    cancelBroadcastHandler,
    estimateBroadcast,
    getBroadcastHistory,
    getBroadcastStatus,
    receiveBroadcastPhoto,
    startBroadcastHandler,
    testBroadcast,
} from "../controllers/admin/broadcastAdminController.js";
import {
    getReceipt,
    listPayments,
    listPurchases,
    resolvePayment,
} from "../controllers/admin/paymentsController.js";
import { getContentStats } from "../controllers/admin/contentController.js";
import { clearCaches, getSystemStatus } from "../controllers/admin/systemController.js";
import { getSettings, updateSettings } from "../controllers/admin/settingsController.js";
import {
    cancelTtsJobHandler,
    cleanupTts,
    generateTts,
    getTtsJobStatus,
    getTtsNode,
    getTtsOverview,
    previewTts,
    regenerateTts,
} from "../controllers/admin/ttsController.js";

/**
 * Адмін-панель: /api/admin/*. Усе — лише для адміна (VITE_ADMIN_ID).
 * Перевірка на рівні роутера: жоден маршрут нижче не можна випадково лишити відкритим.
 */
const router = Router();

router.use(authMiddleware, adminOnly);

// Старий ендпоінт розсилки тексту (кнопка на головній) — лишається для сумісності
router.post("/broadcast", broadcastToAll);

router.get("/dashboard", getDashboard);

router.get("/users", listUsers);
router.post("/users/export", exportUsers);
router.get("/users/:telegramId", getUserDetail);
router.patch("/users/:telegramId", updateUser);
router.post("/users/:telegramId/message", messageUser);
router.post("/users/:telegramId/games", setUserGame);
router.get("/games", listGames);

router.get("/broadcast/status", getBroadcastStatus);
router.get("/broadcast/history", getBroadcastHistory);
router.post("/broadcast/estimate", estimateBroadcast);
router.post("/broadcast/test", receiveBroadcastPhoto, testBroadcast);
router.post("/broadcast/start", receiveBroadcastPhoto, startBroadcastHandler);
router.post("/broadcast/cancel", cancelBroadcastHandler);

router.get("/payments", listPayments);
router.get("/payments/:id/receipt", getReceipt);
router.post("/payments/:id/resolve", resolvePayment);
router.get("/purchases", listPurchases);

router.get("/content", getContentStats);

router.get("/tts/overview", getTtsOverview);
router.get("/tts/nodes/:nodeId", getTtsNode);
router.post("/tts/generate", generateTts);
router.get("/tts/job", getTtsJobStatus);
router.post("/tts/job/cancel", cancelTtsJobHandler);
router.post("/tts/regenerate", regenerateTts);
router.post("/tts/preview", previewTts);
router.post("/tts/cleanup", cleanupTts);

router.get("/settings", getSettings);
router.patch("/settings", updateSettings);

router.get("/system", getSystemStatus);
router.post("/system/clear-cache", clearCaches);

export default router;