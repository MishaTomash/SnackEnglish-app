// 📁 Файл: SnackEnglish-app/src/features/admin-panel/ui/DashboardTab.tsx
import { useRef, useState } from "react";
import type { FC } from "react";
import { RefreshCw } from "lucide-react";
import { adminApi } from "../api";
import { useAdminQuery } from "../lib/useAdminQuery";
import {
    AdminButton,
    DailyBarChart,
    EmptyState,
    ErrorState,
    HorizontalBars,
    LoadingState,
    Section,
    Segmented,
    StatCard,
    formatNumber,
    formatDateTime,
} from "./primitives";

const PERIODS = [
    { value: 7, label: "7 днів" },
    { value: 14, label: "14 днів" },
    { value: 30, label: "30 днів" },
    { value: 90, label: "90 днів" },
];

/** Людські назви подій аналітики */
const EVENT_LABELS: Record<string, string> = {
    daily_open: "Відкриття застосунку",
    user_registered: "Реєстрація",
    story_node_completed: "Урок пройдено",
    game_started: "Гра розпочата",
    duel_invited: "Виклик на дуель",
    admin_user_updated: "Адмін змінив юзера",
    admin_broadcast_started: "Розсилка",
    admin_payment_resolved: "Оплату оброблено",
    admin_game_access: "Доступ до гри змінено",
    support_click: "Натиснули «Підтримати»",
    daily_goal_reached: "Денну ціль виконано",
    daily_limit_hit: "Уперлись у денний ліміт",
    admin_settings_updated: "Змінено налаштування",
    referral_rewarded: "Друг прийшов за запрошенням",
};

export const DashboardTab: FC<{ onOpenPayments: () => void }> = ({ onOpenPayments }) => {
    const [days, setDays] = useState(30);
    // Кеш сервера обходимо лише при ручному "Оновити", а не при зміні періоду
    const forceFreshRef = useRef(false);
    const { data, error, isLoading, reload } = useAdminQuery(() => {
        const fresh = forceFreshRef.current;
        forceFreshRef.current = false;
        return adminApi.dashboard(days, fresh);
    }, [days]);

    const refresh = () => {
        forceFreshRef.current = true;
        reload();
    };

    if (isLoading && !data) return <LoadingState />;
    if (error && !data) return <ErrorState message={error} onRetry={reload} />;
    if (!data) return null;

    const { users, series, retention, revenue, streaks, week } = data;
    const onboardingRate = users.total > 0 ? Math.round((users.onboarded / users.total) * 100) : 0;

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <Segmented value={days} options={PERIODS} onChange={setDays} />
                <AdminButton variant="secondary" onClick={refresh} loading={isLoading}>
                    <RefreshCw className="h-4 w-4" aria-hidden="true" /> Оновити
                </AdminButton>
            </div>
            <p className="text-[11px] text-[var(--text-muted)]">Дані на {formatDateTime(data.generatedAt)} (оновлюються раз на хвилину)</p>

            {revenue.manualPending > 0 && (
                <button
                    type="button"
                    onClick={onOpenPayments}
                    className="w-full rounded-2xl border border-[var(--accent-cta)] bg-[var(--accent-cta)]/10 p-3 text-left text-sm font-bold text-[var(--accent-cta)]"
                >
                    💳 Очікують перевірки оплат: {revenue.manualPending} — відкрити
                </button>
            )}

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <StatCard label="Усього юзерів" value={users.total} hint={`+${formatNumber(users.newToday)} сьогодні`} />
                <StatCard label="Активні сьогодні" value={users.activeToday} accent="success" />
                <StatCard label="Активні за 7 днів" value={users.active7} hint={`за 30 днів: ${formatNumber(users.active30)}`} />
                <StatCard label="Нові за 7 днів" value={users.new7} hint={`за 30 днів: ${formatNumber(users.new30)}`} accent="cta" />
                <StatCard label="Пройшли онбординг" value={`${onboardingRate}%`} hint={`${formatNumber(users.onboarded)} юзерів`} />
                <StatCard
                    label="Повертаються (7+ днів)"
                    value={`${retention.rate}%`}
                    hint={`${retention.returned} з ${retention.cohortSize} новачків`}
                    accent={retention.rate >= 20 ? "success" : undefined}
                />
                <StatCard label="Середній стрік" value={streaks.average} hint={`рекорд: ${streaks.max} дн`} />
                <StatCard label="Заблоковано" value={users.blocked} accent={users.blocked > 0 ? "error" : undefined} />
            </div>

            <Section title="Активність">
                <div className="space-y-5">
                    <DailyBarChart points={series.activeUsers} label="Активні юзери по днях" color="var(--accent-success)" />
                    <DailyBarChart points={series.newUsers} label="Нові юзери" />
                    <DailyBarChart points={series.lessonsCompleted} label="Пройдені уроки" color="#60a5fa" />
                </div>
                <p className="mt-3 text-[11px] text-[var(--text-muted)]">
                    «Активні» рахуються за подіями в застосунку (відкриття, уроки, ігри). Щоденні відкриття почали записуватись
                    після цього оновлення, тож старіші дні можуть бути заниженими.
                </p>
            </Section>

            <div className="grid gap-4 sm:grid-cols-2">
                <Section title="Рівні юзерів">
                    {data.levels.length === 0 ? (
                        <EmptyState>Немає даних</EmptyState>
                    ) : (
                        <HorizontalBars
                            rows={data.levels.map((l) => ({
                                label: l.level,
                                value: l.count,
                                hint: users.total > 0 ? `${Math.round((l.count / users.total) * 100)}%` : undefined,
                            }))}
                        />
                    )}
                </Section>

                <Section title="Стріки">
                    <div className="grid grid-cols-2 gap-2">
                        <StatCard label="7+ днів поспіль" value={streaks.weekPlus} accent="cta" />
                        <StatCard label="30+ днів поспіль" value={streaks.monthPlus} accent="success" />
                    </div>
                </Section>
            </div>

            <Section title="Дохід">
                <div className="mb-3 grid grid-cols-3 gap-2">
                    <StatCard label="Зірок ⭐" value={revenue.starsTotal} hint={`${revenue.starsPurchases} покупок`} accent="cta" />
                    <StatCard label="Ручні оплати" value={revenue.manualApproved} hint="підтверджено" />
                    <StatCard label="Чекають" value={revenue.manualPending} accent={revenue.manualPending > 0 ? "error" : undefined} />
                </div>
                {revenue.byGame.length === 0 ? (
                    <EmptyState>Ще немає покупок</EmptyState>
                ) : (
                    <HorizontalBars
                        rows={revenue.byGame.map((g) => ({
                            label: g.title,
                            value: g.stars + g.manual,
                            hint: `⭐ ${g.stars} · 💳 ${g.manual}`,
                        }))}
                    />
                )}
            </Section>

            <div className="grid gap-4 sm:grid-cols-2">
                <Section title="Цей тиждень">
                    <p className="mb-3 text-sm text-[var(--text-muted)]">
                        {formatNumber(week.players)} гравців набрали {formatNumber(week.totalScore)} 🏆
                    </p>
                    {week.top.length === 0 ? (
                        <EmptyState>Цього тижня ще ніхто не набрав балів</EmptyState>
                    ) : (
                        <ol className="space-y-1.5">
                            {week.top.map((u, i) => (
                                <li key={u.telegramId} className="flex justify-between text-sm">
                                    <span className="truncate text-[var(--text-main)]">
                                        {["🥇", "🥈", "🥉"][i] ?? `${i + 1}.`} {u.name}
                                    </span>
                                    <span className="font-black text-[var(--accent-cta)]">{formatNumber(u.score)}</span>
                                </li>
                            ))}
                        </ol>
                    )}
                </Section>

                <Section title="Популярні дії (7 днів)">
                    {data.topEvents.length === 0 ? (
                        <EmptyState>Подій ще немає</EmptyState>
                    ) : (
                        <HorizontalBars
                            color="#60a5fa"
                            rows={data.topEvents.map((e) => ({ label: EVENT_LABELS[e.eventType] ?? e.eventType, value: e.count }))}
                        />
                    )}
                </Section>
            </div>
        </div>
    );
};