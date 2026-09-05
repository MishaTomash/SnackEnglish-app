import { Schema, model, Document } from "mongoose";

export interface IGame extends Document {
  gameId: string;
  title: string;
  description: string;
  isFree: boolean;
  priceStars?: number;
  status: "available" | "coming_soon";
  createdAt: Date;
  updatedAt: Date;
}

const gameSchema = new Schema<IGame>(
  {
    gameId: { type: String, required: true, unique: true },
    title: { type: String, required: true },
    description: { type: String, required: true },
    isFree: { type: Boolean, required: true, default: true },
    priceStars: { type: Number },
    status: {
      type: String,
      enum: ["available", "coming_soon"],
      default: "coming_soon",
    },
  },
  { timestamps: true },
);

export const Game = model<IGame>("Game", gameSchema);
