interface ProgressBarProps {
  progress: number; // 0-100
  className?: string;
}

export const ProgressBar = ({ progress, className = "" }: ProgressBarProps) => {
  const clampedProgress = Math.max(0, Math.min(100, progress));

  return (
    <div
      className={`w-full h-3 bg-[#4A3B31] rounded-full overflow-hidden ${className}`}
    >
      <div
        className="h-full bg-[#7ED9A9] transition-all duration-300 rounded-full"
        style={{ width: `${clampedProgress}%` }}
      />
    </div>
  );
};
