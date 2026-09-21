import mongoose, { Schema, Document } from "mongoose";

export interface IAnalyticsEvent extends Document {
  telegramId: number;
  eventType: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

const AnalyticsEventSchema = new Schema<IAnalyticsEvent>(
  {
    telegramId: { type: Number, required: true, index: true },
    eventType: { type: String, required: true, index: true },
    metadata: { type: Schema.Types.Mixed },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  },
);

// Композитний індекс для типових аналітичних вибірок
// (наприклад: "усі події користувача за типом, відсортовані за часом")
AnalyticsEventSchema.index({ telegramId: 1, eventType: 1, createdAt: -1 });

export const AnalyticsEvent = mongoose.model<IAnalyticsEvent>(
  "AnalyticsEvent",
  AnalyticsEventSchema,
);
