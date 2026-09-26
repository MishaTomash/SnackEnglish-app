// 📁 Файл: SnackEnglish-app/src/widgets/WeekActivityCard.tsx
import { useEffect, useState } from "react";
import type { FC } from "react";
import { Link } from "react-router-dom";
import { Flame } from "lucide-react";
import { apiClient } from "../shared/api/apiClient";
import { Card } from "../shared/ui/Card";

/**
 * Активність за тиждень — СПРАВЖНЯ: галочка стоїть у день, коли юзер пройшов урок.
 * Раніше галочки розставлялись за довжиною стріку й могли стояти в дні без занять.
 * Під тижнем — підказка про стан серії (зберегти / врятувати сьогодні).
 */

type StreakStatus = "none" | "done_today" | "pending" | "at_risk" | "lost";

interface WeekDay {
    date: string;
    weekday: number;
    lessons: number;
}

interface ActivityWeek {
    days: WeekDay[];
    todayIndex: number;
    streak: number;
    streakStatus: StreakStatus;
    freezeAvailable: boolean;
}

const WEEKDAY_LABELS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Нд"];

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

const parseWeek = (data: unknown): ActivityWeek | null => {
    if (!isRecord(data) || !Array.isArray(data.days)) return null;
    return {
        days: data.days.filter(isRecord).map((d, i) => ({
            date: String(d.date ?? ""),
            weekday: typeof d.weekday === "number" ? d.weekday : i,
            lessons: typeof d.lessons === "number" ? d.lessons : 0,
        })),
        todayIndex: typeof data.todayIndex === "number" ? data.todayIndex : 0,
        streak: typeof data.streak === "number" ? data.streak : 0,
        streakStatus: (typeof data.streakStatus === "string" ? data.streakStatus : "none") as StreakStatus,
        freezeAvailable: data.freezeAvailable === true,
    };
};

const STATUS_HINT: Record<StreakStatus, { text: string; tone: "ok" | "warn" | "danger" | "muted" }> = {
    done_today: { text: "Сьогодні день зараховано — так тримати! 🔥", tone: "ok" },
    pending: { text: "Пройди хоча б один урок сьогодні, щоб зберегти серію", tone: "warn" },
    at_risk: { text: "Учора був пропуск — пройди урок сьогодні, і серію буде врятовано!", tone: "danger" },
    lost: { text: "Серія згасла — пройди урок і почни нову 💪", tone: "muted" },
    none: { text: "Пройди урок — і почнеться твоя серія днів 🔥", tone: "muted" },
};

const TONE_CLASS = {
    ok: "text-[var(--accent-success)]",
    warn: "text-[var(--accent-cta)]",
    danger: "text-[var(--accent-error)]",
    muted: "text-[var(--text-muted)]",
};

export const WeekActivityCard: FC = () => {
    const [week, setWeek] = useState<ActivityWeek | null>(null);

    useEffect(() => {
        let alive = true;
        apiClient
            .get<unknown>("/user/activity-week")
            .then(({ data }) => {
                if (alive) setWeek(parseWeek(data));
            })
            .catch((error: unknown) => console.error("[activity-week]", error));
        return () => {
            alive = false;
        };
    }, []);

    const todayIndex = week?.todayIndex ?? (new Date().getDay() + 6) % 7;
    const hint = week ? STATUS_HINT[week.streakStatus] : null;
    const needsAction = week?.streakStatus === "pending" || week?.streakStatus === "at_risk";

    return (
        <Card className="p-4 bg-[var(--bg-card)] border-[var(--border-color)]">
            <div className="mb-4 flex items-center justify-between">
                <h3 className="flex items-center gap-1.5 text-sm font-black text-[var(--text-main)]">
                    <Flame className="h-4 w-4 text-orange-500" /> Активність
                </h3>
                <span className="text-xs font-bold text-[var(--text-muted)]">
                    {week && week.streak > 0 ? `Серія: ${week.streak} 🔥` : "Цього тижня"}
                </span>
            </div>

            <div className="flex items-center justify-between">
                {WEEKDAY_LABELS.map((label, index) => {
                    const lessons = week?.days[index]?.lessons ?? 0;
                    const isDone = lessons > 0;
                    const isToday = index === todayIndex;
                    const isFuture = index > todayIndex;

                    return (
                        <div key={label} className="flex flex-col items-center gap-1.5">
                            <div
                                title={isDone ? `Уроків: ${lessons}` : undefined}
                                aria-label={`${label}: ${isDone ? `уроків ${lessons}` : isFuture ? "ще попереду" : "без уроків"}`}
                                className={`flex h-8 w-8 items-center justify-center rounded-full border-2 text-sm transition-all ${isDone
                                        ? "border-orange-500 bg-orange-500 text-white shadow-sm"
                                        : isToday
                                            ? "border-orange-500 bg-orange-900/30 text-orange-500"
                                            : isFuture
                                                ? "border-[var(--border-color)] bg-transparent opacity-50"
                                                : "border-[var(--border-color)] bg-transparent text-[var(--text-muted)]"
                                    }`}
                            >
                                {isDone ? "✓" : ""}
                            </div>
                            <span
                                className={`text-[10px] font-bold ${isToday ? "text-[var(--text-main)]" : "text-[var(--text-muted)]"}`}
                            >
                                {label}
                            </span>
                        </div>
                    );
                })}
            </div>

            {hint && (
                <div className="mt-3 flex items-center justify-between gap-2">
                    <p className={`text-xs font-semibold ${TONE_CLASS[hint.tone]}`}>{hint.text}</p>
                    {needsAction && (
                        <Link
                            to="/learning"
                            className="shrink-0 rounded-xl bg-[var(--accent-cta)] px-3 py-1.5 text-xs font-extrabold text-[var(--text-accent)] active:opacity-80"
                        >
                            До уроку
                        </Link>
                    )}
                </div>
            )}
        </Card>
    );
};