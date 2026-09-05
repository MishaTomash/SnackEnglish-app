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
    "bg-[#E8A33D] text-[#241812] border-b-4 border-[#C88A30] hover:bg-[#D69433] active:border-b-0 active:translate-y-1",
  secondary:
    "bg-[#33241A] text-[#F5E9DD] border-b-4 border-[#4A3B31] hover:bg-[#3D2B20] active:border-b-0 active:translate-y-1",
  outline:
    "border-2 border-[#E8A33D] text-[#E8A33D] hover:bg-[#E8A33D]/10 active:bg-[#E8A33D]/20 active:translate-y-0.5",
  ghost: "text-[#C9B8A8] hover:bg-[#4A3B31]/50 active:scale-95",
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
