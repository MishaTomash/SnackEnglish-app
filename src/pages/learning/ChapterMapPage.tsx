import { useEffect, useMemo, useRef } from "react";
import type { FC, Ref } from "react";
import { useNavigate, useParams } from "react-router-dom";
import type { StoryNode } from "../../entities/story/types";
import { Button } from "../../shared/ui/Button";
import { CookieMascot } from "../../shared/ui/CookieMascot";
import { useStoryStore } from "../../store/storyStore";

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
}

const MapNode: FC<MapNodeProps> = ({ point, onOpen, activeRef }) => {
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
                <span className="absolute -top-9 whitespace-nowrap rounded-full bg-[var(--accent-cta)] px-3 py-1 text-xs font-extrabold text-[var(--text-accent)] shadow-lg">
                    Почати
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
                {isActive && (
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
    const activeRef = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        void fetchChapterNodes(chapterId);
    }, [chapterId, fetchChapterNodes]);

    const points = useMemo(() => layoutNodes(nodes), [nodes]);
    const height = points.length > 0 ? points[points.length - 1].y + PADDING_Y + 24 : 0;

    // Після завантаження — прокрутити до активного вузла
    const hasNodes = nodes.length > 0;
    useEffect(() => {
        if (hasNodes) activeRef.current?.scrollIntoView?.({ block: "center", behavior: "smooth" });
    }, [hasNodes]);

    const openLesson = (node: StoryNode) => {
        if (node.status === "locked") return;
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
                        />
                    ))}
                </div>
            )}
        </div>
    );
};