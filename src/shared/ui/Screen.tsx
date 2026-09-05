import type { ReactNode } from "react";

interface ScreenProps {
  children: ReactNode;
  className?: string;
}

export const Screen = ({ children, className = "" }: ScreenProps) => {
  return (
    <div
      className={`min-h-screen pb-[80px] px-4 pt-4 flex flex-col bg-[#241812] text-[#F5E9DD] ${className}`}
    >
      {children}
    </div>
  );
};
