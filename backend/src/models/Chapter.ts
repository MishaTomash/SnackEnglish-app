import { Schema, model, Document } from "mongoose";
import type { UserEnglishLevel } from "./User.js";

export type ChapterLevel = Exclude<UserEnglishLevel, null>;

export interface IChapter extends Document {
    slug: string; // Людський ідентифікатор для URL: "coffee-shop"
    title: string;
    subtitle: string;
    cover: string; // Емодзі-обкладинка: "☕"
    accent: string; // Hex-колір акценту: "#FF8A3D"
    level: ChapterLevel;
    order: number; // Порядок розділу в межах рівня (визначає ланцюжок розблокування)
    /** false — чернетка: юзери розділ не бачать, адмін наповнює його уроками */
    published: boolean;
    createdAt: Date;
    updatedAt: Date;
}

const chapterSchema = new Schema<IChapter>(
    {
        slug: {
            type: String,
            required: true,
            unique: true,
            trim: true,
            lowercase: true,
            match: /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
        },
        title: { type: String, required: true, trim: true },
        subtitle: { type: String, trim: true, default: "" },
        cover: { type: String, default: "📖" },
        accent: {
            type: String,
            default: "#E8A33D",
            match: /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/,
        },
        level: {
            type: String,
            enum: ["A1", "A2", "B1", "B2", "C1", "C2"],
            required: true,
        },
        order: { type: Number, required: true },
        published: { type: Boolean, default: false },
    },
    { timestamps: true },
);

// Кожен рівень — окремий ланцюжок розділів: порядок унікальний у межах рівня,
// щоб "попередній розділ" завжди визначався однозначно
chapterSchema.index({ level: 1, order: 1 }, { unique: true });

/**
 * Фільтр "розділ видно юзерам". $ne: false, а не true: розділи, створені
 * до появи поля published, вважаються опублікованими.
 */
export const PUBLISHED_FILTER = { published: { $ne: false } } as const;

export const Chapter = model<IChapter>("Chapter", chapterSchema);