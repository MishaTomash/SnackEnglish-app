import { forwardRef } from "react";
import type { ButtonHTMLAttributes } from "react";

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "outline"
  | "ghost"
  | "danger";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    "bg-[var(--accent-cta)] text-[var(--text-accent)] border-b-4 border-[var(--accent-cta-active)] hover:bg-[var(--accent-cta-hover)] active:border-b-0 active:translate-y-1",
  secondary:
    "bg-[var(--bg-card)] text-[var(--text-main)] border-b-4 border-[var(--border-color)] hover:bg-[var(--bg-card-elevated)] active:border-b-0 active:translate-y-1",
  outline:
    "border-2 border-[var(--accent-cta)] text-[var(--accent-cta)] hover:bg-[var(--accent-cta)]/10 active:bg-[var(--accent-cta)]/20 active:translate-y-0.5",
  ghost:
    "text-[var(--text-muted)] hover:bg-[var(--bg-card-hover)]/50 active:scale-95",
  danger:
    "bg-[var(--accent-error)] text-[var(--text-main)] border-b-4 border-[var(--accent-error-hover)] hover:bg-[var(--accent-error-hover)] active:border-b-0 active:translate-y-1",
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: "px-4 py-2 text-sm rounded-xl",
  md: "px-6 py-3 text-base rounded-2xl font-bold",
  lg: "px-8 py-4 text-lg font-extrabold rounded-3xl",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "primary",
      size = "md",
      isLoading = false,
      disabled,
      className = "",
      children,
      ...props
    },
    ref,
  ) => {
    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={`inline-flex items-center justify-center transition-all focus:outline-none disabled:opacity-50 disabled:pointer-events-none ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
        {...props}
      >
        {isLoading && (
          <span className="inline-block w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
        )}
        {children}
      </button>
    );
  },
);
Button.displayName = "Button";
