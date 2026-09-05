import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  Trophy,
  Gift,
  AlertCircle,
  ArrowRight,
  Medal,
  ShieldAlert,
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

export const LeaderboardPage = () => {
  const { nickname, telegramId } = useUserStore();
  const { topUsers, currentUserRank, isLoading, fetchLeaderboard } =
    useLeaderboardStore();
  const [activeTab, setActiveTab] = useState<Tab>("rating");

  // Перевірка на адміна (твій ID з логів)
  const adminId = Number(import.meta.env.VITE_ADMIN_ID);
  const isAdmin = telegramId === adminId;

  useEffect(() => {
    if (nickname) {
      fetchLeaderboard();
    }
  }, [nickname, fetchLeaderboard]);

  const handleForceEndGiveaway = () => {
    if (
      window.confirm("Закінчити розіграш і визначити переможців прямо зараз?")
    ) {
      // Заглушка до Кроку 6
      alert(
        "Ендпоінт для ручного завершення розіграшу буде підключено в Кроці 6!",
      );
    }
  };

  const renderNoNicknameCTA = () => (
    <div className="flex flex-col items-center justify-center pt-20 text-center space-y-4">
      <div className="w-20 h-20 bg-[var(--accent-cta)]/10 text-[var(--accent-cta)] rounded-full flex items-center justify-center">
        <Medal className="w-10 h-10" />
      </div>
      <div>
        <h2 className="text-xl font-bold text-[var(--text-main)]">
          Ти ще не в Топі!
        </h2>
        <p className="text-sm text-[var(--text-muted)] mt-2 max-w-[260px] mx-auto leading-relaxed">
          Щоб брати участь у щотижневих розіграшах та змагатися з іншими,
          встанови унікальний нікнейм.
        </p>
      </div>
      <Link to="/settings" className="mt-4 block w-full max-w-[240px]">
        <Button
          variant="primary"
          className="w-full flex items-center justify-center gap-2"
        >
          Встановити нікнейм <ArrowRight className="w-4 h-4" />
        </Button>
      </Link>
    </div>
  );

  return (
    <Screen className="justify-start p-4 space-y-6 bg-[var(--bg-app)] pb-24">
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

      {!nickname ? (
        renderNoNicknameCTA()
      ) : (
        <>
          {activeTab === "rating" && (
            <div className="space-y-3 relative pb-16">
              {isLoading ? (
                <div className="text-center py-10 text-[var(--text-muted)] text-sm">
                  Завантаження...
                </div>
              ) : topUsers.length === 0 ? (
                <div className="text-center py-10 text-[var(--text-muted)] text-sm">
                  Рейтинг поки порожній. Будь першим!
                </div>
              ) : (
                topUsers.map((user) => (
                  <Card key={user._id} className="flex items-center p-3 gap-3">
                    <div className="w-6 text-center font-bold text-[var(--text-muted)]">
                      {user.position === 1
                        ? "🥇"
                        : user.position === 2
                          ? "🥈"
                          : user.position === 3
                            ? "🥉"
                            : `#${user.position}`}
                    </div>
                    <img
                      src={
                        resolveAvatarUrl(
                          user.customAvatarUrl || user.telegramPhotoUrl,
                        ) || ""
                      }
                      alt="Avatar"
                      className="w-10 h-10 rounded-full bg-[var(--bg-app)] object-cover border border-[var(--border-color)]"
                      onError={(e) => (e.currentTarget.style.display = "none")}
                    />
                    <div className="flex-1 overflow-hidden">
                      <div className="font-bold text-[var(--text-main)] truncate">
                        @{user.nickname}
                      </div>
                    </div>
                    <div className="font-black text-[var(--accent-cta)]">
                      {user.score}
                    </div>
                  </Card>
                ))
              )}

              {currentUserRank && (
                <Card className="fixed bottom-[calc(75px+env(safe-area-inset-bottom))] left-4 right-4 flex items-center p-3 gap-3 border-[var(--accent-cta)] shadow-lg bg-[var(--bg-card-elevated)] z-40">
                  <div className="w-6 text-center font-bold text-[var(--accent-cta)]">
                    #{currentUserRank.position}
                  </div>
                  <div className="flex-1 font-bold text-[var(--text-main)] truncate">
                    Ви (@{nickname})
                  </div>
                  <div className="font-black text-[var(--accent-cta)]">
                    {currentUserRank.score}
                  </div>
                </Card>
              )}
            </div>
          )}

          {activeTab === "giveaway" && (
            <div className="space-y-4">
              {/* Блок для Адміна */}
              {isAdmin && (
                <Card className="p-4 bg-red-500/10 border-red-500/20 space-y-3">
                  <div className="flex items-center gap-2 text-red-500 font-bold">
                    <ShieldAlert className="w-5 h-5" /> Панель Адміністратора
                  </div>
                  <Button
                    onClick={handleForceEndGiveaway}
                    className="w-full bg-red-500 hover:bg-red-600 text-white font-bold border-none"
                  >
                    Закінчити розіграш зараз
                  </Button>
                </Card>
              )}

              <Card className="p-4 bg-[var(--accent-success)]/10 border-[var(--accent-success)]/20 space-y-3">
                <div className="flex items-center gap-2 text-[var(--accent-success)] font-bold">
                  <Gift className="w-5 h-5" /> Умови розіграшу
                </div>
                <p className="text-sm text-[var(--text-main)] leading-relaxed">
                  Ти береш участь автоматично, оскільки в тебе встановлений
                  нікнейм! Чим більше слів ти вивчаєш, тим вище твоя позиція в
                  Топі, але шанс виграти є у кожного активного гравця.
                </p>
                <div className="flex items-start gap-2 bg-[var(--bg-app)] p-3 rounded-xl border border-[var(--border-color)] mt-2">
                  <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                  <div className="text-sm text-[var(--text-main)]">
                    <span className="font-bold">Коли розіграш?</span>
                    <br />
                    Щонеділі о 20:00 (Київ) або достроково за рішенням
                    адміністратора.
                  </div>
                </div>
              </Card>

              <div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-[var(--text-muted)] ml-1 mb-2">
                  Історія переможців
                </h3>
                <Card className="p-6 text-center text-sm text-[var(--text-muted)] border-dashed">
                  Дані з'являться після першого розіграшу
                </Card>
              </div>
            </div>
          )}
        </>
      )}
    </Screen>
  );
};
