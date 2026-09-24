import { useRef, useState } from "react";
import type { FC, KeyboardEvent } from "react";
import {
    AdminValidationError,
    adminErrorMessage,
    validateLessons,
} from "../../../entities/story/adminApi";
import type { ContentIssue, LessonJson } from "../../../entities/story/adminTypes";
import { Button } from "../../../shared/ui/Button";
import { ConfirmDialog } from "../../../shared/ui/ConfirmDialog";
import { LESSON_TEMPLATE_JSON } from "../lib/lessonTemplate";
import { lineRange, parseJson } from "../lib/parseJson";
import type { JsonParseResult } from "../lib/parseJson";
import { AdminSheet } from "./AdminSheet";
import { IssuesList } from "./IssuesList";
import { LessonPreview } from "./LessonPreview";

export interface LessonJsonEditorProps {
    /** create — урок-об'єкт або масив уроків; edit — рівно один урок-об'єкт */
    mode: "create" | "edit";
    title: string;
    initialText?: string;
    /** Кидає AdminValidationError, якщо сервер знайшов помилки */
    onSave: (data: unknown) => Promise<void>;
    onClose: () => void;
}

type ParseError = Extract<JsonParseResult, { ok: false }>;
type Busy = "validate" | "preview" | "save" | null;

const LINE_HEIGHT_PX = 20; // leading-5 у textarea

export const LessonJsonEditor: FC<LessonJsonEditorProps> = ({
    mode,
    title,
    initialText = "",
    onSave,
    onClose,
}) => {
    const [text, setText] = useState(initialText);
    const [parseError, setParseError] = useState<ParseError | null>(null);
    const [issues, setIssues] = useState<ContentIssue[]>([]);
    const [okMessage, setOkMessage] = useState<string | null>(null);
    const [requestError, setRequestError] = useState<string | null>(null);
    const [busy, setBusy] = useState<Busy>(null);
    const [cursor, setCursor] = useState({ line: 1, column: 1 });
    const [previewChoices, setPreviewChoices] = useState<LessonJson[] | null>(null);
    const [previewLesson, setPreviewLesson] = useState<LessonJson | null>(null);
    const [confirm, setConfirm] = useState<"close" | "template" | null>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const isDirty = text !== initialText;

    const resetFeedback = () => {
        setParseError(null);
        setIssues([]);
        setOkMessage(null);
        setRequestError(null);
    };

    const jumpToLine = (line: number) => {
        const textarea = textareaRef.current;
        if (!textarea) return;
        const { start, end } = lineRange(text, line);
        textarea.focus();
        textarea.setSelectionRange(start, end);
        textarea.scrollTop = Math.max(0, (line - 4) * LINE_HEIGHT_PX);
    };

    /** Розбір + локальна перевірка форми (масив у режимі редагування) */
    const parseLocal = (): { ok: true; data: unknown } | { ok: false } => {
        resetFeedback();
        const parsed = parseJson(text);
        if (!parsed.ok) {
            setParseError(parsed);
            return { ok: false };
        }
        if (mode === "edit" && Array.isArray(parsed.value)) {
            setIssues([{ path: "(корінь)", message: "під час редагування — один урок-об'єкт { … }, а не масив [ … ]" }]);
            return { ok: false };
        }
        return { ok: true, data: parsed.value };
    };

    /** Перевірка на сервері тим самим валідатором, що й при збереженні */
    const validateRemote = async (data: unknown): Promise<boolean> => {
        const result = await validateLessons(data);
        if (!result.ok) {
            setIssues(result.issues);
            return false;
        }
        setOkMessage(
            result.lessons === 1 ? "✓ Помилок немає: 1 урок" : `✓ Помилок немає: уроків — ${result.lessons}`,
        );
        return true;
    };

    const run = async (kind: Exclude<Busy, null>, action: () => Promise<void>) => {
        setBusy(kind);
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
        const local = parseLocal();
        if (!local.ok) return;
        void run("validate", async () => {
            await validateRemote(local.data);
        });
    };

    const handlePreview = () => {
        const local = parseLocal();
        if (!local.ok) return;
        void run("preview", async () => {
            if (!(await validateRemote(local.data))) return;
            const lessons = (Array.isArray(local.data) ? local.data : [local.data]) as LessonJson[];
            if (lessons.length === 1) setPreviewLesson(lessons[0]);
            else setPreviewChoices(lessons);
        });
    };

    const handleSave = () => {
        const local = parseLocal();
        if (!local.ok) return;
        void run("save", () => onSave(local.data));
    };

    const handleFormat = () => {
        const parsed = parseJson(text);
        if (!parsed.ok) {
            resetFeedback();
            setParseError(parsed);
            return;
        }
        setText(JSON.stringify(parsed.value, null, 2));
    };

    const insertTemplate = () => {
        setText(LESSON_TEMPLATE_JSON);
        resetFeedback();
        setConfirm(null);
    };

    const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
        // Tab — відступ, а не перехід фокусу
        if (event.key === "Tab" && !event.shiftKey) {
            event.preventDefault();
            const target = event.currentTarget;
            const { selectionStart, selectionEnd } = target;
            const next = `${text.slice(0, selectionStart)}  ${text.slice(selectionEnd)}`;
            setText(next);
            requestAnimationFrame(() => target.setSelectionRange(selectionStart + 2, selectionStart + 2));
        }
        // Ctrl/Cmd+S — зберегти, Ctrl/Cmd+Enter — перевірити
        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
            event.preventDefault();
            if (!busy) handleSave();
        }
        if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
            event.preventDefault();
            if (!busy) handleValidate();
        }
    };

    const updateCursor = () => {
        const textarea = textareaRef.current;
        if (!textarea) return;
        const before = text.slice(0, textarea.selectionStart);
        setCursor({
            line: before.split("\n").length,
            column: textarea.selectionStart - before.lastIndexOf("\n"),
        });
    };

    const requestClose = () => {
        if (isDirty && !busy) setConfirm("close");
        else onClose();
    };

    return (
        <>
            <AdminSheet
                title={title}
                onClose={requestClose}
                footer={
                    <>
                        <Button variant="ghost" size="sm" onClick={handleFormat} disabled={!!busy}>
                            Форматувати
                        </Button>
                        <Button variant="secondary" size="sm" onClick={handleValidate} isLoading={busy === "validate"} disabled={!!busy}>
                            Перевірити
                        </Button>
                        <Button variant="secondary" size="sm" onClick={handlePreview} isLoading={busy === "preview"} disabled={!!busy}>
                            ▶ Переглянути
                        </Button>
                        <Button size="sm" onClick={handleSave} isLoading={busy === "save"} disabled={!!busy}>
                            Зберегти
                        </Button>
                    </>
                }
            >
                <div className="flex flex-col gap-3">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-[var(--text-muted)]">
                        <span>
                            {mode === "create"
                                ? "Вставте один урок { … } або кілька уроків масивом [ { … }, { … } ]."
                                : "Редагування уроку: прогрес юзерів по ньому збережеться."}
                        </span>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => (text.trim() ? setConfirm("template") : insertTemplate())}
                            disabled={!!busy}
                        >
                            Вставити шаблон
                        </Button>
                    </div>

                    <textarea
                        ref={textareaRef}
                        value={text}
                        onChange={(event) => {
                            setText(event.target.value);
                            setOkMessage(null);
                        }}
                        onKeyDown={handleKeyDown}
                        onSelect={updateCursor}
                        onKeyUp={updateCursor}
                        onClick={updateCursor}
                        aria-label="JSON уроку"
                        spellCheck={false}
                        autoCapitalize="off"
                        autoCorrect="off"
                        wrap="off"
                        placeholder={'{\n  "label": "Назва уроку",\n  "icon": "☕",\n  "steps": [ … ]\n}'}
                        className="min-h-[50dvh] w-full resize-y rounded-2xl border-2 border-[var(--border-color)] bg-[var(--bg-card)] p-3 font-mono text-sm leading-5 text-[var(--text-main)] outline-none focus:border-[var(--accent-cta)]"
                    />
                    <div className="flex justify-between text-xs text-[var(--text-muted)]">
                        <span>
                            Рядок {cursor.line}, стовпець {cursor.column}
                        </span>
                        <span className="hidden sm:inline">Ctrl+Enter — перевірити · Ctrl+S — зберегти</span>
                    </div>

                    {parseError && (
                        <div role="alert" className="rounded-2xl border-2 border-[var(--accent-error)] bg-[var(--accent-error)]/10 p-4">
                            <p className="font-extrabold text-[var(--accent-error)]">
                                Це не валідний JSON{parseError.line !== undefined ? ` — рядок ${parseError.line}, стовпець ${parseError.column}` : ""}
                            </p>
                            {parseError.hint && <p className="mt-1 text-sm font-semibold">{parseError.hint}</p>}
                            <p className="mt-1 font-mono text-xs text-[var(--text-muted)]">{parseError.message}</p>
                            {parseError.line !== undefined && (
                                <Button className="mt-3" variant="outline" size="sm" onClick={() => jumpToLine(parseError.line!)}>
                                    Перейти до рядка {parseError.line}
                                </Button>
                            )}
                        </div>
                    )}

                    <IssuesList issues={issues} />

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
                </div>
            </AdminSheet>

            {previewChoices && (
                <AdminSheet title="Який урок переглянути?" onClose={() => setPreviewChoices(null)}>
                    <div className="flex flex-col gap-2">
                        {previewChoices.map((lesson, i) => (
                            <Button
                                key={i}
                                variant="secondary"
                                className="justify-start"
                                onClick={() => {
                                    setPreviewChoices(null);
                                    setPreviewLesson(lesson);
                                }}
                            >
                                {i + 1}. {lesson.icon ?? "⭐"} {lesson.label}
                            </Button>
                        ))}
                    </div>
                </AdminSheet>
            )}

            {previewLesson && <LessonPreview lesson={previewLesson} onClose={() => setPreviewLesson(null)} />}

            <ConfirmDialog
                open={confirm === "close"}
                title="Закрити без збереження?"
                confirmLabel="Закрити"
                danger
                onConfirm={() => {
                    setConfirm(null);
                    onClose();
                }}
                onCancel={() => setConfirm(null)}
            >
                Зміни в JSON буде втрачено.
            </ConfirmDialog>

            <ConfirmDialog
                open={confirm === "template"}
                title="Замінити текст шаблоном?"
                confirmLabel="Замінити"
                onConfirm={insertTemplate}
                onCancel={() => setConfirm(null)}
            >
                Поточний текст у редакторі буде замінено прикладом уроку з усіма типами кроків.
            </ConfirmDialog>
        </>
    );
};