import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  Trophy,
  Gift,
  ShieldAlert,
  Info,
  ChevronDown,
  ChevronUp,
  Timer,
  Star,
} from "lucide-react";
import { Screen } from "../shared/ui/Screen";
import { Card } from "../shared/ui/Card";
import { Button } from "../shared/ui/Button";
import { useUserStore } from "../store/userStore";
import { useLeaderboardStore } from "../store/leaderboardStore";

type Tab = "rating" | "giveaway";

const resolveAvatarUrl = (url: string | null | undefined) => {
  if (!url) return null;
  if (url.startsWith("http")) return url;
  const apiBase = (import.meta.env.VITE_API_URL || "http://localhost:3000")
    .replace(/\/api$/, "")
    .replace(/\/$/, "");
  return `${apiBase}${url}?ngrok-skip-browser-warning=true`;
};

const calculateTimeLeft = () => {
  const now = new Date();
  const nextSunday = new Date();
  nextSunday.setDate(now.getDate() + ((7 - now.getDay()) % 7));
  nextSunday.setHours(20, 0, 0, 0);

  if (now.getTime() > nextSunday.getTime()) {
    nextSunday.setDate(nextSunday.getDate() + 7);
  }

  const difference = nextSunday.getTime() - now.getTime();
  if (difference > 0) {
    return {
      days: Math.floor(difference / (1000 * 60 * 60 * 24)),
      hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
      minutes: Math.floor((difference / 1000 / 60) % 60),
    };
  }
  return { days: 0, hours: 0, minutes: 0 };
};

const UserAvatar = ({
  url,
  name,
  className,
}: {
  url?: string | null;
  name: string;
  className: string;
}) => {
  const [hasError, setHasError] = useState(false);

  if (!url || hasError) {
    return (
      <div
        className={`${className} flex items-center justify-center bg-[var(--bg-card)] text-[var(--text-main)] font-black uppercase shrink-0`}
      >
        {name ? name.charAt(0) : "U"}
      </div>
    );
  }

  return (
    <img
      src={url}
      alt={name}
      className={`${className} bg-[var(--bg-app)] shrink-0`}
      onError={() => setHasError(true)}
    />
  );
};

export const LeaderboardPage = () => {
  const {
    telegramId,
    telegramFirstName,
    telegramUsername,
    telegramPhotoUrl,
    customAvatarUrl,
    streak,
    wordsLearnedCount,
  } = useUserStore();
  const { topUsers, currentUserRank, isLoading, fetchLeaderboard } =
    useLeaderboardStore();

  const [activeTab, setActiveTab] = useState<Tab>("rating");
  const [showRules, setShowRules] = useState(false);
  const [timeLeft, setTimeLeft] = useState(calculateTimeLeft());

  const adminId = Number(import.meta.env.VITE_ADMIN_ID);
  const isAdmin = telegramId === adminId;

  const myDisplayName = telegramUsername || telegramFirstName || "User";

  useEffect(() => {
    if (telegramId) fetchLeaderboard();
  }, [telegramId, fetchLeaderboard]);

  useEffect(() => {
    if (activeTab === "giveaway") {
      const timer = setInterval(() => setTimeLeft(calculateTimeLeft()), 60000);
      return () => clearInterval(timer);
    }
  }, [activeTab]);

  const handleForceEndGiveaway = () => {
    if (
      window.confirm("Закінчити розіграш і визначити переможців прямо зараз?")
    ) {
      alert(
        "Ендпоінт для ручного завершення розіграшу буде підключено в Кроці 6!",
      );
    }
  };

  return (
    <Screen className="justify-start p-4 space-y-6 bg-[var(--bg-app)] pb-28">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-black text-[var(--text-main)]">
          Топ Гравців
        </h1>
      </div>

      <div className="flex bg-[var(--bg-card)] rounded-xl p-1 border border-[var(--border-color)]">
        <button
          onClick={() => setActiveTab("rating")}
          className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-bold rounded-lg transition-all ${
            activeTab === "rating"
              ? "bg-[var(--accent-cta)] text-white shadow-sm"
              : "text-[var(--text-muted)]"
          }`}
        >
          <Trophy className="w-4 h-4" /> Рейтинг
        </button>
        <button
          onClick={() => setActiveTab("giveaway")}
          className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-bold rounded-lg transition-all ${
            activeTab === "giveaway"
              ? "bg-[var(--accent-success)] text-white shadow-sm"
              : "text-[var(--text-muted)]"
          }`}
        >
          <Gift className="w-4 h-4" /> Розіграш
        </button>
      </div>

      {activeTab === "rating" && (
        <div className="space-y-4 relative pb-16 animate-in fade-in duration-200">
          <Card className="p-3 bg-[var(--bg-card)]/50">
            <button
              onClick={() => setShowRules(!showRules)}
              className="flex items-center justify-between w-full text-sm font-bold text-[var(--text-main)]"
            >
              <span className="flex items-center gap-2">
                <Info className="w-4 h-4 text-[var(--accent-cta)]" /> Як
                рахуються бали?
              </span>
              {showRules ? (
                <ChevronUp className="w-4 h-4 text-[var(--text-muted)]" />
              ) : (
                <ChevronDown className="w-4 h-4 text-[var(--text-muted)]" />
              )}
            </button>
            {showRules && (
              <div className="mt-3 pt-3 border-t border-[var(--border-color)] text-xs text-[var(--text-muted)] leading-relaxed space-y-2">
                <p>
                  Твій рейтинг = <b>Слова + Теми + Дні поспіль (Streak)</b>.
                </p>
                <p>
                  Чим регулярніше ти навчаєшся, тим вище твоя позиція та шанси
                  на перемогу в розіграшах!
                </p>
              </div>
            )}
          </Card>

          {isLoading ? (
            <div className="text-center py-10 text-[var(--text-muted)] text-sm">
              Завантаження...
            </div>
          ) : (
            <div className="space-y-2.5">
              {topUsers.length === 0 && (
                <Card className="flex items-center p-4 gap-4 border-[var(--accent-cta)] bg-[var(--accent-cta)]/5">
                  <div className="w-8 text-center text-2xl">🥇</div>
                  <UserAvatar
                    url={resolveAvatarUrl(customAvatarUrl || telegramPhotoUrl)}
                    name={myDisplayName}
                    className="w-12 h-12 rounded-full object-cover border-2 border-[var(--accent-cta)]"
                  />
                  <div className="flex-1 overflow-hidden">
                    <div className="font-bold text-lg text-[var(--text-main)] truncate">
                      {myDisplayName}
                    </div>
                    <div className="text-xs text-[var(--text-muted)]">
                      Ти перший у списку!
                    </div>
                  </div>
                  <div className="font-black text-xl text-[var(--accent-cta)]">
                    {wordsLearnedCount + streak}
                  </div>
                </Card>
              )}

              {topUsers.map((user, idx) => {
                const isTop3 = idx < 3;
                return (
                  <Link
                    to={`/profile/${user._id}`}
                    key={user._id}
                    className="block hover:scale-[1.02] transition-transform"
                  >
                    <Card
                      className={`flex items-center gap-3 transition-all ${
                        isTop3
                          ? "p-4 border-[var(--accent-cta)]/50 bg-[var(--accent-cta)]/5"
                          : "p-2.5 bg-[var(--bg-card)]"
                      }`}
                    >
                      <div
                        className={`w-8 text-center font-black ${
                          isTop3
                            ? "text-2xl"
                            : "text-sm text-[var(--text-muted)]"
                        }`}
                      >
                        {user.position === 1
                          ? "🥇"
                          : user.position === 2
                            ? "🥈"
                            : user.position === 3
                              ? "🥉"
                              : `#${user.position}`}
                      </div>
                      <UserAvatar
                        url={resolveAvatarUrl(
                          user.customAvatarUrl || user.telegramPhotoUrl,
                        )}
                        name={user.nickname}
                        className={`${
                          isTop3
                            ? "w-12 h-12 border-2 border-[var(--accent-cta)]/30"
                            : "w-9 h-9 border border-[var(--border-color)]"
                        } rounded-full object-cover`}
                      />
                      <div className="flex-1 overflow-hidden">
                        <div
                          className={`font-bold text-[var(--text-main)] truncate ${
                            isTop3 ? "text-lg" : "text-sm"
                          }`}
                        >
                          {user.nickname}
                        </div>
                      </div>
                      <div
                        className={`font-black text-[var(--accent-cta)] ${
                          isTop3 ? "text-xl" : "text-base"
                        }`}
                      >
                        {user.score}
                      </div>
                    </Card>
                  </Link>
                );
              })}
            </div>
          )}

          {currentUserRank && topUsers.length > 0 && (
            <Link
              to={`/profile/${currentUserRank._id}`}
              className="fixed bottom-[calc(70px+env(safe-area-inset-bottom))] left-4 right-4 z-40 block hover:scale-[1.02] transition-transform"
            >
              <Card className="flex items-center p-3 gap-3 border-[var(--accent-cta)] shadow-2xl bg-[var(--bg-card-elevated)]">
                <div className="w-8 text-center font-black text-[var(--accent-cta)]">
                  #{currentUserRank.position}
                </div>
                <div className="flex-1 font-bold text-[var(--text-main)] truncate">
                  Ви ({myDisplayName})
                </div>
                <div className="font-black text-[var(--accent-cta)] text-lg">
                  {currentUserRank.score}
                </div>
              </Card>
            </Link>
          )}
        </div>
      )}

      {activeTab === "giveaway" && (
        <div className="space-y-4 animate-in fade-in duration-200">
          {isAdmin && (
            <Card className="p-4 bg-red-500/10 border-red-500/30 space-y-3">
              <div className="flex items-center gap-2 text-red-500 font-bold">
                <ShieldAlert className="w-5 h-5" /> Панель Адміністратора
              </div>
              <Button
                onClick={handleForceEndGiveaway}
                className="w-full bg-red-500 hover:bg-red-600 text-white font-bold border-none shadow-md"
              >
                Закінчити розіграш зараз
              </Button>
            </Card>
          )}

          <Card className="p-5 bg-gradient-to-br from-[var(--accent-success)]/20 to-[var(--bg-app)] border-[var(--accent-success)]/30 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-[var(--accent-success)] font-black text-lg">
                <Gift className="w-6 h-6" /> Наступний розіграш
              </div>
            </div>

            <div className="flex justify-center gap-3 py-2">
              <div className="flex flex-col items-center bg-[var(--bg-card)] p-3 rounded-xl border border-[var(--accent-success)]/20 min-w-[70px] shadow-sm">
                <span className="text-2xl font-black text-[var(--text-main)]">
                  {timeLeft.days}
                </span>
                <span className="text-[10px] uppercase font-bold text-[var(--text-muted)]">
                  Днів
                </span>
              </div>
              <div className="text-2xl font-black text-[var(--text-muted)] self-center">
                :
              </div>
              <div className="flex flex-col items-center bg-[var(--bg-card)] p-3 rounded-xl border border-[var(--accent-success)]/20 min-w-[70px] shadow-sm">
                <span className="text-2xl font-black text-[var(--text-main)]">
                  {timeLeft.hours}
                </span>
                <span className="text-[10px] uppercase font-bold text-[var(--text-muted)]">
                  Годин
                </span>
              </div>
              <div className="text-2xl font-black text-[var(--text-muted)] self-center">
                :
              </div>
              <div className="flex flex-col items-center bg-[var(--bg-card)] p-3 rounded-xl border border-[var(--accent-success)]/20 min-w-[70px] shadow-sm">
                <span className="text-2xl font-black text-[var(--text-main)]">
                  {timeLeft.minutes}
                </span>
                <span className="text-[10px] uppercase font-bold text-[var(--text-muted)]">
                  Хвилин
                </span>
              </div>
            </div>

            <div className="flex items-start gap-2 bg-[var(--bg-app)]/50 p-3 rounded-xl mt-2">
              <Timer className="w-4 h-4 text-[var(--accent-success)] shrink-0 mt-0.5" />
              <p className="text-xs text-[var(--text-main)] leading-relaxed font-medium">
                Участь автоматична для всіх у Топі! Переможці обираються
                випадково, але вищий рейтинг = більше шансів.
              </p>
            </div>
          </Card>

          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-[var(--text-muted)] ml-1 mb-3 flex items-center gap-2">
              <Star className="w-4 h-4" /> Історія переможців
            </h3>
            <Card className="p-8 text-center border-dashed border-[var(--border-color)] bg-transparent">
              <div className="w-12 h-12 mx-auto bg-[var(--bg-card)] rounded-full flex items-center justify-center text-[var(--text-muted)] mb-3 shadow-sm">
                <Trophy className="w-6 h-6" />
              </div>
              <p className="text-sm font-bold text-[var(--text-main)]">
                Перший розіграш ще попереду!
              </p>
              <p className="text-xs text-[var(--text-muted)] mt-1">
                Грай щодня, щоб потрапити в історію.
              </p>
            </Card>
          </div>
        </div>
      )}
    </Screen>
  );
};
