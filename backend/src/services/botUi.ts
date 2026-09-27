// 📁 Файл: SnackEnglish-app/backend/src/services/botUi.ts
import { Markup } from "telegraf";
import type { Telegram } from "telegraf";
import type { Types } from "mongoose";
import { User } from "../models/User.js";
import { UserDailyActivity } from "../models/UserDailyActivity.js";
import { Chapter, PUBLISHED_FILTER, StoryNode, UserStoryProgress } from "../models/index.js";
import type { ChapterLevel } from "../models/Chapter.js";
import { HAS_NAME_FILTER, RANK_SORT, getUserPosition } from "../controllers/leaderboardController.js";
import { dayKeyAgo, getStreakState } from "./activityService.js";
import type { StreakStatus } from "./activityService.js";
import { getAppSettings } from "./settingsService.js";
import { ensureReferralCode, getBotUsername, getReferralStats } from "./referralService.js";
import { GIVEAWAY_TIME_LABEL, nextGiveawayDate } from "./giveawaySchedule.js";

/**
 * Усе, що бачить юзер у чаті з ботом: тексти, кнопки, картка прогресу.
 * bot.ts лише реєструє обробники й викликає ці функції.
 */

// ==================== ДОПОМІЖНЕ ====================

export const escapeHtml = (value: string): string =>
    value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export const getAppUrl = (): string => process.env.VITE_APP_URL?.trim() ?? "";
export const hasValidAppUrl = (): boolean => getAppUrl().startsWith("https://");

/** Кнопка, що відкриває Mini App (за потреби — одразу на потрібній сторінці) */
const appButton = (text: string, path = "") => Markup.button.webApp(text, `${getAppUrl().replace(/\/$/, "")}${path}`);

/** Смужка прогресу з символів: ▰▰▰▱▱ */
const progressBar = (value: number, max: number, size = 5): string => {
    const filled = max > 0 ? Math.min(size, Math.round((value / max) * size)) : 0;
    return "▰".repeat(filled) + "▱".repeat(size - filled);
};

const pluralDays = (n: number): string => {
    const mod10 = n % 10;
    const mod100 = n % 100;
    if (mod10 === 1 && mod100 !== 11) return "день";
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "дні";
    return "днів";
};

const pluralLessons = (n: number): string => {
    const mod10 = n % 10;
    const mod100 = n % 100;
    if (mod10 === 1 && mod100 !== 11) return "урок";
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "уроки";
    return "уроків";
};

const MEDALS = ["🥇", "🥈", "🥉"];

/** Скільки лишилось до розіграшу (час — giveawaySchedule, за часом сервера — Київ) */
const timeUntilGiveaway = (): string => {
    const now = new Date();
    const next = nextGiveawayDate(now);
    const hours = Math.floor((next.getTime() - now.getTime()) / 3600000);
    const days = Math.floor(hours / 24);
    return days > 0 ? `${days} ${pluralDays(days)} ${hours % 24} год` : `${hours} год`;
};

// ==================== ЗНІМОК ЮЗЕРА ====================

interface UserRow {
    _id: Types.ObjectId;
    telegramId: number;
    telegramFirstName?: string | null;
    customDisplayName?: string | null;
    username?: string | null;
    level?: string | null;
    streak?: number;
    streakLastDay?: string | null;
    streakFreezeUsedAt?: Date | null;
    lastActivityDate?: Date | null;
    weeklyScore?: number;
    wordsLearnedCount?: number;
    remindersEnabled?: boolean;
    onboardingCompleted?: boolean;
}

export interface UserSnapshot {
    name: string;
    level: string | null;
    onboardingCompleted: boolean;
    streak: number;
    streakStatus: StreakStatus;
    lessonsToday: number;
    dailyLimit: number;
    dailyGoal: number;
    weeklyScore: number;
    weeklyPlace: number | null;
    words: number;
    lessonsTotal: number;
    remindersEnabled: boolean;
    /** Наступний урок: куди веде кнопка "Продовжити" */
    next: { label: string; icon: string; path: string } | null;
}

const USER_FIELDS =
    "_id telegramId telegramFirstName customDisplayName username level streak streakLastDay streakFreezeUsedAt lastActivityDate weeklyScore wordsLearnedCount remindersEnabled onboardingCompleted";

/** Порядок рівнів — щоб за потреби обрати розділ найближчого до юзера рівня */
const LEVEL_ORDER = ["A1", "A2", "B1", "B2", "C1", "C2"];

type ActiveEntry = { chapterId: Types.ObjectId; nodeId: Types.ObjectId };
type ChapterRow = { _id: Types.ObjectId; slug?: string; level?: string; order?: number };

/**
 * Наступний урок юзера — куди веде кнопка "Продовжити".
 *
 * Раніше бралося просто останнє створене "active": але активний перший урок з'являється
 * вже тоді, коли юзер лише ВІДКРИЄ карту розділу (syncNodeStatuses). Тож достатньо було
 * заглянути в розділ C2 — і бот пропонував "продовжити" C2 юзеру з рівнем B1.
 *
 * Тепер пріоритет такий:
 *  1. розділ, у якому юзер востаннє ЗАВЕРШИВ урок (там, де він справді навчається);
 *  2. розділ рівня юзера (перший за порядком);
 *  3. розділ найближчого до юзера рівня.
 */
const findNextLesson = async (
    userId: Types.ObjectId,
    userLevel: string | null,
): Promise<UserSnapshot["next"]> => {
    const active = await UserStoryProgress.find({ userId, status: "active" })
        .select("chapterId nodeId")
        .lean<ActiveEntry[]>();

    const chapters = await Chapter.find({ _id: { $in: active.map((a) => a.chapterId) }, ...PUBLISHED_FILTER })
        .select("slug level order")
        .lean<ChapterRow[]>();
    const chapterById = new Map(chapters.map((c) => [String(c._id), c]));
    const candidates = active.filter((a) => chapterById.get(String(a.chapterId))?.slug);

    const chapterOf = (entry: ActiveEntry): ChapterRow => chapterById.get(String(entry.chapterId)) as ChapterRow;
    const levelIndex = (level?: string | null): number => {
        const index = LEVEL_ORDER.indexOf(level ?? "");
        return index === -1 ? 0 : index;
    };
    const userIndex = levelIndex(userLevel);

    // 1. Де юзер востаннє завершив урок
    const lastCompleted = await UserStoryProgress.findOne({
        userId,
        status: "completed",
        chapterId: { $in: candidates.map((c) => c.chapterId) },
    })
        .sort({ completedAt: -1 })
        .select("chapterId")
        .lean<{ chapterId: Types.ObjectId }>();

    const byLevelThenOrder = [...candidates].sort((a, b) => {
        const distance = Math.abs(levelIndex(chapterOf(a).level) - userIndex) - Math.abs(levelIndex(chapterOf(b).level) - userIndex);
        if (distance !== 0) return distance;
        const levelDiff = levelIndex(chapterOf(a).level) - levelIndex(chapterOf(b).level);
        if (levelDiff !== 0) return levelDiff;
        return (chapterOf(a).order ?? 0) - (chapterOf(b).order ?? 0);
    });

    const toNext = async (nodeId: Types.ObjectId, slug: string): Promise<UserSnapshot["next"]> => {
        const node = await StoryNode.findById(nodeId).select("label icon").lean<{ label?: string; icon?: string }>();
        if (!node) return null;
        return { label: node.label || "Наступний урок", icon: node.icon || "📖", path: `/learning/${slug}` };
    };

    // 1. Розділ, де юзер навчається
    const current = lastCompleted && candidates.find((c) => String(c.chapterId) === String(lastCompleted.chapterId));
    if (current) return toNext(current.nodeId, chapterOf(current).slug as string);

    // 2. Уже відкритий розділ рівня юзера
    const sameLevel = byLevelThenOrder.find((c) => userLevel && chapterOf(c).level === userLevel);
    if (sameLevel) return toNext(sameLevel.nodeId, chapterOf(sameLevel).slug as string);

    // 3. Розділ рівня юзера, який він ще не відкривав (напр., імпортовані зі старої бази)
    if (userLevel) {
        const firstChapter = await Chapter.findOne({ level: userLevel as ChapterLevel, ...PUBLISHED_FILTER })
            .sort({ order: 1 })
            .select("_id slug")
            .lean<{ _id: Types.ObjectId; slug?: string }>();
        if (firstChapter?.slug) {
            const firstNode = await StoryNode.findOne({ chapterId: firstChapter._id })
                .sort({ order: 1 })
                .select("_id")
                .lean<{ _id: Types.ObjectId }>();
            if (firstNode) return toNext(firstNode._id, firstChapter.slug);
        }
    }

    // 4. Відкритий розділ найближчого рівня
    const nearest = byLevelThenOrder[0];
    return nearest ? toNext(nearest.nodeId, chapterOf(nearest).slug as string) : null;
};

export const loadUserSnapshot = async (telegramId: number, fallbackName = "друже"): Promise<UserSnapshot | null> => {
    const user = await User.findOne({ telegramId }).select(USER_FIELDS).lean<UserRow>();
    if (!user) return null;

    const streakState = getStreakState(user);
    const [settings, today, lessonsTotal, weeklyPlace, next] = await Promise.all([
        getAppSettings(),
        UserDailyActivity.findOne({ userId: user._id, day: dayKeyAgo(0) })
            .select("newLessons")
            .lean<{ newLessons?: number }>(),
        UserStoryProgress.countDocuments({ userId: user._id, status: "completed" }),
        (user.weeklyScore ?? 0) > 0
            ? getUserPosition({ _id: user._id, weeklyScore: user.weeklyScore, streak: user.streak })
            : Promise.resolve(null),
        findNextLesson(user._id, user.level ?? null),
    ]);

    return {
        name: user.customDisplayName || user.telegramFirstName || fallbackName,
        level: user.level ?? null,
        onboardingCompleted: user.onboardingCompleted === true,
        streak: streakState.streak,
        streakStatus: streakState.status,
        lessonsToday: today?.newLessons ?? 0,
        dailyLimit: settings.dailyLessonLimit,
        dailyGoal: settings.dailyGoalLessons,
        weeklyScore: user.weeklyScore ?? 0,
        weeklyPlace,
        words: user.wordsLearnedCount ?? 0,
        lessonsTotal,
        remindersEnabled: user.remindersEnabled !== false,
        next,
    };
};

// ==================== ПОВІДОМЛЕННЯ ====================

const STREAK_HINTS: Record<StreakStatus, (streak: number) => string> = {
    done_today: () => "Сьогодні день уже зараховано ✅",
    pending: (streak) => `Пройди урок сьогодні — і серія стане ${streak + 1} 🔥`,
    at_risk: () => "⚠️ Учора був пропуск — пройди урок сьогодні, щоб урятувати серію!",
    lost: () => "Серія згасла — один урок, і почнеш нову 💪",
    none: () => "Пройди урок — і почнеться твоя серія днів 💪",
};

/** Картка прогресу для /start і /progress */
export const buildStatusCard = (s: UserSnapshot, greeting: string): string => {
    const lines: string[] = [`🍪 <b>${escapeHtml(greeting)}, ${escapeHtml(s.name)}!</b>`, ""];

    lines.push(
        s.streak > 0
            ? `🔥 Серія: <b>${s.streak} ${pluralDays(s.streak)}</b>\n<i>${STREAK_HINTS[s.streakStatus](s.streak)}</i>`
            : `🔥 <i>${STREAK_HINTS[s.streakStatus](0)}</i>`,
    );

    if (s.dailyLimit > 0 || s.dailyGoal > 0) {
        const target = s.dailyLimit > 0 ? s.dailyLimit : s.dailyGoal;
        const goalMark = s.dailyGoal > 0 ? (s.lessonsToday >= s.dailyGoal ? " · 🎯 ціль виконано" : ` · 🎯 ціль ${s.dailyGoal}`) : "";
        lines.push(`📚 Сьогодні: ${progressBar(s.lessonsToday, target)} ${s.lessonsToday}/${target}${goalMark}`);
    }

    lines.push(
        s.weeklyPlace
            ? `🏆 Тиждень: <b>${s.weeklyScore}</b> кубків · <b>${s.weeklyPlace}</b> місце`
            : "🏆 Тиждень: ще без кубків — перший урок, і ти в рейтингу",
    );
    lines.push(`📖 Слів вивчено: <b>${s.words}</b> · уроків: <b>${s.lessonsTotal}</b>`);

    if (s.next) lines.push("", `<i>Далі: ${escapeHtml(s.next.icon)} ${escapeHtml(s.next.label)}</i>`);
    return lines.join("\n");
};

/** Кнопки під карткою прогресу */
export const statusKeyboard = (s: UserSnapshot | null) => {
    const rows = [];
    if (hasValidAppUrl()) {
        rows.push([
            s?.next
                ? appButton(`▶️ Продовжити: ${s.next.label}`.slice(0, 60), s.next.path)
                : appButton(s?.onboardingCompleted === false ? "🚀 Почати навчання" : "🚀 Відкрити SnackEnglish"),
        ]);
    }
    rows.push([Markup.button.callback("🏆 Топ тижня", "ui:top"), Markup.button.callback("🎁 Запросити друга", "ui:invite")]);
    rows.push([Markup.button.callback("🔔 Нагадування", "ui:reminders"), Markup.button.callback("❓ Як це працює", "ui:help")]);
    return Markup.inlineKeyboard(rows);
};

/** Привітання нового юзера */
export const buildWelcomeText = (name: string, friendBonus: number | null): string =>
    [
        `Привіт, <b>${escapeHtml(name)}</b>! 🍪`,
        "",
        "Я — <b>Снекі</b>, печивко, яке вчить англійську. Разом ми пройдемо історії, де англійська — це пригода, а не підручник.",
        "",
        "<b>Що на тебе чекає:</b>",
        "📖 Уроки-історії по 5 хвилин",
        "🎧 Живі голоси й вправи на вимову",
        "🎮 Ігри та ⚔️ дуелі з друзями",
        "🏆 Рейтинг тижня й розіграш призів",
        ...(friendBonus ? ["", `🎁 Тебе запросив друг! Пройди перший урок — і ви обидва отримаєте <b>+${friendBonus} 🏆</b>.`] : []),
        "",
        "Натискай кнопку — перший урок займе 2 хвилини 👇",
    ].join("\n");

export const welcomeKeyboard = () =>
    Markup.inlineKeyboard([
        ...(hasValidAppUrl() ? [[appButton("🚀 Почати перший урок")]] : []),
        [Markup.button.callback("❓ Як це працює", "ui:help")],
    ]);

/** Довідка /help */
export const buildHelpText = async (): Promise<string> => {
    const settings = await getAppSettings();
    const limitLine =
        settings.dailyLessonLimit > 0
            ? `📚 На день відкривається <b>${settings.dailyLessonLimit}</b> нових уроків — так краще запам'ятовується. Повторювати пройдене й грати можна скільки завгодно.`
            : "📚 Проходь скільки завгодно уроків на день.";
    return [
        "<b>Як усе працює</b> 🍪",
        "",
        "🔥 <b>Серія</b> — дні підряд, коли ти пройшов хоча б один урок. Пропустив один день? Наступного дня ще можна врятувати серію (раз на тиждень).",
        "",
        limitLine,
        settings.dailyGoalLessons > 0
            ? `🎯 <b>Денна ціль</b> — ${settings.dailyGoalLessons} ${pluralLessons(settings.dailyGoalLessons)}: за неї +${settings.dailyGoalBonus} 🏆.`
            : "",
        "",
        `🏆 <b>Кубки</b> за уроки йдуть у рейтинг тижня. Щонеділі о ${GIVEAWAY_TIME_LABEL} топ-3 перемагають, і тиждень починається з нуля.`,
        settings.referralBonus > 0 ? `\n🎁 <b>Запроси друга</b> — коли він пройде перший урок, обидва отримаєте +${settings.referralBonus} 🏆.` : "",
        "",
        "<b>Команди</b>",
        "/progress — мій прогрес",
        "/top — рейтинг тижня",
        "/invite — запросити друга",
        "/reminders — нагадування",
    ]
        .filter((line, i, all) => !(line === "" && all[i - 1] === ""))
        .join("\n");
};

/** Рейтинг тижня /top */
export const buildTopText = async (telegramId: number): Promise<string> => {
    const top = await User.find({ $and: [HAS_NAME_FILTER, { weeklyScore: { $gt: 0 } }] })
        .select("telegramId username telegramFirstName weeklyScore")
        .sort(RANK_SORT)
        .limit(10)
        .lean<{ telegramId: number; username?: string | null; telegramFirstName?: string | null; weeklyScore: number }[]>();

    const lines = [`🏆 <b>Рейтинг тижня</b>`, `<i>До розіграшу: ${timeUntilGiveaway()}</i>`, ""];
    if (top.length === 0) {
        lines.push("Цього тижня ще ніхто не набрав кубків — стань першим! 🚀");
    } else {
        top.forEach((u, i) => {
            const name = escapeHtml(u.username || u.telegramFirstName || "User");
            const me = u.telegramId === telegramId ? " ← ти" : "";
            lines.push(`${MEDALS[i] ?? `${i + 1}.`} ${name} — <b>${u.weeklyScore}</b>${me}`);
        });
    }

    const snapshot = await loadUserSnapshot(telegramId);
    if (snapshot && !top.some((u) => u.telegramId === telegramId)) {
        lines.push(
            "",
            snapshot.weeklyPlace
                ? `Ти на <b>${snapshot.weeklyPlace}</b> місці з <b>${snapshot.weeklyScore}</b> 🏆`
                : "Тебе ще немає в рейтингу — пройди урок, і ти в таблиці!",
        );
    }
    lines.push("", `Топ-3 щонеділі о ${GIVEAWAY_TIME_LABEL} отримують призи 🎁`);
    return lines.join("\n");
};

/** Запрошення /invite: текст + кнопки */
export const buildInvite = async (telegramId: number) => {
    const user = await User.findOne({ telegramId }).select("_id").lean<{ _id: Types.ObjectId }>();
    if (!user) return null;
    const [code, stats, botUsername, settings] = await Promise.all([
        ensureReferralCode(user._id),
        getReferralStats(user._id),
        getBotUsername(),
        getAppSettings(),
    ]);
    if (!botUsername) return null;

    const link = `https://t.me/${botUsername}?start=ref_${code}`;
    const shareText = "Вчу англійську з печивком Снекі 🍪 Короткі уроки-історії щодня — приєднуйся!";
    const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(shareText)}`;

    const text = [
        "🎁 <b>Запроси друга</b>",
        "",
        settings.referralBonus > 0
            ? `Коли друг пройде перший урок, ви обидва отримаєте <b>+${settings.referralBonus} 🏆</b> до рейтингу тижня.`
            : "Вчитися разом веселіше — і можна змагатися в дуелях ⚔️",
        "",
        `Твоє посилання:\n<code>${link}</code>`,
        stats.invited > 0 ? `\nЗапрошено: <b>${stats.invited}</b> · бонус отримано: <b>${stats.rewarded}</b>` : "",
    ].join("\n");

    return { text, keyboard: Markup.inlineKeyboard([[Markup.button.url("📤 Надіслати друзям", shareUrl)]]) };
};

/** Нагадування /reminders */
export const buildRemindersText = (enabled: boolean): string =>
    enabled
        ? "🔔 <b>Нагадування увімкнено</b>\n\nСнекі нагадає, коли серія в небезпеці, коли відкриються нові уроки, і розповість про підсумки тижня. Лише вдень і не частіше разу на день."
        : "🔕 <b>Нагадування вимкнено</b>\n\nСнекі не писатиме тобі. Серія без нагадувань гасне частіше — увімкни, якщо передумаєш 🙂";

export const remindersKeyboard = (enabled: boolean) =>
    Markup.inlineKeyboard([
        [enabled ? Markup.button.callback("🔕 Вимкнути нагадування", "ui:remind_off") : Markup.button.callback("🔔 Увімкнути нагадування", "ui:remind_on")],
    ]);

// ==================== ПРОФІЛЬ БОТА ====================

const SHORT_DESCRIPTION = "Вчи англійську з печивком Снекі 🍪 Уроки-історії по 5 хвилин, ігри, дуелі з друзями й рейтинг тижня.";

const DESCRIPTION = [
    "Привіт! Я — Снекі 🍪, печивко, яке вчить англійську.",
    "",
    "📖 Уроки-історії по 5 хвилин — англійська як пригода",
    "🎧 Живі голоси й вправи на вимову",
    "🎮 Ігри та ⚔️ дуелі з друзями",
    "🔥 Серія днів і 🏆 рейтинг тижня з призами",
    "",
    "Натискай «Почати» — перший урок займе 2 хвилини!",
].join("\n");

/**
 * Налаштовує "обличчя" бота в Telegram: опис до /start (перше, що бачить новачок),
 * короткий опис у профілі, команди в меню й кнопку Mini App біля поля вводу.
 * Викликається при старті сервера; помилки лише логуються.
 */
export const setupBotProfile = async (telegram: Telegram): Promise<void> => {
    const tasks: Promise<unknown>[] = [
        telegram.setMyCommands([
            { command: "start", description: "🍪 Головне меню" },
            { command: "progress", description: "📊 Мій прогрес" },
            { command: "top", description: "🏆 Рейтинг тижня" },
            { command: "invite", description: "🎁 Запросити друга" },
            { command: "reminders", description: "🔔 Нагадування" },
            { command: "help", description: "❓ Як це працює" },
        ]),
        telegram.setMyShortDescription(SHORT_DESCRIPTION),
        telegram.setMyDescription(DESCRIPTION),
    ];
    if (hasValidAppUrl()) {
        tasks.push(telegram.setChatMenuButton({ menuButton: { type: "web_app", text: "🍪 Вчити", web_app: { url: getAppUrl() } } }));
    }
    const results = await Promise.allSettled(tasks);
    results.forEach((result) => {
        if (result.status === "rejected") console.error("[bot] Не вдалося налаштувати профіль бота:", result.reason);
    });
};