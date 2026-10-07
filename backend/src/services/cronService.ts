// 📁 Файл: SnackEnglish-app/backend/src/services/cronService.ts
import cron from "node-cron";
import { TelegramError } from "telegraf";
import { withStyle } from "./buttonStyle.js";
import { sendRich } from "./richMessage.js";
const escapeHtml = (value: string): string =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
import type { QueryFilter, Types } from "mongoose";
import { bot } from "../bot.js";
import { User } from "../models/index.js";
import type { IUser } from "../models/User.js";
import { UserDailyActivity } from "../models/UserDailyActivity.js";
import { HAS_NAME_FILTER, RANK_SORT, processGiveawayEnd } from "../controllers/leaderboardController.js";
import { STREAK_FREEZE_COOLDOWN_DAYS, currentWeekDayKeys, dayKeyAgo, migrateStreakDays } from "./activityService.js";
import { getAppSettings } from "./settingsService.js";
import { notifyAdmin } from "./alertService.js";
import { GIVEAWAY_CRON, GIVEAWAY_TIME_LABEL } from "./giveawaySchedule.js";
import { autoGenerateMissing } from "./ttsService.js";

/**
 * Розклад. Правила:
 * - повідомлення юзерам — ЛИШЕ вдень (9:00–21:30 за Києвом); нічні задачі тільки тихо оновлюють базу;
 * - не більше ОДНОГО нагадування на день одній людині (середа й підсумок тижня — виняток);
 * - хто заблокував бота, тому більше не пишемо (поки знову не натисне /start).
 */

const CRON_TIMEZONE = process.env.TZ || "Europe/Kyiv";
const DAY_MS = 24 * 60 * 60 * 1000;

/** Telegram дозволяє ~30 повідомлень/с різним юзерам; беремо із запасом */
const SEND_INTERVAL_MS = 50;

/** Тихі години: поза вікном 9:00–21:30 бот нагадувань не шле */
const QUIET_FROM_MINUTES = 21 * 60 + 30;
const QUIET_TO_MINUTES = 9 * 60;

/** Для вкладки "Система" в адмін-панелі */
export const CRON_SCHEDULE = [
  { time: "щодня 00:01", title: "Тихо: скидання згаслих серій і відновлення життів", sendsMessages: false },
  { time: "щодня 10:00", title: "«Нові уроки відкрились» — тим, хто вчора дійшов до ліміту", sendsMessages: true },
  { time: "щодня 11:00", title: "«Вогник згас, почни нову серію» — якщо серія була 3+ днів", sendsMessages: true },
  { time: "щодня 13:00", title: "«Серія в небезпеці — врятуй сьогодні» (учора пропуск)", sendsMessages: true },
  { time: "щодня 19:00", title: "«Не втрачай вогник» — хто ще не займався сьогодні", sendsMessages: true },
  { time: "середа 14:00", title: "Рейтинг тижня: твоє місце і скільки до наступного", sendsMessages: true },
  { time: `неділя ${GIVEAWAY_TIME_LABEL}`, title: "Підсумки змагання + особистий підсумок тижня", sendsMessages: true },
  { time: "кожні 30 хв (9–21)", title: "Тихо: автоозвучка нових фраз уроків (якщо увімкнено)", sendsMessages: false },
];

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const isQuietTime = (): boolean => {
  const now = new Date();
  const minutes = now.getHours() * 60 + now.getMinutes();
  return minutes >= QUIET_FROM_MINUTES || minutes < QUIET_TO_MINUTES;
};

const startOfToday = (): Date => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

const pluralDays = (n: number): string => {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "день";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "дні";
  return "днів";
};

/** Шанс урятувати серію ще не використовувався останні 7 днів */
const freezeAvailableFilter = (): QueryFilter<IUser> => ({
  $or: [
    { streakFreezeUsedAt: null },
    { streakFreezeUsedAt: { $lt: new Date(Date.now() - STREAK_FREEZE_COOLDOWN_DAYS * DAY_MS) } },
  ],
});

// ==================== ВІДПРАВКА ====================

interface ReminderUser {
  _id: Types.ObjectId;
  telegramId: number;
  streak?: number;
  lostStreak?: number;
  weeklyScore?: number;
}

interface ReminderOptions {
  /** true — пропустити тих, хто сьогодні вже отримав нагадування */
  respectDailyCap: boolean;
  buttonText: string;
}

interface ReminderResult {
  sent: number;
  failed: number;
  stoppedByQuietHours: boolean;
}

/**
 * Надсилає нагадування юзерам із фільтра: потоком (cursor), з паузами під ліміт Telegram,
 * з повтором на 429 і позначкою botBlockedAt на 403. build повертає текст або null (пропустити).
 */
const sendReminders = async (
  job: string,
  filter: QueryFilter<IUser>,
  build: (user: ReminderUser) => string | null,
  options: ReminderOptions,
): Promise<ReminderResult> => {
  const result: ReminderResult = { sent: 0, failed: 0, stoppedByQuietHours: false };
  const appUrl = process.env.VITE_APP_URL?.trim() ?? "";
  const rows = appUrl.startsWith("https://")
    ? [[withStyle({ text: options.buttonText, web_app: { url: appUrl } }, "primary")]]
    : [];

  // Не пишемо: заблокованим адміном, тим, хто заблокував бота, і тим, хто вимкнув нагадування
  const conditions: QueryFilter<IUser>[] = [
    filter,
    { blocked: { $ne: true }, botBlockedAt: null, remindersEnabled: { $ne: false } },
  ];
  if (options.respectDailyCap) {
    conditions.push({ $or: [{ lastReminderAt: null }, { lastReminderAt: { $lt: startOfToday() } }] });
  }

  const cursor = User.find({ $and: conditions })
    .select("_id telegramId streak lostStreak weeklyScore")
    .lean<ReminderUser[]>()
    .cursor();

  for await (const user of cursor) {
    // Запобіжник: розсилка затягнулась до ночі — зупиняємось, а не будимо людей
    if (isQuietTime()) {
      result.stoppedByQuietHours = true;
      notifyAdmin(`Нагадування «${job}» зупинено: почалися тихі години (надіслано ${result.sent})`);
      break;
    }

    const text = build(user);
    if (!text || !user.telegramId) continue;

    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        await sendRich(bot.telegram, user.telegramId, { html: escapeHtml(text), rows, home: true });
        await User.updateOne({ _id: user._id }, { $set: { lastReminderAt: new Date() } });
        result.sent += 1;
        break;
      } catch (error) {
        const retryAfter = error instanceof TelegramError ? error.parameters?.retry_after : undefined;
        if (retryAfter && attempt === 0) {
          await sleep((retryAfter + 1) * 1000);
          continue;
        }
        if (error instanceof TelegramError && error.code === 403) {
          // Бот заблокований або акаунт видалено — більше не пробуємо
          await User.updateOne({ _id: user._id }, { $set: { botBlockedAt: new Date() } });
        }
        result.failed += 1;
        break;
      }
    }

    await sleep(SEND_INTERVAL_MS);
  }

  console.log(`[CRON] ${job}: надіслано ${result.sent}, не вдалося ${result.failed}`);
  return result;
};

/** Обгортка задачі: лог + сповіщення адміну про помилку */
const runJob = (name: string, task: () => Promise<void>) => async (): Promise<void> => {
  console.log(`[CRON] Старт: ${name}`);
  try {
    await task();
  } catch (error) {
    console.error(`[CRON Error] ${name}:`, error);
    notifyAdmin(`Помилка cron: ${name}`, error);
  }
};

// ==================== ЗАДАЧІ ====================

/** 00:01 — ТИХО: гасимо серії, які вже не врятувати, і відновлюємо життя. Без повідомлень */
const nightlyMaintenance = async (): Promise<void> => {
  const twoDaysAgo = dayKeyAgo(2);
  const freezeUsedRecently = new Date(Date.now() - STREAK_FREEZE_COOLDOWN_DAYS * DAY_MS);

  // Згасла: останній урок раніше за позавчора, АБО позавчора, але шанс уже використано.
  // Позавчора + шанс є — серія живе ще сьогодні (день на порятунок)
  const lost = await User.find({
    streak: { $gt: 0 },
    $or: [
      { streakLastDay: { $lt: twoDaysAgo } },
      { streakLastDay: twoDaysAgo, streakFreezeUsedAt: { $gte: freezeUsedRecently } },
    ],
  })
    .select("_id streak")
    .lean<{ _id: Types.ObjectId; streak: number }[]>();

  if (lost.length > 0) {
    const now = new Date();
    await User.bulkWrite(
      lost.map((u) => ({
        updateOne: {
          filter: { _id: u._id },
          update: { $set: { streak: 0, lostStreak: u.streak, streakLostAt: now } },
        },
      })),
    );
  }
  console.log(`[CRON] Згаслих серій: ${lost.length}`);

  await User.updateMany({ hp: { $lt: 5 } }, { $set: { hp: 5 } });
};

/** 10:00 — нові уроки відкрились (тим, хто вчора дійшов до ліміту й сьогодні ще не займався) */
const lessonsReopened = async (): Promise<void> => {
  const settings = await getAppSettings();
  if (settings.dailyLessonLimit <= 0) return;

  const [yesterdayRows, todayRows] = await Promise.all([
    UserDailyActivity.find({ day: dayKeyAgo(1), newLessons: { $gte: settings.dailyLessonLimit } })
      .select("userId")
      .lean<{ userId: Types.ObjectId }[]>(),
    UserDailyActivity.find({ day: dayKeyAgo(0) }).select("userId").lean<{ userId: Types.ObjectId }[]>(),
  ]);
  const activeToday = new Set(todayRows.map((r) => String(r.userId)));
  const ids = yesterdayRows.map((r) => r.userId).filter((id) => !activeToday.has(String(id)));
  if (ids.length === 0) return;

  const goalLine = settings.dailyGoalLessons > 0 ? `\nСьогоднішня ціль: ${settings.dailyGoalLessons} 🎯` : "";
  await sendReminders(
    "нові уроки відкрились",
    { _id: { $in: ids } },
    () => `☀️ Доброго ранку! Нові уроки вже відкрились — продовжимо з того місця, де ти зупинився?${goalLine}`,
    { respectDailyCap: true, buttonText: "Продовжити 🚀" },
  );
};

/** 11:00 — м'яко про згаслу серію (лише якщо вона була помітною — 3+ дні) */
const streakLostNotice = async (): Promise<void> => {
  await sendReminders(
    "вогник згас",
    { streakLostAt: { $gte: startOfToday() }, lostStreak: { $gte: 3 } },
    (u) =>
      `Твій вогник (${u.lostStreak} ${pluralDays(u.lostStreak ?? 0)}) згас 😢\n\nНе страшно — пройди один урок сьогодні й почни нову серію. Снекі чекає! 🍪`,
    { respectDailyCap: true, buttonText: "Почати нову серію 🔥" },
  );
};

/** 13:00 — серія в небезпеці: учора пропуск, сьогодні останній шанс урятувати */
const streakGraceReminder = async (): Promise<void> => {
  await sendReminders(
    "серія в небезпеці",
    { $and: [{ streak: { $gt: 0 }, streakLastDay: dayKeyAgo(2) }, freezeAvailableFilter()] },
    (u) =>
      `🔥 Твоя серія ${u.streak} ${pluralDays(u.streak ?? 0)} у небезпеці!\n\nУчора ти пропустив день, але сьогодні ще можна її врятувати — просто пройди один урок.`,
    { respectDailyCap: true, buttonText: "Врятувати серію ⚡" },
  );
};

/** 19:00 — хто вчора займався, а сьогодні ще ні (і хто в "шансі", якщо не отримав нагадування о 13:00) */
const streakEveningReminder = async (): Promise<void> => {
  await sendReminders(
    "не втрачай вогник",
    {
      streak: { $gt: 0 },
      $or: [{ streakLastDay: dayKeyAgo(1) }, { $and: [{ streakLastDay: dayKeyAgo(2) }, freezeAvailableFilter()] }],
    },
    (u) =>
      `Не втрачай свій вогник! 🔥\n\nТвоя серія — ${u.streak} ${pluralDays(u.streak ?? 0)}. Пройди хоча б один урок сьогодні, щоб зберегти прогрес!`,
    { respectDailyCap: true, buttonText: "Пройти урок ⚡" },
  );
};

interface RankEntry {
  place: number;
  score: number;
}

interface RankRow {
  _id: Types.ObjectId;
  weeklyScore: number;
  username?: string | null;
  telegramFirstName?: string | null;
}

interface RankingSnapshot {
  byId: Map<string, RankEntry>;
  scores: number[];
  top: { name: string; score: number }[];
}

/** Місця всіх юзерів із кубками цього тижня (той самий порядок, що в рейтингу) */
const snapshotRanking = async (): Promise<RankingSnapshot> => {
  const cursor = User.find({ $and: [HAS_NAME_FILTER, { weeklyScore: { $gt: 0 } }] })
    .select("_id weeklyScore username telegramFirstName")
    .sort(RANK_SORT)
    .lean<RankRow[]>()
    .cursor();

  const byId = new Map<string, RankEntry>();
  const scores: number[] = [];
  const top: { name: string; score: number }[] = [];
  let place = 0;
  for await (const u of cursor) {
    place += 1;
    byId.set(String(u._id), { place, score: u.weeklyScore });
    scores.push(u.weeklyScore);
    if (top.length < 3) top.push({ name: u.username || u.telegramFirstName || "User", score: u.weeklyScore });
  }
  return { byId, scores, top };
};

/** Текст для середи: місце і скільки кубків до наступної цілі */
export const buildWeeklyTopText = (me: RankEntry | undefined, scores: number[]): string => {
  if (!me) {
    return `🏆 Змагання тижня вже в розпалі, а тебе ще немає в рейтингу!\n\nДо неділі ${GIVEAWAY_TIME_LABEL} є час — кілька уроків, і ти в таблиці. Топ-3 тижня потрапляють в історію переможців 🏅`;
  }
  if (me.place === 1) {
    return `👑 Ти зараз ПЕРШИЙ у рейтингу тижня — ${me.score} 🏆!\n\nДо неділі ${GIVEAWAY_TIME_LABEL} ще кілька днів. Тримай позицію — суперники не сплять 😉`;
  }
  // У топ-3 — ціль на сходинку вище; інакше — до 3 місця
  const target = me.place <= 3 ? me.place - 1 : 3;
  const gap = Math.max(1, scores[target - 1] - me.score + 1);
  return me.place <= 3
    ? `🔥 Ти на ${me.place} місці з ${me.score} 🏆!\n\nДо ${target} місця — лише ${gap} 🏆. Ще кілька уроків — і ти вище! Підсумки в неділю о ${GIVEAWAY_TIME_LABEL}.`
    : `Ти на ${me.place} місці в рейтингу тижня (${me.score} 🏆).\n\nДо топ-3 не вистачає ${gap} 🏆 — встигнеш до неділі ${GIVEAWAY_TIME_LABEL}? 🏅`;
};

/** Середа 14:00 — рейтинг тижня */
const weeklyTopReminder = async (): Promise<void> => {
  const { byId, scores } = await snapshotRanking();
  await sendReminders(
    "рейтинг тижня (середа)",
    // Лише тим, хто заходив останні 2 тижні — не турбуємо тих, хто давно пішов
    { lastActivityDate: { $gte: new Date(Date.now() - 14 * DAY_MS) } },
    (u) => buildWeeklyTopText(byId.get(String(u._id)), scores),
    { respectDailyCap: false, buttonText: "Набрати кубки 🏆" },
  );
};

/** Неділя (час — giveawaySchedule) — розіграш і особистий підсумок тижня кожному */
const weeklySummary = async (): Promise<void> => {
  // Знімок ДО розіграшу: після нього кубки тижня обнуляться
  const { byId, top } = await snapshotRanking();

  const weekLessons = await UserDailyActivity.aggregate<{ _id: Types.ObjectId; lessons: number }>([
    { $match: { day: { $in: currentWeekDayKeys() } } },
    { $group: { _id: "$userId", lessons: { $sum: "$lessons" } } },
  ]);
  const lessonsById = new Map(weekLessons.map((r) => [String(r._id), r.lessons]));

  await processGiveawayEnd();

  const medals = ["🥇", "🥈", "🥉"];
  const winnersBlock =
    top.length > 0 ? `\n\nПереможці тижня:\n${top.map((w, i) => `${medals[i]} ${w.name} — ${w.score} 🏆`).join("\n")}` : "";

  await sendReminders(
    "підсумок тижня",
    { lastActivityDate: { $gte: new Date(Date.now() - 14 * DAY_MS) } },
    (u) => {
      const lessons = lessonsById.get(String(u._id)) ?? 0;
      const rank = byId.get(String(u._id));
      if (lessons === 0 && !rank) {
        return `🏁 Тиждень завершено!${winnersBlock}\n\nЦього тижня ти не проходив уроків — але новий тиждень уже почався, і рейтинг обнулено. Усі стартують з нуля — це твій шанс! 🚀`;
      }
      const lines = [
        `📚 Уроків: ${lessons}`,
        `🏆 Кубків: ${rank?.score ?? 0}`,
        rank ? `🎯 Місце в рейтингу: ${rank.place}` : null,
        (u.streak ?? 0) > 0 ? `🔥 Серія: ${u.streak} ${pluralDays(u.streak ?? 0)}` : null,
      ].filter((line): line is string => line !== null);
      return `🏁 Тиждень завершено! Твої результати:\n\n${lines.join("\n")}${winnersBlock}\n\nНовий тиждень уже почався — вперед! 🚀`;
    },
    { respectDailyCap: false, buttonText: "Новий тиждень 🚀" },
  );
};

// ==================== РОЗКЛАД ====================

export function initCronJobs(): void {
  // noOverlap: якщо попередній запуск ще триває, новий не стартує поверх нього
  const options = { timezone: CRON_TIMEZONE, noOverlap: true };

  // Одноразово для старих юзерів: день останнього уроку зі старого "дня відкриття"
  migrateStreakDays()
    .then((count) => {
      if (count > 0) console.log(`[CRON] Міграція стріків: ${count}`);
    })
    .catch((error: unknown) => notifyAdmin("Міграція стріків не вдалася", error));

  cron.schedule("1 0 * * *", runJob("нічне обслуговування", nightlyMaintenance), options);
  cron.schedule("0 10 * * *", runJob("нові уроки відкрились", lessonsReopened), options);
  cron.schedule("0 11 * * *", runJob("вогник згас", streakLostNotice), options);
  cron.schedule("0 13 * * *", runJob("серія в небезпеці", streakGraceReminder), options);
  cron.schedule("0 19 * * *", runJob("не втрачай вогник", streakEveningReminder), options);
  cron.schedule("0 14 * * 3", runJob("рейтинг тижня (середа)", weeklyTopReminder), options);
  cron.schedule(GIVEAWAY_CRON, runJob("підсумки змагання тижня", weeklySummary), options);
  cron.schedule("*/30 9-21 * * *", runJob("автоозвучка нових фраз", autoGenerateMissing), options);
}