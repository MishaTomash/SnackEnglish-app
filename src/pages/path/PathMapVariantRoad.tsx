// src/pages/path/PathMapVariantRoad.tsx
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

const getUnitId = (u: Unit) =>
  u.id || (u as unknown as { _id?: string })._id || "";
const getStatus = (u: Unit) => u.status ?? "locked";

// Детермінований псевдо-рандом (щоб стежка не "стрибала" між рендерами)
const seededOffset = (i: number) => {
  const seed = Math.sin(i * 12.9898) * 43758.5453;
  return seed - Math.floor(seed); // 0..1
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
        // Органічна, злегка "нерівна" амплітуда — не ідеально симетрична змійка
        const wave = Math.sin(i * 0.9) * 0.6 + (seededOffset(i) - 0.5) * 0.5;
        const amplitude = 96;
        return {
          x: CENTER_X + wave * amplitude,
          y: ROW_HEIGHT * i + ROW_HEIGHT / 2 + 36,
        };
      }),
    [units.length],
  );

  const pathD = useMemo(() => buildTrailPath(points), [points]);
  const canvasHeight = Math.max(units.length * ROW_HEIGHT + 60, ROW_HEIGHT);

  const handleLockedTap = (unitId: string) => {
    hapticLockedNode();
    setShakeId(unitId);
    setTimeout(() => setShakeId(null), 400);
  };

  return (
    <div
      className="relative mx-auto overflow-hidden"
      style={{
        width: CANVAS_WIDTH,
        height: canvasHeight,
        background:
          "radial-gradient(120% 40% at 50% 0%, rgba(74,222,128,0.16) 0%, rgba(74,222,128,0.05) 45%, transparent 70%)," +
          "linear-gradient(180deg, rgba(191,219,254,0.15) 0%, transparent 260px)",
      }}
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
          0%, 100% { box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.45); }
          70% { box-shadow: 0 0 0 12px rgba(245, 158, 11, 0); }
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
            className="absolute text-emerald-600/20"
            style={{ left: px, top: py }}
            width={26}
            height={26}
            strokeWidth={1.5}
          />
        );
      })}

      {/* Банери розділів над стежкою */}
      {units.map((_, i) => {
        if (i % CHAPTER_SIZE !== 0) return null;
        const chapterNumber = Math.floor(i / CHAPTER_SIZE) + 1;
        const py = points[i] ? points[i].y - 62 : 0;
        return (
          <div
            key={`chapter-${i}`}
            className="absolute left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-emerald-600/90 text-white text-[10px] font-bold tracking-wide shadow-sm whitespace-nowrap"
            style={{ top: py }}
          >
            Розділ {chapterNumber}
          </div>
        );
      })}

      {/* Стежка: м'яка тінь-підкладка + основне "земляне" полотно + пунктирна центральна лінія */}
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
          strokeOpacity={0.06}
          strokeWidth={22}
          strokeLinecap="round"
          transform="translate(0, 3)"
        />
        <path
          d={pathD}
          fill="none"
          stroke="#DFC28B"
          strokeOpacity={0.55}
          strokeWidth={18}
          strokeLinecap="round"
        />
        <path
          d={pathD}
          fill="none"
          stroke="#B08D57"
          strokeOpacity={0.5}
          strokeWidth={2}
          strokeDasharray="1 11"
          strokeLinecap="round"
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
            {isCurrent && (
              <div className="absolute -top-20 flex flex-col items-center pm-float">
                <div className="relative mb-1 px-2.5 py-1 rounded-xl bg-[var(--tg-theme-bg-color,#ffffff)] shadow-md text-[10px] font-bold text-[var(--tg-theme-text-color,#000000)] whitespace-nowrap">
                  Уперед! 🍪
                  <div className="absolute left-1/2 -bottom-1 -translate-x-1/2 w-2 h-2 rotate-45 bg-[var(--tg-theme-bg-color,#ffffff)]" />
                </div>
                <CookieMascot state="celebrating" size={54} />
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
              <div
                className={`w-full h-full rounded-2xl flex items-center justify-center border-b-4 shadow-md transition-colors ${
                  isCompleted
                    ? "bg-gradient-to-b from-emerald-400 to-emerald-500 border-emerald-700 text-white"
                    : isAvailable
                      ? "bg-gradient-to-b from-amber-300 to-amber-500 border-amber-700 text-white"
                      : "bg-[var(--tg-theme-secondary-bg-color,#f4f4f5)] border-black/5 text-[var(--tg-theme-hint-color,#9ca3af)]"
                }`}
              >
                {isCompleted && <CheckIcon className="w-7 h-7" />}
                {isLocked && <Lock className="w-6 h-6" />}
                {isAvailable && !isCompleted && (
                  <Sparkles className="w-7 h-7 drop-shadow-sm" />
                )}
              </div>

              {isCompleted && (
                <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-white shadow flex items-center justify-center">
                  <CheckIcon
                    className="w-3 h-3 text-emerald-500"
                    strokeWidth={3}
                  />
                </span>
              )}
            </button>

            <span
              className={`mt-2 text-[11px] font-semibold text-center w-28 line-clamp-2 ${
                isLocked
                  ? "text-[var(--tg-theme-hint-color,#9ca3af)]"
                  : "text-[var(--tg-theme-text-color,#000000)]"
              }`}
            >
              {unit.title}
            </span>
          </div>
        );
      })}
    </div>
  );
};
