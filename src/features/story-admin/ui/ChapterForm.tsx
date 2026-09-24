import { useState } from "react";
import type { FC, FormEvent, ReactNode } from "react";
import { AdminValidationError, adminErrorMessage } from "../../../entities/story/adminApi";
import type { AdminChapter, ChapterInput } from "../../../entities/story/adminTypes";
import type { EnglishLevel } from "../../../entities/word/types";
import { Button } from "../../../shared/ui/Button";

const LEVELS: readonly EnglishLevel[] = ["A1", "A2", "B1", "B2", "C1", "C2"];
const COVER_PRESETS = ["☕", "🚌", "🕵️", "🏨", "✈️", "🛒", "🏥", "🎓", "🍕", "🌧️", "🏛️", "💼"];
const ACCENT_PRESETS = ["#E8A33D", "#60A5FA", "#A78BFA", "#4ADE80", "#F87171", "#F472B6", "#2DD4BF"];
const HEX_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

export interface ChapterFormProps {
    /** Є — редагування (надсилаються лише змінені поля), немає — створення */
    initial?: AdminChapter;
    submitLabel: string;
    onSubmit: (input: ChapterInput) => Promise<void>;
    onCancel: () => void;
}

interface FieldProps {
    label: string;
    htmlFor: string;
    error?: string;
    hint?: ReactNode;
    children: ReactNode;
}

const Field: FC<FieldProps> = ({ label, htmlFor, error, hint, children }) => (
    <div className="flex flex-col gap-1.5">
        <label htmlFor={htmlFor} className="text-sm font-bold">
            {label}
        </label>
        {children}
        {error ? (
            <p className="text-xs font-semibold text-[var(--accent-error)]">{error}</p>
        ) : (
            hint && <p className="text-xs text-[var(--text-muted)]">{hint}</p>
        )}
    </div>
);

const inputClass =
    "w-full rounded-xl border-2 border-[var(--border-color)] bg-[var(--bg-card)] px-3 py-2.5 text-[var(--text-main)] outline-none focus:border-[var(--accent-cta)]";

export const ChapterForm: FC<ChapterFormProps> = ({ initial, submitLabel, onSubmit, onCancel }) => {
    const [title, setTitle] = useState(initial?.title ?? "");
    const [subtitle, setSubtitle] = useState(initial?.subtitle ?? "");
    const [cover, setCover] = useState(initial?.cover ?? "☕");
    const [accent, setAccent] = useState(initial?.accent ?? ACCENT_PRESETS[0]);
    const [level, setLevel] = useState<EnglishLevel>(initial?.level ?? "A1");
    const [slug, setSlug] = useState(initial?.slug ?? "");
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
    const [formError, setFormError] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    const buildInput = (): ChapterInput => {
        const all: ChapterInput = {
            title: title.trim(),
            subtitle: subtitle.trim(),
            cover: cover.trim(),
            accent,
            level,
            slug: slug.trim(),
        };
        if (!initial) return all;
        // Редагування: лише те, що змінилось
        const changed: ChapterInput = {};
        if (all.title !== initial.title) changed.title = all.title;
        if (all.subtitle !== initial.subtitle) changed.subtitle = all.subtitle;
        if (all.cover !== initial.cover) changed.cover = all.cover;
        if (all.accent !== initial.accent) changed.accent = all.accent;
        if (all.level !== initial.level) changed.level = all.level;
        if (all.slug && all.slug !== initial.slug) changed.slug = all.slug;
        return changed;
    };

    const handleSubmit = async (event: FormEvent) => {
        event.preventDefault();
        setFieldErrors({});
        setFormError(null);

        // Швидкі перевірки на місці; решту (унікальність slug тощо) перевіряє сервер
        const local: Record<string, string> = {};
        if (!title.trim()) local.title = "Вкажіть назву розділу";
        if (!HEX_RE.test(accent)) local.accent = "Колір у форматі #RRGGBB";
        if (Object.keys(local).length > 0) {
            setFieldErrors(local);
            return;
        }

        const input = buildInput();
        if (initial && Object.keys(input).length === 0) {
            onCancel(); // нічого не змінено
            return;
        }

        setIsSaving(true);
        try {
            await onSubmit(input);
        } catch (error) {
            if (error instanceof AdminValidationError) {
                const byField: Record<string, string> = {};
                const rest: string[] = [];
                for (const issue of error.issues) {
                    if (["title", "subtitle", "cover", "accent", "level", "slug", "published"].includes(issue.path)) {
                        byField[issue.path] = issue.message;
                    } else {
                        rest.push(`${issue.path}: ${issue.message}`);
                    }
                }
                setFieldErrors(byField);
                if (rest.length > 0) setFormError(rest.join("; "));
            } else {
                setFormError(adminErrorMessage(error));
            }
        } finally {
            setIsSaving(false);
        }
    };

    const levelChanged = !!initial && level !== initial.level;
    const slugChanged = !!initial && slug.trim() !== "" && slug.trim() !== initial.slug;

    return (
        <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
            {/* Живе прев'ю картки, як її побачить юзер */}
            <div className="flex items-center gap-4 rounded-3xl border border-[var(--border-color)] bg-[var(--bg-card)] p-4">
                <div
                    className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl text-4xl"
                    style={{ backgroundColor: `color-mix(in srgb, ${HEX_RE.test(accent) ? accent : "#888888"} 22%, transparent)` }}
                    aria-hidden="true"
                >
                    {cover || "📖"}
                </div>
                <div className="min-w-0">
                    <p className="truncate text-lg font-extrabold">{title || "Назва розділу"}</p>
                    <p className="line-clamp-2 text-sm text-[var(--text-muted)]">{subtitle || "Короткий опис"}</p>
                    <p className="mt-1 text-xs font-bold" style={{ color: HEX_RE.test(accent) ? accent : undefined }}>
                        {level}
                    </p>
                </div>
            </div>

            <Field label="Назва *" htmlFor="chapter-title" error={fieldErrors.title}>
                <input
                    id="chapter-title"
                    className={inputClass}
                    value={title}
                    maxLength={60}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Перша кава"
                    autoFocus={!initial}
                />
            </Field>

            <Field label="Підзаголовок" htmlFor="chapter-subtitle" error={fieldErrors.subtitle}>
                <input
                    id="chapter-subtitle"
                    className={inputClass}
                    value={subtitle}
                    maxLength={140}
                    onChange={(e) => setSubtitle(e.target.value)}
                    placeholder="Знайомство і замовлення в кав'ярні"
                />
            </Field>

            <Field label="Рівень *" htmlFor="chapter-level" error={fieldErrors.level}
                hint={levelChanged ? "Розділ переїде в кінець ланцюжка нового рівня." : undefined}>
                <div id="chapter-level" role="radiogroup" aria-label="Рівень" className="flex flex-wrap gap-2">
                    {LEVELS.map((item) => (
                        <button
                            key={item}
                            type="button"
                            role="radio"
                            aria-checked={level === item}
                            onClick={() => setLevel(item)}
                            className={`rounded-xl border-2 px-4 py-2 font-extrabold transition-colors ${level === item
                                    ? "border-[var(--accent-cta)] bg-[var(--accent-cta)]/15"
                                    : "border-[var(--border-color)] bg-[var(--bg-card)]"
                                }`}
                        >
                            {item}
                        </button>
                    ))}
                </div>
            </Field>

            <Field label="Обкладинка (емодзі)" htmlFor="chapter-cover" error={fieldErrors.cover}>
                <div className="flex flex-wrap items-center gap-2">
                    <input
                        id="chapter-cover"
                        className={`${inputClass} w-20 text-center text-2xl`}
                        value={cover}
                        maxLength={16}
                        onChange={(e) => setCover(e.target.value)}
                    />
                    {COVER_PRESETS.map((emoji) => (
                        <button
                            key={emoji}
                            type="button"
                            onClick={() => setCover(emoji)}
                            aria-label={`Обкладинка ${emoji}`}
                            className={`h-10 w-10 rounded-xl text-xl ${cover === emoji ? "bg-[var(--accent-cta)]/25" : "bg-[var(--bg-card)]"}`}
                        >
                            {emoji}
                        </button>
                    ))}
                </div>
            </Field>

            <Field label="Колір акценту" htmlFor="chapter-accent" error={fieldErrors.accent}>
                <div className="flex flex-wrap items-center gap-2">
                    <input
                        type="color"
                        aria-label="Вибрати колір"
                        value={HEX_RE.test(accent) && accent.length === 7 ? accent : "#e8a33d"}
                        onChange={(e) => setAccent(e.target.value.toUpperCase())}
                        className="h-11 w-11 cursor-pointer rounded-xl border-2 border-[var(--border-color)] bg-transparent"
                    />
                    <input
                        id="chapter-accent"
                        className={`${inputClass} w-32 font-mono`}
                        value={accent}
                        maxLength={7}
                        onChange={(e) => setAccent(e.target.value)}
                    />
                    {ACCENT_PRESETS.map((color) => (
                        <button
                            key={color}
                            type="button"
                            onClick={() => setAccent(color)}
                            aria-label={`Колір ${color}`}
                            className={`h-8 w-8 rounded-full border-2 ${accent.toUpperCase() === color ? "border-[var(--text-main)]" : "border-transparent"}`}
                            style={{ backgroundColor: color }}
                        />
                    ))}
                </div>
            </Field>

            <Field
                label="Slug (адреса розділу)"
                htmlFor="chapter-slug"
                error={fieldErrors.slug}
                hint={
                    slugChanged
                        ? "Увага: зміниться адреса розділу — старі посилання перестануть працювати."
                        : initial
                            ? `Адреса: /learning/${initial.slug}`
                            : "Залиште порожнім — згенерується з назви (напр. persha-kava)."
                }
            >
                <input
                    id="chapter-slug"
                    className={`${inputClass} font-mono`}
                    value={slug}
                    maxLength={60}
                    onChange={(e) => setSlug(e.target.value.toLowerCase())}
                    placeholder="persha-kava"
                    autoCapitalize="off"
                    autoCorrect="off"
                    spellCheck={false}
                />
            </Field>

            {formError && (
                <p role="alert" className="text-sm font-semibold text-[var(--accent-error)]">
                    {formError}
                </p>
            )}

            <div className="flex flex-wrap justify-end gap-2 pt-2">
                <Button type="button" variant="ghost" onClick={onCancel} disabled={isSaving}>
                    Скасувати
                </Button>
                <Button type="submit" isLoading={isSaving}>
                    {submitLabel}
                </Button>
            </div>
        </form>
    );
};