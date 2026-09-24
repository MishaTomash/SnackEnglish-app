import { useEffect } from "react";
import type { FC } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import type { Chapter } from "../../entities/story/types";
import type { EnglishLevel } from "../../entities/word/types";
import { Button } from "../../shared/ui/Button";
import { Card } from "../../shared/ui/Card";
import { CookieMascot } from "../../shared/ui/CookieMascot";
import { useStoryStore } from "../../store/storyStore";
import { useIsAdmin } from "../../features/story-admin/lib/useIsAdmin";

const LEVELS: readonly EnglishLevel[] = ["A1", "A2", "B1", "B2", "C1", "C2"];

const LEVEL_NAMES: Record<EnglishLevel, string> = {
  A1: "Початковий",
  A2: "Елементарний",
  B1: "Середній",
  B2: "Вище середнього",
  C1: "Просунутий",
  C2: "Вільне володіння",
};

const parseLevel = (value: string | null): EnglishLevel | undefined => {
  const upper = value?.toUpperCase();
  return LEVELS.find((level) => level === upper);
};

const ChapterCard: FC<{ chapter: Chapter; onOpen: () => void }> = ({ chapter, onOpen }) => {
  const percent =
    chapter.totalNodes > 0 ? Math.round((chapter.doneNodes / chapter.totalNodes) * 100) : 0;
  const isLocked = chapter.locked;
  const isCompleted = chapter.status === "completed";

  const statusText = isLocked
    ? "🔒 Пройди попередній розділ"
    : isCompleted
      ? "✓ Пройдено"
      : chapter.doneNodes > 0
        ? "Продовжити →"
        : "Почати →";

  return (
    <button
      type="button"
      onClick={onOpen}
      disabled={isLocked}
      aria-label={`${chapter.title}: ${isLocked ? "закрито" : `пройдено ${percent}%`}`}
      className="block w-full rounded-3xl text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-cta)] disabled:cursor-not-allowed"
    >
      <Card interactive={!isLocked} className={isLocked ? "opacity-55" : ""}>
        <div className="flex items-center gap-4">
          <div
            className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl text-4xl"
            // Фон обкладинки — акцентний колір розділу з прозорістю
            style={{ backgroundColor: `color-mix(in srgb, ${chapter.accent} 22%, transparent)` }}
            aria-hidden="true"
          >
            {isLocked ? "🔒" : chapter.cover}
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-lg font-extrabold">{chapter.title}</h2>
            {chapter.subtitle && (
              <p className="line-clamp-2 text-sm text-[var(--text-muted)]">{chapter.subtitle}</p>
            )}
          </div>
        </div>

        <div className="mt-4">
          <div className="mb-1.5 flex items-center justify-between text-xs font-bold">
            <span className={isCompleted ? "text-[var(--accent-success)]" : "text-[var(--text-muted)]"}>
              {statusText}
            </span>
            <span className="text-[var(--text-muted)]">
              {chapter.doneNodes}/{chapter.totalNodes} · {percent}%
            </span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-[var(--bg-app)]">
            <div
              className="h-full rounded-full transition-[width] duration-700 ease-out"
              style={{ width: `${percent}%`, backgroundColor: chapter.accent }}
            />
          </div>
        </div>
      </Card>
    </button>
  );
};

/**
 * Список розділів одного рівня. За замовчуванням — рівень юзера з профілю;
 * інші рівні доступні перемикачем (?level=B1 в адресі).
 */
export const LearningHubPage = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedLevel = parseLevel(searchParams.get("level"));

  const chapters = useStoryStore((s) => s.chapters);
  const level = useStoryStore((s) => s.level);
  const userLevel = useStoryStore((s) => s.userLevel);
  const levels = useStoryStore((s) => s.levels);
  const isLoading = useStoryStore((s) => s.isLoading);
  const error = useStoryStore((s) => s.error);
  const fetchChapters = useStoryStore((s) => s.fetchChapters);
  const isAdmin = useIsAdmin();

  useEffect(() => {
    void fetchChapters(requestedLevel);
  }, [requestedLevel, fetchChapters]);

  // Рівень завжди явно в адресі: без ?level стор лишає останній обраний рівень
  // (повернення з мапи не скидає вибір), тож "повернутися на свій" теж пишемо явно
  const selectLevel = (next: EnglishLevel) => {
    if (next === level) return;
    setSearchParams({ level: next }, { replace: true });
  };

  const userLevelHasContent = !userLevel || levels.some((l) => l.level === userLevel);

  return (
    <div className="mx-auto min-h-[100dvh] max-w-md px-4 pb-[calc(96px+env(safe-area-inset-bottom))] pt-[calc(env(safe-area-inset-top)+20px)]">
      <header className="flex items-center gap-3">
        <CookieMascot state="happy" size={56} />
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-extrabold">Навчання</h1>
          <p className="text-sm text-[var(--text-muted)]">Історії з Снекі</p>
        </div>
        {isAdmin && (
          <Button size="sm" variant="secondary" onClick={() => navigate("/learning/admin")}>
            ⚙️ Адмінка
          </Button>
        )}
      </header>

      {levels.length > 0 && (
        <nav aria-label="Рівень англійської" className="-mx-4 mt-5 flex gap-2 overflow-x-auto px-4 pb-1">
          {levels.map(({ level: item }) => {
            const isSelected = item === level;
            return (
              <button
                key={item}
                type="button"
                onClick={() => selectLevel(item)}
                aria-pressed={isSelected}
                className={`shrink-0 rounded-2xl border-2 px-4 py-2 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-cta)] ${isSelected
                    ? "border-[var(--accent-cta)] bg-[var(--accent-cta)]/15"
                    : "border-[var(--border-color)] bg-[var(--bg-card)]"
                  }`}
              >
                <span className="block text-base font-extrabold">
                  {item}
                  {item === userLevel && (
                    <span className="ml-1.5 rounded-full bg-[var(--accent-cta)] px-1.5 py-0.5 align-middle text-[10px] font-bold text-[var(--text-accent)]">
                      твій
                    </span>
                  )}
                </span>
                <span className="block text-[11px] text-[var(--text-muted)]">{LEVEL_NAMES[item]}</span>
              </button>
            );
          })}
        </nav>
      )}

      {!userLevelHasContent && userLevel && (
        <p className="mt-3 rounded-2xl bg-[var(--bg-card)] p-3 text-sm text-[var(--text-muted)]">
          Для твого рівня {userLevel} історії ще готуються 🍪 Поки можна пройти інші рівні.
        </p>
      )}

      <section className="mt-5 flex flex-col gap-4" aria-busy={isLoading}>
        {isLoading &&
          [0, 1, 2].map((i) => (
            <div key={i} className="h-36 animate-pulse rounded-3xl bg-[var(--bg-card)]" aria-hidden="true" />
          ))}

        {!isLoading && error && (
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <CookieMascot state="sad" size={80} />
            <p role="alert" className="font-semibold">
              Не вдалося завантажити розділи.
            </p>
            <Button onClick={() => void fetchChapters(requestedLevel)}>Спробувати ще</Button>
          </div>
        )}

        {!isLoading && !error && chapters.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <CookieMascot state="sleeping" size={80} />
            <p className="font-semibold">
              {level ? `Для рівня ${level} історії ще готуються.` : "Історії ще готуються."}
            </p>
          </div>
        )}

        {!isLoading &&
          !error &&
          chapters.map((chapter) => (
            <ChapterCard
              key={chapter.id}
              chapter={chapter}
              onOpen={() => navigate(`/learning/${chapter.slug}`)}
            />
          ))}
      </section>
    </div>
  );
};