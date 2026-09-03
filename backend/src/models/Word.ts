import { Schema, model, Document } from "mongoose";

export type EnglishLevel = "A1" | "A2" | "B1" | "B2" | "C1" | "C2";

export interface IWord extends Document {
  wordId: string;
  text: string;
  translation: string;
  transcription: string;
  exampleSentence: string;
  exampleTranslation: string;
  level: EnglishLevel;
  topic: string;
  createdAt: Date;
  updatedAt: Date;
}

const wordSchema = new Schema<IWord>(
  {
    wordId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },
    text: {
      type: String,
      required: true,
      trim: true,
    },
    translation: {
      type: String,
      required: true,
      trim: true,
    },
    transcription: {
      type: String,
      required: true,
      trim: true,
    },
    exampleSentence: {
      type: String,
      required: true,
      trim: true,
    },
    exampleTranslation: {
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
      index: true,
    },
  },
  {
    timestamps: true,
  },
);

export const Word = model<IWord>("Word", wordSchema);
