import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Check, Lock, Play, Star } from "lucide-react";
import { Screen } from "../../shared/ui/Screen";
import { Card } from "../../shared/ui/Card";
import { Button } from "../../shared/ui/Button";
import { ProgressBar } from "../../shared/ui/ProgressBar";
import { useLearningStore } from "../../store/learningStore";
import type { Accent } from "../../entities/learning/types";

type UnitState = "completed" | "current" | "locked";

const accentProgress: Record<Accent, "amber" | "emerald" | "sky" | "rose"> = {
  amber: "amber",
  emerald: "emerald",
  sky: "sky",
  rose: "rose",
};

const buildUnitStates = (
  unitIds: string[],
  completedMap: Record<string, { completed?: boolean } | undefined>,
): UnitState[] => {
  return unitIds.reduce<{ states: UnitState[]; foundCurrent: boolean }>(
    (acc, id) => {
      if (completedMap[id]?.completed) {
        acc.states.push("completed");
        return acc;
      }
      if (!acc.foundCurrent) {
        acc.states.push("current");
        acc.foundCurrent = true;
        return acc;
      }
      acc.states.push("locked");
      return acc;
    },
    { states: [], foundCurrent: false },
  ).states;
};

export const CategoryPathPage = () => {
  const { categoryId } = useParams<{ categoryId: string }>();
  const navigate = useNavigate();
  const { progress, categories } = useLearningStore();

  const category = categories.find((c) => c.id === categoryId);

  if (!category) {
    return (
      <Screen className="justify-center items-center gap-3">
        <p className="text-[var(--text-muted)]">Категорію не знайдено</p>
        <Button variant="secondary" onClick={() => navigate("/learning")}>
          До навчання
        </Button>
      </Screen>
    );
  }

  const unitStates = buildUnitStates(
    category.units.map((u) => u.id),
    progress,
  );

  const completed = unitStates.filter((s) => s === "completed").length;
  const percent =
    category.units.length > 0
      ? Math.round((completed / category.units.length) * 100)
      : 0;

  return (
    <Screen className="!px-0 !pt-0 bg-[var(--bg-app)] pb-24">
      <div className="sticky top-0 z-50 bg-[var(--bg-app)]/95 backdrop-blur-md px-4 pt-4 pb-4 border-b border-[var(--border-color)]">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/learning")}
            className="p-2 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] active:opacity-70"
          >
            <ArrowLeft className="w-5 h-5 text-[var(--text-main)]" />
          </button>
          <div className="text-3xl">{category.emoji}</div>
          <div className="min-w-0 flex-1">
            <h1 className="text-base font-black text-[var(--text-main)] leading-tight truncate">
              {category.title}
            </h1>
            <p className="text-[11px] text-[var(--text-muted)] truncate">
              {completed}/{category.units.length} · {percent}%
            </p>
          </div>
        </div>
        <div className="mt-3">
          <ProgressBar
            progress={percent}
            className="!h-2"
            accent={accentProgress[category.accent]}
          />
        </div>
      </div>

      <div className="px-4 pt-6 pb-4 space-y-5">
        {category.units.length === 0 && (
          <div className="text-center text-[var(--text-muted)] text-sm mt-10">
            Тут поки немає уроків
          </div>
        )}
        {category.units.map((unit, i) => {
          const state = unitStates[i];
          const isLocked = state === "locked";
          const isCompleted = state === "completed";

          return (
            <Card
              key={unit.id}
              interactive={!isLocked}
              className={`flex items-center gap-4 !p-4 animate-in fade-in slide-in-from-bottom-2 ${
                isLocked ? "opacity-60" : ""
              } ${
                state === "current"
                  ? "border-[var(--accent-cta)] shadow-[0_0_30px_rgba(232,163,61,0.15)]"
                  : ""
              }`}
              onClick={() => {
                if (isLocked) return;
                navigate(`/learning/unit/${unit.id}`);
              }}
            >
              <div
                className={`w-14 h-14 rounded-2xl shrink-0 flex items-center justify-center text-2xl relative ${
                  isCompleted
                    ? "bg-emerald-500/15"
                    : isLocked
                      ? "bg-[var(--bg-card-hover)]"
                      : "bg-[var(--accent-cta)]/15"
                }`}
              >
                {isLocked ? (
                  <Lock className="w-6 h-6 text-[var(--text-muted)]" />
                ) : (
                  <span>{unit.emoji}</span>
                )}
                {isCompleted && (
                  <span className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center border-2 border-[var(--bg-app)]">
                    <Check className="w-3.5 h-3.5" strokeWidth={4} />
                  </span>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-[var(--text-muted)]">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <h3
                    className={`text-sm font-bold truncate ${
                      isLocked
                        ? "text-[var(--text-muted)]"
                        : "text-[var(--text-main)]"
                    }`}
                  >
                    {unit.title}
                  </h3>
                </div>
                <p className="text-[11px] text-[var(--text-muted)] mt-0.5 line-clamp-2">
                  {unit.description}
                </p>
                {progress[unit.id]?.completed && (
                  <div className="flex items-center gap-1 mt-1.5 text-[10px] font-bold text-emerald-400">
                    <Star className="w-3 h-3" />
                    {progress[unit.id].bestAccuracy}% точність
                  </div>
                )}
              </div>

              {!isLocked && (
                <div
                  className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
                    isCompleted
                      ? "bg-[var(--bg-card-hover)] text-[var(--text-muted)]"
                      : "bg-[var(--accent-cta)] text-[var(--text-accent)]"
                  }`}
                >
                  <Play className="w-4 h-4 ml-0.5" />
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </Screen>
  );
};
