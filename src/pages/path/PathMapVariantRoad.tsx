// src/pages/PathMapPage/PathMapVariantRoad.tsx
import { useMemo, useState, useEffect } from "react";
import {
  CheckIcon,
  Cloud,
  Lock,
  TreePine,
  Star,
  Handshake,
  Coffee,
  MessageCircle,
  Dumbbell,
  Apple,
} from "lucide-react";
import type { Unit } from "../../entities/unit/types";
import { hapticLockedNode } from "../../shared/lib/telegramHaptics";
import { CookieMascot } from "../../shared/ui/CookieMascot";

interface VariantProps {
  units: Unit[];
  currentUnitId: string | null;
  onSelectUnit: (unitId: string) => void;
}

const NODE_SIZE = 72;
const ROW_HEIGHT = 152;
const CANVAS_WIDTH = 340;
const CENTER_X = CANVAS_WIDTH / 2;
const TOP_PADDING = 140;

const getUnitId = (u: Unit) =>
  u.id || (u as unknown as { _id?: string })._id || "";
const getStatus = (u: Unit) => u.status ?? "locked";

const seededOffset = (i: number) => {
  const seed = Math.sin(i * 12.9898) * 43758.5453;
  return seed - Math.floor(seed);
};

const buildTrailPath = (points: { x: number; y: number }[]) => {
  if (points.length < 2) return "";
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i];
    const p1 = points[i + 1];
    const midY = (p0.y + p1.y) / 2;
    d += ` C ${p0.x} ${midY}, ${p1.x} ${midY}, ${p1.x} ${p1.y}`;
  }
  return d;
};

const DECORATIONS = [Cloud, TreePine, Cloud, TreePine, TreePine, Cloud];
const CHAPTER_SIZE = 5;

// Словник іконок для тем
const ICON_MAP: Record<string, React.ElementType> = {
  Handshake,
  Coffee,
  MessageCircle,
  Dumbbell,
  Apple,
  Star, // фоллбек за замовчуванням
};

export const PathMapVariantRoad = ({
  units,
  currentUnitId,
  onSelectUnit,
}: VariantProps) => {
  const [shakeId, setShakeId] = useState<string | null>(null);

  const points = useMemo(
    () =>
      units.map((_, i) => {
        const wave = Math.sin(i * 0.9) * 0.6 + (seededOffset(i) - 0.5) * 0.5;
        const amplitude = 96;
        return {
          x: CENTER_X + wave * amplitude,
          y: ROW_HEIGHT * i + ROW_HEIGHT / 2 + TOP_PADDING,
        };
      }),
    [units.length],
  );

  const pathD = useMemo(() => buildTrailPath(points), [points]);
  const canvasHeight = Math.max(
    units.length * ROW_HEIGHT + TOP_PADDING + 80,
    ROW_HEIGHT + TOP_PADDING,
  );

  useEffect(() => {
    if (currentUnitId && units.length > 0) {
      const timer = setTimeout(() => {
        const activeNode = document.getElementById(`unit-${currentUnitId}`);
        if (activeNode) {
          activeNode.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [currentUnitId, units.length]);

  const handleLockedTap = (unitId: string) => {
    hapticLockedNode();
    setShakeId(unitId);
    setTimeout(() => setShakeId(null), 400);
  };

  return (
    <div
      className="relative w-full overflow-hidden"
      style={{
        backgroundColor: "var(--bg-app)",
        backgroundImage: `
          radial-gradient(120% 50% at 50% 0%, rgba(232, 163, 61, 0.12) 0%, transparent 60%),
          radial-gradient(rgba(201, 184, 168, 0.06) 1.5px, transparent 1.5px)
        `,
        backgroundSize: "100% 100%, 28px 28px",
        backgroundPosition: "0 0, 0 0",
      }}
    >
      <div
        className="relative mx-auto"
        style={{ width: CANVAS_WIDTH, height: canvasHeight }}
      >
        <style>{`
          @keyframes pm-shake {
            0%, 100% { transform: translateX(0); }
            20% { transform: translateX(-6px); }
            40% { transform: translateX(6px); }
            60% { transform: translateX(-4px); }
            80% { transform: translateX(4px); }
          }
          .pm-shake { animation: pm-shake 0.4s ease-in-out; }
          
          @keyframes pm-float {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-7px); }
          }
          .pm-float { animation: pm-float 2.4s ease-in-out infinite; }
          
          @keyframes pm-dash-flow {
            to { stroke-dashoffset: -24; }
          }
          
          @keyframes pm-ripple {
            0% { transform: scale(0.8); opacity: 0.8; }
            100% { transform: scale(1.8); opacity: 0; }
          }
          
          @keyframes pm-bounce-subtle {
            0%, 100% { transform: translateY(0) scale(1.1); }
            50% { transform: translateY(-4px) scale(1.1); }
          }
        `}</style>

        {units.map((_, i) => {
          if (i % 2 !== 0) return null;
          const Deco = DECORATIONS[i % DECORATIONS.length];
          const side = i % 4 === 0 ? -1 : 1;
          const px = points[i] ? points[i].x + side * 98 : 0;
          const py = points[i] ? points[i].y - 22 : 0;
          return (
            <Deco
              key={`deco-${i}`}
              className="absolute text-[var(--text-muted)] opacity-20 mix-blend-screen"
              style={{ left: px, top: py }}
              width={26}
              height={26}
              strokeWidth={1.5}
            />
          );
        })}

        {units.map((_, i) => {
          if (i % CHAPTER_SIZE !== 0) return null;
          const chapterNumber = Math.floor(i / CHAPTER_SIZE) + 1;
          const py = points[i] ? points[i].y - 62 : 0;
          return (
            <div
              key={`chapter-${i}`}
              className="absolute left-1/2 -translate-x-1/2 px-6 py-1.5 w-fit whitespace-nowrap text-center rounded-full bg-[var(--bg-card-elevated)] border border-[var(--border-color)] text-[var(--text-main)] text-[12px] font-bold tracking-wide shadow-md z-10"
              style={{ top: py }}
            >
              Розділ {chapterNumber}
            </div>
          );
        })}

        <svg
          className="absolute inset-0"
          width={CANVAS_WIDTH}
          height={canvasHeight}
          viewBox={`0 0 ${CANVAS_WIDTH} ${canvasHeight}`}
        >
          <path
            d={pathD}
            fill="none"
            stroke="rgba(0,0,0,0.25)"
            strokeWidth={26}
            strokeLinecap="round"
            transform="translate(0, 6)"
          />
          <path
            d={pathD}
            fill="none"
            stroke="var(--bg-card-hover)"
            strokeWidth={18}
            strokeLinecap="round"
          />
          <path
            d={pathD}
            fill="none"
            stroke="var(--accent-cta)"
            strokeOpacity={0.85}
            strokeWidth={4}
            strokeDasharray="1 11"
            strokeLinecap="round"
            style={{ animation: "pm-dash-flow 1s linear infinite" }}
          />
        </svg>

        {units.map((unit, i) => {
          const unitId = getUnitId(unit);
          const status = getStatus(unit);
          const isCompleted = status === "completed";
          const isAvailable = status === "available";
          const isLocked = status === "locked";
          const isCurrent = unitId === currentUnitId && isAvailable;
          const { x, y } = points[i];

          // Визначаємо тематичну іконку
          const ThemeIcon =
            unit.icon && ICON_MAP[unit.icon] ? ICON_MAP[unit.icon] : Star;

          return (
            <div
              key={unitId || i}
              id={`unit-${unitId}`}
              className="absolute flex flex-col items-center z-10 scroll-m-24"
              style={{
                left: x - NODE_SIZE / 2,
                top: y - NODE_SIZE / 2,
                width: NODE_SIZE,
                height: NODE_SIZE,
              }}
            >
              {isCurrent && (
                <div className="absolute bottom-[85%] left-1/2 -translate-x-1/2 mb-3 flex flex-col items-center gap-1.5 pm-float pointer-events-none z-20">
                  <div className="relative w-fit whitespace-nowrap px-3 py-1.5 rounded-xl bg-[var(--accent-cta)] text-[var(--text-accent)] text-[12px] font-bold shadow-lg">
                    Уперед! 🍪
                    <div className="absolute left-1/2 -bottom-1 -translate-x-1/2 w-3 h-3 rotate-45 bg-[var(--accent-cta)] -z-10" />
                  </div>
                  <CookieMascot state="celebrating" size={60} />
                </div>
              )}

              <button
                onClick={() =>
                  isLocked ? handleLockedTap(unitId) : onSelectUnit(unitId)
                }
                className={`relative flex items-center justify-center rounded-2xl w-full h-full transition-all duration-300 ${
                  shakeId === unitId ? "pm-shake" : ""
                } ${
                  isCurrent
                    ? "pm-bounce-subtle z-10"
                    : "hover:scale-105 active:scale-95"
                }`}
              >
                {isCurrent && (
                  <>
                    <div
                      className="absolute inset-0 rounded-2xl bg-[var(--accent-cta)]"
                      style={{
                        animation:
                          "pm-ripple 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
                      }}
                    />
                    <div
                      className="absolute inset-0 rounded-2xl bg-[var(--accent-cta)]"
                      style={{
                        animation:
                          "pm-ripple 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
                        animationDelay: "1s",
                      }}
                    />
                  </>
                )}

                <div
                  className={`relative w-full h-full rounded-2xl flex items-center justify-center transition-all ${
                    isCompleted || isCurrent
                      ? "bg-[var(--accent-cta)] border-b-[6px] border-[var(--accent-cta-active)] text-[var(--text-accent)] shadow-lg"
                      : "bg-[var(--bg-card-hover)] border-[1px] border-[var(--border-color)] text-[var(--text-muted)] shadow-[inset_0_4px_12px_rgba(0,0,0,0.5)]"
                  }`}
                >
                  <ThemeIcon
                    className={`w-7 h-7 transition-all ${isLocked ? "opacity-30" : "opacity-100 drop-shadow-md"}`}
                    strokeWidth={isCurrent ? 2.5 : 2}
                  />

                  {/* Оверлей замка для заблокованих юнітів */}
                  {isLocked && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Lock
                        className="w-5 h-5 text-[var(--text-main)] drop-shadow-md"
                        strokeWidth={2.5}
                      />
                    </div>
                  )}
                </div>

                {isCompleted && (
                  <span className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-[var(--bg-card-elevated)] shadow-md border-2 border-[var(--border-color)] flex items-center justify-center z-10">
                    <CheckIcon
                      className="w-4 h-4 text-[var(--accent-success)]"
                      strokeWidth={4}
                    />
                  </span>
                )}
              </button>

              <span
                className={`absolute top-full mt-2 text-[11px] font-semibold text-center w-[120px] left-1/2 -translate-x-1/2 leading-tight line-clamp-2 ${
                  isLocked
                    ? "text-[var(--text-muted)] opacity-60"
                    : isCurrent
                      ? "text-[var(--accent-cta)] drop-shadow-sm"
                      : "text-[var(--text-main)]"
                }`}
              >
                {unit.title}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
