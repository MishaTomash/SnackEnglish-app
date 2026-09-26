// 📁 Файл: SnackEnglish-app/src/features/story-admin/lib/stepCatalog.ts
import type { StepPayload, StepType } from "../../../entities/story/types";

/**
 * Каталог типів кроків для візуального редактора: назва, іконка, пояснення,
 * заготовка нового кроку, короткий підсумок для згорнутої картки й швидка перевірка.
 * Повна перевірка — на сервері (storyContentValidator), ці підказки лише для зручності.
 */

export interface StepMeta {
    type: StepType;
    title: string;
    emoji: string;
    description: string;
    create: () => StepPayload;
}

export const STEP_CATALOG: readonly StepMeta[] = [
    {
        type: "scene",
        title: "Сцена",
        emoji: "🏙️",
        description: "Опис місця чи події. Англійські слова можна виділити — їх натискають і слухають.",
        create: () => ({ type: "scene", icon: "🏙️", text: "" }),
    },
    {
        type: "dialogue",
        title: "Діалог",
        emoji: "💬",
        description: "Репліки Снекі, юзера й персонажа уроку — кожен своїм голосом.",
        create: () => ({ type: "dialogue", lines: [{ speaker: "snacky", en: "", uk: "" }] }),
    },
    {
        type: "cards",
        title: "Картки слів",
        emoji: "🃏",
        description: "Нові слова: англійською, переклад і емодзі.",
        create: () => ({ type: "cards", title: "Нові слова", cards: [{ en: "", uk: "", emoji: "" }] }),
    },
    {
        type: "quiz",
        title: "Тест",
        emoji: "❓",
        description: "Питання з варіантами й однією правильною відповіддю.",
        create: () => ({ type: "quiz", question: "", options: ["", ""], correct: 0 }),
    },
    {
        type: "listen",
        title: "Аудіювання",
        emoji: "🎧",
        description: "Юзер слухає фразу й обирає, що почув.",
        create: () => ({ type: "listen", audio: "", question: "", options: ["", ""], correct: 0 }),
    },
    {
        type: "reply",
        title: "Відповідь Снекі",
        emoji: "🗣️",
        description: "Снекі щось каже — юзер обирає репліку: добру, так собі чи погану.",
        create: () => ({
            type: "reply",
            prompt: "",
            promptUk: "",
            options: [
                { en: "", uk: "", quality: "good" },
                { en: "", uk: "", quality: "bad" },
            ],
        }),
    },
    {
        type: "build",
        title: "Скласти речення",
        emoji: "🧩",
        description: "Юзер складає речення зі слів у правильному порядку.",
        create: () => ({ type: "build", prompt: "", answer: "", distractors: [] }),
    },
    {
        type: "voice",
        title: "Скажи вголос",
        emoji: "🎤",
        description: "Юзер вимовляє фразу — застосунок перевіряє вимову.",
        create: () => ({ type: "voice", phrase: "", uk: "" }),
    },
    {
        type: "choice",
        title: "Сюжетний вибір",
        emoji: "🔀",
        description: "Вибір без правильної відповіді; кожен варіант може мати свою гілку кроків.",
        create: () => ({ type: "choice", prompt: "", options: [{ text: "", uk: "" }, { text: "", uk: "" }] }),
    },
    {
        type: "event",
        title: "Подія",
        emoji: "💥",
        description: "Раптова подія з ефектом: спалах, трясіння чи дощ.",
        create: () => ({ type: "event", effect: "shake", icon: "💥", text: "" }),
    },
];

export const STEP_META: Readonly<Record<string, StepMeta>> = Object.fromEntries(STEP_CATALOG.map((m) => [m.type, m]));

const strip = (value: unknown): string =>
    typeof value === "string" ? value.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim() : "";

const cut = (value: string, max = 70): string => (value.length > max ? `${value.slice(0, max - 1)}…` : value);

/** Короткий підсумок для згорнутої картки кроку */
export const stepSummary = (step: StepPayload): string => {
    switch (step.type) {
        case "scene":
        case "event":
            return cut(strip(step.text)) || "без тексту";
        case "dialogue":
            return `${step.lines.length} ${step.lines.length === 1 ? "репліка" : "реплік"}: ${cut(strip(step.lines[0]?.en), 50) || "…"}`;
        case "cards":
            return step.cards.map((c) => strip(c.en)).filter(Boolean).join(", ") || "без слів";
        case "quiz":
            return cut(strip(step.question)) || "без питання";
        case "listen":
            return cut(strip(step.audio)) || "без фрази";
        case "reply":
            return cut(strip(step.prompt)) || `${step.options.length} варіанти відповіді`;
        case "build":
            return cut(Array.isArray(step.answer) ? step.answer.join(" ") : strip(step.answer)) || "без речення";
        case "voice":
            return cut(strip(step.phrase)) || "без фрази";
        case "choice":
            return cut(strip(step.prompt)) || `${step.options.length} варіанти`;
        default:
            return "";
    }
};

const blank = (value: unknown): boolean => strip(value) === "";

const unbalancedMarkup = (value: unknown): boolean =>
    typeof value === "string" && (value.match(/<en>/gi) ?? []).length !== (value.match(/<\/en>/gi) ?? []).length;

/** Швидка перевірка кроку прямо під час редагування (повна — на сервері) */
export const localStepIssues = (step: StepPayload): string[] => {
    const issues: string[] = [];
    const markupFields: unknown[] = [];

    switch (step.type) {
        case "scene":
        case "event":
            if (blank(step.text)) issues.push("Порожній текст");
            markupFields.push(step.text);
            break;
        case "dialogue":
            if (step.lines.length === 0) issues.push("Немає жодної репліки");
            step.lines.forEach((line, i) => {
                if (blank(line.en)) issues.push(`Репліка ${i + 1}: порожній англійський текст`);
                markupFields.push(line.en, line.uk);
            });
            break;
        case "cards":
            if (step.cards.length === 0) issues.push("Немає жодної картки");
            step.cards.forEach((card, i) => {
                if (blank(card.en) || blank(card.uk)) issues.push(`Картка ${i + 1}: потрібні слово й переклад`);
            });
            break;
        case "quiz":
        case "listen": {
            if (step.type === "quiz" && blank(step.question)) issues.push("Порожнє питання");
            if (step.type === "listen" && blank(step.audio)) issues.push("Порожня фраза для прослуховування");
            if (step.options.length < 2) issues.push("Потрібно щонайменше 2 варіанти");
            if (step.options.some((o) => blank(o))) issues.push("Є порожній варіант");
            if (typeof step.correct !== "number" || step.correct < 0 || step.correct >= step.options.length) {
                issues.push("Не вибрано правильну відповідь");
            }
            markupFields.push(...step.options);
            break;
        }
        case "reply":
            if (step.options.length < 2) issues.push("Потрібно щонайменше 2 варіанти");
            if (!step.options.some((o) => o.quality === "good")) issues.push("Потрібен хоча б один «добрий» варіант");
            step.options.forEach((o, i) => {
                if (blank(o.en)) issues.push(`Варіант ${i + 1}: порожній текст`);
            });
            markupFields.push(step.prompt);
            break;
        case "build": {
            const words = Array.isArray(step.answer) ? step.answer : strip(step.answer).split(" ").filter(Boolean);
            if (words.length < 2) issues.push("Речення має бути хоча б з 2 слів");
            break;
        }
        case "voice":
            if (blank(step.phrase)) issues.push("Порожня фраза");
            markupFields.push(step.phrase);
            break;
        case "choice":
            if (step.options.length < 2) issues.push("Потрібно щонайменше 2 варіанти");
            step.options.forEach((o, i) => {
                if (blank(o.text)) issues.push(`Варіант ${i + 1}: порожній текст`);
            });
            break;
        default:
            break;
    }

    if (markupFields.some(unbalancedMarkup)) issues.push("Непарні теги <en> … </en>");
    return issues;
};