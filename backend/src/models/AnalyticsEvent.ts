import mongoose, { Schema, Document } from "mongoose";

export interface IAnalyticsEvent extends Document {
  telegramId: number;
  eventType: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

/**
 * Скільки днів зберігати події. Без обмеження колекція росте безкінечно:
 * кожна дія кожного юзера — новий документ, і аналітика в адмінці з часом
 * сповільнюється. MongoDB сама видаляє старіші події (TTL-індекс).
 */
const ANALYTICS_TTL_DAYS = Math.max(1, Number(process.env.ANALYTICS_TTL_DAYS) || 180);

const AnalyticsEventSchema = new Schema<IAnalyticsEvent>(
  {
    telegramId: { type: Number, required: true },
    eventType: { type: String, required: true },
    metadata: { type: Schema.Types.Mixed },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  },
);

// Композитний індекс для типових аналітичних вибірок
// (наприклад: "усі події користувача за типом, відсортовані за часом").
// Також покриває пошук лише за telegramId, тому окремий індекс на telegramId не потрібен.
AnalyticsEventSchema.index({ telegramId: 1, eventType: 1, createdAt: -1 });

// Стрічка подій в адмінці з фільтром за типом, найновіші спершу
AnalyticsEventSchema.index({ eventType: 1, createdAt: -1 });

// TTL: автоматичне видалення подій, старших за ANALYTICS_TTL_DAYS
AnalyticsEventSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: ANALYTICS_TTL_DAYS * 24 * 60 * 60 },
);

export const AnalyticsEvent = mongoose.model<IAnalyticsEvent>(
  "AnalyticsEvent",
  AnalyticsEventSchema,
);