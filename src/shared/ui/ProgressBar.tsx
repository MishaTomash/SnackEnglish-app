interface ProgressBarProps {
  progress: number; // 0-100
  className?: string;
}

export const ProgressBar = ({ progress, className = "" }: ProgressBarProps) => {
  const clampedProgress = Math.max(0, Math.min(100, progress));

  return (
    <div
      className={`w-full h-3 bg-[var(--locked)] rounded-full overflow-hidden ${className}`}
    >
      <div
        className="h-full bg-[var(--accent-success)] transition-all duration-300 rounded-full"
        style={{ width: `${clampedProgress}%` }}
      />
    </div>
  );
};
