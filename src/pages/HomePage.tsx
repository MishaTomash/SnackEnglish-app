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
} from "lucide-react";
import { Screen } from "../shared/ui/Screen";
import { Card } from "../shared/ui/Card";
import { Badge } from "../shared/ui/Badge";
import { StreakBadge } from "../entities/user/ui/StreakBadge";
import { useUserStore } from "../store/userStore";
import { useRepetitionStore } from "../store/repetitionStore";

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

  const reviewWordsCount = dailyQueue.length;

  const currentDisplayName =
    customDisplayName || telegramFirstName || "Користувач";
  const currentPhotoUrl = resolveAvatarUrl(customAvatarUrl) || telegramPhotoUrl;

  return (
    <Screen className="space-y-4">
      <div className="flex items-center justify-between pt-1 pb-2">
        <div className="flex items-center gap-3">
          <Link to="/settings" className="relative shrink-0">
            {currentPhotoUrl ? (
              <img
                src={currentPhotoUrl}
                alt="Avatar"
                className="w-12 h-12 rounded-full object-cover bg-[var(--bg-app)] border border-[var(--border-color)]"
              />
            ) : (
              <div className="w-12 h-12 rounded-full bg-[var(--bg-card)] flex items-center justify-center text-[var(--text-muted)] border border-[var(--border-color)]">
                <UserIcon className="w-6 h-6" />
              </div>
            )}
          </Link>

          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <h1 className="text-base font-black text-[var(--text-main)] leading-tight truncate max-w-[140px]">
                {currentDisplayName}
              </h1>
              <Badge className="px-1.5 py-0 font-bold text-[10px] tracking-wide bg-[var(--accent-cta)]/10 text-[var(--text-main)] border border-[var(--accent-cta)]/20">
                {level}
              </Badge>
            </div>
            {telegramUsername && (
              <span className="text-[11px] font-medium text-[var(--text-muted)] mt-0.5 truncate max-w-[160px]">
                @{telegramUsername}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--accent-cta)]/10 border border-[var(--accent-cta)]/20 text-[var(--accent-cta)] font-black text-sm shadow-sm">
            <Trophy className="w-4 h-4" />
            <span>{totalScore || 0}</span>
          </div>

          <StreakBadge streak={streak} />
          <Link
            to="/settings"
            className="p-2 rounded-full bg-[var(--bg-card)] text-[var(--text-main)] transition-colors active:opacity-70 border border-[var(--border-color)]"
          >
            <MoreVertical className="w-5 h-5" />
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 pb-4">
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
              reviewWordsCount > 0
                ? "border-[var(--accent-success)] bg-[var(--accent-success)]/5 shadow-sm"
                : "border-[var(--border-color)]"
            }`}
          >
            <div
              className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                reviewWordsCount > 0
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
                  reviewWordsCount > 0
                    ? "text-[var(--accent-success)] font-bold"
                    : "text-[var(--text-muted)]"
                }`}
              >
                {reviewWordsCount > 0 ? "до Практики ➔" : "на сьогодні"}
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
    </Screen>
  );
};
