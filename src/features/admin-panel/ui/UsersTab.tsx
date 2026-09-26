// 📁 Файл: SnackEnglish-app/src/features/admin-panel/ui/UsersTab.tsx
import { useEffect, useState } from "react";
import type { FC } from "react";
import { ChevronLeft, ChevronRight, FileDown, Search } from "lucide-react";
import { adminApi, getErrorMessage } from "../api";
import type { UsersQuery } from "../api";
import { useAdminQuery } from "../lib/useAdminQuery";
import {
    AdminButton,
    EmptyState,
    ErrorState,
    LoadingState,
    Notice,
    Pill,
    Section,
    fieldClass,
    formatNumber,
    formatRelative,
} from "./primitives";
import { UserDetailSheet } from "./UserDetailSheet";
import { UserAvatar, userDisplayName } from "./UserAvatar";

const SORT_OPTIONS: { value: NonNullable<UsersQuery["sort"]>; label: string }[] = [
    { value: "createdAt", label: "Нові" },
    { value: "lastActivityDate", label: "Активність" },
    { value: "weeklyScore", label: "Кубки тижня" },
    { value: "totalScore", label: "Кубки за весь час" },
    { value: "streak", label: "Стрік" },
];

export const UsersTab: FC = () => {
    const [searchInput, setSearchInput] = useState("");
    const [query, setQuery] = useState<UsersQuery>({ status: "all", sort: "createdAt", order: "desc", page: 1 });
    const [selectedId, setSelectedId] = useState<number | null>(null);
    const [exportState, setExportState] = useState<{ loading: boolean; message: string | null; ok: boolean }>({
        loading: false,
        message: null,
        ok: true,
    });

    // Пошук із затримкою: не шлемо запит на кожну літеру
    useEffect(() => {
        const timer = setTimeout(() => {
            setQuery((prev) => (prev.search === searchInput.trim() ? prev : { ...prev, search: searchInput.trim(), page: 1 }));
        }, 400);
        return () => clearTimeout(timer);
    }, [searchInput]);

    const { data, error, isLoading, reload } = useAdminQuery(() => adminApi.users(query), [JSON.stringify(query)]);

    const update = (patch: Partial<UsersQuery>) => setQuery((prev) => ({ ...prev, ...patch, page: patch.page ?? 1 }));

    const handleExport = async () => {
        setExportState({ loading: true, message: null, ok: true });
        try {
            const { count } = await adminApi.exportUsers();
            setExportState({ loading: false, message: `CSV з ${formatNumber(count)} юзерами надіслано тобі в чат з ботом`, ok: true });
        } catch (exportError) {
            setExportState({ loading: false, message: getErrorMessage(exportError), ok: false });
        }
    };

    return (
        <div className="space-y-4">
            <Section
                title="Пошук"
                action={
                    <AdminButton variant="secondary" onClick={() => void handleExport()} loading={exportState.loading}>
                        <FileDown className="h-4 w-4" aria-hidden="true" /> CSV
                    </AdminButton>
                }
            >
                <div className="space-y-2">
                    <label className="relative block">
                        <span className="sr-only">Пошук за іменем, @username або id</span>
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
                        <input
                            value={searchInput}
                            onChange={(e) => setSearchInput(e.target.value)}
                            placeholder="Ім'я, @username або Telegram id"
                            className={`${fieldClass} pl-9`}
                        />
                    </label>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                        <select
                            value={query.status}
                            onChange={(e) => update({ status: e.target.value as UsersQuery["status"] })}
                            className={fieldClass}
                            aria-label="Статус"
                        >
                            <option value="all">Усі</option>
                            <option value="active">Активні</option>
                            <option value="blocked">Заблоковані</option>
                        </select>
                        <select
                            value={query.level ?? ""}
                            onChange={(e) => update({ level: e.target.value })}
                            className={fieldClass}
                            aria-label="Рівень"
                        >
                            <option value="">Будь-який рівень</option>
                            {["A1", "A2", "B1", "B2", "C1", "C2"].map((l) => (
                                <option key={l} value={l}>
                                    {l}
                                </option>
                            ))}
                        </select>
                        <select
                            value={query.onboarding ?? ""}
                            onChange={(e) => update({ onboarding: e.target.value as UsersQuery["onboarding"] })}
                            className={fieldClass}
                            aria-label="Онбординг"
                        >
                            <option value="">Онбординг: усі</option>
                            <option value="done">Пройшли</option>
                            <option value="pending">Не пройшли</option>
                        </select>
                        <select
                            value={`${query.sort}:${query.order}`}
                            onChange={(e) => {
                                const [sort, order] = e.target.value.split(":") as [UsersQuery["sort"], UsersQuery["order"]];
                                update({ sort, order });
                            }}
                            className={fieldClass}
                            aria-label="Сортування"
                        >
                            {SORT_OPTIONS.map((o) => (
                                <option key={o.value} value={`${o.value}:desc`}>
                                    {o.label}
                                </option>
                            ))}
                            <option value="createdAt:asc">Найстаріші</option>
                        </select>
                    </div>
                    {exportState.message && <Notice kind={exportState.ok ? "success" : "error"}>{exportState.message}</Notice>}
                </div>
            </Section>

            <Section title={data ? `Юзери: ${formatNumber(data.total)}` : "Юзери"}>
                {isLoading && !data ? (
                    <LoadingState />
                ) : error ? (
                    <ErrorState message={error} onRetry={reload} />
                ) : !data || data.users.length === 0 ? (
                    <EmptyState>Нікого не знайдено</EmptyState>
                ) : (
                    <>
                        <ul className={`divide-y divide-[var(--border-color)] ${isLoading ? "opacity-60" : ""}`}>
                            {data.users.map((user) => (
                                <li key={user.telegramId}>
                                    <button
                                        type="button"
                                        onClick={() => setSelectedId(user.telegramId)}
                                        className="flex w-full items-center gap-3 py-2.5 text-left hover:bg-[var(--bg-card-hover)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-cta)]"
                                    >
                                        <UserAvatar user={user} />
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-1.5">
                                                <span className="truncate text-sm font-bold text-[var(--text-main)]">{userDisplayName(user)}</span>
                                                {user.level && <Pill>{user.level}</Pill>}
                                                {user.blocked && <Pill tone="error">блок</Pill>}
                                                {!user.onboardingCompleted && <Pill tone="warning">новачок</Pill>}
                                            </div>
                                            <p className="truncate text-[11px] text-[var(--text-muted)]">
                                                {user.username ? `@${user.username} · ` : ""}був(ла) {formatRelative(user.lastActivityDate)}
                                            </p>
                                        </div>
                                        <div className="shrink-0 text-right">
                                            <p className="text-sm font-black text-[var(--accent-cta)]">🏆 {formatNumber(user.weeklyScore ?? 0)}</p>
                                            <p className="text-[11px] text-[var(--text-muted)]">🔥 {user.streak ?? 0}</p>
                                        </div>
                                    </button>
                                </li>
                            ))}
                        </ul>
                        {data.pages > 1 && (
                            <div className="mt-3 flex items-center justify-between">
                                <AdminButton
                                    variant="secondary"
                                    disabled={data.page <= 1}
                                    onClick={() => update({ page: data.page - 1 })}
                                    className="px-3"
                                >
                                    <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                                    <span className="sr-only">Попередня сторінка</span>
                                </AdminButton>
                                <span className="text-xs text-[var(--text-muted)]">
                                    {data.page} / {data.pages}
                                </span>
                                <AdminButton
                                    variant="secondary"
                                    disabled={data.page >= data.pages}
                                    onClick={() => update({ page: data.page + 1 })}
                                    className="px-3"
                                >
                                    <ChevronRight className="h-4 w-4" aria-hidden="true" />
                                    <span className="sr-only">Наступна сторінка</span>
                                </AdminButton>
                            </div>
                        )}
                    </>
                )}
            </Section>

            {selectedId !== null && (
                <UserDetailSheet telegramId={selectedId} onClose={() => setSelectedId(null)} onChanged={reload} />
            )}
        </div>
    );
};