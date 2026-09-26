// 📁 Файл: SnackEnglish-app/src/features/admin-panel/ui/ContentTab.tsx
import { useMemo, useRef, useState } from "react";
import type { FC } from "react";
import { ChevronDown, ChevronUp, RefreshCw } from "lucide-react";
import { adminApi } from "../api";
import type { ContentChapter } from "../api";
import { useAdminQuery } from "../lib/useAdminQuery";
import { AdminButton, EmptyState, ErrorState, LoadingState, Pill, Section, formatDateTime, formatNumber } from "./primitives";

/** Частка, що пройшла вузол, від тих, хто почав розділ */
const percentOf = (value: number, base: number): number => (base > 0 ? Math.round((value / base) * 100) : 0);

/**
 * Найбільше падіння між сусідніми вузлами — "проблемний" урок,
 * де юзери найчастіше кидають розділ.
 */
const findBiggestDrop = (chapter: ContentChapter): { index: number; lost: number } | null => {
    let best: { index: number; lost: number } | null = null;
    for (let i = 1; i < chapter.nodes.length; i++) {
        const lost = chapter.nodes[i - 1].completed - chapter.nodes[i].completed;
        if (lost > 0 && (!best || lost > best.lost)) best = { index: i, lost };
    }
    return best;
};

const ChapterFunnel: FC<{ chapter: ContentChapter }> = ({ chapter }) => {
    const [open, setOpen] = useState(false);
    const base = chapter.startedUsers;
    const drop = useMemo(() => findBiggestDrop(chapter), [chapter]);
    const completion = percentOf(chapter.finishedUsers, base);

    return (
        <li className="rounded-2xl bg-[var(--bg-app)] p-3">
            <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                aria-expanded={open}
                className="flex w-full items-center justify-between gap-2 text-left"
            >
                <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                        <span className="truncate text-sm font-bold text-[var(--text-main)]">{chapter.title}</span>
                        <Pill>{chapter.level}</Pill>
                        {!chapter.published && <Pill tone="warning">чернетка</Pill>}
                    </div>
                    <p className="text-[11px] text-[var(--text-muted)]">
                        {chapter.nodes.length} уроків · почали {formatNumber(base)} · завершили {formatNumber(chapter.finishedUsers)} (
                        {completion}%)
                    </p>
                </div>
                {open ? (
                    <ChevronUp className="h-4 w-4 shrink-0 text-[var(--text-muted)]" aria-hidden="true" />
                ) : (
                    <ChevronDown className="h-4 w-4 shrink-0 text-[var(--text-muted)]" aria-hidden="true" />
                )}
            </button>

            {open && (
                <div className="mt-3 space-y-2">
                    {chapter.nodes.length === 0 ? (
                        <EmptyState>У розділі ще немає уроків</EmptyState>
                    ) : (
                        <>
                            {drop && base > 0 && (
                                <p className="rounded-xl bg-[var(--accent-error)]/10 px-3 py-2 text-xs text-[var(--accent-error)]">
                                    Найбільше юзерів кидають перед уроком «{chapter.nodes[drop.index].label}»: −{formatNumber(drop.lost)}
                                </p>
                            )}
                            <ul className="space-y-1.5">
                                {chapter.nodes.map((node, i) => {
                                    const pct = percentOf(node.completed, base);
                                    const isDrop = drop?.index === i;
                                    return (
                                        <li key={node.id}>
                                            <div className="mb-0.5 flex justify-between gap-2 text-xs">
                                                <span className={`truncate ${isDrop ? "font-bold text-[var(--accent-error)]" : "text-[var(--text-main)]"}`}>
                                                    {i + 1}. {node.icon ? `${node.icon} ` : ""}
                                                    {node.label}
                                                    {node.isBoss ? " 👑" : ""}
                                                </span>
                                                <span className="shrink-0 text-[var(--text-muted)]">
                                                    {formatNumber(node.completed)} · {pct}%
                                                </span>
                                            </div>
                                            <div className="h-1.5 overflow-hidden rounded-full bg-[var(--bg-card)]">
                                                <div
                                                    className="h-full rounded-full"
                                                    style={{
                                                        width: `${pct}%`,
                                                        backgroundColor: isDrop ? "var(--accent-error)" : "var(--accent-success)",
                                                    }}
                                                />
                                            </div>
                                        </li>
                                    );
                                })}
                            </ul>
                        </>
                    )}
                </div>
            )}
        </li>
    );
};

export const ContentTab: FC = () => {
    const forceFreshRef = useRef(false);
    const { data, error, isLoading, reload } = useAdminQuery(() => {
        const fresh = forceFreshRef.current;
        forceFreshRef.current = false;
        return adminApi.content(fresh);
    }, []);
    const [level, setLevel] = useState("all");

    const levels = useMemo(() => Array.from(new Set((data?.chapters ?? []).map((c) => c.level))), [data]);
    const chapters = (data?.chapters ?? []).filter((c) => level === "all" || c.level === level);

    return (
        <div className="space-y-4">
            <Section
                title="Воронка уроків"
                action={
                    <AdminButton
                        variant="secondary"
                        loading={isLoading}
                        onClick={() => {
                            forceFreshRef.current = true;
                            reload();
                        }}
                    >
                        <RefreshCw className="h-4 w-4" aria-hidden="true" />
                        <span className="sr-only">Оновити</span>
                    </AdminButton>
                }
            >
                <p className="mb-3 text-xs text-[var(--text-muted)]">
                    Скільки юзерів пройшли кожен урок від тих, хто почав розділ. Червоним — урок, де кидають найчастіше:
                    можливо, він заважкий або задовгий.
                    {data && ` Дані на ${formatDateTime(data.generatedAt)}.`}
                </p>
                {levels.length > 1 && (
                    <select
                        value={level}
                        onChange={(e) => setLevel(e.target.value)}
                        className="mb-3 w-auto rounded-xl border border-[var(--border-color)] bg-[var(--bg-app)] px-3 py-2 text-sm text-[var(--text-main)]"
                        aria-label="Рівень"
                    >
                        <option value="all">Усі рівні</option>
                        {levels.map((l) => (
                            <option key={l} value={l}>
                                {l}
                            </option>
                        ))}
                    </select>
                )}

                {isLoading && !data ? (
                    <LoadingState />
                ) : error ? (
                    <ErrorState message={error} onRetry={reload} />
                ) : chapters.length === 0 ? (
                    <EmptyState>Розділів немає</EmptyState>
                ) : (
                    <ul className="space-y-2">
                        {chapters.map((chapter) => (
                            <ChapterFunnel key={chapter.id} chapter={chapter} />
                        ))}
                    </ul>
                )}
            </Section>
        </div>
    );
};