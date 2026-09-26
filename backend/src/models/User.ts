// 📁 Файл: SnackEnglish-app/backend/src/models/User.ts
import { Schema, model, Document, Types } from "mongoose";

export type UserEnglishLevel = "A1" | "A2" | "B1" | "B2" | "C1" | "C2" | null;

export interface IUser extends Document {
  telegramId: number;
  username?: string;
  telegramFirstName?: string;
  telegramPhotoUrl?: string;
  customDisplayName?: string;
  customAvatarUrl?: string;
  level: UserEnglishLevel;
  weakAreas: string[];
  streak: number;
  hp: number; // ДОДАНО: Життя/Спроби
  lastActivityDate: Date | null; // ДОДАНО: Дата останньої активності для розрахунку стріку
  onboardingCompleted: boolean;
  blocked: boolean; // ДОДАНО: Блокування адміністратором
  createdAt: Date;
  updatedAt: Date;
  totalScore: number; // Кубки за весь час (для профілю)
  weeklyScore: number; // ДОДАНО: Кубки поточного тижня (для Топу і розіграшу)

  // ---------- Стрік (рахується за уроками, див. activityService) ----------
  /** Останній день ("YYYY-MM-DD", Київ), коли юзер пройшов урок */
  streakLastDay?: string | null;
  /** Коли востаннє використано "шанс" врятувати серію після пропущеного дня */
  streakFreezeUsedAt?: Date | null;
  /** Коли серія згасла (нічний cron) і якою була — для денного повідомлення */
  streakLostAt?: Date | null;
  lostStreak?: number;

  // ---------- Слова ----------
  /** Унікальні англійські слова з пройдених уроків (не віддається клієнту) */
  learnedWords?: string[];
  wordsLearnedCount: number;
  /** Слова з уже пройдених раніше уроків перераховано (одноразово) */
  wordsBackfilled?: boolean;
  /** Слова, вивчені в старій версії бота (до переносу) — додаються до нових */
  legacyWordsCount?: number;
  /** Коли юзера перенесено зі старої бази (null — зареєструвався в новій версії) */
  legacyImportedAt?: Date | null;

  // ---------- Запрошення друзів ----------
  referralCode?: string | null;
  referredBy?: Types.ObjectId | null;
  /** Коли нараховано бонус за запрошення (після першого уроку запрошеного) */
  referralRewardedAt?: Date | null;

  // ---------- Повідомлення від бота ----------
  /** Юзер заблокував бота — нагадування йому не шлемо */
  botBlockedAt?: Date | null;
  /** Останнє нагадування — не більше одного на день */
  lastReminderAt?: Date | null;
  /** Юзер сам вимкнув нагадування (/reminders у боті) */
  remindersEnabled?: boolean;
}

const userSchema = new Schema<IUser>(
  {
    telegramId: { type: Number, required: true, unique: true, index: true },
    username: { type: String, trim: true, default: null },
    telegramFirstName: { type: String, default: null },
    telegramPhotoUrl: { type: String, default: null },
    customDisplayName: { type: String, trim: true, default: null },
    customAvatarUrl: { type: String, trim: true, default: null },
    level: {
      type: String,
      enum: ["A1", "A2", "B1", "B2", "C1", "C2", null],
      default: null,
    },
    weakAreas: { type: [String], default: [] },
    streak: { type: Number, default: 0, min: 0 },
    hp: { type: Number, default: 5, min: 0, max: 5 }, // 5 життів максимум
    lastActivityDate: { type: Date, default: null },
    onboardingCompleted: { type: Boolean, default: false },
    blocked: { type: Boolean, default: false, index: true },
    totalScore: { type: Number, default: 0 },
    weeklyScore: { type: Number, default: 0 },

    streakLastDay: { type: String, default: null },
    streakFreezeUsedAt: { type: Date, default: null },
    streakLostAt: { type: Date, default: null },
    lostStreak: { type: Number, default: 0 },

    // select: false — масив слів може бути великим, у відповіді API він не потрібен
    learnedWords: { type: [String], default: [], select: false },
    wordsLearnedCount: { type: Number, default: 0 },
    wordsBackfilled: { type: Boolean, default: false },
    legacyWordsCount: { type: Number, default: 0 },
    legacyImportedAt: { type: Date, default: null },

    referralCode: { type: String, default: null },
    referredBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    referralRewardedAt: { type: Date, default: null },

    botBlockedAt: { type: Date, default: null },
    lastReminderAt: { type: Date, default: null },
    remindersEnabled: { type: Boolean, default: true },
  },
  { timestamps: true },
);

// Рейтинг тижня: сортування й підрахунок місця юзера йдуть по індексу,
// а не завантаженням усієї колекції в пам'ять (покриває й старий індекс weeklyScore)
userSchema.index({ weeklyScore: -1, streak: -1, _id: 1 });

// Нічні cron-задачі: пошук юзерів зі стріком за датою останньої активності
userSchema.index({ streak: 1, lastActivityDate: 1 });

// Нагадування про стрік: юзери зі стріком за останнім днем уроку
userSchema.index({ streak: 1, streakLastDay: 1 });

// Код запрошення унікальний, але лише серед тих, у кого він уже є
userSchema.index(
  { referralCode: 1 },
  { unique: true, partialFilterExpression: { referralCode: { $type: "string" } } },
);
// Скільки друзів запросив юзер
userSchema.index({ referredBy: 1 });

export const User = model<IUser>("User", userSchema);