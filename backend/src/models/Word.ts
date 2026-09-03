import mongoose, { Schema, Document } from "mongoose";

export interface IWord extends Document {
  text: string;
  transcription: string;
  translation: string;
  exampleSentence: string;
  exampleTranslation: string;
  level: "A1" | "A2" | "B1" | "B2" | "C1";
}

const WordSchema = new Schema<IWord>(
  {
    text: { type: String, required: true, trim: true },
    transcription: { type: String, required: true },
    translation: { type: String, required: true },
    exampleSentence: { type: String, required: true },
    exampleTranslation: { type: String, required: true },
    level: {
      type: String,
      required: true,
      enum: ["A1", "A2", "B1", "B2", "C1"],
    },
  },
  { timestamps: true },
);

WordSchema.index({ text: 1, level: 1 }, { unique: true });

export const Word =
  mongoose.models.Word || mongoose.model<IWord>("Word", WordSchema);
