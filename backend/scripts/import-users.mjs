// 📁 Файл: SnackEnglish-app/backend/scripts/import-users.mjs
/**
 * Перенос юзерів зі СТАРОЇ версії бота в нову базу. Стара база лише ЧИТАЄТЬСЯ.
 *
 * Запуск (з папки backend):
 *   node scripts/import-users.mjs "<URI_СТАРОЇ>" "<URI_НОВОЇ>"            ← пробний прогін, нічого не пише
 *   node scripts/import-users.mjs "<URI_СТАРОЇ>" "<URI_НОВОЇ>" --apply    ← справжній перенос
 *
 * Що переноситься (див. mapLegacyUser):
 *   Telegram id, ім'я, username, рівень (A1–C2), дата реєстрації, кубки за весь час (xp),
 *   серія (лише якщо юзер був активний за останні 2 дні), слова зі старої версії,
 *   "заблокував бота", хто кого запросив.
 * Не переноситься: старий прогрес уроків, преміум, нагадування за часом, тижневі кубки (усі з нуля).
 *
 * Захист:
 *   - юзери, які вже є в новій базі, НЕ перезаписуються (пропускаються);
 *   - можна запускати кілька разів: вдруге перенесе лише нових;
 *   - кожен перенесений юзер має legacyImportedAt — видно, хто прийшов зі старої версії.
 */
import mongoose from "mongoose";
import { pathToFileURL } from "url";

const LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"];
const DAY_MS = 24 * 60 * 60 * 1000;
const BATCH = 500;

// ==================== ПЕРЕТВОРЕННЯ ====================

/** "YYYY-MM-DD" за Києвом — так нова версія рахує дні серії */
export const kyivDayKey = (date) =>
    new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Kyiv", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);

/** Рівень зі старої бази -> A1…C2 або null (тоді юзер пройде визначення рівня заново) */
export const normalizeLevel = (value) => {
    if (typeof value !== "string") return null;
    const match = value.trim().toUpperCase().match(/\b([ABC][12])\b/);
    return match && LEVELS.includes(match[1]) ? match[1] : null;
};

const validDate = (value) => (value instanceof Date && !Number.isNaN(value.getTime()) ? value : null);

const nonNegativeInt = (value) => (Number.isFinite(value) && value > 0 ? Math.floor(value) : 0);

/**
 * Старий юзер -> документ нової бази. Чиста функція (без бази) — її перевіряють тести.
 * now — "зараз" (для тестів).
 */
export const mapLegacyUser = (old, now = new Date()) => {
    const lastActive = validDate(old.lastActive) ?? validDate(old.lastActivityDate);
    const level = normalizeLevel(old.level);

    // Серію лишаємо, лише якщо юзер займався сьогодні/учора/позавчора (нова логіка ще дасть день на порятунок).
    // Давно неактивним — тихо 0: інакше нічний cron "загасив" би серію й написав "вогник згас" людині,
    // яка не заходила місяцями.
    const streak = nonNegativeInt(old.streak);
    const isRecent = lastActive !== null && now.getTime() - lastActive.getTime() <= 2 * DAY_MS;
    const keepStreak = streak > 0 && isRecent;

    // Дата реєстрації: у старій моделі немає createdAt — беремо час зі старого _id
    const createdAt =
        typeof old._id?.getTimestamp === "function" ? old._id.getTimestamp() : lastActive ?? now;

    return {
        telegramId: old.telegramId,
        username: typeof old.username === "string" && old.username.trim() ? old.username.trim() : null,
        telegramFirstName: typeof old.firstName === "string" && old.firstName.trim() ? old.firstName.trim() : null,
        telegramPhotoUrl: null,
        customDisplayName: null,
        customAvatarUrl: null,
        level,
        // Рівень відомий — онбординг (визначення рівня) не потрібен
        onboardingCompleted: level !== null,
        weakAreas: [],
        hp: 5,
        blocked: false,
        totalScore: nonNegativeInt(old.xp),
        weeklyScore: 0,
        streak: keepStreak ? streak : 0,
        streakLastDay: keepStreak ? kyivDayKey(lastActive) : null,
        streakFreezeUsedAt: null,
        streakLostAt: null,
        lostStreak: 0,
        lastActivityDate: lastActive,
        learnedWords: [],
        wordsLearnedCount: nonNegativeInt(old.wordsLearned),
        legacyWordsCount: nonNegativeInt(old.wordsLearned),
        // Старий прогрес уроків-історій порожній — перераховувати нічого
        wordsBackfilled: true,
        referralCode: null,
        referredBy: null, // заповнюється другим проходом (у старій базі тут Telegram id, а не _id)
        referralRewardedAt: null,
        // isBlocked у старій версії = "юзер заблокував бота" (див. індекс нагадувань), НЕ блокування адміном.
        // /start у новій версії знімає цю позначку сам
        botBlockedAt: old.isBlocked === true ? now : null,
        lastReminderAt: null,
        remindersEnabled: true,
        legacyImportedAt: now,
        createdAt,
        updatedAt: now,
    };
};

// ==================== ПЕРЕНОС ====================

const LEGACY_FIELDS = {
    telegramId: 1,
    username: 1,
    firstName: 1,
    level: 1,
    streak: 1,
    lastActive: 1,
    lastActivityDate: 1,
    xp: 1,
    wordsLearned: 1,
    isBlocked: 1,
    isPremium: 1,
    premiumExpiresAt: 1,
    referredBy: 1,
};

/**
 * Сам перенос. oldDb / newDb — бази MongoDB (або тестові замінники з тими самими методами).
 * apply=false — лише рахує й друкує, нічого не пише.
 */
export const runImport = async ({ oldDb, newDb, apply, now = new Date(), log = console.log }) => {
    const legacy = await oldDb
        .collection("users")
        .find({ telegramId: { $type: "number" } }, { projection: LEGACY_FIELDS })
        .toArray();
    const existing = new Set(await newDb.collection("users").distinct("telegramId"));

    const toInsert = [];
    const stats = {
        oldTotal: legacy.length,
        alreadyInNew: 0,
        levels: {},
        unknownLevels: {},
        streakKept: 0,
        streakReset: 0,
        botBlocked: 0,
        activePremium: 0,
        withReferrer: 0,
        active30d: 0,
        inserted: 0,
        skippedDuplicates: 0,
        linked: 0,
    };

    const seen = new Set();
    for (const old of legacy) {
        if (existing.has(old.telegramId)) {
            stats.alreadyInNew += 1;
            continue;
        }
        // Дублікати telegramId у старій базі (якщо раптом є) — переносимо один раз
        if (seen.has(old.telegramId)) continue;
        seen.add(old.telegramId);

        const doc = mapLegacyUser(old, now);
        toInsert.push({ doc, referrerTelegramId: Number.isFinite(old.referredBy) ? old.referredBy : null });

        const levelKey = doc.level ?? "без рівня";
        stats.levels[levelKey] = (stats.levels[levelKey] ?? 0) + 1;
        if (!doc.level && old.level) stats.unknownLevels[String(old.level)] = (stats.unknownLevels[String(old.level)] ?? 0) + 1;
        if (doc.streak > 0) stats.streakKept += 1;
        else if (nonNegativeInt(old.streak) > 0) stats.streakReset += 1;
        if (doc.botBlockedAt) stats.botBlocked += 1;
        if (old.isPremium && validDate(old.premiumExpiresAt) && old.premiumExpiresAt > now) stats.activePremium += 1;
        if (Number.isFinite(old.referredBy)) stats.withReferrer += 1;
        if (doc.lastActivityDate && now - doc.lastActivityDate <= 30 * DAY_MS) stats.active30d += 1;
    }

    log(`У старій базі юзерів: ${stats.oldTotal}`);
    log(`  уже є в новій (не чіпаю): ${stats.alreadyInNew}`);
    log(`  буде перенесено: ${toInsert.length}`);
    log(`    з них активні за 30 днів: ${stats.active30d}`);
    log(`    рівні: ${Object.entries(stats.levels).map(([k, v]) => `${k} — ${v}`).join(", ") || "—"}`);
    if (Object.keys(stats.unknownLevels).length > 0) {
        log(`    ⚠️ нерозпізнані рівні (такі юзери пройдуть визначення рівня заново): ${JSON.stringify(stats.unknownLevels)}`);
    }
    log(`    серія збережена: ${stats.streakKept}, тихо обнулена (давно неактивні): ${stats.streakReset}`);
    log(`    заблокували бота (нагадування не слатимуться): ${stats.botBlocked}`);
    log(`    запрошені друзями: ${stats.withReferrer}`);
    if (stats.activePremium > 0) {
        log(`    💎 з активним преміумом: ${stats.activePremium} — у новій версії все безкоштовно; варто написати їм подяку`);
    }

    if (!apply) {
        log("\nПробний прогін завершено. Усе гаразд? Запусти ще раз з --apply.");
        return stats;
    }

    // ---------- 1. Вставка ----------
    for (let i = 0; i < toInsert.length; i += BATCH) {
        const batch = toInsert.slice(i, i + BATCH).map((item) => item.doc);
        try {
            const result = await newDb.collection("users").insertMany(batch, { ordered: false });
            stats.inserted += result.insertedCount;
        } catch (error) {
            // Хтось зареєструвався в новій версії, поки йшов перенос — просто пропускаємо його
            if (error?.code === 11000 || error?.writeErrors) {
                const failed = error.writeErrors?.length ?? 0;
                stats.inserted += batch.length - failed;
                stats.skippedDuplicates += failed;
            } else {
                throw error;
            }
        }
        log(`  вставлено ${Math.min(i + BATCH, toInsert.length)} / ${toInsert.length}`);
    }

    // ---------- 2. Хто кого запросив ----------
    // У старій базі referredBy — Telegram id. Шукаємо нові _id і ставимо "бонус уже нараховано",
    // щоб після першого уроку в новій версії бонус не нарахувався вдруге
    const referrals = toInsert.filter((item) => item.referrerTelegramId !== null);
    if (referrals.length > 0) {
        const referrerIds = [...new Set(referrals.map((item) => item.referrerTelegramId))];
        const referrers = await newDb
            .collection("users")
            .find({ telegramId: { $in: referrerIds } }, { projection: { _id: 1, telegramId: 1 } })
            .toArray();
        const idByTelegram = new Map(referrers.map((u) => [u.telegramId, u._id]));

        const ops = referrals
            .filter((item) => idByTelegram.has(item.referrerTelegramId) && item.referrerTelegramId !== item.doc.telegramId)
            .map((item) => ({
                updateOne: {
                    filter: { telegramId: item.doc.telegramId, referredBy: null, legacyImportedAt: { $ne: null } },
                    update: { $set: { referredBy: idByTelegram.get(item.referrerTelegramId), referralRewardedAt: now } },
                },
            }));
        if (ops.length > 0) stats.linked = (await newDb.collection("users").bulkWrite(ops, { ordered: false })).modifiedCount;
    }

    log(`\n✅ Перенесено: ${stats.inserted}${stats.skippedDuplicates ? `, пропущено (вже зареєструвались): ${stats.skippedDuplicates}` : ""}`);
    log(`   Зв'язків "хто кого запросив": ${stats.linked}`);
    log("Далі: запусти новий сервер з токеном основного бота й зроби розсилку в адмінці 🍪");
    return stats;
};

const main = async () => {
    const args = process.argv.slice(2);
    const apply = args.includes("--apply");
    const [oldUri, newUri] = args.filter((a) => !a.startsWith("--"));
    if (!oldUri || !newUri) {
        console.error('Використання: node scripts/import-users.mjs "<URI_СТАРОЇ>" "<URI_НОВОЇ>" [--apply]');
        process.exit(1);
    }
    if (oldUri === newUri) {
        console.error("Стара й нова база однакові — зупиняюсь.");
        process.exit(1);
    }

    const oldConnection = await mongoose.createConnection(oldUri, { serverSelectionTimeoutMS: 15000 }).asPromise();
    const newConnection = await mongoose.createConnection(newUri, { serverSelectionTimeoutMS: 15000 }).asPromise();
    console.log(`Стара база: "${oldConnection.db.databaseName}" (лише читання)`);
    console.log(`Нова база:  "${newConnection.db.databaseName}"`);
    console.log(apply ? "Режим: ПЕРЕНОС\n" : "Режим: пробний прогін (нічого не пишу; для переносу додай --apply)\n");

    try {
        await runImport({ oldDb: oldConnection.db, newDb: newConnection.db, apply });
    } finally {
        await Promise.all([oldConnection.close(), newConnection.close()]);
    }
};

// Запуск лише як скрипта (імпорт для тестів — без підключення до баз)
if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
    main().catch((error) => {
        console.error("Помилка:", error.message);
        process.exit(1);
    });
}