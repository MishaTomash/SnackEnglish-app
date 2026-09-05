import path from "path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import { authMiddleware } from "./middlewares/authMiddleware.js";
import progressRoutes from "./routes/progressRoutes.js";
import { bot } from "./bot.js";
import { initCronJobs } from "./services/cronService.js";
import wordRoutes from "./routes/wordRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import compression from "compression";
// ДОДАНО: Імпорт нового сервісу контенту
import { contentService } from "./services/contentService.js";

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

app.use("/api/progress", authMiddleware, progressRoutes);
app.use("/api/user", authMiddleware, userRoutes);
app.use("/api/words", wordRoutes);

const frontendDist = path.resolve(process.cwd(), "../dist");
app.use(express.static(frontendDist));

app.get(/.*/, (_req, res) => {
  res.sendFile(path.join(frontendDist, "index.html"));
});

async function bootstrap(): Promise<void> {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log("Successfully connected to MongoDB.");

    // ДОДАНО: Ініціалізація статичного контенту з JSON-файлів
    await contentService.init();

    initCronJobs();

    void bot.launch(() => {
      console.log("Telegram bot is running.");
    });

    app.listen(PORT, () => {
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
