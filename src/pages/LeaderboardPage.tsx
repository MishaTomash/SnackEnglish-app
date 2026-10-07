// 📁 Файл: SnackEnglish-app/src/pages/LeaderboardPage.tsx
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  Trophy,
  Flag,
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
import {
  useLeaderboardStore,
  type GiveawayHistoryData,
} from "../store/leaderboardStore";
import { resolveAvatarUrl } from "../shared/lib/avatarUrl";
import { SupportCard } from "../widgets/SupportCard";
import { GIVEAWAY_HOUR, GIVEAWAY_TIME_LABEL, GIVEAWAY_TIMEZONE, GIVEAWAY_WEEKDAY } from "../shared/lib/giveaway";

type Tab = "rating" | "giveaway";

/** Розіграш завершує сервер щонеділі за Києвом; час — shared/lib/giveaway (як у cron на сервері) */

/**
 * "Настінний" час у заданому поясі як Date (для розрахунків різниці).
 * ВИПРАВЛЕНО: раніше відлік ішов від часу телефона — юзер в іншому часовому поясі
 * (або з неправильним поясом на телефоні) бачив неправильний таймер.
 */
const nowInZone = (timeZone: string): Date => {
  const now = new Date();
  try {
    const zoned = new Date(now.toLocaleString("en-US", { timeZone }));
    return Number.isNaN(zoned.getTime()) ? now : zoned;
  } catch {
    return now; // дуже старий WebView без підтримки часових поясів
  }
};

const calculateTimeLeft = () => {
  const now = nowInZone(GIVEAWAY_TIMEZONE);
  const nextSunday = new Date(now);
  nextSunday.setDate(now.getDate() + ((7 + GIVEAWAY_WEEKDAY - now.getDay()) % 7));
  nextSunday.setHours(GIVEAWAY_HOUR, 0, 0, 0);

  if (now.getTime() >= nextSunday.getTime()) {
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

  useEffect(() => {
    setHasError(false);
  }, [url]);

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

const HistoryItem = ({ week }: { week: GiveawayHistoryData }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dateStr = new Date(week.endDate).toLocaleDateString("uk-UA");

  return (
    <Card className="p-3 bg-[var(--bg-card)] border-[var(--border-color)] mb-3">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between w-full text-sm font-bold text-[var(--text-main)]"
      >
        <span>
          Тиждень {week.weekNumber}{" "}
          <span className="text-[var(--text-muted)] text-xs font-normal">
            ({dateStr})
          </span>
        </span>
        {isOpen ? (
          <ChevronUp className="w-4 h-4" />
        ) : (
          <ChevronDown className="w-4 h-4" />
        )}
      </button>
      {isOpen && (
        <div className="mt-3 pt-3 border-t border-[var(--border-color)] space-y-2">
          {week.winners.map((winner) => (
            <div key={winner.userId} className="flex items-center gap-3">
              <div className="w-6 text-center font-bold text-sm">
                {winner.position === 1
                  ? "🥇"
                  : winner.position === 2
                    ? "🥈"
                    : "🥉"}
              </div>
              <UserAvatar
                url={resolveAvatarUrl(winner.avatarUrl)}
                name={winner.nickname}
                className="w-8 h-8 rounded-full object-cover border border-[var(--border-color)]"
              />
              <div className="flex-1 font-bold text-sm text-[var(--text-main)] truncate">
                {winner.nickname}
              </div>
              <div className="font-black text-[var(--accent-cta)] text-sm">
                {winner.score}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
};

export const LeaderboardPage = () => {
  const {
    telegramId,
    telegramFirstName,
    telegramUsername,
    telegramPhotoUrl,
    customAvatarUrl,
    weeklyScore,
  } = useUserStore();

  const {
    topUsers,
    currentUserRank,
    giveawayHistory,
    isLoading,
    fetchLeaderboard,
    fetchGiveawayHistory,
    forceEndGiveaway,
  } = useLeaderboardStore();

  const [activeTab, setActiveTab] = useState<Tab>("rating");
  const [showRules, setShowRules] = useState(false);
  const [timeLeft, setTimeLeft] = useState(calculateTimeLeft());

  const adminId = Number(import.meta.env.VITE_ADMIN_ID);
  const isAdmin = telegramId === adminId;

  const myDisplayName = telegramUsername || telegramFirstName || "User";

  // Рейтинг — за балами тижня. Раніше тут підставлявся totalScore (бали за весь час)
  const myScore = currentUserRank?.score ?? weeklyScore ?? 0;

  useEffect(() => {
    if (telegramId) fetchLeaderboard();
  }, [telegramId, fetchLeaderboard]);

  useEffect(() => {
    if (activeTab === "giveaway") {
      fetchGiveawayHistory();
      setTimeLeft(calculateTimeLeft());
      const timer = setInterval(() => setTimeLeft(calculateTimeLeft()), 60000);
      return () => clearInterval(timer);
    }
  }, [activeTab, fetchGiveawayHistory]);

  const handleForceEndGiveaway = async () => {
    if (
      window.confirm("Закінчити змагання тижня і визначити переможців прямо зараз?")
    ) {
      try {
        await forceEndGiveaway();
        alert("Змагання тижня завершено! Бали рейтингу скинуто.");
      } catch {
        alert("Не вдалося завершити змагання. Спробуй ще раз.");
      }
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
          className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-bold rounded-lg transition-all ${activeTab === "rating"
              ? "bg-[var(--accent-cta)] text-white shadow-sm"
              : "text-[var(--text-muted)]"
            }`}
        >
          <Trophy className="w-4 h-4" /> Рейтинг
        </button>
        <button
          onClick={() => setActiveTab("giveaway")}
          className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-bold rounded-lg transition-all ${activeTab === "giveaway"
              ? "bg-[var(--accent-success)] text-white shadow-sm"
              : "text-[var(--text-muted)]"
            }`}
        >
          <Flag className="w-4 h-4" /> Змагання
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
                  Рейтинг тепер <b>тижневий</b>: бали рахуються за поточний
                  тиждень і щонеділі о {GIVEAWAY_TIME_LABEL} скидаються заново.
                </p>
                <p>
                  За кожен пройдений урок на сторінці Навчання ти отримуєш рівно{" "}
                  <b>10 кубків</b> до тижневого рахунку. Хто набрав найбільше
                  кубків за тиждень, той і перемагає. Топ-3 тижня назавжди
                  потрапляють в історію переможців.
                </p>
                <p>
                  Кубки за весь час нікуди не зникають — вони й далі показуються
                  в твоєму профілі.
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
                    {myScore}
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
                      className={`flex items-center gap-3 transition-all ${isTop3
                          ? "p-4 border-[var(--accent-cta)]/50 bg-[var(--accent-cta)]/5"
                          : "p-2.5 bg-[var(--bg-card)]"
                        }`}
                    >
                      <div
                        className={`w-8 text-center font-black ${isTop3
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
                        className={`${isTop3
                            ? "w-12 h-12 border-2 border-[var(--accent-cta)]/30"
                            : "w-9 h-9 border border-[var(--border-color)]"
                          } rounded-full object-cover`}
                      />
                      <div className="flex-1 overflow-hidden">
                        <div
                          className={`font-bold text-[var(--text-main)] truncate ${isTop3 ? "text-lg" : "text-sm"
                            }`}
                        >
                          {user.nickname}
                        </div>
                      </div>
                      <div
                        className={`font-black text-[var(--accent-cta)] ${isTop3 ? "text-xl" : "text-base"
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
                Закінчити змагання зараз
              </Button>
            </Card>
          )}

          <Card className="p-5 bg-gradient-to-br from-[var(--accent-success)]/20 to-[var(--bg-app)] border-[var(--accent-success)]/30 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-[var(--accent-success)] font-black text-lg">
                <Flag className="w-6 h-6" /> До кінця тижня
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
                Це щотижневе змагання, участь автоматична. Щонеділі о {GIVEAWAY_TIME_LABEL} топ-3 гравці
                з найвищим рейтингом стають переможцями тижня та назавжди потрапляють в історію.
              </p>
            </div>
          </Card>

          {/* Підтримка проєкту; блок видно лише якщо підтримку увімкнено в адмінці */}
          <SupportCard place="giveaway" />

          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-[var(--text-muted)] ml-1 mb-3 flex items-center gap-2">
              <Star className="w-4 h-4" /> Історія переможців
            </h3>
            {giveawayHistory.length === 0 ? (
              <Card className="p-8 text-center border-dashed border-[var(--border-color)] bg-transparent">
                <div className="w-12 h-12 mx-auto bg-[var(--bg-card)] rounded-full flex items-center justify-center text-[var(--text-muted)] mb-3 shadow-sm">
                  <Trophy className="w-6 h-6" />
                </div>
                <p className="text-sm font-bold text-[var(--text-main)]">
                  Перший тиждень змагання ще триває!
                </p>
                <p className="text-xs text-[var(--text-muted)] mt-1">
                  Грай щодня, щоб потрапити в історію.
                </p>
              </Card>
            ) : (
              <div>
                {giveawayHistory.map((week) => (
                  <HistoryItem key={week._id} week={week} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </Screen>
  );
};