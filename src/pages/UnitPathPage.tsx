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
import { Card } from "../shared/ui/Card";
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

  const targetId = unitId ?? currentUnitId;
  const unit = units.find((u) => u.id === targetId) ?? units[0];

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

  return (
    <Screen className="space-y-4">
      {/* Верхня панель */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate("/")}
          className="p-2 rounded-xl bg-[var(--tg-theme-secondary-bg-color,#f4f4f5)] text-[var(--tg-theme-text-color,#000000)]"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <div className="flex items-center gap-2">
            <Badge className="text-[10px] uppercase">{unit.level}</Badge>
            <span className="text-xs text-[var(--tg-theme-hint-color,#8e8e93)] font-medium">
              Тема: {unit.topic}
            </span>
          </div>
          <h1 className="text-xl font-bold leading-tight mt-0.5">
            {unit.title}
          </h1>
        </div>
      </div>

      {/* Список кроків (Таймлайн) */}
      <div className="space-y-3 relative before:absolute before:left-6 before:top-4 before:bottom-4 before:w-0.5 before:bg-[var(--tg-theme-hint-color,#8e8e93)]/20">
        {unit.steps.map((step, index) => {
          const meta = STEP_METADATA[step.type];
          const StepIcon = meta.icon;
          const isCompleted = step.status === "completed";
          const isAvailable = step.status === "available";
          const isLocked = step.status === "locked";

          return (
            <Card
              key={step.id}
              className={`relative flex items-center justify-between p-3.5 transition-all ${
                isAvailable
                  ? "border-[var(--tg-theme-button-color,#3390ec)] shadow-md bg-[var(--tg-theme-bg-color,#ffffff)] ring-1 ring-[var(--tg-theme-button-color,#3390ec)]/30"
                  : isLocked
                    ? "opacity-60 bg-[var(--tg-theme-secondary-bg-color,#f4f4f5)]/50"
                    : "bg-[var(--tg-theme-bg-color,#ffffff)]"
              }`}
            >
              <div className="flex items-center gap-3.5 z-10">
                {/* Іконка кроку */}
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    isCompleted
                      ? "bg-emerald-500/10 text-emerald-500"
                      : isAvailable
                        ? "bg-[var(--tg-theme-button-color,#3390ec)] text-white shadow-sm"
                        : "bg-gray-200 dark:bg-gray-800 text-gray-400"
                  }`}
                >
                  <StepIcon className="w-5 h-5" />
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-[var(--tg-theme-hint-color,#8e8e93)] font-semibold">
                      Крок {index + 1}
                    </span>
                    <span className="text-sm font-bold">{meta.title}</span>
                  </div>
                  <p className="text-xs text-[var(--tg-theme-hint-color,#8e8e93)] line-clamp-1">
                    {meta.desc}
                  </p>
                </div>
              </div>

              {/* Статус / Кнопка дії */}
              <div className="z-10 shrink-0">
                {isCompleted && (
                  <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                )}
                {isLocked && <Lock className="w-5 h-5 text-gray-400" />}
                {isAvailable && (
                  <button
                    onClick={() =>
                      navigate(`/unit/${unit.id}/step/${step.type}`)
                    }
                    className="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-[var(--tg-theme-button-color,#3390ec)] text-white shadow-sm active:scale-95 transition-transform"
                  >
                    Старт
                  </button>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </Screen>
  );
};
