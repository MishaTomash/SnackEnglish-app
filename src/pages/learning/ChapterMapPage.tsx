// 📁 Файл: SnackEnglish-app/src/pages/learning/ChapterMapPage.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import type { FC, Ref } from "react";
import { useNavigate, useParams } from "react-router-dom";
import type { StoryNode } from "../../entities/story/types";
import { Button } from "../../shared/ui/Button";
import { CookieMascot } from "../../shared/ui/CookieMascot";
import { useStoryStore } from "../../store/storyStore";
import { useDailyProgressStore } from "../../store/dailyProgressStore";
import type { DailyProgress } from "../../store/dailyProgressStore";

// ---------- Геометрія стежки ----------
// x — у відсотках ширини (адаптивно), y — у пікселях (стабільний крок)
const NODE_STEP_Y = 128;
const PADDING_Y = 72;
const ZIGZAG_X = [50, 74, 50, 26]; // центр -> праворуч -> центр -> ліворуч

interface MapPoint {
    node: StoryNode;
    x: number; // %
    y: number; // px
}

const layoutNodes = (nodes: StoryNode[]): MapPoint[] =>
    nodes.map((node, i) => ({
        node,
        x: ZIGZAG_X[i % ZIGZAG_X.length],
        y: PADDING_Y + i * NODE_STEP_Y,
    }));

/** Плавна крива між сусідніми вузлами (кубічна Безьє з вертикальними дотичними) */
const segmentPath = (a: MapPoint, b: MapPoint): string => {
    const midY = (a.y + b.y) / 2;
    return `M ${a.x} ${a.y} C ${a.x} ${midY}, ${b.x} ${midY}, ${b.x} ${b.y}`;
};

const STATUS_LABEL: Record<StoryNode["status"], string> = {
    completed: "пройдено",
    active: "доступно",
    locked: "закрито",
};

interface MapNodeProps {
    point: MapPoint;
    onOpen: (node: StoryNode) => void;
    activeRef?: Ref<HTMLButtonElement>;
    /** Денний ліміт нових уроків вичерпано — активний вузол чекає на завтра */
    limitReached?: boolean;
}

const MapNode: FC<MapNodeProps> = ({ point, onOpen, activeRef, limitReached = false }) => {
    const { node } = point;
    const size = node.isBoss ? 88 : 68;
    const isLocked = node.status === "locked";
    const isActive = node.status === "active";
    const isCompleted = node.status === "completed";

    return (
        <div
            className="absolute flex flex-col items-center"
            style={{ left: `${point.x}%`, top: point.y, transform: "translate(-50%, -50%)" }}
        >
            {isActive && (
                <span
                    className={`absolute -top-9 whitespace-nowrap rounded-full px-3 py-1 text-xs font-extrabold shadow-lg ${limitReached
                            ? "bg-[var(--bg-card-elevated)] text-[var(--text-muted)]"
                            : "bg-[var(--accent-cta)] text-[var(--text-accent)]"
                        }`}
                >
                    {limitReached ? "Завтра 🌙" : "Почати"}
                </span>
            )}
            <button
                ref={activeRef}
                type="button"
                disabled={isLocked}
                onClick={() => onOpen(node)}
                aria-label={`${node.label} — ${STATUS_LABEL[node.status]}`}
                className={`relative flex items-center justify-center rounded-full border-b-[6px] transition-transform focus:outline-none focus-visible:ring-4 focus-visible:ring-[var(--accent-cta)]/50 active:translate-y-1 active:border-b-2 disabled:cursor-not-allowed ${isCompleted
                    ? "border-[var(--accent-cta-active)] bg-[var(--accent-cta)]"
                    : isActive
                        ? "border-[var(--accent-cta-active)] bg-[var(--bg-card-elevated)] ring-4 ring-[var(--accent-cta)]"
                        : "border-[var(--border-color)] bg-[var(--bg-card)]"
                    }`}
                style={{ width: size, height: size }}
            >
                {isActive && !limitReached && (
                    <span
                        className="absolute inset-0 animate-ping rounded-full bg-[var(--accent-cta)]/25 motion-reduce:hidden"
                        aria-hidden="true"
                    />
                )}
                <span
                    className={`relative leading-none ${node.isBoss ? "text-4xl" : "text-3xl"} ${isLocked ? "opacity-40 grayscale" : ""}`}
                    aria-hidden="true"
                >
                    {node.icon}
                </span>
                {node.isBoss && (
                    <span className="absolute -top-3 text-2xl" aria-hidden="true">
                        👑
                    </span>
                )}
                {isCompleted && (
                    <span
                        className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full border-2 border-[var(--bg-app)] bg-[var(--accent-success)] text-sm font-extrabold text-[var(--text-accent)]"
                        aria-hidden="true"
                    >
                        ✓
                    </span>
                )}
                {isLocked && (
                    <span className="absolute -bottom-1 -right-1 text-lg" aria-hidden="true">
                        🔒
                    </span>
                )}
            </button>
            <span
                className={`mt-2 max-w-[132px] text-center text-xs font-bold leading-tight ${isLocked ? "text-[var(--text-muted)]/60" : "text-[var(--text-main)]"
                    }`}
            >
                {node.label}
            </span>
        </div>
    );
};

/** Смужка прогресу дня над мапою: нові уроки сьогодні, ліміт і денна ціль */
const DailyBar: FC<{ daily: DailyProgress }> = ({ daily }) => {
    if (daily.limit <= 0 && daily.goal <= 0) return null;
    const target = daily.limit > 0 ? daily.limit : daily.goal;
    const percent = Math.min(100, Math.round((daily.completedToday / Math.max(1, target)) * 100));

    return (
        <div className="mx-4 mt-3 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] p-3">
            <div className="mb-2 flex items-center justify-between text-xs font-bold">
                <span className="text-[var(--text-main)]">
                    Сьогодні: {daily.completedToday}
                    {daily.limit > 0 ? ` з ${daily.limit}` : ""} нових уроків
                </span>
                {daily.goal > 0 && (
                    <span className={daily.goalReached ? "text-[var(--accent-success)]" : "text-[var(--text-muted)]"}>
                        {daily.goalReached ? "🎯 Ціль виконано" : `🎯 Ціль: ${daily.goal}`}
                    </span>
                )}
            </div>
            <div
                className="h-2 overflow-hidden rounded-full bg-[var(--bg-app)]"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={target}
                aria-valuenow={Math.min(daily.completedToday, target)}
                aria-label="Нові уроки сьогодні"
            >
                <div
                    className="h-full rounded-full bg-[var(--accent-cta)] transition-[width] duration-500"
                    style={{ width: `${percent}%` }}
                />
            </div>
        </div>
    );
};

/**
 * Мапа розділу: вузли на зигзаг-стежці. Активний і пройдені вузли відкривають
 * урок (пройдений можна переграти — бали повторно не нараховуються).
 */
export const ChapterMapPage = () => {
    const { chapterId = "" } = useParams();
    const navigate = useNavigate();
    const chapter = useStoryStore((s) => s.currentChapter);
    const nodes = useStoryStore((s) => s.currentChapterNodes);
    const isLoading = useStoryStore((s) => s.isNodesLoading);
    const error = useStoryStore((s) => s.error);
    const fetchChapterNodes = useStoryStore((s) => s.fetchChapterNodes);
    const daily = useDailyProgressStore((s) => s.daily);
    const fetchDaily = useDailyProgressStore((s) => s.fetchDaily);
    const [showLimitNotice, setShowLimitNotice] = useState(false);
    const activeRef = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        void fetchChapterNodes(chapterId);
        void fetchDaily();
    }, [chapterId, fetchChapterNodes, fetchDaily]);

    const limitReached = Boolean(daily?.limitReached);

    const points = useMemo(() => layoutNodes(nodes), [nodes]);
    const height = points.length > 0 ? points[points.length - 1].y + PADDING_Y + 24 : 0;

    // Після завантаження — прокрутити до активного вузла
    const hasNodes = nodes.length > 0;
    useEffect(() => {
        if (hasNodes) activeRef.current?.scrollIntoView?.({ block: "center", behavior: "smooth" });
    }, [hasNodes]);

    const openLesson = (node: StoryNode) => {
        if (node.status === "locked") return;
        // Новий урок понад денний ліміт — пояснюємо, а не ведемо на помилку.
        // Пройдені уроки відкриваються як завжди (повторення без обмежень).
        if (node.status === "active" && limitReached) {
            setShowLimitNotice(true);
            return;
        }
        navigate(`/learning/${chapterId}/lesson/${node.id}`);
    };

    const isLockedChapter = !!error && /locked/i.test(error);

    return (
        <div className="mx-auto min-h-[100dvh] max-w-md pb-[calc(96px+env(safe-area-inset-bottom))]">
            <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-[var(--border-color)] bg-[var(--bg-app)]/95 px-4 pb-3 pt-[calc(env(safe-area-inset-top)+12px)] backdrop-blur">
                <button
                    type="button"
                    onClick={() => navigate("/learning")}
                    aria-label="До списку розділів"
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xl text-[var(--text-muted)] hover:bg-[var(--bg-card)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-cta)]"
                >
                    ←
                </button>
                {chapter ? (
                    <>
                        <span className="text-3xl leading-none" aria-hidden="true">
                            {chapter.cover}
                        </span>
                        <div className="min-w-0 flex-1">
                            <h1 className="truncate text-lg font-extrabold">{chapter.title}</h1>
                            <p className="text-xs text-[var(--text-muted)]">
                                {chapter.level} · пройдено {chapter.doneNodes} з {chapter.totalNodes}
                            </p>
                        </div>
                    </>
                ) : (
                    <div className="h-6 flex-1 animate-pulse rounded-full bg-[var(--bg-card)]" />
                )}
            </header>

            {daily && !error && <DailyBar daily={daily} />}

            {showLimitNotice && (
                <div
                    role="status"
                    className="mx-4 mt-3 flex items-start gap-3 rounded-2xl border border-[var(--accent-cta)]/40 bg-[var(--accent-cta)]/10 p-3"
                >
                    <CookieMascot state="sleeping" size={48} className="shrink-0" />
                    <div className="min-w-0 flex-1">
                        <p className="font-bold text-[var(--text-main)]">На сьогодні нові уроки закінчились 🌙</p>
                        <p className="mt-1 text-sm text-[var(--text-muted)]">
                            Мозку треба відпочити, щоб усе запам'яталось. Завтра відкриються нові! А поки можна
                            повторити пройдені уроки або пограти в ігри.
                        </p>
                        <div className="mt-2 flex gap-2">
                            <Button size="sm" onClick={() => navigate("/games")}>
                                До ігор
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => setShowLimitNotice(false)}>
                                Зрозуміло
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {isLoading && (
                <div className="flex justify-center py-24" aria-label="Завантаження мапи">
                    <CookieMascot state="thinking" size={72} className="animate-pulse" />
                </div>
            )}

            {!isLoading && error && (
                <div className="flex flex-col items-center gap-4 px-6 py-20 text-center">
                    <CookieMascot state={isLockedChapter ? "sleeping" : "sad"} size={96} />
                    <p role="alert" className="text-lg font-semibold">
                        {isLockedChapter
                            ? "Цей розділ ще закритий — спершу пройди попередній."
                            : "Не вдалося завантажити мапу."}
                    </p>
                    {!isLockedChapter && (
                        <Button onClick={() => void fetchChapterNodes(chapterId)}>Спробувати ще</Button>
                    )}
                    <Button variant="ghost" onClick={() => navigate("/learning")}>
                        До розділів
                    </Button>
                </div>
            )}

            {!isLoading && !error && hasNodes && (
                <div className="relative mx-4" style={{ height }}>
                    {/* viewBox по x = 0..100 (відсотки), по y = пікселі; non-scaling-stroke тримає товщину лінії */}
                    <svg
                        className="absolute inset-0 h-full w-full"
                        viewBox={`0 0 100 ${height}`}
                        preserveAspectRatio="none"
                        aria-hidden="true"
                    >
                        {points.slice(1).map((point, i) => {
                            const from = points[i];
                            const isDone = from.node.status === "completed";
                            return (
                                <path
                                    key={point.node.id}
                                    d={segmentPath(from, point)}
                                    fill="none"
                                    stroke={isDone ? "var(--accent-cta)" : "var(--border-color)"}
                                    strokeWidth={isDone ? 8 : 6}
                                    strokeDasharray={isDone ? undefined : "2 14"}
                                    strokeLinecap="round"
                                    vectorEffect="non-scaling-stroke"
                                    data-done={isDone || undefined}
                                />
                            );
                        })}
                    </svg>

                    {points.map((point) => (
                        <MapNode
                            key={point.node.id}
                            point={point}
                            onOpen={openLesson}
                            activeRef={point.node.status === "active" ? activeRef : undefined}
                            limitReached={limitReached}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};