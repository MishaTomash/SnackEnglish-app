import { Schema, model, Document, Types } from "mongoose";

export interface IUserProgress extends Document {
  userId: Types.ObjectId;
  wordId: string; // ЗМІНЕНО: тепер це рядок (String)
  easinessFactor: number;
  interval: number;
  repetitions: number;
  nextReviewDate: Date;
  createdAt: Date;
  updatedAt: Date;
}

const userProgressSchema = new Schema<IUserProgress>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    wordId: {
      type: String, // ЗМІНЕНО: String замість ObjectId
      required: true,
      index: true,
    },
    easinessFactor: {
      type: Number,
      required: true,
      default: 2.5,
      min: 1.3,
    },
    interval: {
      type: Number,
      required: true,
      default: 1,
      min: 1,
    },
    repetitions: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    nextReviewDate: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
  },
);

userProgressSchema.index({ userId: 1, wordId: 1 }, { unique: true });

export const UserProgress = model<IUserProgress>(
  "UserProgress",
  userProgressSchema,
);
