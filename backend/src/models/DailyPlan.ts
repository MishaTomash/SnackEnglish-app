import { Schema, model, Document } from "mongoose";

export interface IDailyPlan extends Document {
  level: string;
  dayNumber: number;
  title: string;
  words: Array<{
    id: string;
    word: string;
    translation: string;
    transcription: string;
  }>;
  quizzes: Array<{
    id: string;
    question: string;
    options: string[];
    correctAnswer: string;
  }>;
  listening: Array<{
    id: string;
    phrase: string;
    options: string[];
    correctAnswer: string;
  }>;
  speaking: Array<{ id: string; phrase: string; translation: string }>;
}

const dailyPlanSchema = new Schema<IDailyPlan>(
  {
    level: { type: String, required: true, default: "A1", index: true },
    dayNumber: { type: Number, required: true },
    title: { type: String, required: true },
    words: [
      { id: String, word: String, translation: String, transcription: String },
    ],
    quizzes: [
      {
        id: String,
        question: String,
        options: [String],
        correctAnswer: String,
      },
    ],
    listening: [
      { id: String, phrase: String, options: [String], correctAnswer: String },
    ],
    speaking: [{ id: String, phrase: String, translation: String }],
  },
  { timestamps: true },
);

// Унікальний індекс, щоб не було двох "День 1" для рівня А1
dailyPlanSchema.index({ level: 1, dayNumber: 1 }, { unique: true });

export const DailyPlan = model<IDailyPlan>("DailyPlan", dailyPlanSchema);
