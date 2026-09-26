// 📁 Файл: SnackEnglish-app/src/features/story-admin/ui/visual/fields.tsx
import { useId, useRef } from "react";
import type { FC, ReactNode } from "react";
import { speak } from "../../../../shared/lib/speech";

/**
 * Поля форм візуального редактора уроків. Однаковий вигляд і поведінка,
 * щоб редагувати уроки можна було без знання JSON.
 */

export const inputClass =
    "w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-app)] px-3 py-2 text-sm text-[var(--text-main)] placeholder:text-[var(--text-muted)]/70 focus:border-[var(--accent-cta)] focus:outline-none";

const stripMarkup = (value: string): string => value.replace(/<[^>]*>/g, "").trim();

/** Підпис поля з підказкою */
export const Field: FC<{ label: string; hint?: string; htmlFor?: string; children: ReactNode; required?: boolean }> = ({
    label,
    hint,
    htmlFor,
    children,
    required,
}) => (
    <div className="min-w-0">
        <label htmlFor={htmlFor} className="mb-1 block text-xs font-bold text-[var(--text-muted)]">
            {label}
            {required && <span className="text-[var(--accent-error)]"> *</span>}
        </label>
        {children}
        {hint && <p className="mt-1 text-[11px] leading-snug text-[var(--text-muted)]">{hint}</p>}
    </div>
);

/** Кнопка "прослухати" (голос телефона — безкоштовно, для швидкої перевірки) */
export const SpeakButton: FC<{ text: string }> = ({ text }) => {
    const clean = stripMarkup(text);
    return (
        <button
            type="button"
            onClick={() => void speak(clean)}
            disabled={!clean}
            aria-label="Прослухати"
            title="Прослухати"
            className="shrink-0 rounded-lg px-2 py-1 text-sm hover:bg-[var(--bg-card-elevated)] disabled:opacity-30"
        >
            🔊
        </button>
    );
};

interface TextFieldProps {
    label: string;
    value: string | undefined;
    onChange: (value: string) => void;
    placeholder?: string;
    hint?: string;
    required?: boolean;
    /** Англійський текст — показати кнопку "прослухати" */
    english?: boolean;
    maxLength?: number;
}

export const TextField: FC<TextFieldProps> = ({ label, value, onChange, placeholder, hint, required, english, maxLength }) => {
    const id = useId();
    return (
        <Field label={label} hint={hint} htmlFor={id} required={required}>
            <div className="flex items-center gap-1">
                <input
                    id={id}
                    value={value ?? ""}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={placeholder}
                    maxLength={maxLength}
                    lang={english ? "en" : "uk"}
                    spellCheck={english}
                    className={inputClass}
                />
                {english && <SpeakButton text={value ?? ""} />}
            </div>
        </Field>
    );
};

interface RichTextFieldProps extends TextFieldProps {
    rows?: number;
}

/**
 * Текст із розміткою <en>…</en>. Виділи англійське слово й натисни "EN" —
 * воно стане "живим": у застосунку його можна натиснути й послухати.
 */
export const RichTextField: FC<RichTextFieldProps> = ({ label, value, onChange, placeholder, hint, required, english, rows = 2 }) => {
    const id = useId();
    const ref = useRef<HTMLTextAreaElement>(null);
    const text = value ?? "";

    const wrapSelection = () => {
        const area = ref.current;
        if (!area) return;
        const { selectionStart: start, selectionEnd: end } = area;
        const selected = text.slice(start, end);
        if (!selected.trim()) {
            area.focus();
            return;
        }
        const next = `${text.slice(0, start)}<en>${selected}</en>${text.slice(end)}`;
        onChange(next);
        requestAnimationFrame(() => {
            area.focus();
            area.setSelectionRange(end + 9, end + 9);
        });
    };

    return (
        <Field
            label={label}
            required={required}
            htmlFor={id}
            hint={hint ?? "Виділи англійське слово й натисни EN — його можна буде натиснути й послухати."}
        >
            <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-app)] focus-within:border-[var(--accent-cta)]">
                <textarea
                    id={id}
                    ref={ref}
                    value={text}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={placeholder}
                    rows={rows}
                    lang={english ? "en" : "uk"}
                    className="block w-full resize-y rounded-t-xl bg-transparent px-3 py-2 text-sm text-[var(--text-main)] placeholder:text-[var(--text-muted)]/70 focus:outline-none"
                />
                <div className="flex items-center gap-1 border-t border-[var(--border-color)] px-1.5 py-1">
                    <button
                        type="button"
                        // mousedown, а не click: інакше поле втратить виділення до натискання
                        onMouseDown={(e) => {
                            e.preventDefault();
                            wrapSelection();
                        }}
                        onTouchEnd={(e) => {
                            e.preventDefault();
                            wrapSelection();
                        }}
                        // Клавіатура (Enter/Space): detail === 0 — це не клік мишею
                        onClick={(e) => {
                            if (e.detail === 0) wrapSelection();
                        }}
                        className="rounded-lg bg-[var(--accent-cta)]/15 px-2 py-0.5 text-xs font-extrabold text-[var(--accent-cta)]"
                        title="Позначити виділене як англійське"
                    >
                        EN
                    </button>
                    <span className="flex-1 truncate text-[10px] text-[var(--text-muted)]">
                        {text.includes("<en>") ? "✓ є англійські слова" : ""}
                    </span>
                    <SpeakButton text={english ? text : (text.match(/<en>([\s\S]*?)<\/en>/i)?.[1] ?? "")} />
                </div>
            </div>
        </Field>
    );
};

export const EmojiField: FC<{ label: string; value: string | undefined; onChange: (value: string) => void }> = ({
    label,
    value,
    onChange,
}) => {
    const id = useId();
    return (
        <Field label={label} htmlFor={id}>
            <input
                id={id}
                value={value ?? ""}
                onChange={(e) => onChange(e.target.value)}
                maxLength={16}
                placeholder="😀"
                className={`${inputClass} w-20 text-center text-lg`}
            />
        </Field>
    );
};

export const SelectField = <T extends string,>({
    label,
    value,
    options,
    onChange,
    hint,
}: {
    label: string;
    value: T | undefined;
    options: readonly { value: T; label: string }[];
    onChange: (value: T) => void;
    hint?: string;
}) => {
    const id = useId();
    return (
        <Field label={label} hint={hint} htmlFor={id}>
            <select id={id} value={value ?? ""} onChange={(e) => onChange(e.target.value as T)} className={inputClass}>
                {options.map((o) => (
                    <option key={o.value} value={o.value}>
                        {o.label}
                    </option>
                ))}
            </select>
        </Field>
    );
};

/** Маленькі кнопки керування елементом списку: вгору, вниз, видалити */
export const ItemControls: FC<{
    index: number;
    count: number;
    onMove: (from: number, to: number) => void;
    onRemove: (index: number) => void;
    minItems?: number;
    label: string;
}> = ({ index, count, onMove, onRemove, minItems = 0, label }) => (
    <div className="flex shrink-0 items-center gap-0.5">
        <button
            type="button"
            onClick={() => onMove(index, index - 1)}
            disabled={index === 0}
            aria-label={`${label}: вище`}
            className="h-7 w-7 rounded-lg text-xs text-[var(--text-muted)] hover:bg-[var(--bg-card-elevated)] disabled:opacity-25"
        >
            ▲
        </button>
        <button
            type="button"
            onClick={() => onMove(index, index + 1)}
            disabled={index === count - 1}
            aria-label={`${label}: нижче`}
            className="h-7 w-7 rounded-lg text-xs text-[var(--text-muted)] hover:bg-[var(--bg-card-elevated)] disabled:opacity-25"
        >
            ▼
        </button>
        <button
            type="button"
            onClick={() => onRemove(index)}
            disabled={count <= minItems}
            aria-label={`${label}: видалити`}
            className="h-7 w-7 rounded-lg text-xs text-[var(--text-muted)] hover:bg-[var(--accent-error)]/15 hover:text-[var(--accent-error)] disabled:opacity-25"
        >
            ✕
        </button>
    </div>
);

export const AddButton: FC<{ onClick: () => void; children: ReactNode }> = ({ onClick, children }) => (
    <button
        type="button"
        onClick={onClick}
        className="w-full rounded-xl border border-dashed border-[var(--border-color)] py-2 text-xs font-bold text-[var(--text-muted)] hover:border-[var(--accent-cta)] hover:text-[var(--accent-cta)]"
    >
        + {children}
    </button>
);

// ==================== СПИСКИ ====================

export const moveItem = <T,>(list: readonly T[], from: number, to: number): T[] => {
    if (to < 0 || to >= list.length) return [...list];
    const next = [...list];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    return next;
};

export const replaceItem = <T,>(list: readonly T[], index: number, item: T): T[] =>
    list.map((existing, i) => (i === index ? item : existing));

export const removeItem = <T,>(list: readonly T[], index: number): T[] => list.filter((_, i) => i !== index);