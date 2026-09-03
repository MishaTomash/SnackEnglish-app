import React, { HTMLAttributes, forwardRef } from "react";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  interactive?: boolean;
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ interactive = false, className = "", children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={`bg-card text-cookieText-primary border border-card-border rounded-3xl p-5 shadow-cookie-sm transition-all duration-200 ${
          interactive
            ? "hover:bg-card-hover hover:shadow-cookie active:scale-[0.99] cursor-pointer"
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
