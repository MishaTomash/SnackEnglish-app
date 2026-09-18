import { Schema, model, Document } from "mongoose";

export type UserEnglishLevel = "A1" | "A2" | "B1" | "B2" | "C1" | "C2" | null;

export interface IUser extends Document {
  telegramId: number;
  username?: string;
  telegramFirstName?: string;
  telegramPhotoUrl?: string;
  customDisplayName?: string;
  customAvatarUrl?: string;
  level: UserEnglishLevel;
  weakAreas: string[];
  streak: number;
  hp: number; // ДОДАНО: Життя/Спроби
  lastActivityDate: Date | null; // ДОДАНО: Дата останньої активності для розрахунку стріку
  onboardingCompleted: boolean;
  createdAt: Date;
  updatedAt: Date;
  totalScore: number;
}

const userSchema = new Schema<IUser>(
  {
    telegramId: { type: Number, required: true, unique: true, index: true },
    username: { type: String, trim: true, default: null },
    telegramFirstName: { type: String, default: null },
    telegramPhotoUrl: { type: String, default: null },
    customDisplayName: { type: String, trim: true, default: null },
    customAvatarUrl: { type: String, trim: true, default: null },
    level: {
      type: String,
      enum: ["A1", "A2", "B1", "B2", "C1", "C2", null],
      default: null,
    },
    weakAreas: { type: [String], default: [] },
    streak: { type: Number, default: 0, min: 0 },
    hp: { type: Number, default: 5, min: 0, max: 5 }, // 5 життів максимум
    lastActivityDate: { type: Date, default: null },
    onboardingCompleted: { type: Boolean, default: false },
    totalScore: { type: Number, default: 0 },
  },
  { timestamps: true },
);

export const User = model<IUser>("User", userSchema);
