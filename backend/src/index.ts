// 📁 Файл: SnackEnglish-app/backend/src/index.ts
import path from "path";
import http from "http";
import dotenv from "dotenv";
import { initSocket } from "./socket.js";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

// Один часовий пояс для всього сервера: стрік ("сьогодні/вчора" у getMe), нічні cron-задачі
// і недільний розіграш. Без цього на сервері в UTC день починався б о 02:00/03:00 за Києвом.
// Змінити можна змінною TZ у .env.
if (!process.env.TZ) process.env.TZ = "Europe/Kyiv";

const isProduction = process.env.NODE_ENV === "production";

// Необроблена помилка в промісі інакше може тихо зламати логіку або (у Node 15+) зупинити сервер
process.on("unhandledRejection", (reason: unknown) => {
  console.error("[process] Unhandled rejection:", reason);
  notifyAdmin("Необроблена помилка (promise)", reason);
});

// Критична помилка: стан процесу вже ненадійний. Повідомляємо адміна й виходимо —
// менеджер процесів (pm2 / хостинг) перезапустить сервер.
process.on("uncaughtException", (error: Error) => {
  console.error("[process] Uncaught exception:", error);
  notifyAdmin("🔥 Сервер впав (uncaught exception) — перезапуск", error);
  setTimeout(() => process.exit(1), 1500); // час, щоб повідомлення встигло піти
});

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
import speechRoutes from "./routes/speechRoutes.js";
import { notifyAdmin } from "./services/alertService.js";
import type { NextFunction, Request, Response } from "express";
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

// Логування всіх запитів — лише в розробці (на проді з багатьма юзерами це засмічує логи).
// Увімкнути на проді тимчасово: LOG_REQUESTS=true
if (!isProduction || process.env.LOG_REQUESTS === "true") {
  app.use((req, res, next) => {
    console.log(`[HTTP] ${req.method} ${req.url}`);
    next();
  });
}

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
// Розпізнавання мовлення (крок "Скажи вголос"): аудіо лише в пам'яті, ліміт ~1 МБ
app.use("/api/speech", authMiddleware, speechRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/feedback", feedbackRoutes);

// Аватари мають унікальні імена (id-час.webp) — їх можна кешувати надовго
app.use("/uploads", express.static(path.join(process.cwd(), "uploads"), { maxAge: "7d" }));

const frontendDist = path.resolve(process.cwd(), "../dist");
app.use(
  express.static(frontendDist, {
    index: false,
    setHeaders: (res, filePath) => {
      // Файли з /assets/ мають хеш в імені — браузер/Telegram може кешувати їх назавжди.
      // index.html — ніколи, інакше юзери не побачать нову версію після деплою.
      if (filePath.includes(`${path.sep}assets${path.sep}`)) {
        res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      } else {
        res.setHeader("Cache-Control", "no-cache");
      }
    },
  }),
);

// Невідомий /api-маршрут — JSON 404, а не index.html (інакше клієнт отримає HTML замість помилки)
app.use("/api", (_req, res) => {
  res.status(404).json({ error: "Not found" });
});

app.get(/.*/, (_req, res) => {
  res.setHeader("Cache-Control", "no-cache");
  res.sendFile(path.join(frontendDist, "index.html"));
});

// Остання лінія: помилка, яку не обробив жоден контролер. Юзеру — коротка відповідь,
// адміну — повідомлення в Telegram (не частіше за раз на 5 хв для однакових помилок)
app.use((error: unknown, req: Request, res: Response, _next: NextFunction) => {
  console.error(`[HTTP] ${req.method} ${req.path}:`, error);
  notifyAdmin(`Помилка 500: ${req.method} ${req.path}`, error);
  if (!res.headersSent) res.status(500).json({ error: "Internal server error" });
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