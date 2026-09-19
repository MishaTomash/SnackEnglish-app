import { Schema, model, Document } from "mongoose";

export interface IGiveawayWinner {
  userId: string;
  nickname: string;
  score: number;
  avatarUrl?: string;
  position: number;
}

export interface IGiveawayHistory extends Document {
  weekNumber: number;
  endDate: Date;
  winners: IGiveawayWinner[];
}

const giveawayHistorySchema = new Schema<IGiveawayHistory>(
  {
    weekNumber: { type: Number, required: true },
    endDate: { type: Date, required: true },
    winners: [
      {
        userId: { type: String, required: true },
        nickname: { type: String, required: true },
        score: { type: Number, required: true },
        avatarUrl: { type: String, default: null },
        position: { type: Number, required: true },
      },
    ],
  },
  { timestamps: true },
);

export const GiveawayHistory = model<IGiveawayHistory>(
  "GiveawayHistory",
  giveawayHistorySchema,
);
