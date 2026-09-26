// 📁 Файл: SnackEnglish-app/backend/src/controllers/userController.ts
import { Request, Response } from "express";
import path from "path";
import { mkdir, unlink } from "fs/promises";
import sharp from "sharp";
import type { Types, UpdateQuery } from "mongoose";
import { User } from "../models/User.js";
import type { IUser, UserEnglishLevel } from "../models/User.js";
import { AnalyticsEvent } from "../models/AnalyticsEvent.js";
import { invalidateBlockedCache } from "../middlewares/authMiddleware.js";
import { getStreakState, getWeekActivity } from "../services/activityService.js";
import { backfillWords } from "../services/wordsService.js";
import { ensureReferralCode, getBotUsername, getReferralStats } from "../services/referralService.js";
import { getAppSettings } from "../services/settingsService.js";

const VALID_LEVELS: ReadonlySet<string> = new Set(["A1", "A2", "B1", "B2", "C1", "C2"]);

const parseLevel = (value: unknown): Exclude<UserEnglishLevel, null> | null =>
  typeof value === "string" && VALID_LEVELS.has(value) ? (value as Exclude<UserEnglishLevel, null>) : null;

const MAX_DISPLAY_NAME_LENGTH = 32;
const MAX_HP = 5;
const AVATARS_DIR = path.join(process.cwd(), "uploads", "avatars");
const AVATAR_URL_PREFIX = "/uploads/avatars/";

/** Mongo-помилка унікального індексу (два паралельні запити створили одного юзера) */
const isDuplicateKeyError = (error: unknown): boolean =>
  typeof error === "object" && error !== null && "code" in error && (error as { code: unknown }).code === 11000;

/** Екранує спецсимволи, щоб пошук адміна не ламався на "(" чи "*" і не вішав базу */
const escapeRegex = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Видаляє старий аватар з диска, щоб папка uploads не росла безкінечно */
const removeOldAvatar = async (url: string | null | undefined): Promise<void> => {
  if (!url || !url.startsWith(AVATAR_URL_PREFIX)) return;
  const fileName = path.basename(url); // basename — захист від "../" у шляху
  try {
    await unlink(path.join(AVATARS_DIR, fileName));
  } catch {
    // файлу вже немає — нічого страшного
  }
};

export interface ExtendedTelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  photo_url?: string;
}

/**
 * Створює юзера при першому вході. Якщо паралельно його вже створив інший запит
 * (подвійний fetchUser, /start у боті в ту ж мить) — не падаємо з 500, а беремо існуючого.
 */
const createUserSafely = async (telegramUser: ExtendedTelegramUser) => {
  try {
    return await User.create({
      telegramId: telegramUser.id,
      username: telegramUser.username || undefined,
      telegramFirstName: telegramUser.first_name || undefined,
      telegramPhotoUrl: telegramUser.photo_url || undefined,
      level: null,
      onboardingCompleted: false,
      hp: 5,
      lastActivityDate: new Date(),
      // Стрік тепер рахується за уроками — починається з першого пройденого уроку
      streak: 0,
      // Новому юзеру нічого перераховувати — слова збиратимуться з кожного уроку
      wordsBackfilled: true,
    });
  } catch (error) {
    if (!isDuplicateKeyError(error)) throw error;
    const existing = await User.findOne({ telegramId: telegramUser.id });
    if (!existing) throw error;
    return existing;
  }
};

export const getMe = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: "Unauthorized: No user data found" });
      return;
    }

    const telegramUser = req.user as ExtendedTelegramUser;
    let user = await User.findOne({ telegramId: telegramUser.id });

    if (!user) {
      user = await createUserSafely(telegramUser);
      // Для адмін-панелі: реєстрації й активні юзери по днях
      req.logEvent("user_registered");
    } else {
      let needsUpdate = false;
      if (!user.telegramFirstName && telegramUser.first_name) {
        user.telegramFirstName = telegramUser.first_name;
        needsUpdate = true;
      }
      if (!user.username && telegramUser.username) {
        user.username = telegramUser.username;
        needsUpdate = true;
      }
      if (!user.telegramPhotoUrl && telegramUser.photo_url) {
        user.telegramPhotoUrl = telegramUser.photo_url;
        needsUpdate = true;
      }

      // HP і день активності. Стрік тут більше НЕ змінюється: він рахується
      // за пройденими уроками (activityService), а не за відкриттям застосунку
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      if (!user.lastActivityDate || user.lastActivityDate < today) {
        user.hp = 5; // Відновлюємо HP кожен новий день
        user.lastActivityDate = now;
        needsUpdate = true;
        // Перше відкриття за день — для графіка активних юзерів в адмін-панелі
        req.logEvent("daily_open", { streak: user.streak });
      }

      if (needsUpdate) {
        await user.save();
      }
    }

    // Одноразово рахуємо слова з уроків, пройдених до оновлення ("0 слів" на головній)
    let wordsLearnedCount = user.wordsLearnedCount ?? 0;
    if (!user.wordsBackfilled) {
      wordsLearnedCount = await backfillWords(user._id as Types.ObjectId).catch((wordsError: unknown) => {
        console.error("[getMe] words backfill:", wordsError);
        return wordsLearnedCount;
      });
    }

    // Стрік, який бачить юзер: згаслий показується як 0 одразу, не чекаючи нічного cron
    const streakState = getStreakState(user);

    res.status(200).json({
      ...user.toObject(),
      streak: streakState.streak,
      streakStatus: streakState.status,
      streakFreezeAvailable: streakState.freezeAvailable,
      wordsLearnedCount,
      nickname: user.username || user.telegramFirstName || "User",
    });
  } catch (error) {
    console.error("Error in getMe:", error);
    res.status(500).json({ error: "Failed to fetch user profile" });
  }
};

export const completeOnboarding = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user?.id) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    // ВИПРАВЛЕНО: рівень не перевірявся — у базу можна було записати будь-який рядок
    const level = parseLevel(req.body?.level);
    if (!level) {
      res.status(400).json({ error: "Level is required" });
      return;
    }

    const user = await User.findOneAndUpdate(
      { telegramId: req.user.id },
      { level, onboardingCompleted: true },
      { returnDocument: "after" },
    );
    res.status(200).json(user);
  } catch (error) {
    res.status(500).json({ error: "Failed to complete onboarding" });
  }
};

export const updateLevel = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user?.id) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const level = parseLevel(req.body?.level);
    if (!level) {
      res.status(400).json({ error: "Level is required" });
      return;
    }

    const user = await User.findOneAndUpdate(
      { telegramId: req.user.id },
      { level },
      { returnDocument: "after" },
    );
    res.status(200).json({ success: true, level: user?.level });
  } catch (error) {
    res.status(500).json({ error: "Failed to update level" });
  }
};

export const updateProfile = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user?.id) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const telegramId = req.user.id;
    const body = (req.body ?? {}) as { customDisplayName?: unknown; hp?: unknown };
    // null — скинути власне ім'я (показуватиметься ім'я з Telegram)
    const $set: { customDisplayName?: string | null; customAvatarUrl?: string } = {};
    const update: UpdateQuery<IUser> = {};

    // ВИПРАВЛЕНО: ім'я не перевірялось — можна було записати об'єкт або мегабайтний рядок
    if (body.customDisplayName !== undefined) {
      if (typeof body.customDisplayName !== "string") {
        res.status(400).json({ error: "customDisplayName must be a string" });
        return;
      }
      const name = body.customDisplayName.trim().slice(0, MAX_DISPLAY_NAME_LENGTH);
      $set.customDisplayName = name || null;
    }

    // ВИПРАВЛЕНО: клієнт міг виставити собі будь-яке hp (хоч 9999) — findOneAndUpdate
    // не перевіряє min/max схеми. Тепер hp можна лише ЗМЕНШИТИ ($min), у межах 0..5.
    // Відновлення життів робить сервер (новий день у getMe, нічний cron).
    if (body.hp !== undefined) {
      const hp = Math.round(Number(body.hp));
      if (!Number.isFinite(hp)) {
        res.status(400).json({ error: "hp must be a number" });
        return;
      }
      update.$min = { hp: Math.min(MAX_HP, Math.max(0, hp)) };
    }

    // Обробка файлу через sharp
    let previousAvatarUrl: string | null | undefined;
    if (req.file) {
      await mkdir(AVATARS_DIR, { recursive: true });
      const filename = `${telegramId}-${Date.now()}.webp`;

      await sharp(req.file.buffer)
        .rotate() // враховує EXIF-орієнтацію фото з телефона
        .resize(300, 300, { fit: "cover" }) // Кропаємо рівний квадрат
        .webp({ quality: 80 }) // Стискаємо у формат WebP
        .toFile(path.join(AVATARS_DIR, filename));

      $set.customAvatarUrl = `${AVATAR_URL_PREFIX}${filename}`;
      const current = await User.findOne({ telegramId }).select("customAvatarUrl").lean();
      previousAvatarUrl = current?.customAvatarUrl;
    }

    if (Object.keys($set).length > 0) update.$set = $set;

    const user = await User.findOneAndUpdate({ telegramId }, update, {
      returnDocument: "after",
    });

    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    if (req.file && previousAvatarUrl !== user.customAvatarUrl) {
      void removeOldAvatar(previousAvatarUrl);
    }

    res.status(200).json(user);
  } catch (error) {
    console.error("[updateProfile] Помилка:", error);
    res.status(500).json({ error: "Failed to update profile" });
  }
};

// ==================== АДМІН: КОРИСТУВАЧІ + АНАЛІТИКА ====================

const ALLOWED_SORT_FIELDS = new Set([
  "createdAt",
  "streak",
  "totalScore",
  "weeklyScore",
  "telegramId",
]);

export const getAllUsersAdmin = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { search, status, sort, order } = req.query;

    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));

    const filter: Record<string, unknown> = {};

    if (search) {
      const term = String(search).trim().slice(0, 64);
      const regex = new RegExp(escapeRegex(term), "i");
      const orConditions: Record<string, unknown>[] = [
        { username: regex },
        { telegramFirstName: regex },
        { customDisplayName: regex },
      ];
      if (!isNaN(Number(term))) {
        orConditions.push({ telegramId: Number(term) });
      }
      filter.$or = orConditions;
    }

    if (status === "blocked") filter.blocked = true;
    if (status === "active") filter.blocked = { $ne: true };

    const sortField =
      typeof sort === "string" && ALLOWED_SORT_FIELDS.has(sort)
        ? sort
        : "createdAt";
    const sortOrder = order === "asc" ? 1 : -1;

    const [users, total] = await Promise.all([
      User.find(filter)
        .select(
          "telegramId username telegramFirstName customDisplayName level streak totalScore weeklyScore blocked createdAt",
        )
        .sort({ [sortField]: sortOrder })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      User.countDocuments(filter),
    ]);

    res.status(200).json({
      users,
      total,
      page,
      pages: Math.max(1, Math.ceil(total / limit)),
    });
  } catch (error) {
    console.error("Admin users list error:", error);
    res.status(500).json({ error: "Failed to fetch users" });
  }
};

export const toggleUserBlock = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { telegramId } = req.params;
    const { blocked } = req.body;

    if (typeof blocked !== "boolean") {
      res.status(400).json({ error: "'blocked' must be a boolean" });
      return;
    }

    const user = await User.findOneAndUpdate(
      { telegramId: Number(telegramId) },
      { blocked },
      { returnDocument: "after" },
    ).select("telegramId blocked");

    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    invalidateBlockedCache(user.telegramId); // блокування діє одразу, а не через 30 с кешу
    res.status(200).json({ success: true, blocked: user.blocked });
  } catch (error) {
    console.error("Admin block toggle error:", error);
    res.status(500).json({ error: "Failed to update block status" });
  }
};

/**
 * Зводить telegramId -> зручне для відображення ім'я, одним запитом до User.
 */
const buildUserNameMap = async (
  telegramIds: number[],
): Promise<Map<number, string>> => {
  if (telegramIds.length === 0) return new Map();

  const users = await User.find({ telegramId: { $in: telegramIds } })
    .select("telegramId username telegramFirstName customDisplayName")
    .lean();

  const map = new Map<number, string>();
  users.forEach((u) => {
    map.set(
      u.telegramId,
      u.customDisplayName ||
      u.telegramFirstName ||
      u.username ||
      `#${u.telegramId}`,
    );
  });
  return map;
};

export const getAnalyticsSummary = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [
      topEvents,
      totalEvents,
      totalUsers,
      blockedUsers,
      eventsByDayRaw,
      topActiveUsersRaw,
    ] = await Promise.all([
      AnalyticsEvent.aggregate([
        { $group: { _id: "$eventType", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 20 },
      ]),
      AnalyticsEvent.countDocuments(),
      User.countDocuments(),
      User.countDocuments({ blocked: true }),
      AnalyticsEvent.aggregate([
        { $match: { createdAt: { $gte: sevenDaysAgo } } },
        {
          $group: {
            _id: {
              $dateToString: { format: "\%Y-\%m-\%d", date: "$createdAt" },
            },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      AnalyticsEvent.aggregate([
        { $match: { createdAt: { $gte: sevenDaysAgo } } },
        { $group: { _id: "$telegramId", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 },
      ]),
    ]);

    const nameMap = await buildUserNameMap(
      topActiveUsersRaw.map((u) => u._id as number),
    );

    res.status(200).json({
      totalEvents,
      totalUsers,
      blockedUsers,
      topEvents: topEvents.map((e) => ({
        eventType: e._id as string,
        count: e.count as number,
      })),
      eventsByDay: eventsByDayRaw.map((d) => ({
        date: d._id as string,
        count: d.count as number,
      })),
      topActiveUsers: topActiveUsersRaw.map((u) => ({
        telegramId: u._id as number,
        name: nameMap.get(u._id as number) || `#${u._id}`,
        count: u.count as number,
      })),
    });
  } catch (error) {
    console.error("Admin analytics error:", error);
    res.status(500).json({ error: "Failed to fetch analytics" });
  }
};

export const getRecentEvents = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { eventType, telegramId } = req.query;

    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 30));

    const filter: Record<string, unknown> = {};
    if (eventType) filter.eventType = String(eventType);
    if (telegramId && !isNaN(Number(telegramId))) {
      filter.telegramId = Number(telegramId);
    }

    const [events, total] = await Promise.all([
      AnalyticsEvent.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      AnalyticsEvent.countDocuments(filter),
    ]);

    const nameMap = await buildUserNameMap(
      Array.from(new Set(events.map((e) => e.telegramId))),
    );

    res.status(200).json({
      events: events.map((e) => ({
        id: e._id.toString(),
        telegramId: e.telegramId,
        userName: nameMap.get(e.telegramId) || `#${e.telegramId}`,
        eventType: e.eventType,
        metadata: e.metadata,
        createdAt: e.createdAt,
      })),
      total,
      page,
      pages: Math.max(1, Math.ceil(total / limit)),
    });
  } catch (error) {
    console.error("Admin events feed error:", error);
    res.status(500).json({ error: "Failed to fetch events" });
  }
};


// ==================== АКТИВНІСТЬ І ЗАПРОШЕННЯ ====================

/** _id юзера з бази за telegramId із initData; або відповідь 401/404 */
const findCurrentUserId = async (req: Request, res: Response): Promise<Types.ObjectId | null> => {
  if (!req.user?.id) {
    res.status(401).json({ error: "Unauthorized" });
    return null;
  }
  const user = await User.findOne({ telegramId: req.user.id }).select("_id").lean<{ _id: Types.ObjectId }>();
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return null;
  }
  return user._id;
};

// GET /api/user/activity-week — справжня активність за тиждень + стан серії
export const getActivityWeek = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = await findCurrentUserId(req, res);
    if (!userId) return;

    const [week, user] = await Promise.all([
      getWeekActivity(userId),
      User.findById(userId).select("streak streakLastDay streakFreezeUsedAt lastActivityDate").lean(),
    ]);
    const streakState = getStreakState(user ?? {});

    res.status(200).json({
      days: week.days,
      todayIndex: week.todayIndex,
      streak: streakState.streak,
      streakStatus: streakState.status,
      freezeAvailable: streakState.freezeAvailable,
    });
  } catch (error) {
    console.error("[activity-week] Error:", error);
    res.status(500).json({ error: "Failed to fetch activity" });
  }
};

// GET /api/user/referral — посилання-запрошення і статистика
export const getReferralInfo = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = await findCurrentUserId(req, res);
    if (!userId) return;

    const [code, stats, botUsername, settings] = await Promise.all([
      ensureReferralCode(userId),
      getReferralStats(userId),
      getBotUsername(),
      getAppSettings(),
    ]);

    res.status(200).json({
      code,
      link: botUsername ? `https://t.me/${botUsername}?start=ref_${code}` : null,
      invited: stats.invited,
      rewarded: stats.rewarded,
      bonus: settings.referralBonus,
    });
  } catch (error) {
    console.error("[referral] Error:", error);
    res.status(500).json({ error: "Failed to fetch referral info" });
  }
};