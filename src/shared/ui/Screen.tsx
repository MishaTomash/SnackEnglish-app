import type { ReactNode } from "react";

interface ScreenProps {
  children: ReactNode;
  className?: string;
}

export const Screen = ({ children, className = "" }: ScreenProps) => {
  return (
    <div
      className={`min-h-screen pb-[80px] px-4 pt-4 flex flex-col ${className}`}
    >
      {children}
    </div>
  );
};
