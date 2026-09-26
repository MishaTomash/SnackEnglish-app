// 📁 Файл: SnackEnglish-app/src/features/admin-panel/ui/GiveawayTab.tsx
import { useEffect, useState } from "react";
import type { FC } from "react";
import { Flag } from "lucide-react";
import { adminApi, getErrorMessage } from "../api";
import { useAdminQuery } from "../lib/useAdminQuery";
import { AdminButton, EmptyState, ErrorState, LoadingState, Notice, Section, formatNumber } from "./primitives";

const MEDALS = ["🥇", "🥈", "🥉"];

/** Відлік до наступного розіграшу (час з сервера — неділя 20:00 за Києвом) */
const useCountdown = (target: string | null): string => {
    const [now, setNow] = useState(() => Date.now());
    useEffect(() => {
        const timer = setInterval(() => setNow(Date.now()), 30000);
        return () => clearInterval(timer);
    }, []);
    if (!target) return "—";
    const diff = Math.max(0, new Date(target).getTime() - now);
    const days = Math.floor(diff / 86400000);
    const hours = Math.floor((diff % 86400000) / 3600000);
    const minutes = Math.floor((diff % 3600000) / 60000);
    return `${days} дн ${hours} год ${minutes} хв`;
};

export const GiveawayTab: FC = () => {
    const top = useAdminQuery(() => adminApi.leaderboard(), []);
    const history = useAdminQuery(() => adminApi.giveawayHistory(), []);
    const system = useAdminQuery(() => adminApi.system(), []);
    const countdown = useCountdown(system.data?.nextGiveawayAt ?? null);
    const [busy, setBusy] = useState(false);
    const [notice, setNotice] = useState<{ kind: "success" | "error"; text: string } | null>(null);

    const leaders = (top.data ?? []).filter((u) => u.score > 0);

    const endNow = async () => {
        const podium = leaders.slice(0, 3).map((u, i) => `${MEDALS[i]} ${u.nickname} — ${u.score}`).join("\n");
        const question = leaders.length
            ? `Завершити розіграш зараз?\n\nПереможці:\n${podium}\n\nКубки тижня всіх юзерів обнуляться.`
            : "Цього тижня ніхто не набрав балів — розіграш не буде записано. Продовжити?";
        if (!window.confirm(question)) return;

        setBusy(true);
        setNotice(null);
        try {
            await adminApi.endGiveaway();
            setNotice({ kind: "success", text: "Розіграш завершено, кубки тижня обнулено" });
            top.reload();
            history.reload();
        } catch (error) {
            setNotice({ kind: "error", text: getErrorMessage(error) });
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="space-y-4">
            <Section title="Поточний тиждень">
                <p className="mb-3 text-sm text-[var(--text-muted)]">
                    Автоматичне завершення через <b className="text-[var(--text-main)]">{countdown}</b> (неділя, 20:00)
                </p>
                {top.isLoading && !top.data ? (
                    <LoadingState />
                ) : top.error ? (
                    <ErrorState message={top.error} onRetry={top.reload} />
                ) : leaders.length === 0 ? (
                    <EmptyState>Цього тижня ще ніхто не набрав балів</EmptyState>
                ) : (
                    <ol className="space-y-1.5">
                        {leaders.slice(0, 10).map((u, i) => (
                            <li
                                key={u._id}
                                className={`flex justify-between rounded-xl px-3 py-2 text-sm ${i < 3 ? "bg-[var(--accent-cta)]/10" : ""}`}
                            >
                                <span className="truncate text-[var(--text-main)]">
                                    {MEDALS[i] ?? `${i + 1}.`} {u.nickname}
                                </span>
                                <span className="font-black text-[var(--accent-cta)]">{formatNumber(u.score)}</span>
                            </li>
                        ))}
                    </ol>
                )}
                {notice && <div className="mt-3"><Notice kind={notice.kind}>{notice.text}</Notice></div>}
                <AdminButton variant="danger" className="mt-3 w-full" loading={busy} onClick={() => void endNow()}>
                    <Flag className="h-4 w-4" aria-hidden="true" /> Завершити розіграш зараз
                </AdminButton>
            </Section>

            <Section title="Історія переможців">
                {history.isLoading && !history.data ? (
                    <LoadingState />
                ) : history.error ? (
                    <ErrorState message={history.error} onRetry={history.reload} />
                ) : !history.data || history.data.length === 0 ? (
                    <EmptyState>Розіграшів ще не було</EmptyState>
                ) : (
                    <ul className="space-y-2">
                        {history.data.map((week) => (
                            <li key={week._id} className="rounded-2xl bg-[var(--bg-app)] p-3">
                                <p className="mb-1 text-sm font-bold text-[var(--text-main)]">
                                    Тиждень {week.weekNumber}{" "}
                                    <span className="font-normal text-[var(--text-muted)]">
                                        ({new Date(week.endDate).toLocaleDateString("uk-UA")})
                                    </span>
                                </p>
                                <ul className="space-y-0.5 text-sm">
                                    {week.winners.map((w) => (
                                        <li key={`${week._id}-${w.position}`} className="flex justify-between">
                                            <span className="truncate text-[var(--text-main)]">
                                                {MEDALS[w.position - 1] ?? `${w.position}.`} {w.nickname}
                                            </span>
                                            <span className="text-[var(--text-muted)]">{formatNumber(w.score)}</span>
                                        </li>
                                    ))}
                                </ul>
                            </li>
                        ))}
                    </ul>
                )}
            </Section>
        </div>
    );
};