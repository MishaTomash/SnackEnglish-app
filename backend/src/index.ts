import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import mongoose from "mongoose";
import { authMiddleware } from "./middlewares/authMiddleware.js";
import progressRoutes from "./routes/progressRoutes.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT ?? 3000;
const MONGODB_URI =
  process.env.MONGODB_URI ?? "mongodb://localhost:27017/snackenglish";

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

// Захищені роути прогресу
app.use("/api/progress", authMiddleware, progressRoutes);

// Захищений роут верифікації сесії
app.get("/api/me", authMiddleware, (req, res) => {
  res.status(200).json({
    message: "Authorized successfully",
    user: req.user,
  });
});

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
