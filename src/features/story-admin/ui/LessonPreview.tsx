import { useMemo, useState } from "react";
import type { FC } from "react";
import type { LessonJson } from "../../../entities/story/adminTypes";
import type { StoryNodeContent } from "../../../entities/story/types";
import { Button } from "../../../shared/ui/Button";
import { CookieMascot } from "../../../shared/ui/CookieMascot";
import { LessonEngine } from "../../lesson-engine/LessonEngine";
import type { LessonSummary } from "../../lesson-engine/LessonEngine";

/**
 * Прохід уроку просто з JSON — без збереження прогресу і без запитів на сервер.
 * Той самий LessonEngine, що бачать юзери.
 */
export const LessonPreview: FC<{ lesson: LessonJson; onClose: () => void }> = ({ lesson, onClose }) => {
    const [summary, setSummary] = useState<LessonSummary | null>(null);
    const [run, setRun] = useState(0);

    const node = useMemo<StoryNodeContent>(
        () => ({
            id: `preview-${run}`,
            chapterId: "preview",
            order: 1,
            icon: lesson.icon ?? "⭐",
            label: lesson.label,
            npc: lesson.npc ?? "",
            npcName: lesson.npcName ?? "",
            isBoss: lesson.isBoss ?? false,
            cliffhanger: lesson.cliffhanger ?? null,
            steps: lesson.steps,
            status: "active",
        }),
        [lesson, run],
    );

    return (
        <div className="fixed inset-0 z-[80] flex flex-col bg-[var(--bg-app)] text-[var(--text-main)]">
            <div className="bg-[var(--accent-cta)] px-4 py-1 text-center text-xs font-extrabold text-[var(--text-accent)]">
                ПРЕВ'Ю · прогрес не зберігається
            </div>
            <div className="min-h-0 flex-1">
                {summary ? (
                    <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
                        <CookieMascot state="celebrating" size={120} />
                        <h2 className="text-2xl font-extrabold">Урок пройдено</h2>
                        <p className="text-[var(--text-muted)]">
                            {summary.perfect ? "Без жодної помилки" : `Помилок: ${summary.errors}`} · життів лишилось:{" "}
                            {summary.livesLeft}
                        </p>
                        {lesson.cliffhanger?.text && <p className="max-w-sm italic">«{lesson.cliffhanger.text}»</p>}
                        <div className="mt-4 flex w-full max-w-xs flex-col gap-2">
                            <Button
                                size="lg"
                                onClick={() => {
                                    setSummary(null);
                                    setRun((r) => r + 1);
                                }}
                            >
                                Пройти ще раз
                            </Button>
                            <Button variant="ghost" onClick={onClose}>
                                Закрити прев'ю
                            </Button>
                        </div>
                    </div>
                ) : (
                    <LessonEngine key={node.id} node={node} onComplete={setSummary} onExit={onClose} />
                )}
            </div>
        </div>
    );
};