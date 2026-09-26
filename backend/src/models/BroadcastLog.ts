// 📁 Файл: SnackEnglish-app/backend/src/models/BroadcastLog.ts
import { Schema, model, Document } from "mongoose";

/** Запис про завершену розсилку — для історії в адмін-панелі */
export interface IBroadcastLog extends Document {
    kind: "text" | "photo" | "copy";
    /** Початок тексту (для списку історії) */
    textPreview: string;
    audience: string;
    buttonText: string | null;
    total: number;
    sent: number;
    failed: number;
    status: "completed" | "cancelled" | "failed";
    error: string | null;
    startedAt: Date;
    finishedAt: Date;
}

const broadcastLogSchema = new Schema<IBroadcastLog>({
    kind: { type: String, enum: ["text", "photo", "copy"], required: true },
    textPreview: { type: String, default: "" },
    audience: { type: String, default: "all" },
    buttonText: { type: String, default: null },
    total: { type: Number, default: 0 },
    sent: { type: Number, default: 0 },
    failed: { type: Number, default: 0 },
    status: { type: String, enum: ["completed", "cancelled", "failed"], required: true },
    error: { type: String, default: null },
    startedAt: { type: Date, required: true },
    finishedAt: { type: Date, required: true },
});

broadcastLogSchema.index({ startedAt: -1 });

export const BroadcastLog = model<IBroadcastLog>("BroadcastLog", broadcastLogSchema);