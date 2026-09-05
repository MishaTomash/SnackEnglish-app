/**
 * @deprecated
 * MongoDB більше не використовується для зберігання контенту.
 * Усі юніти та слова завантажуються зі статичних JSON (див. contentService.ts).
 */

import mongoose, { Schema, Document } from "mongoose";

export interface IWord extends Document {
  id?: string;
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

WordSchema.set("toJSON", {
  virtuals: true,
  transform: (_doc, ret) => {
    (ret as any).id = ret._id.toString();
    return ret;
  },
});

export const Word =
  mongoose.models.Word || mongoose.model<IWord>("Word", WordSchema);
