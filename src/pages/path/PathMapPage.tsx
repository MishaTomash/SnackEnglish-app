import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Screen } from "../../shared/ui/Screen";
import { useProgressStore } from "../../store/progressStore";
import { hapticSelectNode } from "../../shared/lib/telegramHaptics";
import { PathMapVariantRoad } from "./PathMapVariantRoad";

export const PathMapPage = () => {
  const navigate = useNavigate();
  const { units, currentUnitId, progressPercent, isLoading, error, loadUnits } =
    useProgressStore();

  useEffect(() => {
    if (units.length === 0) {
      loadUnits("A1");
    }
  }, [units.length, loadUnits]);

  const handleSelectUnit = (unitId: string) => {
    const selectedUnit = units.find((u) => u.id === unitId);
    if (selectedUnit?.status === "locked") {
      hapticSelectNode();
      return;
    }
    hapticSelectNode();
    navigate(`/path/${unitId}`, { state: { from: "/path" } });
  };

  if (isLoading && units.length === 0) {
    return (
      <Screen className="justify-center items-center">
        <p className="text-[var(--text-muted)] animate-pulse">
          Завантаження карти уроків...
        </p>
      </Screen>
    );
  }

  if (error && units.length === 0) {
    return (
      <Screen className="justify-center items-center gap-3">
        <p className="text-[var(--text-muted)]">{error}</p>
        <button
          onClick={() => void loadUnits("A1")}
          disabled={isLoading}
          className={`px-4 py-2 rounded-xl text-sm font-semibold bg-[var(--accent-cta)] text-[var(--text-accent)] transition-all ${
            isLoading ? "opacity-50 pointer-events-none" : "active:scale-95"
          }`}
        >
          Спробувати ще раз
        </button>
      </Screen>
    );
  }

  return (
    <Screen
      fullBleed
      className="!pt-0 !pb-[calc(96px+env(safe-area-inset-bottom))] bg-[var(--bg-app)] min-h-[100dvh] overscroll-none"
    >
      {/* Оновлений стильний Хедер Карти */}
      <div className="sticky top-0 z-50 bg-[var(--bg-app)]/90 backdrop-blur-md px-4 pt-4 pb-3 border-b border-[var(--border-color)] shadow-sm">
        <div className="flex items-center gap-3.5">
          {/* Круговий прогрес */}
          <div className="relative w-12 h-12 shrink-0">
            <svg
              className="w-full h-full -rotate-90 drop-shadow-sm"
              viewBox="0 0 36 36"
            >
              <circle
                cx="18"
                cy="18"
                r="15"
                fill="none"
                className="stroke-[var(--locked)]"
                strokeWidth="4"
              />
              <circle
                cx="18"
                cy="18"
                r="15"
                fill="none"
                className="stroke-[var(--accent-cta)]"
                strokeWidth="4"
                pathLength="100"
                strokeDasharray="100"
                strokeDashoffset={100 - progressPercent}
                strokeLinecap="round"
                style={{ transition: "stroke-dashoffset 1s ease-in-out" }}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center text-[10px] font-black text-[var(--text-main)]">
              {progressPercent}%
            </div>
          </div>

          <div className="flex flex-col">
            <span className="text-sm font-bold text-[var(--text-main)] leading-snug">
              Ти переміг себе <br />в цьому курсі на:
            </span>
          </div>
        </div>
      </div>

      <PathMapVariantRoad
        units={units}
        currentUnitId={currentUnitId}
        onSelectUnit={handleSelectUnit}
      />
    </Screen>
  );
};
