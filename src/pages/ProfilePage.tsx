import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Heart,
  UserPlus,
  Clock,
  Check,
  X,
  Shield,
  Medal,
  Flame,
  BookOpen,
  ChevronLeft,
  Swords,
} from "lucide-react";
import { Screen } from "../shared/ui/Screen";
import { Card } from "../shared/ui/Card";
import { Button } from "../shared/ui/Button";
import { useUserStore } from "../store/userStore";
import { apiClient } from "../shared/api/apiClient";
import { resolveAvatarUrl } from "../shared/lib/avatarUrl";


const UserAvatar = ({
  url,
  nickname,
  className,
}: {
  url?: string | null;
  nickname: string;
  className: string;
}) => {
  const [hasError, setHasError] = useState(false);

  if (!url || hasError) {
    return (
      <div
        className={`${className} flex items-center justify-center bg-[var(--bg-card)] text-[var(--text-main)] font-black uppercase shrink-0`}
      >
        {nickname ? nickname.charAt(0) : "U"}
      </div>
    );
  }

  return (
    <img
      src={url}
      alt={nickname}
      className={`${className} bg-[var(--bg-app)] shrink-0`}
      onError={() => setHasError(true)}
    />
  );
};

interface ProfileData {
  _id: string;
  telegramId: number;
  nickname: string;
  avatar: string | null;
  level: string | null;
  rank: number;
  score: number;
  streak: number;
  wordsLearnedCount: number;
  likesCount: number;
  /** Чи вже лайкнув поточний юзер (раніше не передавалось — серце завжди було порожнім) */
  likedByMe?: boolean;
  friendStatus: "none" | "pending_sent" | "pending_received" | "friends";
}

export const ProfilePage = () => {
  const { userId } = useParams();
  const navigate = useNavigate();
  const { telegramId } = useUserStore();

  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLikedByMe, setIsLikedByMe] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const { data } = await apiClient.get<ProfileData>(`/profile/${userId}`);
        setProfile(data);
        setIsLikedByMe(Boolean(data.likedByMe));
      } catch (error) {
        console.error(error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchProfile();
  }, [userId]);

  const isMe = !!profile && profile.telegramId === telegramId;

  const handleLike = async () => {
    if (!profile || isMe) return;

    const wasLiked = isLikedByMe;
    setIsLikedByMe(!wasLiked);
    setProfile((prev) =>
      prev
        ? { ...prev, likesCount: prev.likesCount + (wasLiked ? -1 : 1) }
        : null,
    );

    try {
      const { data } = await apiClient.post<{ liked?: boolean }>(`/profile/${userId}/like`);
      if (typeof data.liked === "boolean") {
        setIsLikedByMe(data.liked);
        // Сервер лишив попередній стан (напр., паралельний тап) — відкочуємо лічильник
        if (data.liked === wasLiked) {
          setProfile((prev) =>
            prev ? { ...prev, likesCount: prev.likesCount + (wasLiked ? 1 : -1) } : null,
          );
        }
      }
    } catch {
      setIsLikedByMe(wasLiked);
      setProfile((prev) =>
        prev
          ? { ...prev, likesCount: prev.likesCount + (wasLiked ? 1 : -1) }
          : null,
      );
    }
  };

  const handleFriendRequest = async () => {
    if (!profile || isMe) return;
    setProfile((prev) =>
      prev ? { ...prev, friendStatus: "pending_sent" } : null,
    );
    try {
      // ВИПРАВЛЕНО: fetch не кидав помилку на 4xx/5xx — кнопка лишалась "Запит надіслано",
      // навіть якщо сервер відмовив. apiClient кидає, і стан відкочується
      await apiClient.post(`/profile/${userId}/friend-request`);
    } catch {
      setProfile((prev) => (prev ? { ...prev, friendStatus: "none" } : null));
    }
  };

  const handleFriendRespond = async (accept: boolean) => {
    if (!profile || isMe) return;
    const oldStatus = profile.friendStatus;
    setProfile((prev) =>
      prev ? { ...prev, friendStatus: accept ? "friends" : "none" } : null,
    );
    try {
      await apiClient.post(`/profile/${userId}/friend-respond`, { accept });
    } catch {
      setProfile((prev) =>
        prev ? { ...prev, friendStatus: oldStatus } : null,
      );
    }
  };

  if (isLoading) {
    return (
      <Screen className="justify-center items-center">
        <div className="animate-pulse text-[var(--text-muted)] font-bold">
          Завантаження...
        </div>
      </Screen>
    );
  }

  if (!profile) {
    return (
      <Screen className="justify-center items-center space-y-4 p-4 text-center">
        <h2 className="text-xl font-bold text-[var(--text-main)]">
          Профіль не знайдено
        </h2>
        <Button onClick={() => navigate(-1)} variant="secondary">
          Повернутися
        </Button>
      </Screen>
    );
  }

  return (
    <Screen className="justify-start p-4 space-y-6 bg-[var(--bg-app)] pb-28">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1 text-[var(--text-muted)] font-bold mb-2 transition-opacity hover:opacity-70"
      >
        <ChevronLeft className="w-5 h-5" /> Назад
      </button>

      <Card className="flex flex-col items-center p-6 text-center space-y-4 shadow-sm border-[var(--border-color)]">
        <UserAvatar
          url={resolveAvatarUrl(profile.avatar)}
          nickname={profile.nickname}
          className="w-24 h-24 rounded-full object-cover border-4 border-[var(--accent-cta)]/20"
        />
        <div>
          <h1 className="text-2xl font-black text-[var(--text-main)]">
            @{profile.nickname}
          </h1>
          <div className="flex items-center justify-center gap-2 mt-2">
            {profile.level && (
              <span className="bg-[var(--accent-success)]/10 text-[var(--accent-success)] px-3 py-1 rounded-full text-sm font-bold flex items-center gap-1">
                <Shield className="w-4 h-4" /> {profile.level}
              </span>
            )}
            <span className="bg-[var(--accent-cta)]/10 text-[var(--accent-cta)] px-3 py-1 rounded-full text-sm font-bold flex items-center gap-1">
              <Medal className="w-4 h-4" /> Топ #{profile.rank}
            </span>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-3 gap-3">
        <Card className="p-3 flex flex-col items-center justify-center text-center shadow-sm border-[var(--border-color)]">
          <Flame className="w-6 h-6 text-orange-500 mb-1" />
          <span className="text-xl font-black text-[var(--text-main)]">
            {profile.streak}
          </span>
          <span className="text-[10px] uppercase font-bold text-[var(--text-muted)]">
            Днів
          </span>
        </Card>
        <Card className="p-3 flex flex-col items-center justify-center text-center shadow-sm border-[var(--border-color)]">
          <Medal className="w-6 h-6 text-[var(--accent-cta)] mb-1" />
          <span className="text-xl font-black text-[var(--text-main)]">
            {profile.score}
          </span>
          <span className="text-[10px] uppercase font-bold text-[var(--text-muted)]">
            Балів
          </span>
        </Card>
        <Card className="p-3 flex flex-col items-center justify-center text-center shadow-sm border-[var(--border-color)]">
          <BookOpen className="w-6 h-6 text-[var(--accent-success)] mb-1" />
          <span className="text-xl font-black text-[var(--text-main)]">
            {profile.wordsLearnedCount}
          </span>
          <span className="text-[10px] uppercase font-bold text-[var(--text-muted)]">
            Слів
          </span>
        </Card>
      </div>

      <div className="flex gap-3">
        <Card
          className={`flex-1 p-4 flex flex-col items-center justify-center gap-2 transition-all shadow-sm border-[var(--border-color)] ${!isMe ? "cursor-pointer active:scale-95" : "opacity-50"
            } ${isLikedByMe
              ? "bg-red-500/10 border-red-500/30"
              : "bg-[var(--bg-card)]"
            }`}
          onClick={handleLike}
        >
          <Heart
            className={`w-8 h-8 transition-colors ${isLikedByMe
                ? "text-red-500 fill-red-500"
                : "text-[var(--text-muted)]"
              }`}
          />
          <span className="font-bold text-[var(--text-main)] text-sm">
            {profile.likesCount}
          </span>
        </Card>

        <Card className="flex-[2] p-4 flex flex-col items-center justify-center gap-3 shadow-sm border-[var(--border-color)]">
          {isMe ? (
            <div className="text-center text-[var(--text-muted)] font-bold text-sm">
              <Shield className="w-6 h-6 mx-auto mb-2 opacity-50" />
              Це твій профіль
            </div>
          ) : (
            <>
              {profile.friendStatus === "none" && (
                <Button
                  onClick={handleFriendRequest}
                  className="w-full flex items-center justify-center gap-2"
                >
                  <UserPlus className="w-5 h-5" /> Додати в друзі
                </Button>
              )}
              {profile.friendStatus === "pending_sent" && (
                <Button
                  variant="secondary"
                  disabled
                  className="w-full flex items-center justify-center gap-2 opacity-70"
                >
                  <Clock className="w-5 h-5" /> Запит надіслано
                </Button>
              )}
              {profile.friendStatus === "pending_received" && (
                <div className="flex w-full gap-2">
                  <Button
                    onClick={() => handleFriendRespond(true)}
                    className="flex-1 bg-[var(--accent-success)] border-[var(--accent-success)] flex justify-center"
                  >
                    <Check className="w-5 h-5 text-white" />
                  </Button>
                  <Button
                    onClick={() => handleFriendRespond(false)}
                    variant="secondary"
                    className="flex-1 flex justify-center"
                  >
                    <X className="w-5 h-5" />
                  </Button>
                </div>
              )}
              {profile.friendStatus === "friends" && (
                <Button
                  onClick={() => navigate(`/room/new?targetId=${userId}`)}
                  className="w-full flex items-center justify-center gap-2 bg-[var(--accent-cta)] font-bold text-white shadow-md border-none mt-4"
                >
                  <Swords className="w-5 h-5" /> Викликати на дуель
                </Button>
              )}
            </>
          )}
        </Card>
      </div>
    </Screen>
  );
};