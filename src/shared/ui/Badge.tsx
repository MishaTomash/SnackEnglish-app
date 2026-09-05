import type { ReactNode } from "react";

interface BadgeProps {
  children: ReactNode;
  className?: string;
}

export const Badge = ({ children, className = "" }: BadgeProps) => {
  return (
    <span
      className={`inline-flex items-center justify-center px-2 py-1 text-xs font-bold rounded-full bg-[var(--accent-cta)] text-[var(--text-accent)] ${className}`}
    >
      {children}
    </span>
  );
};
