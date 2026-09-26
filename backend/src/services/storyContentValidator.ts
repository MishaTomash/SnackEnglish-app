// 📁 Файл: SnackEnglish-app/backend/src/services/storyContentValidator.ts
/**
 * Валідація контенту історій, що надходить з адмін-панелі.
 *
 * Дзеркалить типи кроків фронтенду (src/entities/story/types.ts).
 * Змінюєте форму кроку там — оновіть і тут, інакше адмінка відхилятиме контент.
 *
 * Строгість навмисна: невідомі поля — помилка (ловить одруківки на кшталт
 * "explantion"), бо фронтенд такі поля мовчки ігнорує.
 */
import { SLUG_MAX_LENGTH, SLUG_RE } from "../utils/slugify.js";

export interface ContentIssue {
    /** Номер уроку (з 1), якщо вставлено масив уроків */
    lesson?: number;
    /** Шлях усередині JSON: steps[3].options[1].quality */
    path: string;
    message: string;
}

export const LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;
export type Level = (typeof LEVELS)[number];

export const STEP_TYPES = [
    "scene",
    "dialogue",
    "choice",
    "reply",
    "listen",
    "cards",
    "quiz",
    "build",
    "voice",
    "event",
] as const;

/** Slug-и, що перетнулися б з маршрутами фронтенду (/learning/admin) */
export const RESERVED_SLUGS: ReadonlySet<string> = new Set(["admin", "new", "edit"]);

export const MAX_LESSONS_PER_REQUEST = 50;

// CookieMascot: COOKIE_STATES (можна з префіксом "emo-")
const EMOTIONS = [
    "happy",
    "thinking",
    "sleeping",
    "celebrating",
    "idle",
    "scared",
    "surprised",
    "excited",
    "sad",
];
const EVENT_EFFECTS = ["flash", "shake", "rain"];
// npc — персонаж уроку (npcName): бариста, офіціант… Говорить своїм голосом
const SPEAKERS = ["snacky", "user", "npc"];
const QUALITIES = ["good", "ok", "bad"];
const HEX_COLOR_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
const MAX_BRANCH_DEPTH = 3; // choice усередині outcome усередині choice…

/** Крок після валідації: type гарантовано є, решта полів — за типом кроку */
export interface ContentStep {
    type: string;
    [key: string]: unknown;
}

export interface LessonContent {
    slug?: string;
    label: string;
    icon: string;
    npc: string;
    npcName: string;
    isBoss: boolean;
    cliffhanger: { text: string } | null;
    steps: ContentStep[];
}

export interface ChapterInput {
    slug?: string;
    title?: string;
    subtitle?: string;
    cover?: string;
    accent?: string;
    level?: Level;
    published?: boolean;
}

type Obj = Record<string, unknown>;

/**
 * rich  — текст рендериться через RichText: <en>…</en> дозволено, теги мають бути парні
 * plain — показується як є або озвучується: <en> заборонено (з'явився б на екрані/в озвучці)
 */
type Markup = "rich" | "plain";

const isObj = (value: unknown): value is Obj =>
    typeof value === "object" && value !== null && !Array.isArray(value);

const join = (path: string, key: string) => (path ? `${path}.${key}` : key);

class Checker {
    constructor(
        private readonly issues: ContentIssue[],
        private readonly lesson?: number,
    ) { }

    error(path: string, message: string): void {
        this.issues.push({
            ...(this.lesson !== undefined ? { lesson: this.lesson } : {}),
            path: path || "(корінь)",
            message,
        });
    }

    obj(value: unknown, path: string): Obj | null {
        if (isObj(value)) return value;
        this.error(path, "очікується об'єкт { … }");
        return null;
    }

    onlyKeys(obj: Obj, path: string, allowed: readonly string[]): void {
        for (const key of Object.keys(obj)) {
            if (!allowed.includes(key)) {
                this.error(join(path, key), `невідоме поле "${key}". Дозволені: ${allowed.join(", ")}`);
            }
        }
    }

    str(
        obj: Obj,
        key: string,
        path: string,
        {
            required = false,
            markup = "rich",
            max,
        }: { required?: boolean; markup?: Markup; max?: number } = {},
    ): string | undefined {
        const value = obj[key];
        const fieldPath = join(path, key);
        if (value === undefined) {
            if (required) this.error(fieldPath, "обов'язкове поле");
            return undefined;
        }
        if (typeof value !== "string") {
            this.error(fieldPath, "очікується рядок");
            return undefined;
        }
        if (required && value.trim() === "") {
            this.error(fieldPath, "не може бути порожнім");
            return undefined;
        }
        if (max !== undefined && value.length > max) {
            this.error(fieldPath, `задовго: максимум ${max} символів`);
        }
        this.checkMarkup(value, fieldPath, markup);
        return value;
    }

    checkMarkup(value: string, path: string, markup: Markup): void {
        const opens = (value.match(/<en>/gi) ?? []).length;
        const closes = (value.match(/<\/en>/gi) ?? []).length;
        if (markup === "plain" && (opens > 0 || closes > 0)) {
            this.error(path, "тут розмітка <en> не підтримується — текст показується/озвучується як є");
        } else if (opens !== closes) {
            this.error(path, `непарні теги: <en> ×${opens}, </en> ×${closes}`);
        }
    }

    oneOf(obj: Obj, key: string, path: string, allowed: readonly string[], required = false): void {
        const value = obj[key];
        if (value === undefined) {
            if (required) this.error(join(path, key), `обов'язкове поле: ${allowed.join(" | ")}`);
            return;
        }
        if (typeof value !== "string" || !allowed.includes(value)) {
            this.error(join(path, key), `має бути одне з: ${allowed.join(", ")}`);
        }
    }

    emotion(obj: Obj, key: string, path: string): void {
        const value = obj[key];
        if (value === undefined) return;
        const normalized =
            typeof value === "string" ? value.trim().toLowerCase().replace(/^emo-/, "") : "";
        if (!EMOTIONS.includes(normalized)) {
            this.error(join(path, key), `невідома емоція. Дозволені: ${EMOTIONS.join(", ")}`);
        }
    }

    bool(obj: Obj, key: string, path: string): boolean | undefined {
        const value = obj[key];
        if (value === undefined) return undefined;
        if (typeof value !== "boolean") {
            this.error(join(path, key), "очікується true або false");
            return undefined;
        }
        return value;
    }

    array(obj: Obj, key: string, path: string, { min = 1 } = {}): unknown[] | null {
        const value = obj[key];
        const fieldPath = join(path, key);
        if (!Array.isArray(value)) {
            this.error(fieldPath, value === undefined ? "обов'язкове поле (масив)" : "очікується масив [ … ]");
            return null;
        }
        if (value.length < min) {
            this.error(fieldPath, `потрібно щонайменше ${min} елемент(и)`);
        }
        return value;
    }

    stringArray(obj: Obj, key: string, path: string, markup: Markup, { min = 1 } = {}): string[] | null {
        const items = this.array(obj, key, path, { min });
        if (!items) return null;
        const result: string[] = [];
        items.forEach((item, i) => {
            const itemPath = `${join(path, key)}[${i}]`;
            if (typeof item !== "string" || item.trim() === "") {
                this.error(itemPath, "очікується непорожній рядок");
                return;
            }
            this.checkMarkup(item, itemPath, markup);
            result.push(item);
        });
        return result;
    }

    /** correct: індекс у options або текст одного з варіантів */
    correctAnswer(obj: Obj, path: string, options: string[] | null): void {
        const value = obj.correct;
        const fieldPath = join(path, "correct");
        if (value === undefined) {
            this.error(fieldPath, "обов'язкове поле: індекс або текст правильного варіанта");
            return;
        }
        if (!options) return;
        if (typeof value === "number") {
            if (!Number.isInteger(value) || value < 0 || value >= options.length) {
                this.error(fieldPath, `індекс поза межами options (0…${options.length - 1})`);
            }
            return;
        }
        if (typeof value === "string") {
            const target = value.trim().toLowerCase();
            const matches = options.filter((o) => o.trim().toLowerCase() === target).length;
            if (matches === 0) this.error(fieldPath, `"${value}" немає серед options`);
            if (matches > 1) this.error(fieldPath, `"${value}" зустрічається в options кілька разів`);
            return;
        }
        this.error(fieldPath, "очікується число (індекс) або рядок (текст варіанта)");
    }

    slug(obj: Obj, key: string, path: string): string | undefined {
        const value = this.str(obj, key, path, { markup: "plain", max: SLUG_MAX_LENGTH });
        if (value === undefined) return undefined;
        if (!SLUG_RE.test(value)) {
            this.error(join(path, key), "лише латиниця в нижньому регістрі, цифри й дефіси (напр. at-the-hotel)");
            return undefined;
        }
        if (RESERVED_SLUGS.has(value)) {
            this.error(join(path, key), `"${value}" зарезервовано — оберіть інший`);
            return undefined;
        }
        return value;
    }
}

// ==================== КРОКИ ====================

const STEP_KEYS: Record<(typeof STEP_TYPES)[number], readonly string[]> = {
    scene: ["type", "icon", "text"],
    dialogue: ["type", "lines"],
    cards: ["type", "title", "cards"],
    event: ["type", "effect", "icon", "text"],
    choice: ["type", "prompt", "options"],
    reply: ["type", "prompt", "promptUk", "emotion", "options"],
    listen: ["type", "audio", "question", "options", "correct"],
    quiz: ["type", "question", "npcPrompt", "options", "correct", "explanation"],
    build: ["type", "prompt", "answer", "distractors"],
    voice: ["type", "phrase", "uk"],
};

function checkStep(c: Checker, value: unknown, path: string, depth: number): void {
    const step = c.obj(value, path);
    if (!step) return;

    const type = step.type;
    if (typeof type !== "string" || !(STEP_TYPES as readonly string[]).includes(type)) {
        c.error(join(path, "type"), `невідомий тип кроку. Дозволені: ${STEP_TYPES.join(", ")}`);
        return;
    }
    const stepType = type as (typeof STEP_TYPES)[number];
    c.onlyKeys(step, path, STEP_KEYS[stepType]);

    switch (stepType) {
        case "scene":
            c.str(step, "icon", path, { markup: "plain" });
            c.str(step, "text", path, { required: true });
            break;

        case "event":
            c.oneOf(step, "effect", path, EVENT_EFFECTS);
            c.str(step, "icon", path, { markup: "plain" });
            c.str(step, "text", path, { required: true });
            break;

        case "dialogue":
            c.array(step, "lines", path)?.forEach((raw, i) => {
                const linePath = `${join(path, "lines")}[${i}]`;
                const line = c.obj(raw, linePath);
                if (!line) return;
                c.onlyKeys(line, linePath, ["speaker", "en", "uk", "emotion"]);
                c.oneOf(line, "speaker", linePath, SPEAKERS, true);
                c.str(line, "en", linePath, { required: true });
                c.str(line, "uk", linePath);
                c.emotion(line, "emotion", linePath);
            });
            break;

        case "cards":
            c.str(step, "title", path, { markup: "plain" });
            c.array(step, "cards", path)?.forEach((raw, i) => {
                const cardPath = `${join(path, "cards")}[${i}]`;
                const card = c.obj(raw, cardPath);
                if (!card) return;
                c.onlyKeys(card, cardPath, ["en", "uk", "emoji"]);
                c.str(card, "en", cardPath, { required: true, markup: "plain" });
                c.str(card, "uk", cardPath, { required: true, markup: "plain" });
                c.str(card, "emoji", cardPath, { markup: "plain" });
            });
            break;

        case "choice":
            c.str(step, "prompt", path);
            c.array(step, "options", path, { min: 2 })?.forEach((raw, i) => {
                const optionPath = `${join(path, "options")}[${i}]`;
                const option = c.obj(raw, optionPath);
                if (!option) return;
                c.onlyKeys(option, optionPath, ["text", "uk", "icon", "outcome"]);
                c.str(option, "text", optionPath, { required: true });
                c.str(option, "uk", optionPath, { markup: "plain" });
                c.str(option, "icon", optionPath, { markup: "plain" });
                if (option.outcome !== undefined) {
                    if (depth >= MAX_BRANCH_DEPTH) {
                        c.error(join(optionPath, "outcome"), `завелика вкладеність гілок (макс. ${MAX_BRANCH_DEPTH})`);
                        return;
                    }
                    c.array(option, "outcome", optionPath)?.forEach((branchStep, k) =>
                        checkStep(c, branchStep, `${join(optionPath, "outcome")}[${k}]`, depth + 1),
                    );
                }
            });
            break;

        case "reply": {
            c.str(step, "prompt", path);
            c.str(step, "promptUk", path);
            c.emotion(step, "emotion", path);
            let hasGood = false;
            c.array(step, "options", path, { min: 2 })?.forEach((raw, i) => {
                const optionPath = `${join(path, "options")}[${i}]`;
                const option = c.obj(raw, optionPath);
                if (!option) return;
                c.onlyKeys(option, optionPath, ["en", "uk", "quality", "reaction", "emotion"]);
                c.str(option, "en", optionPath, { required: true });
                c.str(option, "uk", optionPath, { markup: "plain" });
                c.oneOf(option, "quality", optionPath, QUALITIES, true);
                // Реакція показується як звичайний текст у StepFeedback
                c.str(option, "reaction", optionPath, { markup: "plain" });
                c.emotion(option, "emotion", optionPath);
                if (option.quality === "good") hasGood = true;
            });
            if (!hasGood) {
                c.error(join(path, "options"), 'потрібен хоча б один варіант з quality "good" — інакше крок не пройти');
            }
            break;
        }

        case "listen": {
            c.str(step, "audio", path, { required: true, markup: "plain" });
            c.str(step, "question", path, { markup: "plain" });
            const options = c.stringArray(step, "options", path, "rich", { min: 2 });
            c.correctAnswer(step, path, options);
            break;
        }

        case "quiz": {
            c.str(step, "question", path, { required: true });
            c.str(step, "npcPrompt", path);
            c.str(step, "explanation", path);
            const options = c.stringArray(step, "options", path, "rich", { min: 2 });
            c.correctAnswer(step, path, options);
            break;
        }

        case "build": {
            c.str(step, "prompt", path);
            const answer = step.answer;
            if (typeof answer === "string") {
                c.checkMarkup(answer, join(path, "answer"), "plain");
                if (answer.trim().split(/\s+/).length < 2) {
                    c.error(join(path, "answer"), "потрібно щонайменше 2 слова — інакше нема що складати");
                }
            } else if (Array.isArray(answer)) {
                c.stringArray(step, "answer", path, "plain", { min: 2 });
            } else {
                c.error(join(path, "answer"), "обов'язкове поле: рядок або масив слів");
            }
            if (step.distractors !== undefined) {
                c.stringArray(step, "distractors", path, "plain", { min: 0 });
            }
            break;
        }

        case "voice":
            c.str(step, "phrase", path, { required: true });
            c.str(step, "uk", path);
            break;
    }
}

// ==================== УРОКИ ====================

const LESSON_KEYS = ["slug", "label", "icon", "npc", "npcName", "isBoss", "cliffhanger", "steps"];

function validateLesson(data: unknown, issues: ContentIssue[], lesson?: number): LessonContent | null {
    const c = new Checker(issues, lesson);
    const before = issues.length;
    const node = c.obj(data, "");
    if (!node) return null;

    c.onlyKeys(node, "", LESSON_KEYS);
    const slug = c.slug(node, "slug", "");
    const label = c.str(node, "label", "", { required: true, markup: "plain", max: 60 });
    const icon = c.str(node, "icon", "", { markup: "plain", max: 16 });
    const npc = c.str(node, "npc", "", { markup: "plain" });
    const npcName = c.str(node, "npcName", "", { markup: "plain" });
    const isBoss = c.bool(node, "isBoss", "");

    let cliffhanger: { text: string } | null = null;
    if (node.cliffhanger !== undefined && node.cliffhanger !== null) {
        const raw = c.obj(node.cliffhanger, "cliffhanger");
        if (raw) {
            c.onlyKeys(raw, "cliffhanger", ["text"]);
            const text = c.str(raw, "text", "cliffhanger", { required: true, markup: "plain" });
            if (text) cliffhanger = { text };
        }
    }

    const steps = c.array(node, "steps", "") ?? [];
    steps.forEach((step, i) => checkStep(c, step, `steps[${i}]`, 0));

    if (issues.length > before) return null;
    return {
        ...(slug ? { slug } : {}),
        label: label ?? "",
        icon: icon ?? "⭐",
        npc: npc ?? "",
        npcName: npcName ?? "",
        isBoss: isBoss ?? false,
        cliffhanger,
        steps: steps as ContentStep[],
    };
}

/**
 * Приймає один урок (об'єкт) або кілька (масив). Все або нічого:
 * якщо є хоч одна помилка — lessons порожній, issues містить усі помилки.
 */
export function validateLessons(
    data: unknown,
    { allowArray = true }: { allowArray?: boolean } = {},
): { lessons: LessonContent[]; issues: ContentIssue[] } {
    const issues: ContentIssue[] = [];

    if (Array.isArray(data)) {
        if (!allowArray) {
            issues.push({ path: "(корінь)", message: "тут очікується один урок — об'єкт { … }, а не масив [ … ]" });
            return { lessons: [], issues };
        }
        if (data.length === 0) {
            issues.push({ path: "(корінь)", message: "порожній масив — додайте хоча б один урок" });
            return { lessons: [], issues };
        }
        if (data.length > MAX_LESSONS_PER_REQUEST) {
            issues.push({
                path: "(корінь)",
                message: `за раз можна додати щонайбільше ${MAX_LESSONS_PER_REQUEST} уроків`,
            });
            return { lessons: [], issues };
        }
    }

    const items = Array.isArray(data) ? data : [data];
    const lessons = items
        .map((item, i) => validateLesson(item, issues, Array.isArray(data) ? i + 1 : undefined))
        .filter((lesson): lesson is LessonContent => lesson !== null);

    // Явні slug-и не повинні повторюватись у межах однієї вставки
    const seen = new Map<string, number>();
    items.forEach((item, i) => {
        const slug = isObj(item) && typeof item.slug === "string" ? item.slug : null;
        if (!slug) return;
        const first = seen.get(slug);
        if (first !== undefined) {
            issues.push({ lesson: i + 1, path: "slug", message: `"${slug}" уже є в уроці ${first}` });
        } else {
            seen.set(slug, i + 1);
        }
    });

    return issues.length > 0 ? { lessons: [], issues } : { lessons, issues };
}

// ==================== РОЗДІЛИ ====================

const CHAPTER_KEYS = ["slug", "title", "subtitle", "cover", "accent", "level", "published"];

/**
 * Поля розділу з форми адмінки. partial — для редагування (усі поля опційні),
 * інакше title і level обов'язкові.
 */
export function validateChapterInput(
    data: unknown,
    { partial }: { partial: boolean },
): { value: ChapterInput; issues: ContentIssue[] } {
    const issues: ContentIssue[] = [];
    const c = new Checker(issues);
    const input = c.obj(data, "");
    if (!input) return { value: {}, issues };

    c.onlyKeys(input, "", CHAPTER_KEYS);
    const value: ChapterInput = {};

    // Порожній slug у формі = "згенерувати автоматично"
    if (typeof input.slug === "string" && input.slug.trim() === "") delete input.slug;
    const slug = c.slug(input, "slug", "");
    if (slug) value.slug = slug;

    const title = c.str(input, "title", "", { required: !partial, markup: "plain", max: 60 });
    if (title !== undefined) value.title = title.trim();

    const subtitle = c.str(input, "subtitle", "", { markup: "plain", max: 140 });
    if (subtitle !== undefined) value.subtitle = subtitle.trim();

    const cover = c.str(input, "cover", "", { markup: "plain", max: 16 });
    if (cover !== undefined) value.cover = cover.trim() || "📖";

    const accent = c.str(input, "accent", "", { markup: "plain" });
    if (accent !== undefined) {
        if (HEX_COLOR_RE.test(accent)) value.accent = accent;
        else c.error("accent", 'очікується hex-колір, напр. "#E8A33D"');
    }

    c.oneOf(input, "level", "", LEVELS, !partial);
    if ((LEVELS as readonly unknown[]).includes(input.level)) value.level = input.level as Level;

    const published = c.bool(input, "published", "");
    if (published !== undefined) value.published = published;

    return { value, issues };
}