import { Schema, model, Document } from "mongoose";

export interface IManualPaymentRequest extends Document {
  telegramId: number;
  gameId: string;
  uniqueCode: string;
  screenshotFileId?: string;
  status: "pending" | "approved" | "rejected";
  createdAt: Date;
  updatedAt: Date;
}

const manualPaymentSchema = new Schema<IManualPaymentRequest>(
  {
    telegramId: { type: Number, required: true, index: true },
    gameId: { type: String, required: true },
    uniqueCode: { type: String, required: true, unique: true },
    screenshotFileId: { type: String, default: null },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
  },
  { timestamps: true },
);

export const ManualPaymentRequest = model<IManualPaymentRequest>(
  "ManualPaymentRequest",
  manualPaymentSchema,
);
