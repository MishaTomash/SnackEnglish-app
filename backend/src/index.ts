import path from "path";
import http from "http";
import dotenv from "dotenv";
import { initSocket } from "./socket.js";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import { authMiddleware } from "./middlewares/authMiddleware.js";
import progressRoutes from "./routes/progressRoutes.js";
import { bot } from "./bot.js";
import { initCronJobs } from "./services/cronService.js";
import userRoutes from "./routes/userRoutes.js";
import compression from "compression";
import gamesRoutes from "./routes/gamesRoutes.js";
import { seedGames } from "./services/gameService.js";
// ДОДАНО: Імпорт нового сервісу контенту
import profileRoutes from "./routes/profileRoutes.js";
import duelRoutes from "./routes/duelRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import { initDuelSocketService } from "./services/duelSocketService.js";
import { Server } from "http";

const app = express();
const PORT = process.env.PORT ?? 3000;
const MONGODB_URI =
  process.env.MONGODB_URI ?? "mongodb://localhost:27017/snackenglish";

app.use(cors({ origin: process.env.CLIENT_URL ?? "*", credentials: true }));
app.use(express.json());
app.use(compression());

app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
});
app.use("/api/duels", authMiddleware, duelRoutes);
app.use("/api/progress", authMiddleware, progressRoutes);
app.use("/api/user", authMiddleware, userRoutes);

app.use("/api/games", authMiddleware, gamesRoutes);
app.use("/api/profile", authMiddleware, profileRoutes);
app.use("/api/admin", adminRoutes);

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

    // ДОДАНО: Сідінг ігор (виклик функції)
    await seedGames();

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
