// src/pages/UnitPathPage.tsx
import { useEffect, useMemo } from "react";
import { useParams, useNavigate, Link, useLocation } from "react-router-dom";
import {
  ArrowLeft,
  CheckCircle2,
  Lock,
  Play,
  Flame,
  BookA,
  BookOpen,
  Video,
  FileText,
  Mic,
  CheckSquare,
  MessageSquare,
} from "lucide-react";
import { Screen } from "../shared/ui/Screen";
import { Badge } from "../shared/ui/Badge";
import { useProgressStore } from "../store/progressStore";
import type { UnitStepType } from "../entities/unit/types";
import { hapticLockedNode } from "../shared/lib/telegramHaptics";

const STEP_METADATA: Record<
  UnitStepType,
  { title: string; desc: string; icon: typeof Play }
> = {
  warmup: {
    title: "Розігрів",
    desc: "Вступ до теми та перевірка інтуїції",
    icon: Flame,
  },
  vocabulary: {
    title: "Словничок",
    desc: "Вивчення нових слів уроку",
    icon: BookA,
  },
  grammar: {
    title: "Граматика",
    desc: "Правило та практичні приклади",
    icon: BookOpen,
  },
  video: {
    title: "Відеоурок",
    desc: "Аудіо-візуальне закріплення теми",
    icon: Video,
  },
  reading: {
    title: "Читання",
    desc: "Короткий текст із запитаннями",
    icon: FileText,
  },
  roleplay: {
    title: "Діалог",
    desc: "Симуляція реальної життєвої ситуації",
    icon: MessageSquare,
  },
  speaking: { title: "Говоріння", desc: "Тренування вимови фрази", icon: Mic },
  test: {
    title: "Фінальний тест",
    desc: "Перевірка знань юніту на 75%+",
    icon: CheckSquare,
  },
};

export const UnitPathPage = () => {
  const { unitId } = useParams<{ unitId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { units, currentUnitId, loadUnits } = useProgressStore();

  const returnPath = location.state?.from || "/path";

  useEffect(() => {
    if (units.length === 0) {
      loadUnits("A1");
    }
  }, [units.length, loadUnits]);

  const activeId = unitId || currentUnitId;
  const unit =
    units.find(
      (u) =>
        u.id === activeId ||
        (u as unknown as { _id?: string })._id === activeId,
    ) ?? units[0];

  const processedSteps = useMemo(() => {
    if (!unit) return [];

    let rawSteps: Array<{ id: string; type: UnitStepType }> = [];

    // 1. Якщо кроки прийшли як правильний масив
    if (Array.isArray(unit.steps) && unit.steps.length > 0) {
      rawSteps = unit.steps;
    }
    // 2. Якщо бекенд віддав JSON-об'єкт (наприклад, "steps": { "warmup": {}, "vocabulary": [] })
    else if (
      unit.steps &&
      typeof unit.steps === "object" &&
      Object.keys(unit.steps).length > 0
    ) {
      rawSteps = Object.keys(unit.steps).map((key, index) => ({
        id: String(index + 1),
        type: key as UnitStepType,
      }));
    }
    // 3. Динамічний фоллбек
    else {
      const dynamicSteps: UnitStepType[] = ["warmup"];
      if (unit.wordIds?.length > 0) dynamicSteps.push("vocabulary", "speaking");
      if (unit.grammarTopic || unit.grammar?.title)
        dynamicSteps.push("grammar");

      // ОСЬ ТУТ ЗМІНА: додано (unit.steps as any)?.video
      if (unit.videoUrl || (unit.steps as any)?.video)
        dynamicSteps.push("video");

      if (unit.readingText) dynamicSteps.push("reading");
      dynamicSteps.push("test");

      rawSteps = dynamicSteps.map((type, index) => ({
        id: String(index + 1),
        type,
      }));
    }

    const completedSteps = unit.completedSteps || [];
    let isNextAvailableFound = false;

    return rawSteps.map((step) => {
      const isCompleted = completedSteps.includes(step.type);

      let status: "completed" | "available" | "locked";
      if (isCompleted) {
        status = "completed";
      } else if (!isNextAvailableFound) {
        status = "available";
        isNextAvailableFound = true; // Перший непройдений крок
      } else {
        status = "locked";
      }

      return { ...step, status };
    });
  }, [unit]);

  if (units.length === 0) {
    return (
      <Screen className="justify-center items-center">
        <p className="text-[var(--text-muted)] animate-pulse">
          Завантаження юнітів...
        </p>
      </Screen>
    );
  }

  if (!unit) {
    return (
      <Screen className="justify-center items-center">
        <p className="text-[var(--text-muted)]">Юніт не знайдено...</p>
        <Link to="/" className="mt-4 text-[var(--accent-cta)] font-semibold">
          Повернутися на Головну
        </Link>
      </Screen>
    );
  }

  const effectiveUnitId = unit.id || (unit as unknown as { _id?: string })._id;
  const completedCount = processedSteps.filter(
    (s) => s.status === "completed",
  ).length;
  const percent =
    processedSteps.length > 0
      ? Math.round((completedCount / processedSteps.length) * 100)
      : 0;

  const handleLockedClick = () => {
    hapticLockedNode();
  };

  return (
    <Screen className="!px-0 !pt-0 bg-[var(--bg-app)]">
      {/* Хедер юніта */}
      <div className="relative overflow-hidden bg-[var(--bg-card)] px-4 pt-4 pb-6 rounded-b-3xl shadow-lg border-b border-[var(--border-color)]">
        <div className="relative flex items-center justify-between z-10">
          <button
            onClick={() => navigate(returnPath)}
            className="p-2 rounded-xl bg-[var(--bg-card-hover)] border border-[var(--border-color)] active:scale-95 transition-transform"
          >
            <ArrowLeft className="w-5 h-5 text-[var(--text-main)]" />
          </button>

          <div
            className="relative w-14 h-14 rounded-full grid place-items-center shrink-0 shadow-sm"
            style={{
              background: `conic-gradient(var(--accent-cta) ${percent}%, var(--locked) ${percent}% 100%)`,
            }}
          >
            <div className="w-11 h-11 rounded-full bg-[var(--bg-card)] grid place-items-center">
              <span className="text-[11px] font-bold text-[var(--text-main)]">
                {percent}%
              </span>
            </div>
          </div>
        </div>

        <div className="relative mt-4 space-y-1 z-10">
          <div className="flex items-center gap-2">
            <Badge className="bg-[var(--accent-cta)] text-[var(--text-accent)] border-none text-[10px] uppercase shadow-sm">
              {unit.level}
            </Badge>
            <span className="text-xs text-[var(--text-muted)] font-medium">
              {(unit as unknown as { topic?: string }).topic || unit.title}
            </span>
          </div>
          <h1 className="text-xl font-bold leading-tight text-[var(--text-main)]">
            {unit.title}
          </h1>
          <p className="text-xs text-[var(--text-muted)]">
            {completedCount} з {processedSteps.length} кроків пройдено
          </p>
        </div>
      </div>

      {/* Таймлайн кроків */}
      <div className="px-4 mt-5 space-y-3 relative before:absolute before:left-[38px] before:top-2 before:bottom-2 before:w-0.5 before:bg-[var(--border-color)]">
        {processedSteps.map((step, index) => {
          const meta = STEP_METADATA[step.type] ?? {
            title: step.type,
            desc: "Урок юніту",
            icon: Play,
          };
          const StepIcon = meta.icon;
          const isCompleted = step.status === "completed";
          const isAvailable = step.status === "available";
          const isLocked = step.status === "locked";

          return (
            <div
              key={step.id || index}
              className={`relative flex items-center gap-3.5 rounded-2xl p-3.5 transition-all ${
                isAvailable
                  ? "bg-[var(--bg-card-elevated)] shadow-lg border-l-4 border-[var(--accent-cta)]"
                  : isLocked
                    ? "bg-[var(--bg-app)] border-l-4 border-transparent opacity-60"
                    : "bg-[var(--bg-card-elevated)] border-l-4 border-[var(--accent-success)]"
              }`}
            >
              <div
                className={`relative w-11 h-11 rounded-full flex items-center justify-center shrink-0 z-10 ${
                  isCompleted
                    ? "bg-[var(--accent-success)]/20 text-[var(--accent-success)] border border-[var(--accent-success)]/30"
                    : isAvailable
                      ? "bg-[var(--accent-cta)] text-[var(--text-accent)] shadow-sm"
                      : "bg-[var(--bg-card)] text-[var(--text-muted)] border-2 border-[var(--border-color)]"
                }`}
              >
                <StepIcon className="w-5 h-5" />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-bold text-[var(--text-muted)]">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span
                    className={`text-sm font-bold truncate ${
                      isLocked
                        ? "text-[var(--text-muted)]"
                        : "text-[var(--text-main)]"
                    }`}
                  >
                    {meta.title}
                  </span>
                </div>
                <p className="text-xs text-[var(--text-muted)] truncate">
                  {meta.desc}
                </p>
              </div>

              <div className="shrink-0">
                {isCompleted && (
                  <button
                    onClick={() =>
                      navigate(`/unit/${effectiveUnitId}/step/${step.type}`, {
                        state: { from: location.pathname },
                      })
                    }
                    className="flex flex-col items-center justify-center w-12 text-[var(--accent-success)] active:scale-95 transition-transform"
                  >
                    <CheckCircle2 className="w-6 h-6" />
                    <span className="text-[10px] font-bold mt-1">Пройдено</span>
                  </button>
                )}
                {isLocked && (
                  <button
                    onClick={handleLockedClick}
                    className="flex flex-col items-center justify-center w-12"
                  >
                    <Lock className="w-5 h-5 text-[var(--locked)]" />
                  </button>
                )}
                {isAvailable && (
                  <button
                    onClick={() =>
                      navigate(`/unit/${effectiveUnitId}/step/${step.type}`, {
                        state: { from: location.pathname },
                      })
                    }
                    className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-[var(--accent-cta)] text-[var(--text-accent)] shadow-sm active:scale-95 transition-transform"
                  >
                    Старт
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </Screen>
  );
};
