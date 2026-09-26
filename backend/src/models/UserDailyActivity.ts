// 📁 Файл: SnackEnglish-app/backend/src/models/UserDailyActivity.ts
import { Schema, model, Document, Types } from "mongoose";

/**
 * Активність юзера за день: скільки уроків пройдено (усього і нових).
 * Один документ на юзера на день. З цього будується справжня тижнева
 * активність на головній, підсумок тижня й ранкове нагадування.
 */
export interface IUserDailyActivity extends Document {
    userId: Types.ObjectId;
    /** "YYYY-MM-DD" за Києвом */
    day: string;
    /** Усі пройдені уроки, включно з повторами */
    lessons: number;
    /** Лише нові уроки (для ліміту) */
    newLessons: number;
}

const userDailyActivitySchema = new Schema<IUserDailyActivity>(
    {
        userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
        day: { type: String, required: true },
        lessons: { type: Number, default: 0 },
        newLessons: { type: Number, default: 0 },
    },
    { timestamps: true },
);

userDailyActivitySchema.index({ userId: 1, day: 1 }, { unique: true });
// Cron: "хто вчора дійшов до ліміту", підсумок тижня
userDailyActivitySchema.index({ day: 1 });

export const UserDailyActivity = model<IUserDailyActivity>("UserDailyActivity", userDailyActivitySchema);