import { useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
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
  const { units, currentUnitId, loadUnits } = useProgressStore();

  useEffect(() => {
    if (units.length === 0) {
      loadUnits("A1");
    }
  }, [units.length, loadUnits]);

  if (units.length === 0) {
    return (
      <Screen className="justify-center items-center">
        <p className="text-[var(--tg-theme-hint-color,#8e8e93)] animate-pulse">
          Завантаження юнітів...
        </p>
      </Screen>
    );
  }

  const activeId = unitId || currentUnitId;
  const unit =
    units.find(
      (u) =>
        u.id === activeId ||
        (u as unknown as { _id?: string })._id === activeId,
    ) ?? units[0];

  if (!unit) {
    return (
      <Screen className="justify-center items-center">
        <p className="text-[var(--tg-theme-hint-color,#8e8e93)]">
          Юніт не знайдено...
        </p>
        <Link
          to="/"
          className="mt-4 text-[var(--tg-theme-button-color,#3390ec)] font-semibold"
        >
          Повернутися на Головну
        </Link>
      </Screen>
    );
  }

  const effectiveUnitId = unit.id || (unit as unknown as { _id?: string })._id;

  const defaultSteps: Array<{
    id: string;
    type: UnitStepType;
    status: "completed" | "available" | "locked";
  }> = [
    { id: "1", type: "vocabulary", status: "available" },
    { id: "2", type: "grammar", status: "available" },
    { id: "3", type: "video", status: "available" },
    { id: "4", type: "reading", status: "available" },
    { id: "5", type: "roleplay", status: "available" },
    { id: "6", type: "test", status: "available" },
  ];

  const steps = unit.steps && unit.steps.length > 0 ? unit.steps : defaultSteps;
  const completedCount = steps.filter((s) => s.status === "completed").length;
  const percent =
    steps.length > 0 ? Math.round((completedCount / steps.length) * 100) : 0;

  return (
    <Screen className="!p-0 pb-8">
      {/* Хедер юніта: градієнт, кільце прогресу, тема */}
      <div className="relative overflow-hidden bg-gradient-to-br from-[var(--tg-theme-button-color,#3390ec)] to-[var(--tg-theme-button-color,#3390ec)]/70 text-white px-4 pt-4 pb-6 rounded-b-3xl shadow-lg">
        <div
          className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-white/10 blur-2xl"
          aria-hidden
        />
        <div
          className="absolute bottom-0 left-1/3 w-24 h-24 rounded-full bg-white/10 blur-xl"
          aria-hidden
        />

        <div className="relative flex items-center justify-between">
          <button
            onClick={() => navigate("/")}
            className="p-2 rounded-xl bg-white/15 backdrop-blur-sm active:scale-95 transition-transform"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <div
            className="relative w-14 h-14 rounded-full grid place-items-center shrink-0"
            style={{
              background: `conic-gradient(#ffffff ${percent}%, rgba(255,255,255,0.25) ${percent}% 100%)`,
            }}
          >
            <div className="w-11 h-11 rounded-full bg-[var(--tg-theme-button-color,#3390ec)] grid place-items-center">
              <span className="text-[11px] font-bold">{percent}%</span>
            </div>
          </div>
        </div>

        <div className="relative mt-4 space-y-1">
          <div className="flex items-center gap-2">
            <Badge className="bg-white/20 text-white border-none text-[10px] uppercase">
              {unit.level}
            </Badge>
            <span className="text-xs text-white/80 font-medium">
              {(unit as unknown as { topic?: string }).topic || unit.title}
            </span>
          </div>
          <h1 className="text-xl font-bold leading-tight">{unit.title}</h1>
          <p className="text-xs text-white/75">
            {completedCount} з {steps.length} кроків пройдено
          </p>
        </div>
      </div>

      {/* Таймлайн кроків */}
      <div className="px-4 mt-5 space-y-3 relative before:absolute before:left-[38px] before:top-2 before:bottom-2 before:w-0.5 before:bg-[var(--tg-theme-hint-color,#8e8e93)]/15">
        {steps.map((step, index) => {
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
                  ? "bg-[var(--tg-theme-bg-color,#ffffff)] shadow-[0_2px_14px_rgba(0,0,0,0.07)] border-l-4 border-[var(--tg-theme-button-color,#3390ec)]"
                  : isLocked
                    ? "bg-[var(--tg-theme-secondary-bg-color,#f4f4f5)]/60 border-l-4 border-transparent"
                    : "bg-[var(--tg-theme-bg-color,#ffffff)] border-l-4 border-emerald-400/60"
              }`}
            >
              <div
                className={`relative w-11 h-11 rounded-full flex items-center justify-center shrink-0 z-10 ${
                  isCompleted
                    ? "bg-emerald-500 text-white"
                    : isAvailable
                      ? "bg-[var(--tg-theme-button-color,#3390ec)] text-white shadow-sm"
                      : "bg-[var(--tg-theme-bg-color,#ffffff)] text-gray-400 border-2 border-[var(--tg-theme-hint-color,#d1d5db)]/40"
                }`}
              >
                <StepIcon className="w-5 h-5" />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-bold text-[var(--tg-theme-hint-color,#8e8e93)]">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span
                    className={`text-sm font-bold truncate ${
                      isLocked
                        ? "text-[var(--tg-theme-hint-color,#9ca3af)]"
                        : ""
                    }`}
                  >
                    {meta.title}
                  </span>
                </div>
                <p className="text-xs text-[var(--tg-theme-hint-color,#8e8e93)] truncate">
                  {meta.desc}
                </p>
              </div>

              <div className="shrink-0">
                {isCompleted && (
                  <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                )}
                {isLocked && <Lock className="w-4 h-4 text-gray-400" />}
                {isAvailable && (
                  <button
                    onClick={() =>
                      navigate(`/unit/${effectiveUnitId}/step/${step.type}`)
                    }
                    className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-[var(--tg-theme-button-color,#3390ec)] text-white shadow-sm active:scale-95 transition-transform"
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
