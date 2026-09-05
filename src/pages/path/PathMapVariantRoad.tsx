import { useMemo, useState } from "react";
import { CheckIcon, Cloud, Lock, TreePine, Sparkles } from "lucide-react";
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
const TOP_PADDING = 140; // Гарантований відступ зверху, щоб обійти системний хедер

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
          // Додано TOP_PADDING до Y-координати для відступу згори
          y: ROW_HEIGHT * i + ROW_HEIGHT / 2 + TOP_PADDING,
        };
      }),
    [units.length],
  );

  const pathD = useMemo(() => buildTrailPath(points), [points]);
  // Враховуємо новий паддінг у розрахунку загальної висоти
  const canvasHeight = Math.max(
    units.length * ROW_HEIGHT + TOP_PADDING + 80,
    ROW_HEIGHT + TOP_PADDING,
  );

  const handleLockedTap = (unitId: string) => {
    hapticLockedNode();
    setShakeId(unitId);
    setTimeout(() => setShakeId(null), 400);
  };

  return (
    <div
      className="relative w-full overflow-hidden" // Outer wrapper: 100% width
      style={{
        background:
          "radial-gradient(120% 40% at 50% 0%, rgba(232, 163, 61, 0.08) 0%, rgba(232, 163, 61, 0.02) 45%, transparent 70%)," +
          "linear-gradient(180deg, rgba(51, 36, 26, 0.3) 0%, transparent 260px)",
      }}
    >
      {/* Inner wrapper: Centered canvas for exact roadmap calculations */}
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
          @keyframes pm-glow {
            0%, 100% { box-shadow: 0 0 0 0 rgba(232, 163, 61, 0.3); }
            70% { box-shadow: 0 0 0 12px rgba(232, 163, 61, 0); }
          }
          .pm-glow { animation: pm-glow 2s ease-out infinite; }
        `}</style>

        {/* Декорації ландшафту */}
        {units.map((_, i) => {
          if (i % 2 !== 0) return null;
          const Deco = DECORATIONS[i % DECORATIONS.length];
          const side = i % 4 === 0 ? -1 : 1;
          const px = points[i] ? points[i].x + side * 98 : 0;
          const py = points[i] ? points[i].y - 22 : 0;
          return (
            <Deco
              key={`deco-${i}`}
              className="absolute text-[var(--text-muted)] opacity-20"
              style={{ left: px, top: py }}
              width={26}
              height={26}
              strokeWidth={1.5}
            />
          );
        })}

        {/* Банери розділів: w-fit, whitespace-nowrap */}
        {units.map((_, i) => {
          if (i % CHAPTER_SIZE !== 0) return null;
          const chapterNumber = Math.floor(i / CHAPTER_SIZE) + 1;
          const py = points[i] ? points[i].y - 62 : 0;
          return (
            <div
              key={`chapter-${i}`}
              className="absolute left-1/2 -translate-x-1/2 px-6 py-1.5 w-fit whitespace-nowrap text-center rounded-full bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-main)] text-[12px] font-bold tracking-wide shadow-sm z-10"
              style={{ top: py }}
            >
              Розділ {chapterNumber}
            </div>
          );
        })}

        {/* Стежка */}
        <svg
          className="absolute inset-0"
          width={CANVAS_WIDTH}
          height={canvasHeight}
          viewBox={`0 0 ${CANVAS_WIDTH} ${canvasHeight}`}
        >
          <path
            d={pathD}
            fill="none"
            stroke="#000000"
            strokeOpacity={0.3}
            strokeWidth={22}
            strokeLinecap="round"
            transform="translate(0, 4)"
          />
          <path
            d={pathD}
            fill="none"
            stroke="var(--border-color)"
            strokeWidth={18}
            strokeLinecap="round"
          />
          <path
            d={pathD}
            fill="none"
            stroke="var(--accent-cta)"
            strokeOpacity={0.4}
            strokeWidth={2}
            strokeDasharray="1 11"
            strokeLinecap="round"
          />
        </svg>

        {/* Юніти */}
        {units.map((unit, i) => {
          const unitId = getUnitId(unit);
          const status = getStatus(unit);
          const isCompleted = status === "completed";
          const isAvailable = status === "available";
          const isLocked = status === "locked";
          const isCurrent = unitId === currentUnitId && isAvailable;
          const { x, y } = points[i];

          return (
            <div
              key={unitId || i}
              className="absolute flex flex-col items-center z-10"
              style={{
                left: x - NODE_SIZE / 2,
                top: y - NODE_SIZE / 2,
                width: NODE_SIZE,
              }}
            >
              {/* МАЛЯВАННЯ МАСКОТА: Без жорсткої висоти, звичайний Flex GAP */}
              {isCurrent && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 flex flex-col items-center gap-1.5 pm-float pointer-events-none z-20">
                  <div className="relative w-fit whitespace-nowrap px-3 py-1.5 rounded-xl bg-[var(--accent-cta)] text-[var(--text-accent)] text-[12px] font-bold shadow-md">
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
                className={`relative flex items-center justify-center rounded-2xl shrink-0 transition-transform active:scale-95 ${
                  shakeId === unitId ? "pm-shake" : ""
                } ${isCurrent ? "pm-glow" : ""}`}
                style={{ width: NODE_SIZE, height: NODE_SIZE }}
              >
                {/* КОЛЬОРИ ТОКЕНІВ: Акцентні для пройдених/поточних */}
                <div
                  className={`w-full h-full rounded-2xl flex items-center justify-center border-b-[6px] shadow-sm transition-colors ${
                    isCompleted || isAvailable
                      ? "bg-[var(--accent-cta)] border-[var(--accent-cta-active)] text-[var(--text-accent)]"
                      : "bg-[var(--bg-card)] border-[var(--border-color)] text-[var(--text-muted)]"
                  }`}
                >
                  {isCompleted && (
                    <CheckIcon className="w-7 h-7" strokeWidth={3} />
                  )}
                  {isLocked && <Lock className="w-6 h-6 opacity-50" />}
                  {isAvailable && !isCompleted && (
                    <Sparkles className="w-7 h-7 drop-shadow-sm" />
                  )}
                </div>

                {isCompleted && (
                  <span className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-[var(--bg-card)] shadow border border-[var(--border-color)] flex items-center justify-center">
                    <CheckIcon
                      className="w-4 h-4 text-[var(--accent-cta)]"
                      strokeWidth={3.5}
                    />
                  </span>
                )}
              </button>

              <span
                className={`mt-2 text-[11px] font-semibold text-center w-[110px] leading-tight line-clamp-2 ${
                  isLocked
                    ? "text-[var(--text-muted)] opacity-60"
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
