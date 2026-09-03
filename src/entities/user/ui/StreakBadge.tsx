import React from "react";

interface StreakBadgeProps {
  streak: number;
  className?: string;
}

export const StreakBadge: React.FC<StreakBadgeProps> = ({
  streak,
  className = "",
}) => {
  return (
    <div
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-100 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 font-bold text-sm shadow-cookie-sm ${className}`}
    >
      {/* SVG надкушеного печива */}
      <svg
        className="w-5 h-5 shrink-0"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M12 2C6.477 2 2 6.477 2 12C2 17.523 6.477 22 12 22C17.523 22 22 17.523 22 12C22 11.5 21.6 10.8 21 10.8C20 10.8 19 9.8 19 8.8C19 7.8 19.8 7 19.8 6C19.8 5 18.8 4.2 17.8 4.5C16.8 4.8 15.8 4 15.8 3C15.8 2.2 15 2 14 2H12Z"
          fill="#D97706"
        />
        {/* Шоколадні крихти */}
        <circle cx="8" cy="9" r="1.2" fill="#451A03" />
        <circle cx="7.5" cy="15" r="1.2" fill="#451A03" />
        <circle cx="12.5" cy="17.5" r="1.2" fill="#451A03" />
        <circle cx="13" cy="12" r="1.5" fill="#451A03" />
      </svg>
      <span>{streak} days</span>
    </div>
  );
};
