// 📁 Файл: SnackEnglish-app/backend/src/services/referralService.ts
import crypto from "crypto";
import type { Types } from "mongoose";
import { User } from "../models/User.js";
import { bot } from "../bot.js";
import { getAppSettings } from "./settingsService.js";

/**
 * "Запроси друга". Посилання: t.me/<бот>?start=ref_<код>.
 * Бонус обом нараховується не за реєстрацію, а коли запрошений пройде ПЕРШИЙ урок —
 * так фейкові акаунти не дають кубків. Для того, хто запрошує, — не більше
 * MAX_REWARDS_PER_WEEK бонусів на тиждень (захист від накрутки розіграшу).
 */

const CODE_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789"; // без схожих символів (l/1, o/0)
const CODE_LENGTH = 8;
const MAX_REWARDS_PER_WEEK = 10;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

const generateCode = (): string => {
    const bytes = crypto.randomBytes(CODE_LENGTH);
    return Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join("");
};

export const isReferralCode = (value: string): boolean => /^[a-z0-9]{6,16}$/.test(value);

const isDuplicateKeyError = (error: unknown): boolean =>
    typeof error === "object" && error !== null && "code" in error && (error as { code: unknown }).code === 11000;

/** Код запрошення юзера (створюється при першому зверненні) */
export const ensureReferralCode = async (userId: Types.ObjectId): Promise<string> => {
    const user = await User.findById(userId).select("referralCode").lean<{ referralCode?: string | null }>();
    if (user?.referralCode) return user.referralCode;

    for (let attempt = 0; attempt < 5; attempt++) {
        const code = generateCode();
        try {
            const updated = await User.findOneAndUpdate(
                { _id: userId, referralCode: null },
                { $set: { referralCode: code } },
                { returnDocument: "after" },
            )
                .select("referralCode")
                .lean<{ referralCode?: string | null }>();
            if (updated?.referralCode) return updated.referralCode;
            // Паралельний запит уже створив код — беремо його
            const again = await User.findById(userId).select("referralCode").lean<{ referralCode?: string | null }>();
            if (again?.referralCode) return again.referralCode;
        } catch (error) {
            if (!isDuplicateKeyError(error)) throw error; // збіг коду — пробуємо інший
        }
    }
    throw new Error("Could not generate referral code");
};

let cachedBotUsername: string | null = null;

/** Юзернейм бота для посилання (з Telegram, із запасним варіантом з .env) */
export const getBotUsername = async (): Promise<string> => {
    if (cachedBotUsername) return cachedBotUsername;
    const fromLaunch = bot.botInfo?.username;
    if (fromLaunch) return (cachedBotUsername = fromLaunch);
    try {
        const me = await bot.telegram.getMe();
        return (cachedBotUsername = me.username);
    } catch {
        return process.env.BOT_USERNAME?.trim() || "";
    }
};

/** Прив'язує нового юзера до того, хто запросив (викликається з /start у боті) */
export const applyReferral = async (newUserId: Types.ObjectId, code: string): Promise<boolean> => {
    if (!isReferralCode(code)) return false;
    const inviter = await User.findOne({ referralCode: code }).select("_id").lean<{ _id: Types.ObjectId }>();
    if (!inviter || inviter._id.equals(newUserId)) return false;

    const result = await User.updateOne({ _id: newUserId, referredBy: null }, { $set: { referredBy: inviter._id } });
    return result.modifiedCount > 0;
};

const displayName = (u: { username?: string | null; telegramFirstName?: string | null }): string =>
    u.username ? `@${u.username}` : u.telegramFirstName || "Твій друг";

/**
 * Бонус за запрошення після ПЕРШОГО уроку запрошеного. Атомарно: нараховується один раз.
 * Повертає розмір бонусу запрошеному (0 — бонусу немає).
 */
export const rewardReferralIfEligible = async (userId: Types.ObjectId): Promise<number> => {
    const settings = await getAppSettings();
    const bonus = settings.referralBonus;
    if (bonus <= 0) return 0;

    const invitee = await User.findOneAndUpdate(
        { _id: userId, referredBy: { $ne: null }, referralRewardedAt: null },
        { $set: { referralRewardedAt: new Date() }, $inc: { weeklyScore: bonus, totalScore: bonus } },
        { returnDocument: "after" },
    )
        .select("referredBy username telegramFirstName")
        .lean<{ referredBy?: Types.ObjectId | null; username?: string | null; telegramFirstName?: string | null }>();

    if (!invitee?.referredBy) return 0;

    // Скільки бонусів той, хто запросив, уже отримав за тиждень
    const recentRewards = await User.countDocuments({
        referredBy: invitee.referredBy,
        referralRewardedAt: { $gte: new Date(Date.now() - WEEK_MS) },
    });

    if (recentRewards <= MAX_REWARDS_PER_WEEK) {
        const inviter = await User.findOneAndUpdate(
            { _id: invitee.referredBy },
            { $inc: { weeklyScore: bonus, totalScore: bonus } },
            { returnDocument: "after" },
        )
            .select("telegramId botBlockedAt")
            .lean<{ telegramId: number; botBlockedAt?: Date | null }>();

        if (inviter && !inviter.botBlockedAt) {
            try {
                await bot.telegram.sendMessage(
                    inviter.telegramId,
                    `🎉 ${displayName(invitee)} пройшов перший урок за твоїм запрошенням!\n\nТобі +${bonus} 🏆 до рейтингу тижня. Дякуємо, що ділишся SnackEnglish!`,
                );
            } catch {
                // Не вдалось повідомити — бонус однаково нараховано
            }
        }
    }

    return bonus;
};

/** Статистика запрошень для екрана "Запроси друга" */
export const getReferralStats = async (userId: Types.ObjectId): Promise<{ invited: number; rewarded: number }> => {
    const [invited, rewarded] = await Promise.all([
        User.countDocuments({ referredBy: userId }),
        User.countDocuments({ referredBy: userId, referralRewardedAt: { $ne: null } }),
    ]);
    return { invited, rewarded };
};