import mongoose, { Schema, Document, Types } from "mongoose";

export interface IUnit extends Document {
  id?: string;
  title: string;
  description: string;
  level: "A1" | "A2" | "B1" | "B2" | "C1";
  order: number;
  wordIds: Types.ObjectId[];
  grammar: {
    title: string;
    explanation: string;
    examples: Array<{ en: string; ua: string }>;
  };
  videoUrl: string;
  reading: {
    title: string;
    text: string;
    questions: Array<{
      question: string;
      options: string[];
      correctAnswer: number;
    }>;
  };
  dialogue: {
    title: string;
    scenario: string;
    lines: Array<{
      speaker: string;
      text: string;
      translation: string;
    }>;
  };
  quiz: Array<{
    question: string;
    options: string[];
    correctAnswer: number;
    explanation?: string;
  }>;
}

const UnitSchema = new Schema<IUnit>(
  {
    title: { type: String, required: true, unique: true },
    description: { type: String, required: true },
    level: {
      type: String,
      required: true,
      enum: ["A1", "A2", "B1", "B2", "C1"],
    },
    order: { type: Number, required: true },
    wordIds: [{ type: Schema.Types.ObjectId, ref: "Word" }],
    grammar: {
      title: { type: String, required: true },
      explanation: { type: String, required: true },
      examples: [{ en: String, ua: String }],
    },
    videoUrl: { type: String, required: true },
    reading: {
      title: { type: String, required: true },
      text: { type: String, required: true },
      questions: [
        {
          question: { type: String, required: true },
          options: [{ type: String, required: true }],
          correctAnswer: { type: Number, required: true },
        },
      ],
    },
    dialogue: {
      title: { type: String, required: true },
      scenario: { type: String, required: true },
      lines: [
        {
          speaker: { type: String, required: true },
          text: { type: String, required: true },
          translation: { type: String, required: true },
        },
      ],
    },
    quiz: [
      {
        question: { type: String, required: true },
        options: [{ type: String, required: true }],
        correctAnswer: { type: Number, required: true },
        explanation: { type: String },
      },
    ],
  },
  { timestamps: true },
);

UnitSchema.set("toJSON", {
  virtuals: true,
  transform: (_doc, ret) => {
    (ret as any).id = ret._id.toString();
    return ret;
  },
});

export const Unit =
  mongoose.models.Unit || mongoose.model<IUnit>("Unit", UnitSchema);
