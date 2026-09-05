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
    "bg-blue-500 text-white border-b-4 border-blue-700 hover:bg-blue-400 active:border-b-0 active:translate-y-1",
  secondary:
    "bg-amber-100 text-amber-800 border-b-4 border-amber-300 hover:bg-amber-50 active:border-b-0 active:translate-y-1",
  outline:
    "border-2 border-slate-200 text-slate-500 hover:bg-slate-50 active:bg-slate-100 active:translate-y-0.5",
  ghost: "text-slate-500 hover:bg-slate-100 active:scale-95",
  danger:
    "bg-red-500 text-white border-b-4 border-red-700 hover:bg-red-400 active:border-b-0 active:translate-y-1",
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
