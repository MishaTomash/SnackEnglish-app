import { forwardRef } from "react";
import type { ButtonHTMLAttributes } from "react";

/**
 * available — слово в банку, можна взяти
 * placed    — слово вже в рядку відповіді (клік повертає його в банк)
 * used      — "тінь" у банку на місці взятого слова: зберігає ширину,
 *             щоб решта чипів не стрибала
 */
export type WordChipVariant = "available" | "placed" | "used";

export interface WordChipProps
    extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
    word: string;
    variant?: WordChipVariant;
}

const variantStyles: Record<WordChipVariant, string> = {
    available:
        "bg-[var(--bg-card)] text-[var(--text-main)] border-2 border-b-4 border-[var(--border-color)] hover:bg-[var(--bg-card-elevated)] active:border-b-2 active:translate-y-0.5",
    placed:
        "bg-[var(--accent-cta)] text-[var(--text-accent)] border-2 border-b-4 border-[var(--accent-cta-active)] hover:bg-[var(--accent-cta-hover)] active:border-b-2 active:translate-y-0.5",
    used:
        "bg-[var(--bg-card-hover)]/30 text-transparent border-2 border-b-4 border-dashed border-[var(--border-color)] pointer-events-none",
};

export const WordChip = forwardRef<HTMLButtonElement, WordChipProps>(
    ({ word, variant = "available", disabled, className = "", ...props }, ref) => {
        const isUsed = variant === "used";

        return (
            <button
                ref={ref}
                type="button"
                disabled={disabled || isUsed}
                // Тінь не читається скрінрідером і не отримує фокус
                aria-hidden={isUsed || undefined}
                tabIndex={isUsed ? -1 : undefined}
                className={`inline-flex items-center justify-center px-4 py-2 rounded-xl text-base font-bold leading-tight select-none transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-cta)] ${isUsed ? "" : "disabled:opacity-50 disabled:pointer-events-none"
                    } ${variantStyles[variant]} ${className}`}
                {...props}
            >
                {word}
            </button>
        );
    },
);

WordChip.displayName = "WordChip";