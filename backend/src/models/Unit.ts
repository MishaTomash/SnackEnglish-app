import { Schema, model, Document, Types } from "mongoose";
import type { EnglishLevel } from "./Word.js";

export interface IUnit extends Document {
  unitId: string;
  title: string;
  level: EnglishLevel;
  topic: string;
  order: number;
  wordIds: Types.ObjectId[];
  grammarTopic: string;
  grammarExplanation: string;
  videoUrl: string;
  readingText: string;
  readingTranslation: string;
  createdAt: Date;
  updatedAt: Date;
}

const unitSchema = new Schema<IUnit>(
  {
    unitId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    level: {
      type: String,
      required: true,
      enum: ["A1", "A2", "B1", "B2", "C1", "C2"],
    },
    topic: {
      type: String,
      required: true,
      trim: true,
    },
    order: {
      type: Number,
      required: true,
      index: true,
    },
    wordIds: [
      {
        type: Schema.Types.ObjectId,
        ref: "Word",
        required: true,
      },
    ],
    grammarTopic: {
      type: String,
      required: true,
      trim: true,
    },
    grammarExplanation: {
      type: String,
      required: true,
      trim: true,
    },
    videoUrl: {
      type: String,
      required: true,
      trim: true,
    },
    readingText: {
      type: String,
      required: true,
      trim: true,
    },
    readingTranslation: {
      type: String,
      required: true,
      trim: true,
    },
  },
  {
    timestamps: true,
  },
);

export const Unit = model<IUnit>("Unit", unitSchema);
