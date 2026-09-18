import { useId, useMemo } from "react";

interface DailyCookieProps {
  /** Скільки уроків завершено сьогодні. */
  eaten: number;
  /** Денна ціль. */
  total: number;
  size?: number;
  className?: string;
}

/**
 * Печиво, яке прогресивно "з'їдається": кожен завершений урок додає укус.
 * Коли ціль досягнута — замість печива лишаються крихти.
 */
export const DailyCookie = ({
  eaten,
  total,
  size = 100,
  className = "",
}: DailyCookieProps) => {
  const maskId = useId();
  const clamped = Math.max(0, Math.min(eaten, total));
  const done = total > 0 && clamped >= total;

  const bites = useMemo(() => {
    const TOTAL_BITES = 6;
    const shown = total > 0 ? Math.round((clamped / total) * TOTAL_BITES) : 0;
    const positions = [
      { cx: 16, cy: 22, r: 15 },
      { cx: 82, cy: 18, r: 13 },
      { cx: 14, cy: 68, r: 14 },
      { cx: 85, cy: 65, r: 15 },
      { cx: 50, cy: 10, r: 12 },
      { cx: 50, cy: 90, r: 13 },
    ];
    return positions.map((p, i) => ({ ...p, visible: i < shown }));
  }, [clamped, total]);

  return (
    <div
      className={`relative ${className}`}
      style={{ width: size, height: size }}
    >
      {!done ? (
        <svg viewBox="0 0 100 100" className="w-full h-full">
          <defs>
            <mask id={maskId}>
              <rect width="100" height="100" fill="white" />
              {bites.map((b, i) => (
                <circle
                  key={i}
                  cx={b.cx}
                  cy={b.cy}
                  r={b.r}
                  fill="black"
                  style={{
                    opacity: b.visible ? 1 : 0,
                    transition: "opacity 0.35s ease-out",
                  }}
                />
              ))}
            </mask>
          </defs>

          <g mask={`url(#${maskId})`}>
            <circle
              cx="50"
              cy="50"
              r="44"
              fill="#E09F3E"
              stroke="#B45309"
              strokeWidth="3.5"
            />
            <circle cx="48" cy="48" r="41" fill="#F4B251" />

            <circle cx="30" cy="32" r="3.5" fill="#582F0E" />
            <circle cx="72" cy="36" r="3" fill="#582F0E" />
            <circle cx="28" cy="66" r="3.5" fill="#582F0E" />
            <circle cx="70" cy="68" r="3" fill="#582F0E" />
            <circle cx="50" cy="24" r="2.5" fill="#582F0E" />

            <ellipse
              cx="34"
              cy="58"
              rx="4"
              ry="2.5"
              fill="#F87171"
              opacity="0.55"
            />
            <ellipse
              cx="66"
              cy="58"
              rx="4"
              ry="2.5"
              fill="#F87171"
              opacity="0.55"
            />

            {clamped === 0 ? (
              <>
                <path
                  d="M38 46C40 42 44 42 46 46"
                  stroke="#3D1A04"
                  strokeWidth="3"
                  strokeLinecap="round"
                  fill="none"
                />
                <path
                  d="M54 46C56 42 60 42 62 46"
                  stroke="#3D1A04"
                  strokeWidth="3"
                  strokeLinecap="round"
                  fill="none"
                />
                <path
                  d="M42 58C42 64 58 64 58 58"
                  stroke="#3D1A04"
                  strokeWidth="3"
                  strokeLinecap="round"
                  fill="none"
                />
              </>
            ) : (
              <>
                <circle cx="42" cy="45" r="3" fill="#3D1A04" />
                <circle cx="58" cy="45" r="3" fill="#3D1A04" />
                <path
                  d="M43 60Q50 65 57 60"
                  stroke="#3D1A04"
                  strokeWidth="3"
                  strokeLinecap="round"
                  fill="none"
                />
              </>
            )}
          </g>
        </svg>
      ) : (
        <svg viewBox="0 0 100 100" className="w-full h-full">
          <circle cx="30" cy="55" r="4" fill="#E09F3E" />
          <circle cx="42" cy="68" r="3" fill="#F4B251" />
          <circle cx="55" cy="60" r="3.5" fill="#E09F3E" />
          <circle cx="65" cy="72" r="2.5" fill="#F4B251" />
          <circle cx="48" cy="48" r="2" fill="#582F0E" />
          <circle cx="60" cy="55" r="1.5" fill="#582F0E" />
          <circle cx="35" cy="72" r="1.5" fill="#582F0E" />
          <text x="12" y="30" fontSize="14" fill="#F59E0B">
            ✨
          </text>
          <text x="76" y="28" fontSize="12" fill="#F59E0B">
            ✨
          </text>
        </svg>
      )}
    </div>
  );
};
