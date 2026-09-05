import { forwardRef } from "react";
import type { HTMLAttributes } from "react";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  interactive?: boolean;
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ interactive = false, className = "", children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={`bg-[#33241A] text-[#F5E9DD] border border-[#4A3B31] rounded-3xl p-5 shadow-lg transition-all duration-200 ${
          interactive
            ? "hover:bg-[#3D2B20] hover:shadow-xl active:scale-[0.99] cursor-pointer"
            : ""
        } ${className}`}
        {...props}
      >
        {children}
      </div>
    );
  },
);

Card.displayName = "Card";
