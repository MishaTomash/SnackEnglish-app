import { forwardRef } from "react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import styles from "../steps/lessonEffects.module.css";

export type OptionState = "idle" | "selected" | "correct" | "wrong";

export interface OptionButtonProps
    extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
    state?: OptionState;
    children: ReactNode;
}

const stateStyles: Record<OptionState, string> = {
    idle: "border-[var(--border-color)] bg-[var(--bg-card)] hover:bg-[var(--bg-card-elevated)]",
    selected: "border-[var(--accent-cta)] bg-[var(--accent-cta)]/10",
    correct: "border-[var(--accent-success)] bg-[var(--accent-success)]/15",
    wrong: `border-[var(--accent-error)] bg-[var(--accent-error)]/15 ${styles.shake}`,
};

/** Варіант відповіді для choice/reply/listen/quiz */
export const OptionButton = forwardRef<HTMLButtonElement, OptionButtonProps>(
    ({ state = "idle", disabled, className = "", children, ...props }, ref) => (
        <button
            ref={ref}
            type="button"
            disabled={disabled}
            aria-pressed={state === "selected" || undefined}
            className={`flex w-full items-center gap-3 rounded-2xl border-2 border-b-4 px-4 py-3 text-left text-base font-semibold text-[var(--text-main)] transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-cta)] active:translate-y-0.5 active:border-b-2 disabled:pointer-events-none ${
                // Приглушуємо лише "нейтральні" неактивні варіанти; результат лишається яскравим
                disabled && state === "idle" ? "opacity-50" : ""
                } ${stateStyles[state]} ${className}`}
            {...props}
        >
            {children}
        </button>
    ),
);

OptionButton.displayName = "OptionButton";