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
  blocked: boolean;
  createdAt: string;
}

interface AnalyticsSummary {
  totalEvents: number;
  totalUsers: number;
  blockedUsers: number;
  topEvents: { eventType: string; count: number }[];
}

const extractErrorMessage = (e: unknown, fallback: string): string => {
  const anyErr = e as { response?: { data?: { error?: string } } };
  return anyErr?.response?.data?.error || fallback;
};

export const AdminPage = () => {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsSummary | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | "active" | "blocked">("all");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadUsers = useCallback(async () => {
    try {
      const params: Record<string, string> = {};
      if (search) params.search = search;
      if (status !== "all") params.status = status;
      const { data } = await apiClient.get<AdminUser[]>("/user/admin/users", {
        params,
      });
      setUsers(data);
    } catch (e) {
      setError(extractErrorMessage(e, "Не вдалося завантажити користувачів"));
    }
  }, [search, status]);

  const loadAnalytics = useCallback(async () => {
    try {
      const { data } = await apiClient.get<AnalyticsSummary>(
        "/user/admin/analytics",
      );
      setAnalytics(data);
    } catch (e) {
      setError(extractErrorMessage(e, "Не вдалося завантажити аналітику"));
    }
  }, []);

  useEffect(() => {
    setIsLoading(true);
    Promise.all([loadUsers(), loadAnalytics()]).finally(() =>
      setIsLoading(false),
    );
  }, [loadUsers, loadAnalytics]);

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

  return (
    <Screen className="p-4 gap-6 overflow-y-auto">
      <h1 className="text-xl font-bold text-[var(--text-main)]">
        Адмін-панель
      </h1>

      {error && (
        <p className="text-sm text-red-400 bg-red-950/40 rounded-lg p-2">
          {error}
        </p>
      )}

      <section className="flex flex-col gap-2">
        <h2 className="text-base font-semibold text-[var(--text-main)]">
          Аналітика
        </h2>
        {analytics && (
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-lg bg-[var(--bg-card,#2c1e16)] p-3 text-center">
              <div className="text-lg font-bold">{analytics.totalUsers}</div>
              <div className="text-xs opacity-70">Користувачів</div>
            </div>
            <div className="rounded-lg bg-[var(--bg-card,#2c1e16)] p-3 text-center">
              <div className="text-lg font-bold">{analytics.blockedUsers}</div>
              <div className="text-xs opacity-70">Заблоковано</div>
            </div>
            <div className="rounded-lg bg-[var(--bg-card,#2c1e16)] p-3 text-center">
              <div className="text-lg font-bold">{analytics.totalEvents}</div>
              <div className="text-xs opacity-70">Подій усього</div>
            </div>
          </div>
        )}
        {analytics && analytics.topEvents.length > 0 && (
          <ul className="flex flex-col gap-1 mt-1">
            {analytics.topEvents.map((e) => (
              <li
                key={e.eventType}
                className="flex justify-between text-sm bg-[var(--bg-card,#2c1e16)] rounded-md px-3 py-1.5"
              >
                <span>{e.eventType}</span>
                <span className="font-semibold">{e.count}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-base font-semibold text-[var(--text-main)]">
          Користувачі
        </h2>
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

        {isLoading ? (
          <p className="text-sm opacity-70">Завантаження...</p>
        ) : (
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
                    id: {u.telegramId} · {u.level || "—"} · стрік {u.streak}
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
        )}
      </section>
    </Screen>
  );
};
