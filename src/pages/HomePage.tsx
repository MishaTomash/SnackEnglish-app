import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  BrainCircuit,
  Sparkles,
  MoreVertical,
  User as UserIcon,
  Trophy,
  Users,
  Heart,
  Flame,
  ShieldCheck,
} from "lucide-react";
import { Screen } from "../shared/ui/Screen";
import { Card } from "../shared/ui/Card";
import { Badge } from "../shared/ui/Badge";
import { StreakBadge } from "../entities/user/ui/StreakBadge";
import { useUserStore } from "../store/userStore";
import { useRepetitionStore } from "../store/repetitionStore";
import { CookieMascot } from "../shared/ui/CookieMascot";
import { apiClient } from "../shared/api/apiClient";
import { MessageCircleWarning } from "lucide-react";
import { FeedbackModal } from "../shared/ui/FeedbackModal";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000/api";

const resolveAvatarUrl = (url: string | null) => {
  if (!url) return null;
  if (url.startsWith("http")) return url;
  const apiBase = API_URL.replace(/\/api$/, "").replace(/\/$/, "");
  return `${apiBase}${url}?ngrok-skip-browser-warning=true`;
};

export const HomePage = () => {
  const {
    telegramId,
    level,
    streak,
    totalScore,
    wordsLearnedCount,
    telegramFirstName,
    telegramUsername,
    telegramPhotoUrl,
    customDisplayName,
    customAvatarUrl,
    fetchUser,
  } = useUserStore();

  const { dailyQueue, loadDailyWords, status } = useRepetitionStore();

  const [stats, setStats] = useState({ likesCount: 0, friendsCount: 0 });

  // Стейт для розсилки
  const [isBroadcastOpen, setIsBroadcastOpen] = useState(false);
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const [broadcastText, setBroadcastText] = useState("");
  const [isBroadcasting, setIsBroadcasting] = useState(false);

  const isAdmin = telegramId === Number(import.meta.env.VITE_ADMIN_ID);

  useEffect(() => {
    fetchUser(true);
  }, [fetchUser]);

  useEffect(() => {
    if (status === "idle") {
      loadDailyWords();
    }
  }, [status, loadDailyWords]);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const initData =
          window.Telegram?.WebApp?.initData || "mock_hash_for_dev_mode";
        const res = await fetch(`${API_URL}/profile/me/stats`, {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${initData}`,
            "ngrok-skip-browser-warning": "true",
            "Bypass-Tunnel-Reminder": "true",
          },
        });
        if (res.ok) {
          const data = await res.json();
          setStats(data);
        }
      } catch (error) {
        console.error("Failed to fetch profile stats:", error);
      }
    };
    if (telegramId) fetchStats();
  }, [telegramId]);

  const handleBroadcast = async () => {
    if (!broadcastText.trim()) return;
    setIsBroadcasting(true);
    try {
      await apiClient.post("/admin/broadcast", { text: broadcastText });
      setIsBroadcastOpen(false);
      setBroadcastText("");
      alert("Розсилку успішно запущено!");
    } catch (error) {
      console.error("Broadcast failed:", error);
      alert("Помилка при запуску розсилки");
    } finally {
      setIsBroadcasting(false);
    }
  };

  const reviewWordsCount = dailyQueue.length;
  const hasReviews = reviewWordsCount > 0;

  const currentDisplayName =
    customDisplayName || telegramFirstName || "Користувач";
  const currentPhotoUrl = resolveAvatarUrl(customAvatarUrl) || telegramPhotoUrl;

  // Тижнева активність
  const weekDays = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Нд"];
  const jsDay = new Date().getDay();
  const currentDayIndex = jsDay === 0 ? 6 : jsDay - 1;

  return (
    <Screen className="space-y-4 pb-24">
      {/* Шапка профілю */}
      <div className="flex items-center justify-between gap-3 pt-1 pb-2">
        <Link to="/settings" className="flex items-center gap-3 min-w-0 flex-1">
          {currentPhotoUrl ? (
            <img
              src={currentPhotoUrl}
              alt="Avatar"
              className="w-12 h-12 rounded-full object-cover bg-[var(--bg-app)] border border-[var(--border-color)] shrink-0"
            />
          ) : (
            <div className="w-12 h-12 rounded-full bg-[var(--bg-card)] flex items-center justify-center text-[var(--text-muted)] border border-[var(--border-color)] shrink-0">
              <UserIcon className="w-6 h-6" />
            </div>
          )}

          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <h1 className="text-base font-black text-[var(--text-main)] leading-tight truncate">
                {currentDisplayName}
              </h1>
              <Badge className="px-1.5 py-0 font-bold text-[10px] tracking-wide bg-[var(--accent-cta)]/10 text-[var(--text-main)] border border-[var(--accent-cta)]/20 shrink-0">
                {level}
              </Badge>
            </div>
            {telegramUsername && (
              <span className="text-[11px] font-medium text-[var(--text-muted)] mt-0.5 truncate">
                @{telegramUsername}
              </span>
            )}
          </div>
        </Link>

        <div className="flex items-center gap-2 shrink-0">
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--accent-cta)]/10 border border-[var(--accent-cta)]/20 text-[var(--accent-cta)] font-black text-sm shadow-sm">
            <Trophy className="w-4 h-4" />
            <span>{totalScore || 0}</span>
          </div>

          {/* Кнопка фідбеку — печиво з бейджем */}
          <button
            onClick={() => setIsFeedbackOpen(true)}
            aria-label="Повідомити про проблему"
            title="Повідомити про проблему"
            className="relative w-10 h-10 rounded-full bg-[var(--bg-card)] border border-[var(--border-color)] flex items-center justify-center active:scale-95 transition-transform shrink-0"
          >
            <CookieMascot state="happy" size={32} />
            <span className="absolute -bottom-0.5 -right-0.5 w-4.5 h-4.5 min-w-[18px] min-h-[18px] rounded-full bg-[var(--accent-cta)] text-white flex items-center justify-center border-2 border-[var(--bg-card)] shadow-sm">
              <MessageCircleWarning className="w-2.5 h-2.5" strokeWidth={3} />
            </span>
          </button>

          <StreakBadge streak={streak} />

          <Link
            to="/settings"
            className="p-2 rounded-full bg-[var(--bg-card)] text-[var(--text-main)] transition-colors active:opacity-70 border border-[var(--border-color)]"
          >
            <MoreVertical className="w-5 h-5" />
          </Link>
        </div>
      </div>

      {/* Панель адміністратора (Кнопка розсилки + вхід в адмінку) */}
      {isAdmin && (
        <Card className="p-3 bg-[var(--bg-card)] border-[var(--border-color)] flex flex-col gap-2">
          <Link
            to="/admin"
            className="w-full py-2.5 rounded-xl bg-violet-500/10 text-violet-400 font-bold border border-violet-500/20 active:opacity-70 transition-opacity flex items-center justify-center gap-2 text-sm"
          >
            <ShieldCheck className="w-4 h-4" />
            Адмін-панель
          </Link>

          {!isBroadcastOpen ? (
            <button
              onClick={() => setIsBroadcastOpen(true)}
              className="w-full py-2.5 rounded-xl bg-blue-500/10 text-blue-500 font-bold border border-blue-500/20 active:opacity-70 transition-opacity flex items-center justify-center gap-2 text-sm"
            >
              🔔 Сповістити про оновлення
            </button>
          ) : (
            <div className="flex flex-col gap-3">
              <h3 className="font-bold text-sm text-[var(--text-main)]">
                Текст розсилки:
              </h3>
              <textarea
                value={broadcastText}
                onChange={(e) => setBroadcastText(e.target.value)}
                className="w-full p-3 rounded-xl bg-[var(--bg-app)] border border-[var(--border-color)] text-[var(--text-main)] text-sm resize-none focus:outline-none focus:border-[var(--accent-cta)]"
                rows={3}
                placeholder="Введіть повідомлення для всіх користувачів..."
              />
              <div className="flex gap-2">
                <button
                  onClick={() => setIsBroadcastOpen(false)}
                  className="flex-1 py-2 rounded-xl bg-[var(--bg-app)] text-[var(--text-muted)] font-bold border border-[var(--border-color)] active:opacity-70 text-sm"
                  disabled={isBroadcasting}
                >
                  Скасувати
                </button>
                <button
                  onClick={handleBroadcast}
                  disabled={isBroadcasting || !broadcastText.trim()}
                  className="flex-1 py-2 rounded-xl bg-[var(--accent-cta)] text-white font-bold active:opacity-70 disabled:opacity-50 text-sm"
                >
                  {isBroadcasting ? "Відправка..." : "Надіслати"}
                </button>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Тижнева активність */}
      <Card className="p-4 bg-[var(--bg-card)] border-[var(--border-color)]">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-black text-sm text-[var(--text-main)] flex items-center gap-1.5">
            <Flame className="w-4 h-4 text-orange-500" /> Активність
          </h3>
          <span className="text-xs font-bold text-[var(--text-muted)]">
            Цього тижня
          </span>
        </div>
        <div className="flex justify-between items-center">
          {weekDays.map((day, index) => {
            const isToday = index === currentDayIndex;
            const isPast = index < currentDayIndex;
            const isCompletedMock = isPast && currentDayIndex - index <= streak;

            return (
              <div key={day} className="flex flex-col items-center gap-1.5">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm transition-all border-2 ${
                    isCompletedMock
                      ? "bg-orange-500 border-orange-500 text-white shadow-sm"
                      : isToday
                        ? "bg-orange-100 border-orange-500 text-orange-600 dark:bg-orange-900/30"
                        : "bg-transparent border-[var(--border-color)] text-[var(--text-muted)]"
                  }`}
                >
                  {isCompletedMock ? "✓" : ""}
                </div>
                <span
                  className={`text-[10px] font-bold ${
                    isToday
                      ? "text-[var(--text-main)]"
                      : "text-[var(--text-muted)]"
                  }`}
                >
                  {day}
                </span>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Мотивація від Маскота */}
      <Link to="/learning" className="block">
        <Card className="p-0 bg-gradient-to-r from-amber-100 to-orange-100 dark:from-amber-950/40 dark:to-orange-900/40 border-amber-200 dark:border-amber-800/50 overflow-hidden relative interactive">
          <div className="p-4 pr-24 relative z-10">
            <h3 className="font-black text-amber-900 dark:text-amber-100 text-sm mb-1">
              Час для англійської!
            </h3>
            <p className="text-xs text-amber-800/80 dark:text-amber-200/80 font-medium leading-relaxed">
              Снакі вже зачекався. Продовжимо вивчення нових слів?
            </p>
          </div>
          <div className="absolute right-0 bottom-0 translate-x-2 translate-y-2">
            <CookieMascot state="happy" size={100} />
          </div>
        </Card>
      </Link>

      {/* Сітка статистики — внизу */}
      <div className="grid grid-cols-2 gap-3 pt-2">
        <Card className="flex flex-col items-start gap-2 p-3.5 h-full">
          <div className="w-8 h-8 rounded-xl bg-[var(--accent-cta)]/15 text-[var(--accent-cta)] flex items-center justify-center">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <div className="text-2xl font-black text-[var(--text-main)] leading-none">
              {wordsLearnedCount}
            </div>
            <div className="text-xs text-[var(--text-muted)] mt-1 font-medium">
              слів вивчено
            </div>
          </div>
        </Card>

        <Link to="/practice" className="block h-full">
          <Card
            className={`flex flex-col items-start gap-2 p-3.5 h-full transition-all active:scale-[0.98] ${
              hasReviews
                ? "border-[var(--accent-success)] bg-[var(--accent-success)]/5 shadow-sm"
                : "border-[var(--border-color)]"
            }`}
          >
            <div
              className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                hasReviews
                  ? "bg-[var(--accent-success)]/20 text-[var(--accent-success)]"
                  : "bg-[var(--text-muted)]/15 text-[var(--text-muted)]"
              }`}
            >
              <BrainCircuit className="w-4 h-4" />
            </div>
            <div>
              <div className="text-2xl font-black text-[var(--text-main)] leading-none">
                {reviewWordsCount}
              </div>
              <div
                className={`text-xs mt-1 font-medium ${
                  hasReviews
                    ? "text-[var(--accent-success)] font-bold"
                    : "text-[var(--text-muted)]"
                }`}
              >
                {hasReviews ? "до Практики ➔" : "на сьогодні"}
              </div>
            </div>
          </Card>
        </Link>

        <Link to="/friends" className="block h-full">
          <Card className="flex flex-col items-start gap-2 p-3.5 h-full transition-all active:scale-[0.98] border-[var(--border-color)] bg-[var(--bg-card)]">
            <div className="w-8 h-8 rounded-xl bg-blue-500/15 text-blue-500 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <div className="text-2xl font-black text-[var(--text-main)] leading-none">
                {stats.friendsCount}
              </div>
              <div className="text-xs text-[var(--text-muted)] mt-1 font-medium">
                друзів
              </div>
            </div>
          </Card>
        </Link>

        <Card className="flex flex-col items-start gap-2 p-3.5 h-full border-[var(--border-color)] bg-[var(--bg-card)]">
          <div className="w-8 h-8 rounded-xl bg-red-500/15 text-red-500 flex items-center justify-center">
            <Heart className="w-4 h-4" />
          </div>
          <div>
            <div className="text-2xl font-black text-[var(--text-main)] leading-none">
              {stats.likesCount}
            </div>
            <div className="text-xs text-[var(--text-muted)] mt-1 font-medium">
              вподобань
            </div>
          </div>
        </Card>
      </div>
      {isFeedbackOpen && (
        <FeedbackModal onClose={() => setIsFeedbackOpen(false)} />
      )}
    </Screen>
  );
};
