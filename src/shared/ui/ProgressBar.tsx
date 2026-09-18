export type ProgressAccent = "success" | "amber" | "emerald" | "sky" | "rose";

interface ProgressBarProps {
  progress: number; // 0-100
  className?: string;
  accent?: ProgressAccent;
}

const accentClass: Record<ProgressAccent, string> = {
  success: "bg-[var(--accent-success)]",
  amber: "bg-amber-400",
  emerald: "bg-emerald-400",
  sky: "bg-sky-400",
  rose: "bg-rose-400",
};

export const ProgressBar = ({
  progress,
  className = "",
  accent = "success",
}: ProgressBarProps) => {
  const clampedProgress = Math.max(0, Math.min(100, progress));

  return (
    <div
      className={`w-full h-3 bg-[var(--locked)] rounded-full overflow-hidden ${className}`}
    >
      <div
        className={`h-full transition-all duration-300 rounded-full ${accentClass[accent]}`}
        style={{ width: `${clampedProgress}%` }}
      />
    </div>
  );
};
