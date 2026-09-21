import { Request, Response } from "express";
import path from "path";
import sharp from "sharp";
import { User } from "../models/User.js";
import { AnalyticsEvent } from "../models/AnalyticsEvent.js";
import { getLearnedWordsCount } from "../services/progressStatsService.js";

export interface ExtendedTelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  photo_url?: string;
}

export const getMe = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: "Unauthorized: No user data found" });
      return;
    }

    const telegramUser = req.user as ExtendedTelegramUser;
    let user = await User.findOne({ telegramId: telegramUser.id });

    if (!user) {
      user = await User.create({
        telegramId: telegramUser.id,
        username: telegramUser.username || undefined,
        telegramFirstName: telegramUser.first_name || undefined,
        telegramPhotoUrl: telegramUser.photo_url || undefined,
        level: null,
        onboardingCompleted: false,
        hp: 5,
        lastActivityDate: new Date(),
        streak: 1, // Перший вхід — стрік 1
      });
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

      // ЛОГІКА СТРІКУ ТА HP
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      if (!user.lastActivityDate || user.lastActivityDate < today) {
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        // Якщо остання активність була вчора -> продовжуємо стрік
        if (user.lastActivityDate && user.lastActivityDate >= yesterday) {
          user.streak += 1;
        }
        // Якщо раніше ніж вчора -> скидаємо на 1
        else if (!user.lastActivityDate || user.lastActivityDate < yesterday) {
          user.streak = 1;
        }

        user.hp = 5; // Відновлюємо HP кожен новий день
        user.lastActivityDate = now;
        needsUpdate = true;
      }

      if (needsUpdate) {
        await user.save();
      }
    }

    const wordsLearnedCount = await getLearnedWordsCount(user._id);

    res.status(200).json({
      ...user.toObject(),
      nickname: user.username || user.telegramFirstName || "User",
      wordsLearnedCount,
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
    const { level } = req.body;
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
    const { level } = req.body;
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
    console.log(`[updateProfile] Запит від: ${req.user?.id}`);

    if (!req.user?.id) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const telegramId = req.user.id;
    const { customDisplayName, hp } = req.body;
    const updateData: any = {};

    if (customDisplayName !== undefined)
      updateData.customDisplayName = customDisplayName;

    if (hp !== undefined) updateData.hp = Number(hp);

    // ЗМІНЕНО: Обробка файлу через sharp
    if (req.file) {
      const filename = `${telegramId}-${Date.now()}.webp`;
      const uploadPath = path.join(
        process.cwd(),
        "uploads",
        "avatars",
        filename,
      );

      await sharp(req.file.buffer)
        .resize(300, 300, { fit: "cover" }) // Кропаємо рівний квадрат
        .webp({ quality: 80 }) // Стискаємо у формат WebP
        .toFile(uploadPath);

      updateData.customAvatarUrl = `/uploads/avatars/${filename}`;
      console.log(
        `[updateProfile] Збережено стиснений аватар: ${updateData.customAvatarUrl}`,
      );
    }

    const user = await User.findOneAndUpdate({ telegramId }, updateData, {
      returnDocument: "after",
    });

    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
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
      const term = String(search).trim();
      const regex = new RegExp(term, "i");
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
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
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
