import { useCallback, useEffect, useState } from "react";
import type { FC } from "react";
import { useNavigate, useParams } from "react-router-dom";
import * as adminApi from "../../../entities/story/adminApi";
import type {
    AdminChapter,
    AdminNode,
    ChapterInput,
    LessonJson,
    MoveDirection,
} from "../../../entities/story/adminTypes";
import { AdminSheet } from "../../../features/story-admin/ui/AdminSheet";
import { ChapterForm } from "../../../features/story-admin/ui/ChapterForm";
import { LessonJsonEditor } from "../../../features/story-admin/ui/LessonJsonEditor";
import { LessonPreview } from "../../../features/story-admin/ui/LessonPreview";
import { Button } from "../../../shared/ui/Button";
import { ConfirmDialog } from "../../../shared/ui/ConfirmDialog";
import { CookieMascot } from "../../../shared/ui/CookieMascot";

type EditorState =
    | { mode: "create" }
    | { mode: "edit"; node: AdminNode; text: string };

const STEP_LABELS: Record<string, string> = {
    scene: "сцена",
    dialogue: "діалог",
    cards: "картки",
    event: "подія",
    choice: "вибір",
    reply: "відповідь",
    listen: "аудіо",
    quiz: "тест",
    build: "речення",
    voice: "вимова",
};

interface LessonRowProps {
    node: AdminNode;
    isFirst: boolean;
    isLast: boolean;
    isBusy: boolean;
    onMove: (direction: MoveDirection) => void;
    onEdit: () => void;
    onPreview: () => void;
    onDelete: () => void;
}

const LessonRow: FC<LessonRowProps> = ({ node, isFirst, isLast, isBusy, onMove, onEdit, onPreview, onDelete }) => (
    <li className="flex items-start gap-3 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] p-3">
        <div className="flex flex-col gap-1">
            <button
                type="button"
                onClick={() => onMove("up")}
                disabled={isFirst || isBusy}
                aria-label={`Перемістити «${node.label}» вище`}
                className="h-7 w-7 rounded-lg text-sm text-[var(--text-muted)] hover:bg-[var(--bg-card-elevated)] disabled:opacity-25"
            >
                ▲
            </button>
            <button
                type="button"
                onClick={() => onMove("down")}
                disabled={isLast || isBusy}
                aria-label={`Перемістити «${node.label}» нижче`}
                className="h-7 w-7 rounded-lg text-sm text-[var(--text-muted)] hover:bg-[var(--bg-card-elevated)] disabled:opacity-25"
            >
                ▼
            </button>
        </div>
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[var(--bg-card-elevated)] text-2xl" aria-hidden="true">
            {node.icon}
        </span>
        <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-center gap-x-2 font-extrabold">
                <span className="truncate">{node.label}</span>
                {node.isBoss && <span className="text-xs text-[var(--accent-cta)]">👑 бос</span>}
            </p>
            <p className="text-xs text-[var(--text-muted)]">
                <span className="font-mono">{node.slug}</span> · кроків: {node.stepsCount}
                {node.hasCliffhanger ? " · є клифгенгер" : ""}
            </p>
            <div className="mt-1.5 flex flex-wrap gap-1">
                {node.stepTypes.map((type) => (
                    <span key={type} className="rounded-full bg-[var(--bg-app)] px-2 py-0.5 text-[10px] font-semibold text-[var(--text-muted)]">
                        {STEP_LABELS[type] ?? type}
                    </span>
                ))}
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" onClick={onPreview} disabled={isBusy} aria-label={`Переглянути «${node.label}»`}>
                    ▶ Переглянути
                </Button>
                <Button size="sm" variant="secondary" onClick={onEdit} disabled={isBusy} aria-label={`Редагувати JSON «${node.label}»`}>
                    ✏️ JSON
                </Button>
                <Button size="sm" variant="ghost" onClick={onDelete} disabled={isBusy} aria-label={`Видалити «${node.label}»`}>
                    🗑 Видалити
                </Button>
            </div>
        </div>
    </li>
);

/** Адмінка одного розділу: поля, публікація, уроки */
export const StoryAdminChapterPage = () => {
    const { chapterId = "" } = useParams();
    const navigate = useNavigate();

    const [chapter, setChapter] = useState<AdminChapter | null>(null);
    const [nodes, setNodes] = useState<AdminNode[]>([]);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [actionError, setActionError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const [isBusy, setIsBusy] = useState(false);

    const [isEditingMeta, setIsEditingMeta] = useState(false);
    const [editor, setEditor] = useState<EditorState | null>(null);
    const [preview, setPreview] = useState<LessonJson | null>(null);
    const [confirmDeleteChapter, setConfirmDeleteChapter] = useState(false);
    const [nodeToDelete, setNodeToDelete] = useState<AdminNode | null>(null);

    const load = useCallback(async () => {
        try {
            const data = await adminApi.listNodes(chapterId);
            setChapter(data.chapter);
            setNodes(data.nodes);
            setLoadError(null);
        } catch (e) {
            setLoadError(adminApi.adminErrorMessage(e));
        }
    }, [chapterId]);

    useEffect(() => {
        void load();
    }, [load]);

    // Повідомлення про успіх зникає саме
    useEffect(() => {
        if (!notice) return;
        const timer = setTimeout(() => setNotice(null), 4000);
        return () => clearTimeout(timer);
    }, [notice]);

    /** Обгортка дій: блокує кнопки, показує помилку, за потреби перечитує дані */
    const act = async (action: () => Promise<string | void>, { reload = true } = {}) => {
        setIsBusy(true);
        setActionError(null);
        try {
            const message = await action();
            if (message) setNotice(message);
            if (reload) await load();
        } catch (e) {
            setActionError(adminApi.adminErrorMessage(e));
        } finally {
            setIsBusy(false);
        }
    };

    const saveMeta = async (input: ChapterInput) => {
        const updated = await adminApi.updateChapter(chapterId, input); // помилки обробляє форма
        setChapter(updated);
        setIsEditingMeta(false);
        setNotice("Розділ збережено");
    };

    const togglePublished = () =>
        act(async () => {
            if (!chapter) return;
            const updated = await adminApi.updateChapter(chapterId, { published: !chapter.published });
            return updated.published ? "Розділ опубліковано — юзери його бачать" : "Розділ знято з публікації";
        });

    const deleteChapter = async () => {
        setIsBusy(true);
        try {
            await adminApi.deleteChapter(chapterId);
            navigate("/learning/admin", { replace: true });
        } catch (e) {
            setActionError(adminApi.adminErrorMessage(e));
            setIsBusy(false);
            setConfirmDeleteChapter(false);
        }
    };

    const openEdit = (node: AdminNode) =>
        act(
            async () => {
                const details = await adminApi.getNode(node.id);
                setEditor({ mode: "edit", node, text: JSON.stringify(details.lesson, null, 2) });
            },
            { reload: false },
        );

    const openPreview = (node: AdminNode) =>
        act(
            async () => {
                const details = await adminApi.getNode(node.id);
                setPreview(details.lesson);
            },
            { reload: false },
        );

    const deleteNode = (node: AdminNode) =>
        act(async () => {
            const result = await adminApi.deleteNode(node.id);
            setNodeToDelete(null);
            return result.chapterUnpublished
                ? "Урок видалено. Розділ став порожнім, тому його знято з публікації."
                : "Урок видалено";
        });

    const saveLessons = async (data: unknown) => {
        if (!editor) return;
        if (editor.mode === "create") {
            const created = await adminApi.createNodes(chapterId, data);
            setNotice(created.length === 1 ? "Урок додано" : `Додано уроків: ${created.length}`);
        } else {
            await adminApi.updateNode(editor.node.id, data);
            setNotice("Урок збережено");
        }
        setEditor(null);
        await load();
    };

    if (loadError && !chapter) {
        return (
            <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 p-6 text-center">
                <CookieMascot state="sad" size={96} />
                <p role="alert" className="text-lg font-semibold">
                    {loadError}
                </p>
                <div className="flex gap-2">
                    <Button onClick={() => void load()}>Спробувати ще</Button>
                    <Button variant="ghost" onClick={() => navigate("/learning/admin")}>
                        До розділів
                    </Button>
                </div>
            </div>
        );
    }

    if (!chapter) {
        return (
            <div className="flex min-h-[100dvh] items-center justify-center" aria-label="Завантаження">
                <CookieMascot state="thinking" size={72} className="animate-pulse" />
            </div>
        );
    }

    const canPublish = nodes.length > 0;

    return (
        <div className="mx-auto min-h-[100dvh] max-w-3xl px-4 pb-[calc(96px+env(safe-area-inset-bottom))] pt-[calc(env(safe-area-inset-top)+16px)]">
            <header className="flex items-center gap-3">
                <button
                    type="button"
                    onClick={() => navigate("/learning/admin")}
                    aria-label="До списку розділів"
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xl text-[var(--text-muted)] hover:bg-[var(--bg-card)]"
                >
                    ←
                </button>
                <h1 className="min-w-0 flex-1 truncate text-xl font-extrabold">{chapter.title}</h1>
            </header>

            {/* Картка розділу */}
            <section className="mt-4 rounded-3xl border border-[var(--border-color)] bg-[var(--bg-card)] p-4">
                <div className="flex items-center gap-4">
                    <div
                        className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl text-4xl"
                        style={{ backgroundColor: `color-mix(in srgb, ${chapter.accent} 22%, transparent)` }}
                        aria-hidden="true"
                    >
                        {chapter.cover}
                    </div>
                    <div className="min-w-0 flex-1">
                        <p className="flex flex-wrap items-center gap-2">
                            <span className="rounded-full px-2 py-0.5 text-xs font-extrabold" style={{ color: chapter.accent, backgroundColor: `color-mix(in srgb, ${chapter.accent} 18%, transparent)` }}>
                                {chapter.level}
                            </span>
                            {chapter.published ? (
                                <span className="text-xs font-bold text-[var(--accent-success)]">● Опубліковано</span>
                            ) : (
                                <span className="text-xs font-bold text-[var(--text-muted)]">○ Чернетка — юзери не бачать</span>
                            )}
                        </p>
                        {chapter.subtitle && <p className="mt-1 text-sm text-[var(--text-muted)]">{chapter.subtitle}</p>}
                        <p className="mt-1 font-mono text-xs text-[var(--text-muted)]">/learning/{chapter.slug}</p>
                    </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                    <Button size="sm" variant="secondary" onClick={() => setIsEditingMeta(true)} disabled={isBusy}>
                        Редагувати розділ
                    </Button>
                    <Button
                        size="sm"
                        variant={chapter.published ? "outline" : "primary"}
                        onClick={() => void togglePublished()}
                        disabled={isBusy || (!chapter.published && !canPublish)}
                    >
                        {chapter.published ? "Зняти з публікації" : "Опублікувати"}
                    </Button>
                    {chapter.published && (
                        <Button size="sm" variant="ghost" onClick={() => navigate(`/learning/${chapter.slug}`)}>
                            Відкрити як юзер ↗
                        </Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => setConfirmDeleteChapter(true)} disabled={isBusy}>
                        🗑 Видалити розділ
                    </Button>
                </div>
                {!chapter.published && !canPublish && (
                    <p className="mt-2 text-xs text-[var(--text-muted)]">Щоб опублікувати, додайте хоча б один урок.</p>
                )}
            </section>

            {notice && (
                <p role="status" className="mt-4 rounded-2xl bg-[var(--accent-success)]/15 p-3 text-sm font-bold text-[var(--accent-success)]">
                    {notice}
                </p>
            )}
            {actionError && (
                <p role="alert" className="mt-4 rounded-2xl bg-[var(--accent-error)]/15 p-3 text-sm font-semibold">
                    {actionError}
                </p>
            )}

            {/* Уроки */}
            <section className="mt-6">
                <div className="mb-3 flex items-center justify-between gap-2">
                    <h2 className="text-lg font-extrabold">Уроки ({nodes.length})</h2>
                    <Button size="sm" onClick={() => setEditor({ mode: "create" })} disabled={isBusy}>
                        + Додати уроки
                    </Button>
                </div>

                {nodes.length === 0 ? (
                    <div className="rounded-3xl border-2 border-dashed border-[var(--border-color)] p-6 text-center">
                        <p className="font-bold">Уроків ще немає</p>
                        <p className="mt-1 text-sm text-[var(--text-muted)]">
                            Натисніть «Додати уроки» і вставте JSON: один урок {"{ … }"} або кілька масивом {"[ … ]"}.
                            У редакторі є кнопка «Вставити шаблон» з прикладом усіх типів кроків.
                        </p>
                    </div>
                ) : (
                    <ol className="flex flex-col gap-2">
                        {nodes.map((node, i) => (
                            <LessonRow
                                key={node.id}
                                node={node}
                                isFirst={i === 0}
                                isLast={i === nodes.length - 1}
                                isBusy={isBusy}
                                onMove={(direction) => void act(() => adminApi.moveNode(node.id, direction))}
                                onEdit={() => void openEdit(node)}
                                onPreview={() => void openPreview(node)}
                                onDelete={() => setNodeToDelete(node)}
                            />
                        ))}
                    </ol>
                )}
            </section>

            {isEditingMeta && (
                <AdminSheet title="Редагувати розділ" onClose={() => setIsEditingMeta(false)}>
                    <ChapterForm
                        initial={chapter}
                        submitLabel="Зберегти"
                        onSubmit={saveMeta}
                        onCancel={() => setIsEditingMeta(false)}
                    />
                </AdminSheet>
            )}

            {editor && (
                <LessonJsonEditor
                    mode={editor.mode}
                    title={editor.mode === "create" ? `Нові уроки · ${chapter.title}` : `Урок «${editor.node.label}»`}
                    initialText={editor.mode === "edit" ? editor.text : ""}
                    onSave={saveLessons}
                    onClose={() => setEditor(null)}
                />
            )}

            {preview && <LessonPreview lesson={preview} onClose={() => setPreview(null)} />}

            <ConfirmDialog
                open={confirmDeleteChapter}
                title={`Видалити розділ «${chapter.title}»?`}
                confirmLabel="Видалити назавжди"
                danger
                isLoading={isBusy}
                onConfirm={() => void deleteChapter()}
                onCancel={() => setConfirmDeleteChapter(false)}
            >
                Буде видалено уроків: {nodes.length} і весь прогрес юзерів у цьому розділі. Цю дію не можна скасувати.
            </ConfirmDialog>

            <ConfirmDialog
                open={nodeToDelete !== null}
                title={`Видалити урок «${nodeToDelete?.label ?? ""}»?`}
                confirmLabel="Видалити"
                danger
                isLoading={isBusy}
                onConfirm={() => nodeToDelete && void deleteNode(nodeToDelete)}
                onCancel={() => setNodeToDelete(null)}
            >
                Прогрес юзерів по цьому уроку теж буде видалено.
            </ConfirmDialog>
        </div>
    );
};