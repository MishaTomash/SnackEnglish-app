/**
 * ⚠️ ЗАГЛУШКА: оригінальний пул SNEKIE_REACTIONS з lesson.js не надійшов,
 * тому тут власні репліки. Замініть текстами з прототипу — структура та сама.
 */

export type FeedbackKind = "correct" | "almost" | "wrong";

export const SNEKIE_REACTIONS: Record<FeedbackKind, readonly string[]> = {
    correct: [
        "Точно! Так і кажуть англійці 🍪",
        "Бездоганно!",
        "Yes! Саме так!",
        "Оце рівень! Продовжуємо.",
        "Смачно сказано 😋",
    ],
    almost: [
        "Майже! Є варіант природніший.",
        "Непогано, але можна краще.",
        "Близько! Спробуй ще раз.",
    ],
    wrong: [
        "Ой, не зовсім… Спробуй ще!",
        "Хмм, це не те. Ще раз?",
        "Не страшно — помилки теж вчать!",
        "Упс! Подумай ще трохи.",
    ],
};

export const pickReaction = (
    kind: FeedbackKind,
    random: () => number = Math.random,
): string => {
    const pool = SNEKIE_REACTIONS[kind];
    return pool[Math.floor(random() * pool.length)] ?? "";
};