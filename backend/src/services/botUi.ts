// 📁 Файл: SnackEnglish-app/backend/src/services/botUi.ts
import { Markup } from "telegraf";
import type { Telegram } from "telegraf";
import type { Types } from "mongoose";
import { User } from "../models/User.js";
import { UserDailyActivity } from "../models/UserDailyActivity.js";
import { Chapter, PUBLISHED_FILTER, StoryNode, UserStoryProgress } from "../models/index.js";
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

/** Наступний урок юзера: останній відкритий (active) у опублікованому розділі */
const findNextLesson = async (userId: Types.ObjectId): Promise<UserSnapshot["next"]> => {
    const active = await UserStoryProgress.find({ userId, status: "active" })
        .sort({ _id: -1 })
        .limit(5)
        .select("chapterId nodeId")
        .lean<{ chapterId: Types.ObjectId; nodeId: Types.ObjectId }[]>();

    for (const entry of active) {
        const chapter = await Chapter.findOne({ _id: entry.chapterId, ...PUBLISHED_FILTER })
            .select("slug")
            .lean<{ slug?: string }>();
        if (!chapter?.slug) continue;
        const node = await StoryNode.findById(entry.nodeId).select("label icon").lean<{ label?: string; icon?: string }>();
        if (!node) continue;
        return { label: node.label || "Наступний урок", icon: node.icon || "📖", path: `/learning/${chapter.slug}` };
    }
    return null;
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
        findNextLesson(user._id),
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