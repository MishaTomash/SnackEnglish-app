import path from "path";
import http from "http";
import dotenv from "dotenv";
import { initSocket } from "./socket.js";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import { adminOnly, authMiddleware } from "./middlewares/authMiddleware.js";
import { bot } from "./bot.js";
import { initCronJobs } from "./services/cronService.js";
import userRoutes from "./routes/userRoutes.js";
import compression from "compression";
import gamesRoutes from "./routes/gamesRoutes.js";
import { seedGames } from "./services/gameService.js";
import profileRoutes from "./routes/profileRoutes.js";
import duelRoutes from "./routes/duelRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import { initDuelSocketService } from "./services/duelSocketService.js";
import feedbackRoutes from "./routes/feedbackRoutes.js";
import storyRoutes from "./routes/storyRoutes.js";
import storyAdminRoutes from "./routes/storyAdminRoutes.js";
import { Chapter, StoryNode } from "./models/index.js";
import { Server } from "http";

const app = express();
const PORT = process.env.PORT ?? 3000;
const MONGODB_URI =
  process.env.MONGODB_URI ?? "mongodb://localhost:27017/snackenglish";

// Виправлено CORS: "*" + credentials: true блокується браузером. origin: true вирішує це.
app.use(
  cors({
    origin: process.env.CLIENT_URL || true,
    credentials: true,
  }),
);
// 1mb: адмін вставляє уроки великим JSON (дефолтних 100kb може забракнути)
app.use(express.json({ limit: "1mb" }));
app.use(compression());

// ДОДАНО: Базове логування всіх запитів для дебагу в терміналі
app.use((req, res, next) => {
  console.log(`[HTTP] ${req.method} ${req.url}`);
  next();
});

app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
});

app.use("/api/duels", authMiddleware, duelRoutes);
app.use("/api/user", authMiddleware, userRoutes);
app.use("/api/games", authMiddleware, gamesRoutes);
app.use("/api/profile", authMiddleware, profileRoutes);
// Адмінка — ДО публічних роутів: інакше "/api/stories/:chapterId" перехопив би "admin"
app.use("/api/stories/admin", authMiddleware, adminOnly, storyAdminRoutes);
app.use("/api/stories", authMiddleware, storyRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/feedback", feedbackRoutes);

app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

const frontendDist = path.resolve(process.cwd(), "../dist");
app.use(express.static(frontendDist));

app.get(/.*/, (_req, res) => {
  res.sendFile(path.join(frontendDist, "index.html"));
});

async function bootstrap(): Promise<void> {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log("Successfully connected to MongoDB.");

    await seedGames();

    // Індекси історій приводяться до схеми: зокрема прибирає старий глобальний
    // unique-індекс на Chapter.order (тепер порядок унікальний у межах рівня)
    try {
      await Promise.all([Chapter.syncIndexes(), StoryNode.syncIndexes()]);
    } catch (error) {
      console.error("[stories] Не вдалося синхронізувати індекси:", error);
    }
    initCronJobs();

    void bot.launch(() => {
      console.log("Telegram bot is running.");
    });

    const server = http.createServer(app);
    initDuelSocketService(server);

    server.listen(PORT, () => {
      console.log(`SnackEnglish server is running on http://localhost:${PORT}`);
    });

    process.once("SIGINT", () => bot.stop("SIGINT"));
    process.once("SIGTERM", () => bot.stop("SIGTERM"));
  } catch (error: unknown) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

void bootstrap();