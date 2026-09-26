// 📁 Файл: SnackEnglish-app/src/features/admin-panel/ui/primitives.tsx
import type { FC, ReactNode } from "react";
import { AlertTriangle, Loader2, RefreshCw } from "lucide-react";
import type { DailyPoint } from "../api";

/**
 * Базові елементи адмін-панелі. Кольори — з CSS-змінних застосунку (index.css),
 * тож панель виглядає як частина SnackEnglish, а не окремий сайт.
 */

// ==================== ФОРМАТУВАННЯ ====================

const numberFormat = new Intl.NumberFormat("uk-UA");

export const formatNumber = (value: number): string => numberFormat.format(value);

export const formatDateTime = (value: string | null | undefined): string => {
    if (!value) return "—";
    const date = new Date(value);
    return Number.isNaN(date.getTime())
        ? "—"
        : date.toLocaleString("uk-UA", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
};

/** "5 хв тому", "3 дн тому" — для останньої активності */
export const formatRelative = (value: string | null | undefined): string => {
    if (!value) return "ніколи";
    const diff = Date.now() - new Date(value).getTime();
    if (Number.isNaN(diff)) return "—";
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return "щойно";
    if (minutes < 60) return `${minutes} хв тому`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} год тому`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days} дн тому`;
    return formatDateTime(value);
};

export const formatDuration = (seconds: number): string => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (days > 0) return `${days} дн ${hours} год`;
    if (hours > 0) return `${hours} год ${minutes} хв`;
    return `${minutes} хв`;
};

// ==================== КОНТЕЙНЕРИ ====================

export const Section: FC<{ title: string; action?: ReactNode; children: ReactNode; className?: string }> = ({
    title,
    action,
    children,
    className = "",
}) => (
    <section className={`rounded-3xl border border-[var(--border-color)] bg-[var(--bg-card)] p-4 ${className}`}>
        <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-base font-extrabold text-[var(--text-main)]">{title}</h2>
            {action}
        </div>
        {children}
    </section>
);

export const StatCard: FC<{ label: string; value: string | number; hint?: string; accent?: "cta" | "success" | "error" }> = ({
    label,
    value,
    hint,
    accent,
}) => {
    const color =
        accent === "success"
            ? "text-[var(--accent-success)]"
            : accent === "error"
                ? "text-[var(--accent-error)]"
                : accent === "cta"
                    ? "text-[var(--accent-cta)]"
                    : "text-[var(--text-main)]";
    return (
        <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card-elevated)] p-3">
            <p className="text-xs font-semibold text-[var(--text-muted)]">{label}</p>
            <p className={`mt-1 text-2xl font-black leading-none ${color}`}>
                {typeof value === "number" ? formatNumber(value) : value}
            </p>
            {hint && <p className="mt-1 text-[11px] text-[var(--text-muted)]">{hint}</p>}
        </div>
    );
};

// ==================== КНОПКИ ТА ПОЛЯ ====================

type ButtonVariant = "primary" | "secondary" | "danger" | "success";

const BUTTON_STYLES: Record<ButtonVariant, string> = {
    primary: "bg-[var(--accent-cta)] text-[var(--text-accent)] hover:bg-[var(--accent-cta-hover)]",
    secondary:
        "border border-[var(--border-color)] bg-[var(--bg-card-elevated)] text-[var(--text-main)] hover:bg-[var(--bg-card-hover)]",
    danger: "bg-[var(--accent-error)] text-white hover:bg-[var(--accent-error-hover)]",
    success: "bg-[var(--accent-success)] text-[var(--text-accent)] hover:bg-[var(--accent-success-hover)]",
};

export const AdminButton: FC<{
    children: ReactNode;
    onClick?: () => void;
    variant?: ButtonVariant;
    disabled?: boolean;
    loading?: boolean;
    className?: string;
    type?: "button" | "submit";
}> = ({ children, onClick, variant = "primary", disabled, loading, className = "", type = "button" }) => (
    <button
        type={type}
        onClick={onClick}
        disabled={disabled || loading}
        className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-cta)] disabled:cursor-not-allowed disabled:opacity-50 ${BUTTON_STYLES[variant]} ${className}`}
    >
        {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
        {children}
    </button>
);

export const fieldClass =
    "w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-app)] px-3 py-2 text-sm text-[var(--text-main)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent-cta)] focus:outline-none";

/** Перемикач-сегменти (період, фільтр статусу) */
export const Segmented = <T extends string | number,>({
    value,
    options,
    onChange,
}: {
    value: T;
    options: { value: T; label: string }[];
    onChange: (value: T) => void;
}) => (
    <div className="flex flex-wrap gap-1 rounded-xl bg-[var(--bg-app)] p-1">
        {options.map((option) => (
            <button
                key={String(option.value)}
                type="button"
                onClick={() => onChange(option.value)}
                aria-pressed={value === option.value}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${value === option.value
                        ? "bg-[var(--accent-cta)] text-[var(--text-accent)]"
                        : "text-[var(--text-muted)] hover:text-[var(--text-main)]"
                    }`}
            >
                {option.label}
            </button>
        ))}
    </div>
);

export const Pill: FC<{ children: ReactNode; tone?: "neutral" | "success" | "error" | "warning" }> = ({
    children,
    tone = "neutral",
}) => {
    const styles = {
        neutral: "bg-[var(--bg-app)] text-[var(--text-muted)]",
        success: "bg-[var(--accent-success)]/15 text-[var(--accent-success)]",
        error: "bg-[var(--accent-error)]/15 text-[var(--accent-error)]",
        warning: "bg-[var(--accent-cta)]/15 text-[var(--accent-cta)]",
    }[tone];
    return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold ${styles}`}>{children}</span>;
};

// ==================== СТАНИ ====================

export const LoadingState: FC<{ label?: string }> = ({ label = "Завантаження…" }) => (
    <div className="flex items-center justify-center gap-2 py-10 text-sm text-[var(--text-muted)]" role="status">
        <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
        {label}
    </div>
);

export const ErrorState: FC<{ message: string; onRetry?: () => void }> = ({ message, onRetry }) => (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-[var(--accent-error)]/40 bg-[var(--accent-error)]/10 p-4 text-center">
        <p className="flex items-center gap-2 text-sm font-semibold text-[var(--accent-error)]">
            <AlertTriangle className="h-4 w-4" aria-hidden="true" />
            {message}
        </p>
        {onRetry && (
            <AdminButton variant="secondary" onClick={onRetry}>
                <RefreshCw className="h-4 w-4" aria-hidden="true" /> Спробувати ще
            </AdminButton>
        )}
    </div>
);

export const EmptyState: FC<{ children: ReactNode }> = ({ children }) => (
    <p className="py-6 text-center text-sm text-[var(--text-muted)]">{children}</p>
);

/** Повідомлення про результат дії (успіх / помилка) */
export const Notice: FC<{ kind: "success" | "error"; children: ReactNode }> = ({ kind, children }) => (
    <p
        role="status"
        className={`rounded-xl px-3 py-2 text-sm font-semibold ${kind === "success"
                ? "bg-[var(--accent-success)]/15 text-[var(--accent-success)]"
                : "bg-[var(--accent-error)]/15 text-[var(--accent-error)]"
            }`}
    >
        {children}
    </p>
);

// ==================== ГРАФІКИ ====================

/**
 * Стовпчиковий графік по днях. Без сторонніх бібліотек — SVG тягнеться на всю ширину.
 * Підказка з датою й значенням — через title (довгий тап на телефоні).
 */
export const DailyBarChart: FC<{ points: DailyPoint[]; label: string; color?: string }> = ({
    points,
    label,
    color = "var(--accent-cta)",
}) => {
    const max = Math.max(1, ...points.map((p) => p.value));
    const total = points.reduce((sum, p) => sum + p.value, 0);
    const width = 100;
    const height = 40;
    const gap = points.length > 45 ? 0.2 : 0.6;
    const barWidth = Math.max(0.4, width / points.length - gap);
    const first = points[0]?.date.slice(5) ?? "";
    const last = points[points.length - 1]?.date.slice(5) ?? "";

    return (
        <figure>
            <figcaption className="mb-2 flex items-baseline justify-between text-xs">
                <span className="font-semibold text-[var(--text-muted)]">{label}</span>
                <span className="font-black text-[var(--text-main)]">
                    {formatNumber(total)} <span className="font-medium text-[var(--text-muted)]">за період</span>
                </span>
            </figcaption>
            <svg
                viewBox={`0 0 ${width} ${height}`}
                preserveAspectRatio="none"
                className="h-28 w-full"
                role="img"
                aria-label={`${label}: всього ${total}, максимум за день ${max}`}
            >
                {points.map((point, index) => {
                    const barHeight = (point.value / max) * (height - 1);
                    return (
                        <rect
                            key={point.date}
                            x={index * (width / points.length) + gap / 2}
                            y={height - barHeight}
                            width={barWidth}
                            height={Math.max(barHeight, point.value > 0 ? 0.6 : 0)}
                            rx={0.4}
                            fill={color}
                        >
                            <title>{`${point.date}: ${point.value}`}</title>
                        </rect>
                    );
                })}
            </svg>
            <div className="mt-1 flex justify-between text-[10px] text-[var(--text-muted)]">
                <span>{first}</span>
                <span>макс. {formatNumber(max)} / день</span>
                <span>{last}</span>
            </div>
        </figure>
    );
};

/** Горизонтальні смужки (розподіл за рівнями, воронка уроків) */
export const HorizontalBars: FC<{ rows: { label: string; value: number; hint?: string }[]; color?: string }> = ({
    rows,
    color = "var(--accent-cta)",
}) => {
    const max = Math.max(1, ...rows.map((r) => r.value));
    return (
        <ul className="space-y-2">
            {rows.map((row) => (
                <li key={row.label}>
                    <div className="mb-1 flex justify-between gap-2 text-xs">
                        <span className="truncate font-semibold text-[var(--text-main)]">{row.label}</span>
                        <span className="shrink-0 text-[var(--text-muted)]">
                            {formatNumber(row.value)}
                            {row.hint ? ` · ${row.hint}` : ""}
                        </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-[var(--bg-app)]">
                        <div className="h-full rounded-full" style={{ width: `${(row.value / max) * 100}%`, backgroundColor: color }} />
                    </div>
                </li>
            ))}
        </ul>
    );
};