// 📁 Файл: SnackEnglish-app/backend/src/models/AudioClip.ts
import { Schema, model, Document } from "mongoose";

/**
 * Озвучена фраза (файл mp3 у uploads/tts). hash = фраза + модель + голос + налаштування:
 * зміна голосу дає нові hash, а старі файли можна прибрати в адмінці.
 */
export interface IAudioClip extends Document {
    hash: string;
    /** Нормалізований ключ фрази (як його шукає клієнт) */
    key: string;
    /** Текст, який озвучено */
    text: string;
    /** Модель OpenAI ("model" зайняте методом документа Mongoose) */
    ttsModel: string;
    voice: string;
    /** Хто говорить: narrator | snacky | user | npc */
    role: string;
    /** Відносна адреса файлу: /uploads/tts/<hash>.mp3 */
    url: string;
    bytes: number;
    chars: number;
    /** Орієнтовна вартість генерації, $ */
    costUsd: number;
    createdAt: Date;
}

const audioClipSchema = new Schema<IAudioClip>(
    {
        hash: { type: String, required: true, unique: true },
        key: { type: String, required: true },
        text: { type: String, required: true },
        ttsModel: { type: String, required: true },
        voice: { type: String, required: true },
        role: { type: String, default: "narrator" },
        url: { type: String, required: true },
        bytes: { type: Number, default: 0 },
        chars: { type: Number, default: 0 },
        costUsd: { type: Number, default: 0 },
    },
    { timestamps: { createdAt: true, updatedAt: false } },
);

// Витрати за місяць (ліміт) рахуються за датою створення
audioClipSchema.index({ createdAt: -1 });

export const AudioClip = model<IAudioClip>("AudioClip", audioClipSchema);