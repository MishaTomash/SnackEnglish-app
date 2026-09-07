import React, { useEffect, useState, useRef, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Screen } from "../shared/ui/Screen";
import { createDuelSocket } from "../shared/lib/duelSocket";
import {
  Swords,
  Loader2,
  WifiOff,
  Trophy,
  Settings,
  Share2,
  Users,
  X,
  Check,
} from "lucide-react";
import type { Socket } from "socket.io-client";
import { DUEL_REGISTRY } from "../duels/registry";
import { useUserStore } from "../store/userStore";
import { Button } from "../shared/ui/Button";
import { Card } from "../shared/ui/Card";

const BOT_USERNAME =
  import.meta.env.VITE_BOT_USERNAME || "snack_english_test_bot";
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000/api";

class RoomErrorBoundary extends React.Component<any, { error: Error | null }> {
  constructor(props: any) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return (
        <Screen className="justify-center items-center p-4 bg-[var(--bg-app)]">
          <div className="bg-red-500/10 border border-red-500 p-4 rounded-xl w-full text-left space-y-3">
            <h3 className="text-red-500 font-bold text-lg">
              Помилка Рендеру 🚨
            </h3>
            <p className="text-[var(--text-main)] font-mono text-xs break-words">
              {this.state.error.message}
            </p>
            <Button
              onClick={() => (window.location.href = "/games")}
              className="w-full"
            >
              На головну
            </Button>
          </div>
        </Screen>
      );
    }
    return this.props.children;
  }
}

const DuelRoomContent = () => {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const { telegramId } = useUserStore();
  const socketRef = useRef<Socket | null>(null);

  const [uiState, setUiState] = useState<
    | "connecting"
    | "configuring"
    | "waiting"
    | "starting"
    | "playing"
    | "finished"
    | "disconnected"
  >("connecting");
  const [setupRounds, setSetupRounds] = useState(5);
  const [setupLevel, setSetupLevel] = useState("B1");
  const [activeGameId, setActiveGameId] = useState<string | null>(null);

  const [opponent, setOpponent] = useState<any>(null);
  const [myScore, setMyScore] = useState(0);
  const [roundData, setRoundData] = useState<any>(null);
  const [roundResult, setRoundResult] = useState<any>(null);
  const [roundNumber, setRoundNumber] = useState(1);
  const [totalRounds, setTotalRounds] = useState(5);

  const [showFriendsModal, setShowFriendsModal] = useState(false);
  const [friends, setFriends] = useState<any[]>([]);
  const [isLoadingFriends, setIsLoadingFriends] = useState(false);
  const [invitedFriends, setInvitedFriends] = useState<Set<string>>(new Set());
  const [invitingId, setInvitingId] = useState<string | null>(null);

  useEffect(() => {
    if (!roomId || !telegramId) return;
    if (roomId === "new") {
      setUiState("configuring");
      return;
    }
    setUiState("connecting");

    try {
      const setupDataStr = sessionStorage.getItem(`duel_setup_${roomId}`);
      const socket = createDuelSocket();
      socketRef.current = socket;
      socket.connect();

      socket.on("connect", () => {
        setUiState("waiting");
        if (setupDataStr) {
          const settings = JSON.parse(setupDataStr);
          setTotalRounds(settings.rounds);
          socket.emit("create_room", {
            roomCode: roomId,
            rounds: settings.rounds,
            level: settings.level,
          });
          sessionStorage.removeItem(`duel_setup_${roomId}`);
        } else {
          socket.emit("join_room", roomId);
        }
      });

      socket.on("duel:ready", (data) => {
        setOpponent({ ...data.opponent, score: 0 });
        setActiveGameId(data.gameId);
        setShowFriendsModal(false);
      });

      socket.on("duel:match_starting", () => setUiState("starting"));

      socket.on("duel:round_start", (data) => {
        setRoundNumber(data.round);
        setRoundData(data.data);
        setRoundResult(null);
        setOpponent((prev: any) => ({ ...(prev || {}), lastAction: null }));
        setUiState("playing");
      });

      socket.on("duel:player_acted", (data) => {
        if (data.playerId.toString() !== telegramId.toString()) {
          setOpponent((prev: any) => ({
            ...(prev || {}),
            lastAction: "acted",
          }));
        }
      });

      socket.on("duel:round_end", (data) => {
        setRoundResult(data);
        setMyScore(data.scores[telegramId] || 0);
        setOpponent((prev: any) => {
          const oppId = Object.keys(data.scores).find(
            (id) => id.toString() !== telegramId.toString(),
          );
          return {
            ...(prev || {}),
            score: oppId ? data.scores[oppId] : prev?.score || 0,
          };
        });
      });

      socket.on("duel:match_over", () => setUiState("finished"));

      socket.on("duel:opponent_disconnected", () => {
        setUiState("disconnected");
        setTimeout(() => navigate("/games"), 2500);
      });
    } catch (err) {
      console.error("Socket Init Error:", err);
    }

    return () => {
      if (socketRef.current) {
        try {
          socketRef.current.disconnect();
        } catch (e) {}
      }
    };
  }, [roomId, telegramId, navigate]);

  useEffect(() => {
    if (showFriendsModal && friends.length === 0) {
      const fetchFriends = async () => {
        setIsLoadingFriends(true);
        try {
          const initData =
            window.Telegram?.WebApp?.initData || "mock_hash_for_dev_mode";
          const res = await fetch(`${API_URL}/profile/me/friends`, {
            headers: { Authorization: `Bearer ${initData}` },
          });

          if (res.ok) {
            const data = await res.json();
            setFriends(Array.isArray(data) ? data : data?.friends || []);
          }
        } catch (e) {
          console.error(e);
        } finally {
          setIsLoadingFriends(false);
        }
      };
      fetchFriends();
    }
  }, [showFriendsModal]);

  const GameComponent = useMemo(
    () =>
      activeGameId
        ? DUEL_REGISTRY.find((g) => g.id === activeGameId)?.component
        : null,
    [activeGameId],
  );

  const handleCreateRoom = () => {
    setUiState("connecting");
    const newRoomId =
      Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
    sessionStorage.setItem(
      `duel_setup_${newRoomId}`,
      JSON.stringify({ rounds: setupRounds, level: setupLevel }),
    );
    setTimeout(() => {
      navigate(`/room/${newRoomId}`, { replace: true });
    }, 50);
  };

  const handleShareLink = () => {
    // ГЕНЕРУЄМО ПРАВИЛЬНИЙ ТЕЛЕГРАМ-ЛІНК
    const botLink = `https://t.me/${BOT_USERNAME}?start=duel_${roomId}`;
    const text = `⚔️ Я створив дуель! Заходь, хто перший — той і грає!`;
    const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(botLink)}&text=${encodeURIComponent(text)}`;
    window.Telegram?.WebApp?.openTelegramLink(shareUrl);
  };

  const handleInviteFriend = async (friendId: string) => {
    try {
      setInvitingId(friendId);
      const initData =
        window.Telegram?.WebApp?.initData || "mock_hash_for_dev_mode";
      await fetch(`${API_URL}/duels/invite`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${initData}`,
        },
        body: JSON.stringify({ targetUserId: friendId, roomId: roomId }),
      });
      setInvitedFriends((prev) => new Set(prev).add(friendId));
    } catch (e) {
      console.error(e);
    } finally {
      setInvitingId(null);
    }
  };

  if (uiState === "connecting") {
    return (
      <Screen className="justify-center items-center p-4 bg-[var(--bg-app)]">
        <Loader2 className="w-12 h-12 text-[var(--accent-cta)] animate-spin" />
        <p className="mt-4 text-[var(--text-muted)] font-bold animate-pulse">
          Завантаження...
        </p>
      </Screen>
    );
  }

  if (uiState === "configuring") {
    return (
      <Screen className="justify-center items-center p-4 bg-[var(--bg-app)]">
        <Card className="w-full max-w-sm p-6 flex flex-col items-center space-y-6 border-[var(--accent-cta)]/20 shadow-xl">
          <Settings className="w-12 h-12 text-[var(--accent-cta)]" />
          <h2 className="text-2xl font-black text-[var(--text-main)] text-center">
            Нова кімната
          </h2>

          <div className="w-full space-y-5">
            <div className="space-y-2">
              <label className="text-sm font-bold text-[var(--text-muted)] uppercase tracking-wider">
                Кількість раундів
              </label>
              <div className="flex gap-2">
                {[3, 5, 10].map((r) => (
                  <Button
                    key={r}
                    onClick={() => setSetupRounds(r)}
                    variant={setupRounds === r ? "primary" : "secondary"}
                    className="flex-1"
                  >
                    {r}
                  </Button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-[var(--text-muted)] uppercase tracking-wider">
                Рівень слів
              </label>
              <div className="grid grid-cols-3 gap-2">
                {["A1", "A2", "B1", "B2", "C1"].map((lvl) => (
                  <Button
                    key={lvl}
                    onClick={() => setSetupLevel(lvl)}
                    variant={setupLevel === lvl ? "primary" : "secondary"}
                    className="py-2"
                  >
                    {lvl}
                  </Button>
                ))}
              </div>
            </div>
            <Button
              onClick={handleCreateRoom}
              className="w-full mt-4 text-lg py-4"
            >
              Створити кімнату 🚀
            </Button>
            <button
              onClick={() => navigate("/games")}
              className="w-full text-sm font-bold text-[var(--text-muted)] pt-2 underline"
            >
              Скасувати
            </button>
          </div>
        </Card>
      </Screen>
    );
  }

  if (uiState === "playing" && GameComponent) {
    return (
      <Screen className="justify-start p-4 bg-[var(--bg-app)]">
        <div className="w-full mb-4 text-center font-bold text-[var(--text-muted)] uppercase tracking-widest text-xs">
          Раунд {roundNumber} / {totalRounds}
        </div>
        <GameComponent
          roomId={roomId!}
          myScore={myScore}
          opponentState={opponent || { score: 0 }}
          roundData={roundData}
          roundResult={roundResult}
          onSubmitAction={(a) => socketRef.current?.emit("duel:action", a)}
        />
      </Screen>
    );
  }

  if (uiState === "finished") {
    const oppScore = opponent?.score || 0;
    const isWinner = myScore > oppScore;
    const isDraw = myScore === oppScore;
    return (
      <Screen className="justify-center items-center p-4 bg-[var(--bg-app)]">
        <div className="text-center space-y-6">
          <div
            className={`w-24 h-24 mx-auto rounded-full flex items-center justify-center ${isWinner ? "bg-amber-500/20 text-amber-500" : isDraw ? "bg-blue-500/20 text-blue-500" : "bg-slate-500/20 text-slate-500"}`}
          >
            <Trophy className="w-12 h-12" />
          </div>
          <div>
            <h2 className="text-4xl font-black text-[var(--text-main)]">
              {isWinner ? "Перемога!" : isDraw ? "Нічия!" : "Поразка"}
            </h2>
            <p className="text-lg font-bold text-[var(--text-muted)] mt-2">
              Рахунок: {myScore} - {oppScore}
            </p>
          </div>
          <Button
            onClick={() => navigate("/games")}
            className="w-full py-4 text-lg"
          >
            Повернутись до ігор
          </Button>
        </div>
      </Screen>
    );
  }

  return (
    <Screen className="justify-center items-center p-4 bg-[var(--bg-app)]">
      <div className="flex flex-col items-center text-center space-y-6 w-full max-w-xs">
        {uiState === "disconnected" ? (
          <>
            <WifiOff className="w-16 h-16 text-red-500" />
            <h2 className="text-xl font-black text-red-500">Кімнату закрито</h2>
          </>
        ) : uiState === "starting" ? (
          <>
            <Swords className="w-20 h-20 text-[var(--accent-cta)] animate-bounce" />
            <h2 className="text-3xl font-black text-[var(--text-main)] uppercase tracking-widest text-amber-500">
              Бій!
            </h2>
          </>
        ) : (
          <>
            <div className="w-20 h-20 bg-[var(--accent-cta)]/10 rounded-full flex items-center justify-center">
              <Swords className="w-10 h-10 text-[var(--accent-cta)] animate-pulse" />
            </div>
            <div>
              <h2 className="text-xl font-black text-[var(--text-main)] flex items-center justify-center gap-2 mb-2">
                <Loader2 className="w-5 h-5 animate-spin text-[var(--text-muted)]" />{" "}
                Очікуємо суперника
              </h2>
              <p className="text-sm text-[var(--text-muted)]">
                Запросіть друга або поділіться посиланням
              </p>
            </div>

            <div className="w-full space-y-3 mt-4">
              <Button
                onClick={handleShareLink}
                className="w-full py-4 text-lg shadow-lg flex items-center justify-center gap-2"
              >
                <Share2 className="w-5 h-5" /> Надіслати в чат
              </Button>
              <Button
                onClick={() => setShowFriendsModal(true)}
                variant="secondary"
                className="w-full py-4 text-lg flex items-center justify-center gap-2 border-[var(--accent-cta)]/50 text-[var(--accent-cta)]"
              >
                <Users className="w-5 h-5" /> Викликати друга
              </Button>
            </div>
            <button
              onClick={() => navigate("/games")}
              className="text-sm font-bold text-[var(--text-muted)] underline mt-2"
            >
              Скасувати
            </button>
          </>
        )}
      </div>

      {showFriendsModal && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <Card className="w-full h-[70vh] rounded-b-none rounded-t-3xl p-5 flex flex-col animate-in slide-in-from-bottom-full duration-300 border-b-0 border-[var(--border-color)]">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-black text-[var(--text-main)] flex items-center gap-2">
                <Users className="w-6 h-6 text-[var(--accent-cta)]" /> Ваші
                друзі
              </h3>
              <button
                onClick={() => setShowFriendsModal(false)}
                className="p-2 rounded-full bg-[var(--bg-app)] text-[var(--text-muted)]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pb-6">
              {isLoadingFriends ? (
                <div className="flex justify-center py-10">
                  <Loader2 className="w-8 h-8 animate-spin text-[var(--text-muted)]" />
                </div>
              ) : friends.length === 0 ? (
                <div className="text-center py-10 text-[var(--text-muted)] font-bold">
                  У вас ще немає доданих друзів 😔
                </div>
              ) : (
                friends.map((friend) => {
                  const fId = friend._id || friend.id;
                  const isInvited = invitedFriends.has(fId);
                  const isInviting = invitingId === fId;

                  return (
                    <div
                      key={fId}
                      className="flex items-center justify-between p-3 rounded-xl bg-[var(--bg-app)] border border-[var(--border-color)]"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-[var(--bg-card)] border border-[var(--border-color)] flex items-center justify-center font-bold overflow-hidden">
                          {friend?.avatar ? (
                            <img
                              src={friend.avatar}
                              alt="ava"
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            (friend?.nickname || "U").charAt(0)
                          )}
                        </div>
                        <span className="font-bold text-[var(--text-main)]">
                          {friend?.nickname || "Користувач"}
                        </span>
                      </div>

                      <Button
                        variant={isInvited ? "secondary" : "primary"}
                        onClick={() => handleInviteFriend(fId)}
                        disabled={isInvited || isInviting}
                        className="px-4 py-1.5 text-sm"
                      >
                        {isInvited ? (
                          <Check className="w-4 h-4 text-[var(--accent-success)]" />
                        ) : isInviting ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          "Викликати"
                        )}
                      </Button>
                    </div>
                  );
                })
              )}
            </div>
          </Card>
        </div>
      )}
    </Screen>
  );
};

export const DuelRoomPage = () => (
  <RoomErrorBoundary>
    <DuelRoomContent />
  </RoomErrorBoundary>
);
