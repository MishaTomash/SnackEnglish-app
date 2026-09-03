import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import mongoose from "mongoose";
import { authMiddleware } from "./middlewares/authMiddleware.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT ?? 3000;
const MONGODB_URI =
  process.env.MONGODB_URI ?? "mongodb://localhost:27017/snackenglish";

// Глобальні middleware
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

// Захищений тестовий ендпоінт для верифікації authMiddleware
app.get("/api/me", authMiddleware, (req, res) => {
  res.status(200).json({
    message: "Authorized successfully",
    user: req.user,
  });
});

// Підключення до MongoDB та запуск сервера
async function bootstrap(): Promise<void> {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log("Successfully connected to MongoDB.");

    app.listen(PORT, () => {
      console.log(`SnackEnglish backend is running on port ${PORT}`);
    });
  } catch (error: unknown) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

void bootstrap();
