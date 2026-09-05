import { Schema, model, Document } from "mongoose";

export interface IUserGamePurchase extends Document {
  telegramId: number;
  gameId: string;
  purchasedAt: Date;
  telegramPaymentChargeId?: string;
}

const userGamePurchaseSchema = new Schema<IUserGamePurchase>({
  telegramId: { type: Number, required: true, index: true },
  gameId: { type: String, required: true },
  purchasedAt: { type: Date, default: Date.now },
  telegramPaymentChargeId: { type: String, default: null },
});

// Унікальний індекс, щоб уникнути подвійних покупок однієї гри
userGamePurchaseSchema.index({ telegramId: 1, gameId: 1 }, { unique: true });

export const UserGamePurchase = model<IUserGamePurchase>(
  "UserGamePurchase",
  userGamePurchaseSchema,
);
