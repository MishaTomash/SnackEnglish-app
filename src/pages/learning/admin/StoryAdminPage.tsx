import { useCallback, useEffect, useMemo, useState } from "react";
import type { FC } from "react";
import { useNavigate } from "react-router-dom";
import * as adminApi from "../../../entities/story/adminApi";
import type { AdminChapter, ChapterInput, MoveDirection } from "../../../entities/story/adminTypes";
import type { EnglishLevel } from "../../../entities/word/types";
import { AdminSheet } from "../../../features/story-admin/ui/AdminSheet";
import { ChapterForm } from "../../../features/story-admin/ui/ChapterForm";
import { Button } from "../../../shared/ui/Button";
import { CookieMascot } from "../../../shared/ui/CookieMascot";

const LEVELS: readonly EnglishLevel[] = ["A1", "A2", "B1", "B2", "C1", "C2"];

const pluralLessons = (n: number) => {
    const mod10 = n % 10;
    const mod100 = n % 100;
    if (mod10 === 1 && mod100 !== 11) return `${n} урок`;
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${n} уроки`;
    return `${n} уроків`;
};

interface ChapterRowProps {
    chapter: AdminChapter;
    isFirst: boolean;
    isLast: boolean;
    isBusy: boolean;
    onMove: (direction: MoveDirection) => void;
    onOpen: () => void;
}

const ChapterRow: FC<ChapterRowProps> = ({ chapter, isFirst, isLast, isBusy, onMove, onOpen }) => (
    <li className="flex items-center gap-3 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] p-3">
        <div className="flex flex-col gap-1">
            <button
                type="button"
                onClick={() => onMove("up")}
                disabled={isFirst || isBusy}
                aria-label={`Перемістити «${chapter.title}» вище`}
                className="h-7 w-7 rounded-lg text-sm text-[var(--text-muted)] hover:bg-[var(--bg-card-elevated)] disabled:opacity-25"
            >
                ▲
            </button>
            <button
                type="button"
                onClick={() => onMove("down")}
                disabled={isLast || isBusy}
                aria-label={`Перемістити «${chapter.title}» нижче`}
                className="h-7 w-7 rounded-lg text-sm text-[var(--text-muted)] hover:bg-[var(--bg-card-elevated)] disabled:opacity-25"
            >
                ▼
            </button>
        </div>
        <div
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-2xl"
            style={{ backgroundColor: `color-mix(in srgb, ${chapter.accent} 22%, transparent)` }}
            aria-hidden="true"
        >
            {chapter.cover}
        </div>
        <button type="button" onClick={onOpen} className="min-w-0 flex-1 text-left">
            <p className="flex items-center gap-2">
                <span className="truncate font-extrabold">{chapter.title}</span>
                {chapter.published ? (
                    <span className="shrink-0 rounded-full bg-[var(--accent-success)]/20 px-2 py-0.5 text-[10px] font-bold text-[var(--accent-success)]">
                        ОПУБЛІКОВАНО
                    </span>
                ) : (
                    <span className="shrink-0 rounded-full bg-[var(--text-muted)]/20 px-2 py-0.5 text-[10px] font-bold text-[var(--text-muted)]">
                        ЧЕРНЕТКА
                    </span>
                )}
            </p>
            <p className="truncate text-xs text-[var(--text-muted)]">
                <span className="font-mono">{chapter.slug}</span> · {pluralLessons(chapter.lessons)}
            </p>
        </button>
        <Button size="sm" variant="secondary" onClick={onOpen}>
            Відкрити
        </Button>
    </li>
);

/** Адмінка навчання: усі розділи всіх рівнів, створення, порядок */
export const StoryAdminPage = () => {
    const navigate = useNavigate();
    const [chapters, setChapters] = useState<AdminChapter[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [busyId, setBusyId] = useState<string | null>(null);
    const [isCreating, setIsCreating] = useState(false);

    const load = useCallback(async () => {
        try {
            setChapters(await adminApi.listChapters());
            setError(null);
        } catch (e) {
            setError(adminApi.adminErrorMessage(e));
        }
    }, []);

    useEffect(() => {
        void load();
    }, [load]);

    const byLevel = useMemo(() => {
        const groups = new Map<EnglishLevel, AdminChapter[]>();
        for (const chapter of chapters ?? []) {
            const list = groups.get(chapter.level) ?? [];
            list.push(chapter);
            groups.set(chapter.level, list);
        }
        return LEVELS.filter((level) => groups.has(level)).map((level) => ({
            level,
            chapters: groups.get(level)!,
        }));
    }, [chapters]);

    const stats = useMemo(() => {
        const list = chapters ?? [];
        return {
            chapters: list.length,
            lessons: list.reduce((sum, c) => sum + c.lessons, 0),
            drafts: list.filter((c) => !c.published).length,
        };
    }, [chapters]);

    const move = async (chapter: AdminChapter, direction: MoveDirection) => {
        setBusyId(chapter.id);
        try {
            await adminApi.moveChapter(chapter.id, direction);
            await load();
        } catch (e) {
            setError(adminApi.adminErrorMessage(e));
        } finally {
            setBusyId(null);
        }
    };

    const create = async (input: ChapterInput) => {
        const chapter = await adminApi.createChapter(input); // помилки обробляє форма
        setIsCreating(false);
        navigate(`/learning/admin/${chapter.id}`);
    };

    return (
        <div className="mx-auto min-h-[100dvh] max-w-3xl px-4 pb-[calc(96px+env(safe-area-inset-bottom))] pt-[calc(env(safe-area-inset-top)+16px)]">
            <header className="flex items-center gap-3">
                <button
                    type="button"
                    onClick={() => navigate("/learning")}
                    aria-label="До навчання"
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xl text-[var(--text-muted)] hover:bg-[var(--bg-card)]"
                >
                    ←
                </button>
                <div className="min-w-0 flex-1">
                    <h1 className="text-2xl font-extrabold">Адмінка навчання</h1>
                    {chapters && (
                        <p className="text-sm text-[var(--text-muted)]">
                            Розділів: {stats.chapters} · уроків: {stats.lessons}
                            {stats.drafts > 0 ? ` · чернеток: ${stats.drafts}` : ""}
                        </p>
                    )}
                </div>
                <Button onClick={() => setIsCreating(true)}>+ Розділ</Button>
            </header>

            {error && (
                <div role="alert" className="mt-4 flex items-center justify-between gap-3 rounded-2xl bg-[var(--accent-error)]/15 p-3 text-sm">
                    <span>{error}</span>
                    <Button size="sm" variant="ghost" onClick={() => void load()}>
                        Оновити
                    </Button>
                </div>
            )}

            {!chapters && !error && (
                <div className="flex justify-center py-20" aria-label="Завантаження">
                    <CookieMascot state="thinking" size={72} className="animate-pulse" />
                </div>
            )}

            {chapters && chapters.length === 0 && (
                <div className="flex flex-col items-center gap-3 py-16 text-center">
                    <CookieMascot state="idle" size={96} />
                    <p className="text-lg font-bold">Розділів ще немає</p>
                    <p className="max-w-sm text-sm text-[var(--text-muted)]">
                        Створіть розділ, потім додайте в нього уроки JSON-ом. Поки розділ — чернетка, юзери його не бачать.
                    </p>
                    <Button onClick={() => setIsCreating(true)}>Створити перший розділ</Button>
                </div>
            )}

            {byLevel.map(({ level, chapters: list }) => (
                <section key={level} className="mt-6">
                    <h2 className="mb-2 text-sm font-extrabold uppercase tracking-wide text-[var(--text-muted)]">
                        Рівень {level}
                    </h2>
                    <ol className="flex flex-col gap-2">
                        {list.map((chapter, i) => (
                            <ChapterRow
                                key={chapter.id}
                                chapter={chapter}
                                isFirst={i === 0}
                                isLast={i === list.length - 1}
                                isBusy={busyId !== null}
                                onMove={(direction) => void move(chapter, direction)}
                                onOpen={() => navigate(`/learning/admin/${chapter.id}`)}
                            />
                        ))}
                    </ol>
                </section>
            ))}

            {isCreating && (
                <AdminSheet title="Новий розділ" onClose={() => setIsCreating(false)}>
                    <ChapterForm submitLabel="Створити розділ" onSubmit={create} onCancel={() => setIsCreating(false)} />
                </AdminSheet>
            )}
        </div>
    );
};