import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ChevronLeft, Users, Shield } from "lucide-react";
import { Screen } from "../shared/ui/Screen";
import { Card } from "../shared/ui/Card";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000/api";

const getAuthHeaders = () => {
  const initData =
    window.Telegram?.WebApp?.initData || "mock_hash_for_dev_mode";
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${initData}`,
  };
};

const resolveAvatarUrl = (url: string | null | undefined) => {
  if (!url) return null;
  if (url.startsWith("http")) return url;
  const apiBase = API_URL.replace(/\/api$/, "").replace(/\/$/, "");
  return `${apiBase}${url}?ngrok-skip-browser-warning=true`;
};

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

export const FriendsPage = () => {
  const navigate = useNavigate();
  const [friends, setFriends] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchFriends = async () => {
      try {
        const res = await fetch(`${API_URL}/profile/me/friends`, {
          headers: getAuthHeaders(),
        });
        if (!res.ok) throw new Error("Failed to fetch friends");
        const data = await res.json();
        setFriends(data);
      } catch (error) {
        console.error(error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchFriends();
  }, []);

  return (
    <Screen className="justify-start p-4 space-y-4 bg-[var(--bg-app)] pb-28">
      <div className="flex items-center gap-3 mb-2">
        <button
          onClick={() => navigate(-1)}
          className="text-[var(--text-muted)] transition-opacity hover:opacity-70 p-1 -ml-1"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
        <h1 className="text-2xl font-black text-[var(--text-main)] flex items-center gap-2">
          <Users className="w-6 h-6 text-blue-500" /> Мої друзі
        </h1>
      </div>

      {isLoading ? (
        <div className="text-center py-10 text-[var(--text-muted)] font-bold animate-pulse">
          Шукаємо друзів...
        </div>
      ) : friends.length === 0 ? (
        <Card className="p-8 text-center border-dashed border-[var(--border-color)] bg-transparent">
          <div className="w-16 h-16 mx-auto bg-[var(--bg-card)] rounded-full flex items-center justify-center text-[var(--text-muted)] mb-4">
            <Users className="w-8 h-8" />
          </div>
          <p className="text-base font-bold text-[var(--text-main)] mb-1">
            У тебе ще немає друзів
          </p>
          <p className="text-sm text-[var(--text-muted)]">
            Перейди в Топ гравців та надішли запити іншим користувачам!
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {friends.map((friend) => (
            <Link
              to={`/profile/${friend._id}`}
              key={friend._id}
              className="block hover:scale-[1.02] transition-transform"
            >
              <Card className="flex items-center p-3 gap-4 border-[var(--border-color)] bg-[var(--bg-card)]">
                <UserAvatar
                  url={resolveAvatarUrl(
                    friend.customAvatarUrl || friend.telegramPhotoUrl,
                  )}
                  nickname={friend.nickname || "Користувач"}
                  className="w-12 h-12 rounded-full object-cover border border-[var(--border-color)]"
                />
                <div className="flex-1 overflow-hidden">
                  <div className="font-bold text-base text-[var(--text-main)] truncate">
                    @{friend.nickname || "Користувач"}
                  </div>
                  {friend.level && (
                    <div className="flex items-center gap-1 text-xs font-bold text-[var(--accent-success)] mt-0.5">
                      <Shield className="w-3 h-3" /> {friend.level}
                    </div>
                  )}
                </div>
                <div className="text-right">
                  <div className="text-xs text-[var(--text-muted)] font-bold uppercase tracking-wider mb-0.5">
                    Балів
                  </div>
                  <div className="font-black text-[var(--accent-cta)] text-lg leading-none">
                    {friend.totalScore || 0}
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </Screen>
  );
};
