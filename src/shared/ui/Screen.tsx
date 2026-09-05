// src/shared/ui/Screen.tsx
import type { ReactNode } from "react";

interface ScreenProps {
  children: ReactNode;
  className?: string;
  fullBleed?: boolean;
}

export const Screen = ({
  children,
  className = "",
  fullBleed = false,
}: ScreenProps) => {
  return (
    <div
      className={`min-h-[var(--tg-viewport-stable-height,100dvh)] w-full ${
        fullBleed ? "" : "px-4"
      } pt-4 pb-[calc(85px+env(safe-area-inset-bottom))] flex flex-col bg-[var(--tg-theme-bg-color)] text-[var(--tg-theme-text-color)] overflow-x-hidden ${className}`}
    >
      {children}
    </div>
  );
};
