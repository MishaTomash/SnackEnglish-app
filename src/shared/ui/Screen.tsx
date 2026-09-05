import type { ReactNode } from "react";

interface ScreenProps {
  children: ReactNode;
  className?: string;
}

export const Screen = ({ children, className = "" }: ScreenProps) => {
  return (
    <div
      className={`min-h-screen px-4 pt-4 pb-[calc(85px+env(safe-area-inset-bottom))] flex flex-col bg-[var(--tg-theme-bg-color)] text-[var(--tg-theme-text-color)] ${className}`}
    >
      {children}
    </div>
  );
};
