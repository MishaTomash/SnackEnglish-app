import { useEffect, useState, useCallback } from "react";
import { Screen } from "../../shared/ui/Screen";
import { apiClient } from "../../shared/api/apiClient";

interface AdminUser {
  telegramId: number;
  username?: string;
  telegramFirstName?: string;
  customDisplayName?: string;
  level: string | null;
  streak: number;
  totalScore: number;
  weeklyScore: number;
  blocked: boolean;
  createdAt: string;
}

interface UsersResponse {
  users: AdminUser[];
  total: number;
  page: number;
  pages: number;
}

interface AnalyticsSummary {
  totalEvents: number;
  totalUsers: number;
  blockedUsers: number;
  topEvents: { eventType: string; count: number }[];
  eventsByDay: { date: string; count: number }[];
  topActiveUsers: { telegramId: number; name: string; count: number }[];
}

interface AnalyticsEventRow {
  id: string;
  telegramId: number;
  userName: string;
  eventType: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

interface EventsResponse {
  events: AnalyticsEventRow[];
  total: number;
  page: number;
  pages: number;
}

type Tab = "analytics" | "users";
type UserSort = "createdAt" | "streak" | "totalScore" | "weeklyScore";

const extractErrorMessage = (e: unknown, fallback: string): string => {
  const anyErr = e as { response?: { data?: { error?: string } } };
  return anyErr?.response?.data?.error || fallback;
};

const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString("uk-UA", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

export const AdminPage = () => {
  const [tab, setTab] = useState<Tab>("analytics");
  const [error, setError] = useState<string | null>(null);

  // ---------- Аналітика ----------
  const [analytics, setAnalytics] = useState<AnalyticsSummary | null>(null);
  const [isAnalyticsLoading, setIsAnalyticsLoading] = useState(true);

  const [events, setEvents] = useState<AnalyticsEventRow[]>([]);
  const [eventsPage, setEventsPage] = useState(1);
  const [eventsPages, setEventsPages] = useState(1);
  const [eventTypeFilter, setEventTypeFilter] = useState("");
  const [eventUserFilter, setEventUserFilter] = useState("");
  const [isEventsLoading, setIsEventsLoading] = useState(true);

  const loadAnalytics = useCallback(async () => {
    setIsAnalyticsLoading(true);
    try {
      const { data } = await apiClient.get<AnalyticsSummary>(
        "/user/admin/analytics",
      );
      setAnalytics(data);
    } catch (e) {
      setError(extractErrorMessage(e, "Не вдалося завантажити аналітику"));
    } finally {
      setIsAnalyticsLoading(false);
    }
  }, []);

  const loadEvents = useCallback(
    async (page: number) => {
      setIsEventsLoading(true);
      try {
        const params: Record<string, string | number> = { page, limit: 20 };
        if (eventTypeFilter) params.eventType = eventTypeFilter;
        if (eventUserFilter) params.telegramId = eventUserFilter;
        const { data } = await apiClient.get<EventsResponse>(
          "/user/admin/events",
          { params },
        );
        setEvents(data.events);
        setEventsPage(data.page);
        setEventsPages(data.pages);
      } catch (e) {
        setError(extractErrorMessage(e, "Не вдалося завантажити події"));
      } finally {
        setIsEventsLoading(false);
      }
    },
    [eventTypeFilter, eventUserFilter],
  );

  useEffect(() => {
    if (tab === "analytics") loadAnalytics();
  }, [tab, loadAnalytics]);

  useEffect(() => {
    if (tab === "analytics") loadEvents(1);
  }, [tab, loadEvents]);

  // ---------- Користувачі ----------
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [usersPage, setUsersPage] = useState(1);
  const [usersPages, setUsersPages] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | "active" | "blocked">("all");
  const [sortField, setSortField] = useState<UserSort>("createdAt");
  const [isUsersLoading, setIsUsersLoading] = useState(true);

  const loadUsers = useCallback(
    async (page: number) => {
      setIsUsersLoading(true);
      try {
        const params: Record<string, string | number> = {
          page,
          limit: 20,
          sort: sortField,
          order: "desc",
        };
        if (search) params.search = search;
        if (status !== "all") params.status = status;
        const { data } = await apiClient.get<UsersResponse>(
          "/user/admin/users",
          { params },
        );
        setUsers(data.users);
        setUsersPage(data.page);
        setUsersPages(data.pages);
      } catch (e) {
        setError(extractErrorMessage(e, "Не вдалося завантажити користувачів"));
      } finally {
        setIsUsersLoading(false);
      }
    },
    [search, status, sortField],
  );

  useEffect(() => {
    if (tab === "users") loadUsers(1);
  }, [tab, loadUsers]);

  const handleToggleBlock = async (user: AdminUser) => {
    const nextBlocked = !user.blocked;
    try {
      await apiClient.patch(`/user/admin/users/${user.telegramId}/block`, {
        blocked: nextBlocked,
      });
      setUsers((prev) =>
        prev.map((u) =>
          u.telegramId === user.telegramId ? { ...u, blocked: nextBlocked } : u,
        ),
      );
    } catch (e) {
      setError(extractErrorMessage(e, "Не вдалося змінити статус блокування"));
    }
  };

  const maxDayCount = analytics
    ? Math.max(1, ...analytics.eventsByDay.map((d) => d.count))
    : 1;

  return (
    <Screen className="p-4 gap-4 overflow-y-auto">
      <h1 className="text-xl font-bold text-[var(--text-main)]">
        Адмін-панель
      </h1>

      {error && (
        <p className="text-sm text-red-400 bg-red-950/40 rounded-lg p-2">
          {error}
        </p>
      )}

      <div className="flex bg-[var(--bg-card,#2c1e16)] rounded-xl p-1">
        <button
          onClick={() => setTab("analytics")}
          className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${
            tab === "analytics"
              ? "bg-[var(--accent-cta,#f59e0b)] text-white"
              : "text-[var(--text-muted)]"
          }`}
        >
          Аналітика
        </button>
        <button
          onClick={() => setTab("users")}
          className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${
            tab === "users"
              ? "bg-[var(--accent-cta,#f59e0b)] text-white"
              : "text-[var(--text-muted)]"
          }`}
        >
          Користувачі
        </button>
      </div>

      {tab === "analytics" && (
        <div className="flex flex-col gap-5">
          {isAnalyticsLoading ? (
            <p className="text-sm opacity-70">Завантаження...</p>
          ) : (
            analytics && (
              <>
                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-lg bg-[var(--bg-card,#2c1e16)] p-3 text-center">
                    <div className="text-lg font-bold">
                      {analytics.totalUsers}
                    </div>
                    <div className="text-xs opacity-70">Користувачів</div>
                  </div>
                  <div className="rounded-lg bg-[var(--bg-card,#2c1e16)] p-3 text-center">
                    <div className="text-lg font-bold">
                      {analytics.blockedUsers}
                    </div>
                    <div className="text-xs opacity-70">Заблоковано</div>
                  </div>
                  <div className="rounded-lg bg-[var(--bg-card,#2c1e16)] p-3 text-center">
                    <div className="text-lg font-bold">
                      {analytics.totalEvents}
                    </div>
                    <div className="text-xs opacity-70">Подій усього</div>
                  </div>
                </div>

                {/* Графік подій по днях за останній тиждень */}
                <section className="flex flex-col gap-2">
                  <h2 className="text-sm font-semibold text-[var(--text-main)]">
                    Активність за 7 днів
                  </h2>
                  <div className="flex items-end gap-2 h-28 bg-[var(--bg-card,#2c1e16)] rounded-lg p-3">
                    {analytics.eventsByDay.length === 0 && (
                      <p className="text-xs opacity-60 self-center">
                        Даних ще немає
                      </p>
                    )}
                    {analytics.eventsByDay.map((d) => (
                      <div
                        key={d.date}
                        className="flex-1 flex flex-col items-center gap-1 h-full justify-end"
                      >
                        <span className="text-[10px] opacity-70">
                          {d.count}
                        </span>
                        <div
                          className="w-full rounded-sm bg-[var(--accent-cta,#f59e0b)]"
                          style={{
                            height: `${(d.count / maxDayCount) * 100}%`,
                            minHeight: d.count > 0 ? 4 : 0,
                          }}
                        />
                        <span className="text-[9px] opacity-60">
                          {d.date.slice(5)}
                        </span>
                      </div>
                    ))}
                  </div>
                </section>

                {/* Топ типів подій */}
                <section className="flex flex-col gap-2">
                  <h2 className="text-sm font-semibold text-[var(--text-main)]">
                    Що роблять найчастіше
                  </h2>
                  <ul className="flex flex-col gap-1">
                    {analytics.topEvents.map((e) => (
                      <li
                        key={e.eventType}
                        className="flex justify-between text-sm bg-[var(--bg-card,#2c1e16)] rounded-md px-3 py-1.5"
                      >
                        <span>{e.eventType}</span>
                        <span className="font-semibold">{e.count}</span>
                      </li>
                    ))}
                    {analytics.topEvents.length === 0 && (
                      <p className="text-xs opacity-60">Даних ще немає</p>
                    )}
                  </ul>
                </section>

                {/* Топ активних користувачів за тиждень */}
                <section className="flex flex-col gap-2">
                  <h2 className="text-sm font-semibold text-[var(--text-main)]">
                    Найактивніші за тиждень
                  </h2>
                  <ul className="flex flex-col gap-1">
                    {analytics.topActiveUsers.map((u, idx) => (
                      <li
                        key={u.telegramId}
                        className="flex items-center justify-between text-sm bg-[var(--bg-card,#2c1e16)] rounded-md px-3 py-1.5"
                      >
                        <span className="flex items-center gap-2 min-w-0">
                          <span className="opacity-60 shrink-0">
                            #{idx + 1}
                          </span>
                          <span className="truncate">{u.name}</span>
                        </span>
                        <span className="font-semibold shrink-0">
                          {u.count} дій
                        </span>
                      </li>
                    ))}
                    {analytics.topActiveUsers.length === 0 && (
                      <p className="text-xs opacity-60">Даних ще немає</p>
                    )}
                  </ul>
                </section>
              </>
            )
          )}

          {/* Стрічка подій з фільтрами */}
          <section className="flex flex-col gap-2">
            <h2 className="text-sm font-semibold text-[var(--text-main)]">
              Стрічка подій
            </h2>
            <div className="flex gap-2">
              <select
                value={eventTypeFilter}
                onChange={(e) => setEventTypeFilter(e.target.value)}
                className="flex-1 rounded-lg bg-[var(--bg-card,#2c1e16)] px-2 py-2 text-sm text-[var(--text-main)]"
              >
                <option value="">Усі типи подій</option>
                {analytics?.topEvents.map((e) => (
                  <option key={e.eventType} value={e.eventType}>
                    {e.eventType}
                  </option>
                ))}
              </select>
              <input
                value={eventUserFilter}
                onChange={(e) => setEventUserFilter(e.target.value)}
                placeholder="telegramId"
                inputMode="numeric"
                className="w-28 rounded-lg bg-[var(--bg-card,#2c1e16)] px-3 py-2 text-sm text-[var(--text-main)] outline-none"
              />
            </div>

            {isEventsLoading ? (
              <p className="text-sm opacity-70">Завантаження...</p>
            ) : (
              <>
                <ul className="flex flex-col gap-1.5">
                  {events.map((e) => (
                    <li
                      key={e.id}
                      className="flex items-center justify-between gap-2 text-xs bg-[var(--bg-card,#2c1e16)] rounded-md px-3 py-2"
                    >
                      <div className="min-w-0">
                        <div className="font-medium truncate">
                          {e.userName}{" "}
                          <span className="opacity-60">· {e.eventType}</span>
                        </div>
                        {e.metadata && Object.keys(e.metadata).length > 0 && (
                          <div className="opacity-50 truncate">
                            {JSON.stringify(e.metadata)}
                          </div>
                        )}
                      </div>
                      <span className="opacity-60 shrink-0">
                        {formatDateTime(e.createdAt)}
                      </span>
                    </li>
                  ))}
                  {events.length === 0 && (
                    <p className="text-xs opacity-60">Подій не знайдено</p>
                  )}
                </ul>

                {eventsPages > 1 && (
                  <div className="flex items-center justify-center gap-3 pt-1">
                    <button
                      disabled={eventsPage <= 1}
                      onClick={() => loadEvents(eventsPage - 1)}
                      className="px-3 py-1 rounded-md bg-[var(--bg-card,#2c1e16)] text-sm disabled:opacity-30"
                    >
                      ←
                    </button>
                    <span className="text-xs opacity-70">
                      {eventsPage} / {eventsPages}
                    </span>
                    <button
                      disabled={eventsPage >= eventsPages}
                      onClick={() => loadEvents(eventsPage + 1)}
                      className="px-3 py-1 rounded-md bg-[var(--bg-card,#2c1e16)] text-sm disabled:opacity-30"
                    >
                      →
                    </button>
                  </div>
                )}
              </>
            )}
          </section>
        </div>
      )}

      {tab === "users" && (
        <section className="flex flex-col gap-2">
          <div className="flex gap-2">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Пошук за ім'ям, username, telegramId"
              className="flex-1 rounded-lg bg-[var(--bg-card,#2c1e16)] px-3 py-2 text-sm text-[var(--text-main)] outline-none"
            />
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as typeof status)}
              className="rounded-lg bg-[var(--bg-card,#2c1e16)] px-2 py-2 text-sm text-[var(--text-main)]"
            >
              <option value="all">Усі</option>
              <option value="active">Активні</option>
              <option value="blocked">Заблоковані</option>
            </select>
          </div>

          <div className="flex gap-2">
            <select
              value={sortField}
              onChange={(e) => setSortField(e.target.value as UserSort)}
              className="flex-1 rounded-lg bg-[var(--bg-card,#2c1e16)] px-2 py-2 text-sm text-[var(--text-main)]"
            >
              <option value="createdAt">За датою реєстрації</option>
              <option value="streak">За стріком</option>
              <option value="totalScore">За кубками (весь час)</option>
              <option value="weeklyScore">За кубками (тиждень)</option>
            </select>
          </div>

          {isUsersLoading ? (
            <p className="text-sm opacity-70">Завантаження...</p>
          ) : (
            <>
              <ul className="flex flex-col gap-2">
                {users.map((u) => (
                  <li
                    key={u.telegramId}
                    className="flex items-center justify-between gap-2 rounded-lg bg-[var(--bg-card,#2c1e16)] px-3 py-2"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">
                        {u.customDisplayName ||
                          u.telegramFirstName ||
                          u.username ||
                          u.telegramId}
                      </div>
                      <div className="text-xs opacity-60">
                        id: {u.telegramId} · {u.level || "—"} · стрік {u.streak}{" "}
                        · тиждень {u.weeklyScore} · всього {u.totalScore}
                      </div>
                    </div>
                    <button
                      onClick={() => handleToggleBlock(u)}
                      className={`shrink-0 rounded-md px-3 py-1.5 text-xs font-semibold ${
                        u.blocked
                          ? "bg-emerald-700 text-white"
                          : "bg-red-700 text-white"
                      }`}
                    >
                      {u.blocked ? "Розблокувати" : "Заблокувати"}
                    </button>
                  </li>
                ))}
                {users.length === 0 && (
                  <p className="text-sm opacity-70">Нікого не знайдено</p>
                )}
              </ul>

              {usersPages > 1 && (
                <div className="flex items-center justify-center gap-3 pt-1">
                  <button
                    disabled={usersPage <= 1}
                    onClick={() => loadUsers(usersPage - 1)}
                    className="px-3 py-1 rounded-md bg-[var(--bg-card,#2c1e16)] text-sm disabled:opacity-30"
                  >
                    ←
                  </button>
                  <span className="text-xs opacity-70">
                    {usersPage} / {usersPages}
                  </span>
                  <button
                    disabled={usersPage >= usersPages}
                    onClick={() => loadUsers(usersPage + 1)}
                    className="px-3 py-1 rounded-md bg-[var(--bg-card,#2c1e16)] text-sm disabled:opacity-30"
                  >
                    →
                  </button>
                </div>
              )}
            </>
          )}
        </section>
      )}
    </Screen>
  );
};
