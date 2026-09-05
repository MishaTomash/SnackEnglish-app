// src/pages/path/PathMapPage.tsx
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

  // ДОДАНО: Валідація статусу юніта перед переходом
  const handleSelectUnit = (unitId: string) => {
    const selectedUnit = units.find((u) => u.id === unitId);

    if (selectedUnit?.status === "locked") {
      // Якщо юніт заблоковано - викликаємо легку вібрацію помилки (якщо підтримується)
      // і не пускаємо далі.
      hapticSelectNode(); // можна замінити на hapticError, якщо є
      return;
    }

    hapticSelectNode();
    navigate(`/path/${unitId}`);
  };

  if (isLoading && units.length === 0) {
    return (
      <Screen className="justify-center items-center">
        <p className="text-[var(--tg-theme-hint-color,#8e8e93)] animate-pulse">
          Завантаження карти уроків...
        </p>
      </Screen>
    );
  }

  if (error && units.length === 0) {
    return (
      <Screen className="justify-center items-center gap-3">
        <p className="text-[var(--tg-theme-hint-color,#8e8e93)]">{error}</p>
        <button
          onClick={() => loadUnits("A1")}
          className="px-4 py-2 rounded-xl text-sm font-semibold bg-[var(--tg-theme-button-color,#3390ec)] text-[var(--tg-theme-button-text-color,#ffffff)] transition-active active:scale-95"
        >
          Спробувати ще раз
        </button>
      </Screen>
    );
  }

  return (
    <Screen className="!px-0 !pt-0 !pb-[calc(96px+env(safe-area-inset-bottom))]">
      <div className="sticky top-0 z-20 bg-[var(--tg-theme-bg-color)]/95 backdrop-blur px-4 pt-4 pb-3 space-y-3 border-b border-[var(--tg-theme-hint-color)]/20">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-bold text-[var(--tg-theme-text-color)]">
            Твій шлях до рівня
          </h1>
          <span className="text-xs font-semibold text-[var(--tg-theme-hint-color,#8e8e93)]">
            {progressPercent}%
          </span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-[var(--tg-theme-secondary-bg-color,#f4f4f5)] overflow-hidden">
          <div
            className="h-full rounded-full bg-[var(--tg-theme-button-color,#3390ec)] transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
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
