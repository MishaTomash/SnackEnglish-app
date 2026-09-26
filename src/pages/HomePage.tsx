// 📁 Файл: SnackEnglish-app/src/pages/HomePage.tsx
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Sparkles,
  MoreVertical,
  User as UserIcon,
  Trophy,
  Users,
  Heart,
  MessageCircleWarning,
} from "lucide-react";
import { Screen } from "../shared/ui/Screen";
import { Card } from "../shared/ui/Card";
import { Badge } from "../shared/ui/Badge";
import { StreakBadge } from "../entities/user/ui/StreakBadge";
import { useUserStore } from "../store/userStore";
import { CookieMascot } from "../shared/ui/CookieMascot";
import { apiClient } from "../shared/api/apiClient";
import { FeedbackModal } from "../shared/ui/FeedbackModal";
import { resolveAvatarUrl } from "../shared/lib/avatarUrl";
import { WeekActivityCard } from "../widgets/WeekActivityCard";
import { InviteFriendCard } from "../widgets/InviteFriendCard";

interface ProfileStats {
  likesCount: number;
  friendsCount: number;
}

export const HomePage = () => {
  const {
    telegramId,
    level,
    streak,
    weeklyScore,
    wordsLearnedCount,
    telegramFirstName,
    telegramUsername,
    telegramPhotoUrl,
    customDisplayName,
    customAvatarUrl,
    fetchUser,
  } = useUserStore();

  const [stats, setStats] = useState<ProfileStats>({ likesCount: 0, friendsCount: 0 });
  // Адреси аватарів, які не завантажились (протермінований telegramPhotoUrl, видалений файл)
  const [brokenPhotoUrls, setBrokenPhotoUrls] = useState<ReadonlySet<string>>(() => new Set());

  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);

  const isAdmin = telegramId === Number(import.meta.env.VITE_ADMIN_ID);

  useEffect(() => {
    fetchUser(true);
  }, [fetchUser]);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        // Через apiClient: правильна адреса API на телефоні й справжній initData
        const { data } = await apiClient.get<Partial<ProfileStats>>("/profile/me/stats");
        setStats({
          likesCount: data.likesCount ?? 0,
          friendsCount: data.friendsCount ?? 0,
        });
      } catch (error) {
        console.error("Failed to fetch profile stats:", error);
      }
    };
    if (telegramId) fetchStats();
  }, [telegramId]);

  const currentDisplayName =
    customDisplayName || telegramFirstName || "Користувач";
  // Свій аватар, інакше фото з Telegram; якщо картинка не вантажиться — показуємо іконку
  const currentPhotoUrl =
    [resolveAvatarUrl(customAvatarUrl), telegramPhotoUrl].find(
      (url): url is string => Boolean(url) && !brokenPhotoUrls.has(url as string),
    ) ?? null;

  return (
    <Screen className="space-y-4 pb-24">
      {/* Шапка профілю */}
      <div className="flex items-center justify-between gap-3 pt-1 pb-2">
        <Link to="/settings" className="flex items-center gap-3 min-w-0 flex-1">
          {currentPhotoUrl ? (
            <img
              src={currentPhotoUrl}
              alt=""
              onError={() =>
                setBrokenPhotoUrls((prev) => new Set(prev).add(currentPhotoUrl))
              }
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
            {/* Кубки тижня — ті самі, що в рейтингу */}
            <span>{weeklyScore || 0}</span>
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

      {/* Вхід в адмін-панель (лише для адміна; доступ перевіряє і сервер) */}
      {isAdmin && (
        <Link
          to="/admin"
          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-blue-500/20 bg-blue-500/10 py-3 text-sm font-bold text-blue-400 transition-opacity active:opacity-70"
        >
          🛠 Адмін-панель
        </Link>
      )}

      {/* Тижнева активність — справжні дні з уроками + стан серії */}
      <WeekActivityCard />

      {/* Запроси друга */}
      <InviteFriendCard />

      {/* Мотивація від Маскота */}
      <Link to="/learning" className="block">
        <Card className="p-0 bg-gradient-to-r from-amber-100 to-orange-100 dark:from-amber-950/40 dark:to-orange-900/40 border-amber-200 dark:border-amber-800/50 overflow-hidden relative interactive">
          <div className="p-4 pr-24 relative z-10">
            <h3 className="font-black text-amber-900 dark:text-amber-100 text-sm mb-1">
              Час для англійської!
            </h3>
            <p className="text-xs text-amber-800/80 dark:text-amber-200/80 font-medium leading-relaxed">
              Снакі вже зачекався. Погляньмо, що нового?
            </p>
          </div>
          <div className="absolute right-0 bottom-0 translate-x-2 translate-y-2">
            <CookieMascot state="happy" size={100} />
          </div>
        </Card>
      </Link>

      {/* Сітка статистики — внизу */}
      <div className="grid grid-cols-3 gap-3 pt-2">
        <Card className="flex flex-col items-center justify-center text-center gap-2 p-3.5 h-full">
          <div className="w-8 h-8 rounded-xl bg-[var(--accent-cta)]/15 text-[var(--accent-cta)] flex items-center justify-center">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <div className="text-2xl font-black text-[var(--text-main)] leading-none">
              {wordsLearnedCount}
            </div>
            <div className="text-[10px] text-[var(--text-muted)] mt-1 font-medium">
              слів
            </div>
          </div>
        </Card>

        <Link to="/friends" className="block h-full">
          <Card className="flex flex-col items-center justify-center text-center gap-2 p-3.5 h-full transition-all active:scale-[0.98] border-[var(--border-color)] bg-[var(--bg-card)]">
            <div className="w-8 h-8 rounded-xl bg-blue-500/15 text-blue-500 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <div className="text-2xl font-black text-[var(--text-main)] leading-none">
                {stats.friendsCount}
              </div>
              <div className="text-[10px] text-[var(--text-muted)] mt-1 font-medium">
                друзів
              </div>
            </div>
          </Card>
        </Link>

        <Card className="flex flex-col items-center justify-center text-center gap-2 p-3.5 h-full border-[var(--border-color)] bg-[var(--bg-card)]">
          <div className="w-8 h-8 rounded-xl bg-red-500/15 text-red-500 flex items-center justify-center">
            <Heart className="w-4 h-4" />
          </div>
          <div>
            <div className="text-2xl font-black text-[var(--text-main)] leading-none">
              {stats.likesCount}
            </div>
            <div className="text-[10px] text-[var(--text-muted)] mt-1 font-medium">
              вподобань
            </div>
          </div>
        </Card>
      </div>

      {/* FAB — повідомити про проблему */}
      <button
        onClick={() => setIsFeedbackOpen(true)}
        aria-label="Повідомити про проблему"
        title="Повідомити про проблему"
        className="fixed right-4 bottom-24 z-40 w-14 h-14 rounded-full bg-[var(--accent-cta)] shadow-xl shadow-black/25 flex items-center justify-center active:scale-95 transition-transform"
      >
        <CookieMascot state="happy" size={38} />
        <span className="absolute -top-0.5 -right-0.5 w-5 h-5 rounded-full bg-white dark:bg-[var(--bg-card)] text-[var(--accent-cta)] flex items-center justify-center border-2 border-[var(--accent-cta)] shadow-sm">
          <MessageCircleWarning className="w-3 h-3" strokeWidth={2.5} />
        </span>
      </button>

      {isFeedbackOpen && (
        <FeedbackModal onClose={() => setIsFeedbackOpen(false)} />
      )}
    </Screen>
  );
};