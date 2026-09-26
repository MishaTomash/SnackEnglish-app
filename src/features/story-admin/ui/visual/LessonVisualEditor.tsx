// 📁 Файл: SnackEnglish-app/src/features/story-admin/ui/visual/LessonVisualEditor.tsx
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FC } from "react";
import { AdminValidationError, adminErrorMessage, validateLessons } from "../../../../entities/story/adminApi";
import type { ContentIssue, LessonJson } from "../../../../entities/story/adminTypes";
import type { StepPayload } from "../../../../entities/story/types";
import { Button } from "../../../../shared/ui/Button";
import { ConfirmDialog } from "../../../../shared/ui/ConfirmDialog";
import { AdminSheet } from "../AdminSheet";
import { IssuesList } from "../IssuesList";
import { LessonPreview } from "../LessonPreview";
import { parseJson } from "../../lib/parseJson";
import { localStepIssues } from "../../lib/stepCatalog";
import { StepList } from "./StepList";
import { EmojiField, Field, TextField, inputClass } from "./fields";

/**
 * Візуальний редактор уроку: поля замість JSON, кроки картками, прев'ю з будь-якого кроку,
 * перевірка з помилками прямо на потрібному кроці й автозбереження чернетки.
 * Вкладка JSON лишилась — для досвідчених і для вставки кількох уроків одразу.
 */

export interface LessonDraft {
    slug?: string;
    label: string;
    icon: string;
    npc: string;
    npcName: string;
    isBoss: boolean;
    cliffhanger: string;
    steps: StepPayload[];
}

const EMPTY_LESSON: LessonDraft = {
    label: "",
    icon: "☕",
    npc: "",
    npcName: "",
    isBoss: false,
    cliffhanger: "",
    steps: [],
};

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const str = (value: unknown): string => (typeof value === "string" ? value : "");

/**
 * Правильна відповідь у старих уроках могла бути текстом варіанта ("coffee").
 * Перетворюємо на номер: інакше після перейменування варіанта відповідь "загубиться".
 * Рекурсивно — і в гілках сюжетного вибору.
 */
const normalizeStep = (step: unknown): unknown => {
    if (!isRecord(step)) return step;
    if ((step.type === "quiz" || step.type === "listen") && typeof step.correct === "string" && Array.isArray(step.options)) {
        const target = step.correct.trim().toLowerCase();
        const index = step.options.findIndex((o) => typeof o === "string" && o.trim().toLowerCase() === target);
        if (index >= 0) return { ...step, correct: index };
    }
    if (step.type === "choice" && Array.isArray(step.options)) {
        return {
            ...step,
            options: step.options.map((option) =>
                isRecord(option) && Array.isArray(option.outcome) ? { ...option, outcome: option.outcome.map(normalizeStep) } : option,
            ),
        };
    }
    return step;
};

/** Урок із сервера (або з JSON) -> чернетка редактора */
export const toDraft = (raw: unknown): LessonDraft => {
    if (!isRecord(raw)) return { ...EMPTY_LESSON };
    const cliffhanger = isRecord(raw.cliffhanger) ? str(raw.cliffhanger.text) : "";
    return {
        ...(typeof raw.slug === "string" && raw.slug ? { slug: raw.slug } : {}),
        label: str(raw.label),
        icon: str(raw.icon) || "⭐",
        npc: str(raw.npc),
        npcName: str(raw.npcName),
        isBoss: raw.isBoss === true,
        cliffhanger,
        steps: Array.isArray(raw.steps) ? (raw.steps.filter(isRecord).map(normalizeStep) as unknown as StepPayload[]) : [],
    };
};

/** Прибирає порожні необов'язкові поля — сервер не любить "" там, де поля може не бути */
const prune = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map((item) => prune(item));
    if (!isRecord(value)) return value;
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
        if (v === undefined || v === "") continue;
        // Порожні списки зайвих слів і гілок — те саме, що їх відсутність
        if (Array.isArray(v) && v.length === 0 && (k === "distractors" || k === "outcome")) continue;
        result[k] = prune(v);
    }
    return result;
};

/** Чернетка -> дані для сервера (формат, який приймає валідатор) */
export const toPayload = (draft: LessonDraft): Record<string, unknown> => {
    const payload: Record<string, unknown> = {
        ...(draft.slug ? { slug: draft.slug } : {}),
        label: draft.label.trim(),
        icon: draft.icon.trim() || "⭐",
        npc: draft.npc.trim(),
        npcName: draft.npcName.trim(),
        isBoss: draft.isBoss,
        steps: draft.steps.map((step) => prune(step)),
    };
    if (!payload.npc) delete payload.npc;
    if (!payload.npcName) delete payload.npcName;
    if (draft.cliffhanger.trim()) payload.cliffhanger = { text: draft.cliffhanger.trim() };
    return payload;
};

/** Номер кроку верхнього рівня з шляху помилки: "steps[3].options[1]" -> 3 */
const stepIndexOf = (path: string): number | null => {
    const match = /^steps\[(\d+)\]/.exec(path);
    return match ? Number(match[1]) : null;
};

interface StoredDraft {
    savedAt: number;
    mode: "visual" | "json";
    draft: LessonDraft;
    json: string;
}

const readStoredDraft = (key: string): StoredDraft | null => {
    try {
        const raw = localStorage.getItem(key);
        if (!raw) return null;
        const parsed: unknown = JSON.parse(raw);
        return isRecord(parsed) && typeof parsed.savedAt === "number" ? (parsed as unknown as StoredDraft) : null;
    } catch {
        return null;
    }
};

const writeStoredDraft = (key: string, value: StoredDraft | null): void => {
    try {
        if (value) localStorage.setItem(key, JSON.stringify(value));
        else localStorage.removeItem(key);
    } catch {
        // сховище недоступне — чернетка просто не збережеться
    }
};

type Busy = "validate" | "save" | null;

export interface LessonVisualEditorProps {
    mode: "create" | "edit";
    title: string;
    /** Урок для редагування (формат getNode().lesson); null — новий */
    initialLesson: unknown;
    /** Ключ автозбереження чернетки (свій для кожного уроку) */
    draftKey: string;
    /** Кидає AdminValidationError, якщо сервер знайшов помилки */
    onSave: (data: unknown) => Promise<void>;
    onClose: () => void;
}

export const LessonVisualEditor: FC<LessonVisualEditorProps> = ({ mode, title, initialLesson, draftKey, onSave, onClose }) => {
    const initialDraft = useMemo(() => (initialLesson ? toDraft(initialLesson) : { ...EMPTY_LESSON }), [initialLesson]);
    const initialJson = useMemo(() => JSON.stringify(toPayload(initialDraft), null, 2), [initialDraft]);

    const [draft, setDraft] = useState<LessonDraft>(initialDraft);
    const [tab, setTab] = useState<"visual" | "json">("visual");
    const [jsonText, setJsonText] = useState(initialJson);
    const [jsonError, setJsonError] = useState<string | null>(null);
    const [issues, setIssues] = useState<ContentIssue[]>([]);
    const [okMessage, setOkMessage] = useState<string | null>(null);
    const [requestError, setRequestError] = useState<string | null>(null);
    const [busy, setBusy] = useState<Busy>(null);
    const [preview, setPreview] = useState<LessonJson | null>(null);
    const [confirmClose, setConfirmClose] = useState(false);
    const [storedDraft, setStoredDraft] = useState<StoredDraft | null>(() => {
        const stored = readStoredDraft(draftKey);
        // Пропонуємо відновити лише якщо чернетка відрізняється від збереженого уроку
        return stored && stored.json !== initialJson ? stored : null;
    });
    const [showAdvanced, setShowAdvanced] = useState(Boolean(initialDraft.slug));

    const currentJson = tab === "visual" ? JSON.stringify(toPayload(draft), null, 2) : jsonText;
    const isDirty = currentJson.trim() !== initialJson.trim();

    // ---------- автозбереження чернетки ----------
    const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    useEffect(() => {
        if (storedDraft) return; // спершу юзер вирішує, що робити зі старою чернеткою
        clearTimeout(saveTimer.current);
        saveTimer.current = setTimeout(() => {
            writeStoredDraft(draftKey, isDirty ? { savedAt: Date.now(), mode: tab, draft, json: currentJson } : null);
        }, 800);
        return () => clearTimeout(saveTimer.current);
    }, [draft, jsonText, tab, isDirty, currentJson, draftKey, storedDraft]);

    const resetFeedback = () => {
        setIssues([]);
        setOkMessage(null);
        setRequestError(null);
    };

    const updateDraft = (patch: Partial<LessonDraft>) => {
        setDraft((prev) => ({ ...prev, ...patch }));
        setOkMessage(null);
    };

    // ---------- вкладки ----------
    const switchTab = (next: "visual" | "json") => {
        if (next === tab) return;
        if (next === "json") {
            setJsonText(JSON.stringify(toPayload(draft), null, 2));
            setJsonError(null);
            setTab("json");
            return;
        }
        const parsed = parseJson(jsonText);
        if (!parsed.ok) {
            setJsonError(`Помилка JSON${parsed.line !== undefined ? ` (рядок ${parsed.line})` : ""}: ${parsed.hint ?? parsed.message}`);
            return;
        }
        if (Array.isArray(parsed.value)) {
            setJsonError("Тут кілька уроків [ … ] — візуально редагується лише один. Збережи їх з цієї вкладки.");
            return;
        }
        setDraft(toDraft(parsed.value));
        setJsonError(null);
        setTab("visual");
    };

    /** Дані для відправки з активної вкладки; null — JSON з помилкою */
    const collectData = (): unknown | null => {
        if (tab === "visual") return toPayload(draft);
        const parsed = parseJson(jsonText);
        if (!parsed.ok) {
            setJsonError(`Помилка JSON${parsed.line !== undefined ? ` (рядок ${parsed.line})` : ""}: ${parsed.hint ?? parsed.message}`);
            return null;
        }
        if (mode === "edit" && Array.isArray(parsed.value)) {
            setJsonError("Під час редагування — один урок { … }, а не масив [ … ]");
            return null;
        }
        setJsonError(null);
        return parsed.value;
    };

    const run = async (kind: Exclude<Busy, null>, action: () => Promise<void>) => {
        setBusy(kind);
        resetFeedback();
        try {
            await action();
        } catch (error) {
            if (error instanceof AdminValidationError) setIssues(error.issues);
            else setRequestError(adminErrorMessage(error));
        } finally {
            setBusy(null);
        }
    };

    const handleValidate = () => {
        const data = collectData();
        if (data === null) return;
        void run("validate", async () => {
            const result = await validateLessons(data);
            if (!result.ok) setIssues(result.issues);
            else setOkMessage(result.lessons === 1 ? "✓ Помилок немає" : `✓ Помилок немає: уроків — ${result.lessons}`);
        });
    };

    const handleSave = useCallback(() => {
        const data = collectData();
        if (data === null) return;
        void run("save", async () => {
            await onSave(data);
            writeStoredDraft(draftKey, null); // збережено — чернетка більше не потрібна
        });
        // collectData/run читають актуальний стан при кожному рендері
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tab, draft, jsonText, mode, onSave, draftKey]);

    const openPreview = (fromIndex = 0) => {
        const data = collectData();
        if (data === null) return;
        const lessons = (Array.isArray(data) ? data : [data]) as LessonJson[];
        const lesson = lessons[0];
        if (!lesson) return;
        // Прев'ю з кроку N — зручно перевіряти кінець довгого уроку
        setPreview(fromIndex > 0 ? ({ ...lesson, steps: lesson.steps.slice(fromIndex) } as LessonJson) : lesson);
    };

    // Ctrl/Cmd+S — зберегти
    useEffect(() => {
        const onKey = (event: KeyboardEvent) => {
            if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
                event.preventDefault();
                if (!busy) handleSave();
            }
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [busy, handleSave]);

    // Помилки з сервера — на картках кроків
    const serverIssues = useMemo(() => {
        const map = new Map<number, string[]>();
        issues.forEach((issue) => {
            const index = stepIndexOf(issue.path);
            if (index === null) return;
            const path = issue.path.replace(/^steps\[\d+\]\.?/, "");
            map.set(index, [...(map.get(index) ?? []), path ? `${path}: ${issue.message}` : issue.message]);
        });
        return map;
    }, [issues]);
    const lessonIssues = issues.filter((issue) => stepIndexOf(issue.path) === null);
    const localProblemCount = draft.steps.reduce((sum, step) => sum + localStepIssues(step).length, 0);

    const requestClose = () => {
        if (isDirty && !busy) setConfirmClose(true);
        else onClose();
    };

    return (
        <>
            <AdminSheet
                title={title}
                onClose={requestClose}
                footer={
                    <>
                        <Button variant="secondary" size="sm" onClick={handleValidate} isLoading={busy === "validate"} disabled={!!busy}>
                            Перевірити
                        </Button>
                        <Button variant="secondary" size="sm" onClick={() => openPreview(0)} disabled={!!busy}>
                            ▶ Переглянути
                        </Button>
                        <Button size="sm" onClick={handleSave} isLoading={busy === "save"} disabled={!!busy}>
                            Зберегти
                        </Button>
                    </>
                }
            >
                <div className="flex flex-col gap-4">
                    {storedDraft && (
                        <div className="rounded-2xl border border-[var(--accent-cta)] bg-[var(--accent-cta)]/10 p-3">
                            <p className="text-sm font-bold text-[var(--text-main)]">
                                Є незбережена чернетка від {new Date(storedDraft.savedAt).toLocaleString("uk-UA")}
                            </p>
                            <div className="mt-2 flex gap-2">
                                <Button
                                    size="sm"
                                    onClick={() => {
                                        setDraft(storedDraft.draft);
                                        setJsonText(storedDraft.json);
                                        setTab(storedDraft.mode);
                                        setStoredDraft(null);
                                    }}
                                >
                                    Відновити
                                </Button>
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => {
                                        writeStoredDraft(draftKey, null);
                                        setStoredDraft(null);
                                    }}
                                >
                                    Відкинути
                                </Button>
                            </div>
                        </div>
                    )}

                    <div className="flex gap-1 rounded-xl bg-[var(--bg-app)] p-1" role="tablist">
                        {(["visual", "json"] as const).map((value) => (
                            <button
                                key={value}
                                type="button"
                                role="tab"
                                aria-selected={tab === value}
                                onClick={() => switchTab(value)}
                                className={`flex-1 rounded-lg py-1.5 text-sm font-bold ${tab === value ? "bg-[var(--accent-cta)] text-[var(--text-accent)]" : "text-[var(--text-muted)]"
                                    }`}
                            >
                                {value === "visual" ? "✏️ Візуально" : "{ } JSON"}
                            </button>
                        ))}
                    </div>
                    {jsonError && (
                        <p role="alert" className="rounded-xl bg-[var(--accent-error)]/10 p-2 text-sm font-semibold text-[var(--accent-error)]">
                            {jsonError}
                        </p>
                    )}

                    {tab === "visual" ? (
                        <>
                            <section className="space-y-3 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] p-3">
                                <div className="grid grid-cols-[auto_1fr] gap-3">
                                    <EmojiField label="Іконка" value={draft.icon} onChange={(icon) => updateDraft({ icon })} />
                                    <TextField label="Назва уроку" required maxLength={60} value={draft.label} onChange={(label) => updateDraft({ label })} placeholder="У кав'ярні" />
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <TextField
                                        label="Персонаж уроку"
                                        value={draft.npcName}
                                        onChange={(npcName) => updateDraft({ npcName })}
                                        placeholder="Бариста"
                                        hint="Його репліки в діалогах — окремим голосом"
                                    />
                                    <Field label="Бос розділу">
                                        <label className="flex h-[38px] items-center gap-2 text-sm text-[var(--text-main)]">
                                            <input type="checkbox" checked={draft.isBoss} onChange={(e) => updateDraft({ isBoss: e.target.checked })} className="h-5 w-5 accent-[var(--accent-cta)]" />
                                            👑 Урок-бос
                                        </label>
                                    </Field>
                                </div>
                                <TextField
                                    label="Клифгенгер (інтрига в кінці)"
                                    value={draft.cliffhanger}
                                    onChange={(cliffhanger) => updateDraft({ cliffhanger })}
                                    placeholder="А хто ж залишив цю записку?.."
                                    hint="Показується після уроку — щоб хотілося пройти наступний."
                                />
                                <button type="button" onClick={() => setShowAdvanced((v) => !v)} className="text-xs font-bold text-[var(--text-muted)]">
                                    {showAdvanced ? "▾" : "▸"} Додатково
                                </button>
                                {showAdvanced && (
                                    <div className="grid grid-cols-2 gap-3">
                                        <TextField
                                            label="Slug (адреса)"
                                            value={draft.slug}
                                            onChange={(slug) => updateDraft({ slug: slug || undefined })}
                                            placeholder="at-the-cafe"
                                            hint="Латиниця, цифри, дефіси. Порожньо — згенерується."
                                        />
                                        <TextField label="Ключ спрайта персонажа" value={draft.npc} onChange={(npc) => updateDraft({ npc })} placeholder="barista" />
                                    </div>
                                )}
                            </section>

                            <div className="flex items-center justify-between">
                                <h3 className="text-sm font-extrabold text-[var(--text-main)]">Кроки ({draft.steps.length})</h3>
                                {localProblemCount > 0 && <span className="text-xs font-semibold text-[var(--accent-cta)]">⚠ незаповнено: {localProblemCount}</span>}
                            </div>
                            <StepList
                                steps={draft.steps}
                                onChange={(steps) => updateDraft({ steps })}
                                serverIssues={serverIssues}
                                onPreviewFrom={(index) => openPreview(index)}
                            />
                        </>
                    ) : (
                        <div className="space-y-2">
                            <p className="text-xs text-[var(--text-muted)]">
                                {mode === "create"
                                    ? "Один урок { … } або кілька масивом [ { … }, { … } ] — щоб додати багато уроків за раз."
                                    : "JSON уроку. Зміни тут переносяться у візуальний редактор при перемиканні вкладки."}
                            </p>
                            <textarea
                                value={jsonText}
                                onChange={(e) => {
                                    setJsonText(e.target.value);
                                    setOkMessage(null);
                                }}
                                spellCheck={false}
                                autoCapitalize="off"
                                autoCorrect="off"
                                wrap="off"
                                aria-label="JSON уроку"
                                className={`${inputClass} min-h-[55dvh] resize-y font-mono leading-5`}
                            />
                        </div>
                    )}

                    <IssuesList issues={tab === "visual" ? lessonIssues : issues} />
                    {tab === "visual" && issues.length > lessonIssues.length && (
                        <p className="text-xs font-semibold text-[var(--accent-error)]">Помилки в кроках позначено червоним — відкрий крок, щоб побачити.</p>
                    )}
                    {requestError && (
                        <p role="alert" className="text-sm font-semibold text-[var(--accent-error)]">
                            {requestError}
                        </p>
                    )}
                    {okMessage && (
                        <p role="status" className="rounded-2xl bg-[var(--accent-success)]/15 p-3 font-bold text-[var(--accent-success)]">
                            {okMessage}
                        </p>
                    )}
                    <p className="hidden text-xs text-[var(--text-muted)] sm:block">Ctrl+S — зберегти · чернетка зберігається автоматично</p>
                </div>
            </AdminSheet>

            {preview && <LessonPreview lesson={preview} onClose={() => setPreview(null)} />}

            <ConfirmDialog
                open={confirmClose}
                title="Закрити без збереження?"
                confirmLabel="Закрити"
                danger
                onConfirm={() => {
                    setConfirmClose(false);
                    onClose();
                }}
                onCancel={() => setConfirmClose(false)}
            >
                Зміни не збережено на сервері, але чернетка лишиться — її можна буде відновити наступного разу.
            </ConfirmDialog>
        </>
    );
};