// 📁 Файл: SnackEnglish-app/src/features/story-admin/ui/visual/StepList.tsx
import { useState } from "react";
import type { FC } from "react";
import type { StepPayload, StepType } from "../../../../entities/story/types";
import { STEP_CATALOG, STEP_META, localStepIssues, stepSummary } from "../../lib/stepCatalog";
import { StepForm } from "./StepForm";
import { moveItem, removeItem } from "./fields";

/** Гілки сюжету можуть містити вибір, але не глибше за 3 рівні (як у валідаторі) */
const MAX_DEPTH = 3;

let idCounter = 0;
const newId = (): string => `step-${Date.now().toString(36)}-${idCounter++}`;

const cloneStep = (step: StepPayload): StepPayload => JSON.parse(JSON.stringify(step)) as StepPayload;

/** Меню вибору типу нового кроку */
const AddStepMenu: FC<{ onPick: (type: StepType) => void; onClose: () => void; allowChoice: boolean }> = ({ onPick, onClose, allowChoice }) => (
    <div className="rounded-2xl border border-[var(--accent-cta)]/50 bg-[var(--bg-card)] p-3">
        <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-extrabold text-[var(--text-main)]">Який крок додати?</p>
            <button type="button" onClick={onClose} className="rounded-lg px-2 py-1 text-sm text-[var(--text-muted)]" aria-label="Закрити">
                ✕
            </button>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
            {STEP_CATALOG.filter((meta) => allowChoice || meta.type !== "choice").map((meta) => (
                <button
                    key={meta.type}
                    type="button"
                    onClick={() => onPick(meta.type)}
                    className="flex items-start gap-2 rounded-xl border border-[var(--border-color)] bg-[var(--bg-app)] p-2.5 text-left hover:border-[var(--accent-cta)]"
                >
                    <span className="text-2xl leading-none" aria-hidden="true">
                        {meta.emoji}
                    </span>
                    <span className="min-w-0">
                        <span className="block text-sm font-bold text-[var(--text-main)]">{meta.title}</span>
                        <span className="block text-[11px] leading-snug text-[var(--text-muted)]">{meta.description}</span>
                    </span>
                </button>
            ))}
        </div>
    </div>
);

export interface StepListProps {
    steps: StepPayload[];
    onChange: (steps: StepPayload[]) => void;
    depth?: number;
    /** Помилки з сервера по індексу кроку (лише верхній рівень) */
    serverIssues?: ReadonlyMap<number, string[]>;
    /** Запустити прев'ю з цього кроку (лише верхній рівень) */
    onPreviewFrom?: (index: number) => void;
}

export const StepList: FC<StepListProps> = ({ steps, onChange, depth = 0, serverIssues, onPreviewFrom }) => {
    // Стабільні ключі карток: кроки не мають id, а розгорнутість має переживати переміщення
    const [ids, setIds] = useState<string[]>(() => steps.map(newId));
    const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set());
    const [addAt, setAddAt] = useState<number | null>(null);

    // Кроки змінились ззовні (JSON-вкладка, чернетка) — оновлюємо ключі
    const keys = ids.length === steps.length ? ids : steps.map((_, i) => ids[i] ?? newId());
    if (keys !== ids) setIds(keys);

    const toggle = (id: string) =>
        setExpanded((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });

    const insert = (index: number, step: StepPayload) => {
        const id = newId();
        const nextSteps = [...steps];
        nextSteps.splice(index, 0, step);
        const nextIds = [...keys];
        nextIds.splice(index, 0, id);
        setIds(nextIds);
        setExpanded((prev) => new Set(prev).add(id)); // новий крок одразу розгорнутий
        onChange(nextSteps);
    };

    const move = (from: number, to: number) => {
        if (to < 0 || to >= steps.length) return;
        setIds(moveItem(keys, from, to));
        onChange(moveItem(steps, from, to));
    };

    const remove = (index: number) => {
        const meta = STEP_META[steps[index].type];
        if (!window.confirm(`Видалити крок ${index + 1} «${meta?.title ?? steps[index].type}»?`)) return;
        setIds(removeItem(keys, index));
        onChange(removeItem(steps, index));
    };

    const update = (index: number, step: StepPayload) => onChange(steps.map((s, i) => (i === index ? step : s)));

    const renderBranch = (branch: StepPayload[], onBranchChange: (next: StepPayload[]) => void, label: string) => (
        <details className="rounded-xl bg-[var(--bg-app)] p-2" open={branch.length > 0}>
            <summary className="cursor-pointer text-xs font-bold text-[var(--text-muted)]">
                {label}: {branch.length > 0 ? `${branch.length} кроків` : "без гілки (сюжет іде далі)"}
            </summary>
            <div className="mt-2">
                {depth + 1 >= MAX_DEPTH ? (
                    <p className="text-xs text-[var(--text-muted)]">Глибше гілок робити не можна.</p>
                ) : (
                    <StepList steps={branch} onChange={onBranchChange} depth={depth + 1} />
                )}
            </div>
        </details>
    );

    return (
        <div className="space-y-2">
            {steps.length === 0 && addAt === null && (
                <p className="rounded-2xl border border-dashed border-[var(--border-color)] p-4 text-center text-sm text-[var(--text-muted)]">
                    {depth === 0 ? "Урок поки порожній — додай перший крок." : "Кроків у гілці немає."}
                </p>
            )}

            {steps.map((step, index) => {
                const id = keys[index];
                const meta = STEP_META[step.type];
                const isOpen = expanded.has(id);
                const local = localStepIssues(step);
                const remote = serverIssues?.get(index) ?? [];
                const problems = [...remote, ...local];

                return (
                    <div key={id}>
                        {addAt === index && (
                            <div className="mb-2">
                                <AddStepMenu
                                    allowChoice={depth + 1 < MAX_DEPTH}
                                    onClose={() => setAddAt(null)}
                                    onPick={(type) => {
                                        insert(index, STEP_META[type].create());
                                        setAddAt(null);
                                    }}
                                />
                            </div>
                        )}
                        <div
                            className={`rounded-2xl border bg-[var(--bg-card)] ${remote.length > 0 ? "border-[var(--accent-error)]" : isOpen ? "border-[var(--accent-cta)]/60" : "border-[var(--border-color)]"
                                }`}
                        >
                            <div className="flex items-center gap-2 p-2.5">
                                <button
                                    type="button"
                                    onClick={() => toggle(id)}
                                    aria-expanded={isOpen}
                                    className="flex min-w-0 flex-1 items-center gap-2 text-left"
                                >
                                    <span className="w-5 shrink-0 text-center text-xs font-bold text-[var(--text-muted)]">{index + 1}</span>
                                    <span className="text-xl leading-none" aria-hidden="true">
                                        {meta?.emoji ?? "❔"}
                                    </span>
                                    <span className="min-w-0">
                                        <span className="flex items-center gap-1.5">
                                            <span className="text-sm font-bold text-[var(--text-main)]">{meta?.title ?? step.type}</span>
                                            {problems.length > 0 && (
                                                <span
                                                    className={`rounded-full px-1.5 text-[10px] font-extrabold ${remote.length > 0 ? "bg-[var(--accent-error)] text-white" : "bg-[var(--accent-cta)]/20 text-[var(--accent-cta)]"
                                                        }`}
                                                    title={problems.join("\n")}
                                                >
                                                    ⚠ {problems.length}
                                                </span>
                                            )}
                                        </span>
                                        {!isOpen && <span className="block truncate text-xs text-[var(--text-muted)]">{stepSummary(step)}</span>}
                                    </span>
                                </button>
                                <div className="flex shrink-0 items-center">
                                    {onPreviewFrom && (
                                        <button
                                            type="button"
                                            onClick={() => onPreviewFrom(index)}
                                            title="Переглянути урок з цього кроку"
                                            aria-label={`Переглянути з кроку ${index + 1}`}
                                            className="h-8 w-8 rounded-lg text-sm text-[var(--accent-cta)] hover:bg-[var(--bg-card-elevated)]"
                                        >
                                            ▶
                                        </button>
                                    )}
                                    <button
                                        type="button"
                                        onClick={() => move(index, index - 1)}
                                        disabled={index === 0}
                                        aria-label={`Крок ${index + 1} вище`}
                                        className="h-8 w-7 rounded-lg text-xs text-[var(--text-muted)] hover:bg-[var(--bg-card-elevated)] disabled:opacity-25"
                                    >
                                        ▲
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => move(index, index + 1)}
                                        disabled={index === steps.length - 1}
                                        aria-label={`Крок ${index + 1} нижче`}
                                        className="h-8 w-7 rounded-lg text-xs text-[var(--text-muted)] hover:bg-[var(--bg-card-elevated)] disabled:opacity-25"
                                    >
                                        ▼
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => insert(index + 1, cloneStep(step))}
                                        title="Дублювати"
                                        aria-label={`Дублювати крок ${index + 1}`}
                                        className="h-8 w-8 rounded-lg text-sm text-[var(--text-muted)] hover:bg-[var(--bg-card-elevated)]"
                                    >
                                        ⧉
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => remove(index)}
                                        aria-label={`Видалити крок ${index + 1}`}
                                        className="h-8 w-8 rounded-lg text-sm text-[var(--text-muted)] hover:bg-[var(--accent-error)]/15 hover:text-[var(--accent-error)]"
                                    >
                                        🗑
                                    </button>
                                </div>
                            </div>

                            {isOpen && (
                                <div className="space-y-3 border-t border-[var(--border-color)] p-3">
                                    {problems.length > 0 && (
                                        <ul className="space-y-0.5 rounded-xl bg-[var(--accent-error)]/10 p-2 text-xs text-[var(--accent-error)]">
                                            {problems.map((problem, i) => (
                                                <li key={i}>• {problem}</li>
                                            ))}
                                        </ul>
                                    )}
                                    <StepForm step={step} onChange={(next) => update(index, next)} renderBranch={renderBranch} />
                                    <button
                                        type="button"
                                        onClick={() => setAddAt(index + 1)}
                                        className="text-xs font-bold text-[var(--accent-cta)]"
                                    >
                                        + крок після цього
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                );
            })}

            {addAt !== null && addAt >= steps.length ? (
                <AddStepMenu
                    allowChoice={depth + 1 < MAX_DEPTH}
                    onClose={() => setAddAt(null)}
                    onPick={(type) => {
                        insert(steps.length, STEP_META[type].create());
                        setAddAt(null);
                    }}
                />
            ) : (
                <button
                    type="button"
                    onClick={() => setAddAt(steps.length)}
                    className="w-full rounded-2xl border-2 border-dashed border-[var(--border-color)] py-3 text-sm font-extrabold text-[var(--text-muted)] hover:border-[var(--accent-cta)] hover:text-[var(--accent-cta)]"
                >
                    + Додати крок
                </button>
            )}
        </div>
    );
};