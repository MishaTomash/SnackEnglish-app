import { Schema, model, Document } from "mongoose";

// Додано "C2"
export type UserEnglishLevel = "A1" | "A2" | "B1" | "B2" | "C1" | "C2" | null;

export interface IUser extends Document {
  telegramId: number;
  username?: string;
  level: UserEnglishLevel;
  weakAreas: string[];
  streak: number;
  onboardingCompleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    telegramId: {
      type: Number,
      required: true,
      unique: true,
      index: true,
    },
    username: {
      type: String,
      trim: true,
      default: null,
    },
    level: {
      type: String,
      // Додано "C2"
      enum: ["A1", "A2", "B1", "B2", "C1", "C2", null],
      default: null,
    },
    weakAreas: {
      type: [String],
      default: [],
    },
    streak: {
      type: Number,
      default: 0,
      min: 0,
    },
    onboardingCompleted: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  },
);

export const User = model<IUser>("User", userSchema);
