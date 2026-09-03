import { Schema, model, Document, Types } from "mongoose";

export type UnitStepType =
  | "warmup"
  | "vocabulary"
  | "grammar"
  | "video"
  | "reading"
  | "speaking"
  | "roleplay"
  | "test";

export type UnitProgressStatus = "locked" | "available" | "completed";

export interface IUserUnitProgress extends Document {
  userId: Types.ObjectId;
  unitId: Types.ObjectId;
  status: UnitProgressStatus;
  completedSteps: UnitStepType[];
  createdAt: Date;
  updatedAt: Date;
}

const userUnitProgressSchema = new Schema<IUserUnitProgress>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    unitId: {
      type: Schema.Types.ObjectId,
      ref: "Unit",
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["locked", "available", "completed"],
      default: "locked",
      required: true,
    },
    completedSteps: {
      type: [String],
      enum: [
        "warmup",
        "vocabulary",
        "grammar",
        "video",
        "reading",
        "speaking",
        "roleplay",
        "test",
      ],
      default: [],
    },
  },
  {
    timestamps: true,
  },
);

// Унікальна пара: статус користувача для кожного конкретного юніта
userUnitProgressSchema.index({ userId: 1, unitId: 1 }, { unique: true });

export const UserUnitProgress = model<IUserUnitProgress>(
  "UserUnitProgress",
  userUnitProgressSchema,
);
