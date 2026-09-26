// 📁 Файл: SnackEnglish-app/backend/src/services/activityService.ts
import type { Types } from "mongoose";
import { User } from "../models/User.js";
import { UserDailyActivity } from "../models/UserDailyActivity.js";

/**
 * Активність і стрік.
 *
 * День зараховується, коли юзер пройшов хоча б один урок (повтор пройденого теж рахується),
 * а не просто відкрив застосунок.
 *
 * Шанс урятувати серію: якщо пропущено ОДИН день, серія не згорає одразу — наступного дня
 * ще можна пройти урок і продовжити її. Шанс дається не частіше, ніж раз на 7 днів,
 * інакше можна було б займатися через день.
 *
 * Дні рахуються за часом процесу — index.ts ставить TZ=Europe/Kyiv.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
export const STREAK_FREEZE_COOLDOWN_DAYS = 7;

const pad = (n: number): string => String(n).padStart(2, "0");

/** "YYYY-MM-DD" за місцевим часом процесу (Київ) */
export const dayKeyOf = (date: Date): string => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

/** Ключ дня зі зсувом: 0 — сьогодні, 1 — учора, 2 — позавчора */
export const dayKeyAgo = (daysAgo: number): string => {
    const d = new Date();
    d.setHours(12, 0, 0, 0); // полудень — щоб перехід на літній/зимовий час не зсунув дату
    d.setDate(d.getDate() - daysAgo);
    return dayKeyOf(d);
};

/** Шанс урятувати серію ще доступний (не використовувався останні 7 днів) */
export const isFreezeAvailable = (usedAt: Date | null | undefined): boolean =>
    !usedAt || Date.now() - new Date(usedAt).getTime() >= STREAK_FREEZE_COOLDOWN_DAYS * DAY_MS;

export type StreakStatus =
    | "none" // серії немає
    | "done_today" // сьогодні вже займався
    | "pending" // учора займався, сьогодні ще ні
    | "at_risk" // учора пропустив — сьогодні останній шанс урятувати
    | "lost"; // серія згасла

export interface StreakState {
    /** Стрік, який бачить юзер (згаслий — 0, навіть якщо нічний cron ще не спрацював) */
    streak: number;
    status: StreakStatus;
    freezeAvailable: boolean;
}

interface StreakFields {
    streak?: number;
    streakLastDay?: string | null;
    streakFreezeUsedAt?: Date | null;
    lastActivityDate?: Date | null;
}

/** Останній день уроку; для старих записів (до оновлення) — день останнього відкриття */
const lastStreakDayOf = (user: StreakFields): string | null =>
    user.streakLastDay ?? (user.lastActivityDate ? dayKeyOf(new Date(user.lastActivityDate)) : null);

/** Поточний стан серії — для головної й відповіді getMe */
export const getStreakState = (user: StreakFields): StreakState => {
    const streak = user.streak ?? 0;
    const last = lastStreakDayOf(user);
    const freezeAvailable = isFreezeAvailable(user.streakFreezeUsedAt);

    if (streak <= 0 || !last) return { streak: 0, status: "none", freezeAvailable };
    if (last >= dayKeyAgo(0)) return { streak, status: "done_today", freezeAvailable };
    if (last === dayKeyAgo(1)) return { streak, status: "pending", freezeAvailable };
    if (last === dayKeyAgo(2) && freezeAvailable) return { streak, status: "at_risk", freezeAvailable };
    return { streak: 0, status: "lost", freezeAvailable };
};

export interface LessonActivityResult {
    streak: number;
    /** Серію врятовано "шансом" (учора був пропуск) */
    streakRestored: boolean;
    /** Перший урок сьогодні (стрік щойно зарахувався) */
    firstToday: boolean;
}

const isDuplicateKeyError = (error: unknown): boolean =>
    typeof error === "object" && error !== null && "code" in error && (error as { code: unknown }).code === 11000;

/**
 * Записує пройдений урок у денну активність і, якщо це перший урок за день, оновлює стрік.
 * Викликається з completeNode — і для нового уроку, і для повтору.
 */
export const recordLessonActivity = async (userId: Types.ObjectId, isNew: boolean): Promise<LessonActivityResult> => {
    const today = dayKeyAgo(0);
    const inc = { lessons: 1, newLessons: isNew ? 1 : 0 };

    // returnDocument "before": null — запису за сьогодні ще не було, тобто це перший урок дня
    let before: unknown;
    try {
        before = await UserDailyActivity.findOneAndUpdate(
            { userId, day: today },
            { $inc: inc },
            { upsert: true, returnDocument: "before" },
        );
    } catch (error) {
        // Два паралельні уроки створили запис одночасно — другий просто додає лічильник
        if (!isDuplicateKeyError(error)) throw error;
        await UserDailyActivity.updateOne({ userId, day: today }, { $inc: inc });
        before = true;
    }

    const user = await User.findById(userId)
        .select("streak streakLastDay streakFreezeUsedAt lastActivityDate")
        .lean<StreakFields>();
    const currentStreak = user?.streak ?? 0;

    if (before || !user) return { streak: currentStreak, streakRestored: false, firstToday: false };

    // Для старих юзерів без streakLastDay: вважаємо, що серія триває з учора (щоб не обнулити її при оновленні)
    const last = user.streakLastDay ?? (currentStreak > 0 ? dayKeyAgo(1) : null);

    let streak = 1;
    let streakRestored = false;
    if (last === today) {
        streak = Math.max(1, currentStreak);
    } else if (last === dayKeyAgo(1) && currentStreak > 0) {
        streak = currentStreak + 1;
    } else if (last === dayKeyAgo(2) && currentStreak > 0 && isFreezeAvailable(user.streakFreezeUsedAt)) {
        streak = currentStreak + 1;
        streakRestored = true;
    }

    await User.updateOne(
        { _id: userId },
        {
            $set: {
                streak,
                streakLastDay: today,
                streakLostAt: null,
                ...(streakRestored ? { streakFreezeUsedAt: new Date() } : {}),
            },
        },
    );

    return { streak, streakRestored, firstToday: true };
};

export interface WeekDay {
    date: string;
    /** 0 — понеділок … 6 — неділя */
    weekday: number;
    lessons: number;
}

/** Поточний тиждень (пн–нд) з кількістю уроків по днях */
export const getWeekActivity = async (userId: Types.ObjectId): Promise<{ days: WeekDay[]; todayIndex: number }> => {
    const now = new Date();
    now.setHours(12, 0, 0, 0);
    const todayIndex = (now.getDay() + 6) % 7; // JS: 0 — неділя
    const monday = new Date(now);
    monday.setDate(now.getDate() - todayIndex);

    const keys = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(monday);
        d.setDate(monday.getDate() + i);
        return dayKeyOf(d);
    });

    const rows = await UserDailyActivity.find({ userId, day: { $in: keys } })
        .select("day lessons")
        .lean<{ day: string; lessons: number }[]>();
    const byDay = new Map(rows.map((r) => [r.day, r.lessons]));

    return {
        days: keys.map((date, weekday) => ({ date, weekday, lessons: byDay.get(date) ?? 0 })),
        todayIndex,
    };
};

/** Ключі днів поточного тижня (пн — сьогодні) — для підсумку тижня */
export const currentWeekDayKeys = (): string[] => {
    const now = new Date();
    now.setHours(12, 0, 0, 0);
    const todayIndex = (now.getDay() + 6) % 7;
    return Array.from({ length: todayIndex + 1 }, (_, i) => dayKeyAgo(todayIndex - i));
};

/**
 * Одноразова міграція для юзерів, у яких стрік є, а streakLastDay ще ні (до оновлення
 * стрік рахувався за відкриттям застосунку). Беремо день останнього відкриття.
 */
export const migrateStreakDays = async (): Promise<number> => {
    const cursor = User.find({ streak: { $gt: 0 }, streakLastDay: null })
        .select("_id lastActivityDate")
        .lean<{ _id: Types.ObjectId; lastActivityDate?: Date | null }[]>()
        .cursor();

    let migrated = 0;
    for await (const user of cursor) {
        const last = user.lastActivityDate ? dayKeyOf(new Date(user.lastActivityDate)) : dayKeyAgo(1);
        await User.updateOne({ _id: user._id, streakLastDay: null }, { $set: { streakLastDay: last } });
        migrated += 1;
    }
    return migrated;
};