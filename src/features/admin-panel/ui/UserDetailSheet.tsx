// 📁 Файл: SnackEnglish-app/src/features/admin-panel/ui/UserDetailSheet.tsx
import { useEffect, useState } from "react";
import type { FC, ReactNode } from "react";
import { X } from "lucide-react";
import { adminApi, getErrorMessage } from "../api";
import type { AdminGame, UserUpdate } from "../api";
import { useAdminQuery } from "../lib/useAdminQuery";
import {
    AdminButton,
    EmptyState,
    ErrorState,
    LoadingState,
    Notice,
    Pill,
    StatCard,
    fieldClass,
    formatDateTime,
    formatNumber,
    formatRelative,
} from "./primitives";
import { UserAvatar, userDisplayName } from "./UserAvatar";

const PAYMENT_STATUS: Record<string, { label: string; tone: "warning" | "success" | "error" }> = {
    pending: { label: "чекає", tone: "warning" },
    approved: { label: "підтверджено", tone: "success" },
    rejected: { label: "відхилено", tone: "error" },
};

const Block: FC<{ title: string; children: ReactNode }> = ({ title, children }) => (
    <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] p-3">
        <h3 className="mb-2 text-sm font-extrabold text-[var(--text-main)]">{title}</h3>
        {children}
    </div>
);

export const UserDetailSheet: FC<{ telegramId: number; onClose: () => void; onChanged: () => void }> = ({
    telegramId,
    onClose,
    onChanged,
}) => {
    const { data, error, isLoading, reload } = useAdminQuery(() => adminApi.userDetail(telegramId), [telegramId]);
    const [games, setGames] = useState<AdminGame[]>([]);
    const [busy, setBusy] = useState<string | null>(null);
    const [notice, setNotice] = useState<{ kind: "success" | "error"; text: string } | null>(null);

    const [scoreDelta, setScoreDelta] = useState("");
    const [streak, setStreak] = useState("");
    const [message, setMessage] = useState("");

    useEffect(() => {
        adminApi.games().then(setGames).catch(() => setGames([]));
    }, []);

    // Закриття на Escape (десктоп)
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [onClose]);

    /** Виконує дію адміна; true — успішно (тоді поле вводу можна очистити) */
    const run = async (key: string, action: () => Promise<unknown>, success: string): Promise<boolean> => {
        setBusy(key);
        setNotice(null);
        try {
            await action();
            setNotice({ kind: "success", text: success });
            reload();
            onChanged();
            return true;
        } catch (actionError) {
            setNotice({ kind: "error", text: getErrorMessage(actionError) });
            return false;
        } finally {
            setBusy(null);
        }
    };

    const patch = (key: string, update: UserUpdate, success: string) =>
        run(key, () => adminApi.updateUser(telegramId, update), success);

    const user = data?.user;
    const ownedGameIds = new Set(data?.purchases.map((p) => p.gameId) ?? []);
    const paidGames = games.filter((g) => !g.isFree);

    return (
        <div className="fixed inset-0 z-[80] flex justify-end bg-black/60" role="dialog" aria-modal="true" aria-label="Юзер">
            <button type="button" className="absolute inset-0 cursor-default" onClick={onClose} aria-label="Закрити" />
            <div className="relative flex h-full w-full max-w-lg flex-col bg-[var(--bg-app)] shadow-2xl">
                <header className="flex items-center gap-3 border-b border-[var(--border-color)] px-4 pb-3 pt-[calc(env(safe-area-inset-top)+12px)]">
                    {user && <UserAvatar user={user} size={44} />}
                    <div className="min-w-0 flex-1">
                        <p className="truncate text-base font-extrabold text-[var(--text-main)]">
                            {user ? userDisplayName(user) : "Юзер"}
                        </p>
                        <p className="truncate text-xs text-[var(--text-muted)]">
                            id {telegramId}
                            {user?.username ? ` · @${user.username}` : ""}
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-full p-2 text-[var(--text-muted)] hover:bg-[var(--bg-card)]"
                        aria-label="Закрити"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </header>

                <div className="flex-1 space-y-3 overflow-y-auto p-4 pb-[calc(env(safe-area-inset-bottom)+24px)]">
                    {isLoading && !data ? (
                        <LoadingState />
                    ) : error ? (
                        <ErrorState message={error} onRetry={reload} />
                    ) : !data || !user ? null : (
                        <>
                            {notice && <Notice kind={notice.kind}>{notice.text}</Notice>}

                            <div className="flex flex-wrap gap-1.5">
                                {user.level && <Pill>{user.level}</Pill>}
                                {user.blocked ? <Pill tone="error">заблокований</Pill> : <Pill tone="success">активний</Pill>}
                                {!user.onboardingCompleted && <Pill tone="warning">не пройшов онбординг</Pill>}
                                <Pill>з {formatDateTime(user.createdAt)}</Pill>
                                <Pill>був(ла) {formatRelative(user.lastActivityDate)}</Pill>
                            </div>

                            <div className="grid grid-cols-3 gap-2">
                                <StatCard label="Кубки тижня" value={user.weeklyScore ?? 0} hint={`місце #${data.stats.weeklyRank}`} accent="cta" />
                                <StatCard label="За весь час" value={user.totalScore ?? 0} />
                                <StatCard label="Стрік" value={`${user.streak ?? 0} 🔥`} />
                                <StatCard label="Уроків" value={data.stats.lessonsCompleted} />
                                <StatCard label="Друзів" value={data.stats.friendsCount} />
                                <StatCard label="Лайків" value={data.stats.likesReceived} />
                            </div>

                            <Block title="Кубки">
                                <p className="mb-2 text-xs text-[var(--text-muted)]">
                                    Додає або знімає кубки тижня (і за весь час). Мінус — зняти, наприклад −50.
                                </p>
                                <div className="flex gap-2">
                                    <input
                                        type="number"
                                        inputMode="numeric"
                                        value={scoreDelta}
                                        onChange={(e) => setScoreDelta(e.target.value)}
                                        placeholder="+100 або −50"
                                        className={fieldClass}
                                        aria-label="Зміна кубків"
                                    />
                                    <AdminButton
                                        loading={busy === "score"}
                                        disabled={!scoreDelta || !Number.isInteger(Number(scoreDelta)) || Number(scoreDelta) === 0}
                                        onClick={() => {
                                            const delta = Number(scoreDelta);
                                            if (!window.confirm(`${delta > 0 ? "Додати" : "Зняти"} ${Math.abs(delta)} 🏆?`)) return;
                                            void patch("score", { scoreDelta: delta }, "Кубки змінено").then((ok) => ok && setScoreDelta(""));
                                        }}
                                    >
                                        Застосувати
                                    </AdminButton>
                                </div>
                            </Block>

                            <Block title="Профіль">
                                <div className="grid grid-cols-2 gap-2">
                                    <label className="text-xs text-[var(--text-muted)]">
                                        Рівень
                                        <select
                                            value={user.level ?? ""}
                                            onChange={(e) =>
                                                void patch("level", { level: e.target.value || null }, `Рівень: ${e.target.value || "не обрано"}`)
                                            }
                                            disabled={busy === "level"}
                                            className={`${fieldClass} mt-1`}
                                        >
                                            <option value="">Не обрано</option>
                                            {["A1", "A2", "B1", "B2", "C1", "C2"].map((l) => (
                                                <option key={l} value={l}>
                                                    {l}
                                                </option>
                                            ))}
                                        </select>
                                    </label>
                                    <label className="text-xs text-[var(--text-muted)]">
                                        Життя (зараз {user.hp ?? 5})
                                        <AdminButton
                                            variant="secondary"
                                            className="mt-1 w-full"
                                            loading={busy === "hp"}
                                            disabled={(user.hp ?? 5) >= 5}
                                            onClick={() => void patch("hp", { hp: 5 }, "Життя відновлено до 5")}
                                        >
                                            ❤️ Відновити до 5
                                        </AdminButton>
                                    </label>
                                </div>
                                <div className="mt-2 flex gap-2">
                                    <input
                                        type="number"
                                        inputMode="numeric"
                                        min={0}
                                        value={streak}
                                        onChange={(e) => setStreak(e.target.value)}
                                        placeholder={`Стрік (зараз ${user.streak ?? 0})`}
                                        className={fieldClass}
                                        aria-label="Новий стрік"
                                    />
                                    <AdminButton
                                        variant="secondary"
                                        loading={busy === "streak"}
                                        disabled={streak === "" || !Number.isInteger(Number(streak)) || Number(streak) < 0}
                                        onClick={() =>
                                            void patch("streak", { streak: Number(streak) }, "Стрік змінено").then((ok) => ok && setStreak(""))
                                        }
                                    >
                                        Встановити
                                    </AdminButton>
                                </div>
                            </Block>

                            <Block title="Повідомлення від бота">
                                <textarea
                                    value={message}
                                    onChange={(e) => setMessage(e.target.value)}
                                    rows={3}
                                    maxLength={4096}
                                    placeholder="Текст (можна <b>жирний</b>, <i>курсив</i>)"
                                    className={`${fieldClass} resize-none`}
                                    aria-label="Текст повідомлення"
                                />
                                <AdminButton
                                    className="mt-2 w-full"
                                    loading={busy === "message"}
                                    disabled={!message.trim()}
                                    onClick={() =>
                                        void run("message", () => adminApi.messageUser(telegramId, message), "Повідомлення надіслано").then(
                                            (ok) => ok && setMessage(""),
                                        )
                                    }
                                >
                                    Надіслати
                                </AdminButton>
                            </Block>

                            {paidGames.length > 0 && (
                                <Block title="Доступ до ігор">
                                    <ul className="space-y-2">
                                        {paidGames.map((game) => {
                                            const owned = ownedGameIds.has(game.gameId);
                                            return (
                                                <li key={game.gameId} className="flex items-center justify-between gap-2">
                                                    <span className="truncate text-sm text-[var(--text-main)]">
                                                        {game.title} {owned && <Pill tone="success">є</Pill>}
                                                    </span>
                                                    <AdminButton
                                                        variant={owned ? "secondary" : "primary"}
                                                        loading={busy === `game-${game.gameId}`}
                                                        onClick={() => {
                                                            if (owned && !window.confirm(`Забрати доступ до «${game.title}»?`)) return;
                                                            void run(
                                                                `game-${game.gameId}`,
                                                                () => adminApi.setUserGame(telegramId, game.gameId, !owned),
                                                                owned ? "Доступ забрано" : "Гру видано",
                                                            );
                                                        }}
                                                    >
                                                        {owned ? "Забрати" : "Видати"}
                                                    </AdminButton>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                </Block>
                            )}

                            {data.payments.length > 0 && (
                                <Block title="Заявки на оплату">
                                    <ul className="space-y-1.5 text-sm">
                                        {data.payments.map((p) => (
                                            <li key={p.id} className="flex items-center justify-between gap-2">
                                                <span className="truncate text-[var(--text-main)]">
                                                    {p.gameTitle} · <span className="font-mono text-xs">{p.uniqueCode}</span>
                                                </span>
                                                <Pill tone={PAYMENT_STATUS[p.status]?.tone ?? "warning"}>
                                                    {PAYMENT_STATUS[p.status]?.label ?? p.status}
                                                </Pill>
                                            </li>
                                        ))}
                                    </ul>
                                </Block>
                            )}

                            <Block title="Останні дії">
                                {data.events.length === 0 ? (
                                    <EmptyState>Подій немає</EmptyState>
                                ) : (
                                    <ul className="space-y-1 text-xs">
                                        {data.events.map((e) => (
                                            <li key={e.id} className="flex justify-between gap-2">
                                                <span className="truncate text-[var(--text-main)]">{e.eventType}</span>
                                                <span className="shrink-0 text-[var(--text-muted)]">{formatDateTime(e.createdAt)}</span>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </Block>

                            <Block title="Небезпечна зона">
                                <AdminButton
                                    variant={user.blocked ? "success" : "danger"}
                                    className="w-full"
                                    loading={busy === "block"}
                                    onClick={() => {
                                        const confirmText = user.blocked
                                            ? "Розблокувати юзера?"
                                            : "Заблокувати юзера? Він не зможе користуватись застосунком.";
                                        if (!window.confirm(confirmText)) return;
                                        void patch(
                                            "block",
                                            { blocked: !user.blocked },
                                            user.blocked ? "Юзера розблоковано" : "Юзера заблоковано",
                                        );
                                    }}
                                >
                                    {user.blocked ? "Розблокувати" : "Заблокувати"}
                                </AdminButton>
                                <p className="mt-2 text-[11px] text-[var(--text-muted)]">
                                    Уроків: {formatNumber(data.stats.lessonsCompleted)} · покупок: {formatNumber(data.purchases.length)}
                                </p>
                            </Block>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};