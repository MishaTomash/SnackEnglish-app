import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Screen } from "../shared/ui/Screen";
import { Card } from "../shared/ui/Card";
import { Button } from "../shared/ui/Button";
import { socket } from "../shared/lib/socket";
import { useUserStore } from "../store/userStore";
import { Swords, Loader2, CheckCircle, XCircle } from "lucide-react";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000/api";

const getAuthHeaders = () => {
  const initData =
    window.Telegram?.WebApp?.initData || "mock_hash_for_dev_mode";
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${initData}`,
  };
};

export const DuelLobbyPage = () => {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const { telegramId } = useUserStore();

  const [uiState, setUiState] = useState<
    "loading" | "confirmation" | "waiting" | "ready" | "error"
  >("loading");
  const [statusMessage, setStatusMessage] = useState("Завантаження кімнати...");
  const [inviteData, setInviteData] = useState<any>(null);

  const socketConnected = useRef(false);

  // 1. Отримуємо статус запрошення з бекенду
  useEffect(() => {
    if (!telegramId || !roomId) return;

    const fetchRoom = async () => {
      try {
        const res = await fetch(`${API_URL}/duels/${roomId}`, {
          headers: getAuthHeaders(),
        });
        if (!res.ok)
          throw new Error("Кімнату не знайдено або запрошення протерміновано");

        const data = await res.json();
        setInviteData(data);

        if (data.isHost || data.invite.status === "accepted") {
          // Якщо ти хост або гість, який вже прийняв запрошення — підключаємось до сокету
          connectToSocket();
        } else if (data.isGuest && data.invite.status === "pending") {
          // Якщо ти гість і ще не прийняв — показуємо кнопки [Так] [Ні]
          setUiState("confirmation");
          setStatusMessage("запрошує тебе на дуель!");
        } else {
          throw new Error("Запрошення більше не активне");
        }
      } catch (error: any) {
        setUiState("error");
        setStatusMessage(error.message);
      }
    };

    fetchRoom();

    return () => {
      if (socketConnected.current) {
        socket.disconnect();
        socket.off("connect");
        socket.off("duel_ready");
      }
    };
  }, [roomId, telegramId]);

  // 2. Логіка підключення до Socket.io
  const connectToSocket = () => {
    setUiState("waiting");
    setStatusMessage("Очікуємо підключення суперника...");
    socketConnected.current = true;

    socket.auth = { userId: telegramId };
    socket.connect();

    socket.on("connect", () => {
      socket.emit("join_duel", roomId);
    });

    socket.on("duel_ready", (data: { message: string; timestamp: number }) => {
      setUiState("ready");
      setStatusMessage(data.message);
    });
  };

  // 3. Обробка відповіді гостя (клік на кнопку)
  const handleResponse = async (accept: boolean) => {
    setUiState("loading");
    setStatusMessage("Відправка відповіді...");
    try {
      const res = await fetch(`${API_URL}/duels/${roomId}/respond`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ accept }),
      });

      if (accept && res.ok) {
        connectToSocket();
      } else {
        navigate("/");
      }
    } catch {
      setUiState("error");
      setStatusMessage("Помилка зв'язку з сервером");
    }
  };

  return (
    <Screen className="justify-center items-center p-4 bg-[var(--bg-app)]">
      <Card className="flex flex-col items-center justify-center p-8 text-center space-y-6 w-full max-w-sm border-[var(--accent-cta)]/20 shadow-xl">
        {/* Іконка */}
        <div
          className={`w-20 h-20 rounded-full flex items-center justify-center ${
            uiState === "ready"
              ? "bg-[var(--accent-success)]/10 text-[var(--accent-success)]"
              : uiState === "error"
                ? "bg-red-500/10 text-red-500"
                : "bg-[var(--accent-cta)]/10 text-[var(--accent-cta)]"
          }`}
        >
          {uiState === "ready" ? (
            <CheckCircle className="w-10 h-10" />
          ) : uiState === "error" ? (
            <XCircle className="w-10 h-10" />
          ) : (
            <Swords
              className={`w-10 h-10 ${uiState === "waiting" || uiState === "loading" ? "animate-pulse" : ""}`}
            />
          )}
        </div>

        {/* Текст */}
        <div>
          <h2 className="text-2xl font-black text-[var(--text-main)] mb-2">
            Дуель
          </h2>

          {uiState === "confirmation" && inviteData ? (
            <p className="font-bold text-[var(--text-main)]">
              <span className="text-[var(--accent-cta)]">
                @{inviteData.invite.hostId?.nickname || "Користувач"}
              </span>{" "}
              {statusMessage}
            </p>
          ) : (
            <p
              className={`font-bold flex items-center justify-center gap-2 ${
                uiState === "ready"
                  ? "text-[var(--accent-success)]"
                  : uiState === "error"
                    ? "text-red-500"
                    : "text-[var(--text-muted)]"
              }`}
            >
              {(uiState === "loading" || uiState === "waiting") && (
                <Loader2 className="w-4 h-4 animate-spin" />
              )}
              {statusMessage}
            </p>
          )}
        </div>

        {/* Кнопки для гостя */}
        {uiState === "confirmation" && (
          <div className="flex w-full gap-3 pt-2">
            <Button
              onClick={() => handleResponse(false)}
              variant="secondary"
              className="flex-1"
            >
              Відхилити
            </Button>
            <Button onClick={() => handleResponse(true)} className="flex-1">
              Прийняти
            </Button>
          </div>
        )}

        {/* Кнопка скасування (для хоста або при помилці) */}
        {(uiState === "waiting" ||
          uiState === "error" ||
          uiState === "ready") && (
          <button
            onClick={() => navigate("/")}
            className="text-sm font-bold text-[var(--text-muted)] underline mt-4"
          >
            {uiState === "ready" ? "Повернутись на Головну" : "Скасувати"}
          </button>
        )}
      </Card>
    </Screen>
  );
};
