// 📁 Файл: SnackEnglish-app/src/features/lesson-engine/ui/VictoryScreen.tsx
import { useEffect, useState } from "react";
import type { FC } from "react";
import type { CompleteNodeResponse } from "../../../entities/story/types";
import { hapticNotify } from "../../../shared/lib/haptics";
import { Button } from "../../../shared/ui/Button";
import { Card } from "../../../shared/ui/Card";
import { CookieMascot } from "../../../shared/ui/CookieMascot";
import type { LessonSummary } from "../LessonEngine";
import styles from "../steps/lessonEffects.module.css";
import { useDailyProgressStore } from "../../../store/dailyProgressStore";
import { markSupportPromptShown, shouldShowSupportPrompt } from "../../../shared/lib/supportPrompt";
import { SupportCard } from "../../../widgets/SupportCard";
import { useAppConfigStore } from "../../../store/appConfigStore";

export type SaveStatus = "saving" | "saved" | "error";

export interface VictoryScreenProps {
    label: string;
    isBoss: boolean;
    summary: LessonSummary;
    saveStatus: SaveStatus;
    result: CompleteNodeResponse | null;
    cliffhanger: string | null;
    onContinue: () => void;
    onRetrySave: () => void;
}

/** Екран після проходження уроку: бали, помилки, клифгенгер, "далі" */
export const VictoryScreen: FC<VictoryScreenProps> = ({
    label,
    isBoss,
    summary,
    saveStatus,
    result,
    cliffhanger,
    onContinue,
    onRetrySave,
}) => {
    useEffect(() => {
        hapticNotify("success");
    }, []);

    const daily = useDailyProgressStore((s) => s.daily);
    const hasSupport = useAppConfigStore((s) => Boolean(s.config?.support));
    const loadConfig = useAppConfigStore((s) => s.load);
    useEffect(() => {
        void loadConfig();
    }, [loadConfig]);
    // Рішення показати заклик "Підтримати" — один раз на екран, не частіше за раз на кілька днів
    const [supportAllowed] = useState(() => shouldShowSupportPrompt());
    const showSupport = saveStatus === "saved" && supportAllowed && hasSupport;
    useEffect(() => {
        if (showSupport) markSupportPromptShown();
    }, [showSupport]);

    const bonusXp = saveStatus === "saved" && daily?.bonusXp ? daily.bonusXp : 0;

    const xpText =
        saveStatus === "saving"
            ? "…"
            : saveStatus === "error"
                ? "—"
                : result?.alreadyCompleted
                    ? "0"
                    : `+${result?.earnedXp ?? 0}`;

    return (
        <div className="flex h-full flex-col overflow-y-auto px-5 pb-[calc(env(safe-area-inset-bottom)+20px)] pt-[calc(env(safe-area-inset-top)+32px)]">
            <div className={`mx-auto flex w-full max-w-md flex-1 flex-col items-center text-center ${styles.fadeIn}`}>
                <CookieMascot state="celebrating" size={140} className={styles.pop} />
                <h1 className="mt-4 text-3xl font-extrabold text-[var(--accent-cta)]">
                    {isBoss ? "Боса переможено!" : "Урок пройдено!"}
                </h1>
                <p className="mt-1 text-lg text-[var(--text-muted)]">{label}</p>

                <div className="mt-6 grid w-full grid-cols-2 gap-3">
                    <Card className="p-4">
                        <p className="text-2xl font-extrabold text-[var(--accent-cta)]" aria-live="polite">
                            {xpText}
                        </p>
                        <p className="text-xs text-[var(--text-muted)]">
                            {result?.alreadyCompleted ? "бали вже зараховані раніше" : "кубків"}
                        </p>
                    </Card>
                    <Card className="p-4">
                        <p className="text-2xl font-extrabold">
                            {summary.perfect ? "✨" : summary.errors}
                        </p>
                        <p className="text-xs text-[var(--text-muted)]">
                            {summary.perfect ? "без жодної помилки" : "помилок"}
                        </p>
                    </Card>
                </div>

                {saveStatus === "error" && (
                    <p role="alert" className="mt-4 text-sm text-[var(--accent-error)]">
                        Не вдалося зберегти прогрес. Перевір з'єднання і спробуй ще раз.
                    </p>
                )}

                {saveStatus === "saved" && daily?.streakRestored && (
                    <Card className="mt-4 w-full p-4" style={{ borderColor: "#f97316" }}>
                        <p className="font-bold">🔥 Серію врятовано!</p>
                        <p className="text-sm text-[var(--text-muted)]">
                            Учора був пропуск, але ти повернувся вчасно — серія {daily.streak ?? ""} днів триває.
                            Наступний шанс — через тиждень.
                        </p>
                    </Card>
                )}

                {bonusXp > 0 && (
                    <Card className="mt-4 w-full p-4" style={{ borderColor: "var(--accent-success)" }}>
                        <p className="font-bold">🎯 Денну ціль виконано!</p>
                        <p className="text-sm text-[var(--text-muted)]">
                            +{bonusXp} бонусних кубків (уже в сумі вище). Так тримати!
                        </p>
                    </Card>
                )}

                {saveStatus === "saved" && daily && daily.limit > 0 && (
                    <p className="mt-4 text-sm text-[var(--text-muted)]">
                        {daily.limitReached
                            ? "На сьогодні нові уроки закінчились — мозку треба відпочити, щоб усе запам'яталось 🌙 Повторювати пройдене й грати в ігри можна й далі."
                            : `Сьогодні нових уроків: ${daily.completedToday} з ${daily.limit}`}
                    </p>
                )}

                {result?.chapterCompleted && (
                    // borderColor через style: клас конфліктував би з border-класом Card
                    <Card className="mt-4 w-full p-4" style={{ borderColor: "var(--accent-cta)" }}>
                        <p className="font-bold">🎉 Розділ завершено!</p>
                        <p className="text-sm text-[var(--text-muted)]">Наступний розділ уже відкрито.</p>
                    </Card>
                )}

                {cliffhanger && (
                    <div className="mt-4 w-full rounded-3xl border border-dashed border-[var(--border-color)] p-4 text-left">
                        <p className="text-xs font-bold uppercase tracking-wide text-[var(--text-muted)]">
                            Далі буде…
                        </p>
                        <p className="mt-1 italic">{cliffhanger}</p>
                    </div>
                )}

                {showSupport && <SupportCard place="victory" className="mt-4" />}

                <div className="mt-auto flex w-full flex-col gap-2 pt-8">
                    {saveStatus === "error" ? (
                        <>
                            <Button size="lg" onClick={onRetrySave}>
                                Зберегти ще раз
                            </Button>
                            <Button variant="ghost" onClick={onContinue}>
                                На мапу без збереження
                            </Button>
                        </>
                    ) : (
                        <Button size="lg" isLoading={saveStatus === "saving"} onClick={onContinue}>
                            Продовжити
                        </Button>
                    )}
                </div>
            </div>
        </div>
    );
};