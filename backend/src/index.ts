import path from "path";
import dotenv from "dotenv";

// Явне завантаження .env із поточної робочої директорії
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import { authMiddleware } from "./middlewares/authMiddleware.js";
import progressRoutes from "./routes/progressRoutes.js";
import { bot } from "./bot.js";
import { initCronJobs } from "./services/cronService.js";
import wordRoutes from "./routes/wordRoutes.js";

const app = express();
const PORT = process.env.PORT ?? 3000;
const MONGODB_URI =
  process.env.MONGODB_URI ?? "mongodb://localhost:27017/snackenglish";

// Базові middleware
app.use(
  cors({
    origin: process.env.CLIENT_URL ?? "*",
    credentials: true,
  }),
);
app.use(express.json());

// Публічний health check
app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
});

// Захищені API роути
app.use("/api/progress", authMiddleware, progressRoutes);

// Захищений роут перевірки сесії
app.get("/api/me", authMiddleware, (req, res) => {
  res.status(200).json({
    message: "Authorized successfully",
    user: req.user,
  });
});

app.use("/api/words", wordRoutes);

// Шлях до скомпільованого фронтенду (папка dist у корені проєкту)
const frontendDist = path.resolve(process.cwd(), "../dist");

// Роздача статичних файлів бандла (JS, CSS, картинки)
app.use(express.static(frontendDist));

// SPA fallback: передає index.html для будь-яких невідомих маршрутів React Router
app.get("*", (_req, res) => {
  res.sendFile(path.join(frontendDist, "index.html"));
});

async function bootstrap(): Promise<void> {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log("Successfully connected to MongoDB.");

    // Ініціалізація фонових retention-нагадувань (Cron)
    initCronJobs();

    // Запуск Telegram-бота у режимі polling
    void bot.launch(() => {
      console.log("Telegram bot is running.");
    });

    app.listen(PORT, () => {
      console.log(`SnackEnglish server is running on http://localhost:${PORT}`);
    });

    // Graceful stop
    process.once("SIGINT", () => bot.stop("SIGINT"));
    process.once("SIGTERM", () => bot.stop("SIGTERM"));
  } catch (error: unknown) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

void bootstrap();
