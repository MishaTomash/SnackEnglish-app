import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { useNavigate, useParams } from "react-router-dom";
import * as storyApi from "../../entities/story/api";
import type { CompleteNodeResponse, StoryNodeContent } from "../../entities/story/types";
import { LessonEngine } from "../../features/lesson-engine/LessonEngine";
import type { LessonSummary } from "../../features/lesson-engine/LessonEngine";
import { VictoryScreen } from "../../features/lesson-engine/ui/VictoryScreen";
import type { SaveStatus } from "../../features/lesson-engine/ui/VictoryScreen";
import { Button } from "../../shared/ui/Button";
import { CookieMascot } from "../../shared/ui/CookieMascot";
import { useStoryStore } from "../../store/storyStore";

type Phase =
    | { kind: "loading" }
    | { kind: "error"; message: string; canRetry: boolean }
    | { kind: "playing"; node: StoryNodeContent }
    | {
        kind: "victory";
        node: StoryNodeContent;
        summary: LessonSummary;
        saveStatus: SaveStatus;
        result: CompleteNodeResponse | null;
    };

const describeLoadError = (error: unknown): { message: string; canRetry: boolean } => {
    const status = axios.isAxiosError(error) ? error.response?.status : undefined;
    if (status === 403) {
        return { message: "Цей урок ще закритий. Спершу пройди попередні.", canRetry: false };
    }
    if (status === 404) return { message: "Урок не знайдено.", canRetry: false };
    return { message: "Не вдалося завантажити урок.", canRetry: true };
};

/**
 * Повноекранний прохід уроку: завантаження вузла -> LessonEngine ->
 * збереження (completeNode через стор) -> VictoryScreen -> назад на мапу.
 */
export const LessonRunnerPage = () => {
    const { chapterId = "", nodeId = "" } = useParams();
    const navigate = useNavigate();
    const markNodeCompleted = useStoryStore((s) => s.markNodeCompleted);
    const [phase, setPhase] = useState<Phase>({ kind: "loading" });
    const [loadAttempt, setLoadAttempt] = useState(0);

    useEffect(() => {
        let cancelled = false;
        setPhase({ kind: "loading" });
        storyApi
            .getNodeContent(chapterId, nodeId)
            .then((node) => {
                if (!cancelled) setPhase({ kind: "playing", node });
            })
            .catch((error: unknown) => {
                if (!cancelled) setPhase({ kind: "error", ...describeLoadError(error) });
            });
        return () => {
            cancelled = true;
        };
    }, [chapterId, nodeId, loadAttempt]);

    const backToMap = useCallback(
        () => navigate(`/learning/${chapterId}`, { replace: true }),
        [navigate, chapterId],
    );

    const save = useCallback(async () => {
        setPhase((p) => (p.kind === "victory" ? { ...p, saveStatus: "saving" } : p));
        const result = await markNodeCompleted(chapterId, nodeId);
        setPhase((p) =>
            p.kind === "victory" ? { ...p, saveStatus: result ? "saved" : "error", result } : p,
        );
    }, [markNodeCompleted, chapterId, nodeId]);

    const handleComplete = useCallback(
        (summary: LessonSummary) => {
            setPhase((p) =>
                p.kind === "playing"
                    ? { kind: "victory", node: p.node, summary, saveStatus: "saving", result: null }
                    : p,
            );
            void save();
        },
        [save],
    );

    return (
        // Поверх усього, включно з BottomNav (z-50)
        <div className="fixed inset-0 z-[60] flex flex-col bg-[var(--bg-app)] text-[var(--text-main)]">
            {phase.kind === "loading" && (
                <div className="flex flex-1 items-center justify-center" aria-label="Завантаження уроку">
                    <CookieMascot state="thinking" size={72} className="animate-pulse" />
                </div>
            )}

            {phase.kind === "error" && (
                <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
                    <CookieMascot state="sad" size={96} />
                    <p role="alert" className="text-lg font-semibold">
                        {phase.message}
                    </p>
                    <div className="flex w-full max-w-xs flex-col gap-2">
                        {phase.canRetry && (
                            <Button size="lg" onClick={() => setLoadAttempt((n) => n + 1)}>
                                Спробувати ще
                            </Button>
                        )}
                        <Button variant="ghost" onClick={backToMap}>
                            До мапи розділу
                        </Button>
                    </div>
                </div>
            )}

            {phase.kind === "playing" && (
                <LessonEngine node={phase.node} onComplete={handleComplete} onExit={backToMap} />
            )}

            {phase.kind === "victory" && (
                <VictoryScreen
                    label={phase.node.label}
                    isBoss={phase.node.isBoss}
                    summary={phase.summary}
                    saveStatus={phase.saveStatus}
                    result={phase.result}
                    cliffhanger={phase.node.cliffhanger?.text ?? null}
                    onContinue={backToMap}
                    onRetrySave={() => void save()}
                />
            )}
        </div>
    );
};