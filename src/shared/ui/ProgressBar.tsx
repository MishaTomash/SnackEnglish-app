interface ProgressBarProps {
  progress: number; // 0-100
  className?: string;
}

export const ProgressBar = ({ progress, className = "" }: ProgressBarProps) => {
  const clampedProgress = Math.max(0, Math.min(100, progress));

  return (
    <div
      className={`w-full h-3 bg-[var(--tg-theme-secondary-bg-color,#f4f4f5)] rounded-full overflow-hidden ${className}`}
    >
      <div
        className="h-full bg-[var(--tg-theme-button-color,#3390ec)] transition-all duration-300 rounded-full"
        style={{ width: `${clampedProgress}%` }}
      />
    </div>
  );
};
