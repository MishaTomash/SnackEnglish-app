import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import {
  Gamepad2,
  Star,
  Lock,
  CreditCard,
  Copy,
  Check,
  X,
  Info,
  Camera,
  CheckCircle2,
  Receipt,
  Users,
} from "lucide-react";
import { Screen } from "../shared/ui/Screen";
import { Card } from "../shared/ui/Card";
import { Button } from "../shared/ui/Button";
import { DUEL_REGISTRY } from "../duels/registry";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000/api";

const getAuthHeaders = () => {
  const initData =
    window.Telegram?.WebApp?.initData || "mock_hash_for_dev_mode";
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${initData}`,
  };
};

interface BackendGame {
  _id: string;
  gameId: string;
  title: string;
  description: string;
  isFree: boolean;
  priceStars?: number;
  status: "available" | "coming_soon";
  isPurchased: boolean;
}

interface PaymentHistoryItem {
  id: string;
  gameTitle: string;
  method: string;
  status: "pending" | "approved" | "rejected";
  date: string;
}

export const GamesPage = () => {
  // ДОДАНО: Стейт для вкладок
  const [activeTab, setActiveTab] = useState<"single" | "duel">("single");

  const [games, setGames] = useState<BackendGame[]>([]);
  const [payments, setPayments] = useState<PaymentHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [manualModal, setManualModal] = useState<{
    gameId: string;
    uniqueCode: string;
    cardNumber: string;
    step: "info" | "upload" | "success";
  } | null>(null);

  const [copied, setCopied] = useState<"card" | "code" | null>(null);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchGamesAndPayments = async () => {
    try {
      const [gamesRes, payRes] = await Promise.all([
        fetch(`${API_URL}/games`, { headers: getAuthHeaders() }),
        fetch(`${API_URL}/games/payments`, { headers: getAuthHeaders() }),
      ]);
      if (gamesRes.ok) setGames(await gamesRes.json());
      if (payRes.ok) setPayments(await payRes.json());
    } catch (error) {
      console.error("Failed to fetch data", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchGamesAndPayments();
  }, []);

  const handleStarsPayment = async (gameId: string) => {
    try {
      setProcessingId(gameId);
      const res = await fetch(`${API_URL}/games/invoice`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ gameId }),
      });
      const data = await res.json();

      if (data.invoiceLink) {
        const tg = (window as any).Telegram?.WebApp;
        if (tg?.openInvoice) {
          tg.openInvoice(data.invoiceLink, (status: string) => {
            if (status === "paid") {
              fetchGamesAndPayments();
            }
            setProcessingId(null);
          });
        } else {
          alert("Оплата Зірками підтримується лише у мобільному клієнті.");
          setProcessingId(null);
        }
      } else {
        setProcessingId(null);
      }
    } catch (error) {
      console.error("Error creating invoice", error);
      setProcessingId(null);
    }
  };

  const handleManualPaymentClick = async (gameId: string) => {
    try {
      setProcessingId(gameId);
      const res = await fetch(`${API_URL}/games/manual-payment`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ gameId }),
      });
      const data = await res.json();

      if (data.uniqueCode && data.cardNumber) {
        setReceiptFile(null);
        setReceiptPreview(null);
        setManualModal({
          gameId,
          uniqueCode: data.uniqueCode,
          cardNumber: data.cardNumber,
          step: "info",
        });
      }
    } catch (error) {
      console.error("Error creating manual payment request", error);
    } finally {
      setProcessingId(null);
    }
  };

  const handleCopy = (text: string, type: "card" | "code") => {
    navigator.clipboard.writeText(text);
    setCopied(type);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setReceiptFile(file);
      setReceiptPreview(URL.createObjectURL(file));
    }
  };

  const handleReceiptSubmit = async () => {
    if (!receiptFile || !manualModal) return;
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("receipt", receiptFile);
      formData.append("uniqueCode", manualModal.uniqueCode);

      const initData =
        window.Telegram?.WebApp?.initData || "mock_hash_for_dev_mode";
      const res = await fetch(`${API_URL}/games/receipt`, {
        method: "POST",
        headers: { Authorization: `Bearer ${initData}` },
        body: formData,
      });

      if (res.ok) {
        setManualModal({ ...manualModal, step: "success" });
        fetchGamesAndPayments();
      } else {
        alert("Помилка відправки квитанції. Спробуйте ще раз.");
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsUploading(false);
    }
  };

  const hasPendingPayments = payments.some((p) => p.status === "pending");

  return (
    <Screen className="justify-start p-4 space-y-5 bg-[var(--bg-app)] pb-24 relative">
      <div className="flex items-center justify-between w-full">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 bg-[var(--accent-cta)]/10 text-[var(--accent-cta)] rounded-2xl flex items-center justify-center">
            <Gamepad2 className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-black text-[var(--text-main)]">Ігри</h1>
        </div>
        <button
          onClick={() => setShowHistoryModal(true)}
          className="relative p-2 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-main)] active:scale-95 transition-transform"
        >
          <Receipt className="w-5 h-5" />
          {hasPendingPayments && (
            <span className="absolute -top-1 -right-1 w-3 h-3 bg-amber-500 rounded-full border-2 border-[var(--bg-app)]"></span>
          )}
        </button>
      </div>

      {/* ДОДАНО: Перемикач вкладок */}
      <div className="flex bg-[var(--bg-card)] p-1 rounded-xl border border-[var(--border-color)]">
        <button
          onClick={() => setActiveTab("single")}
          className={`flex-1 py-2 text-sm font-bold rounded-lg transition-colors ${activeTab === "single" ? "bg-[var(--accent-cta)] text-white shadow-sm" : "text-[var(--text-muted)]"}`}
        >
          Одиночні
        </button>
        <button
          onClick={() => setActiveTab("duel")}
          className={`flex-1 py-2 text-sm font-bold rounded-lg transition-colors flex items-center justify-center gap-1.5 ${activeTab === "duel" ? "bg-blue-500 text-white shadow-sm" : "text-[var(--text-muted)]"}`}
        >
          <Users className="w-4 h-4" /> Дуелі
        </button>
      </div>

      {isLoading ? (
        <div className="text-center py-10 text-[var(--text-muted)] text-sm">
          Завантаження ігор...
        </div>
      ) : activeTab === "single" ? (
        <div className="space-y-4">
          {games.map((game) => (
            <Card
              key={game.gameId}
              className="p-4 flex flex-col gap-3 relative overflow-hidden"
            >
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-lg font-bold text-[var(--text-main)]">
                    {game.title}
                  </h3>
                  <p className="text-sm text-[var(--text-muted)] mt-1 leading-snug">
                    {game.description}
                  </p>
                </div>
                {game.status === "coming_soon" && (
                  <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider bg-amber-500/10 text-amber-500 border border-amber-500/20 rounded-lg shrink-0 ml-2">
                    Скоро
                  </div>
                )}
              </div>

              <div className="mt-1 pt-3 border-t border-[var(--border-color)]">
                {game.status === "coming_soon" ? (
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-[var(--text-muted)]">
                      В розробці
                    </span>
                    <Button
                      variant="secondary"
                      disabled
                      className="px-4 py-2 opacity-50"
                    >
                      <Lock className="w-4 h-4 mr-2" /> Зачинено
                    </Button>
                  </div>
                ) : game.isPurchased || game.isFree ? (
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-[var(--accent-success)]">
                      {game.isFree ? "Безкоштовно" : "Куплено"}
                    </span>
                    <Link to={`/games/${game.gameId}`} className="block">
                      <Button variant="primary" className="px-6 py-2">
                        Грати
                      </Button>
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center gap-1.5 text-lg font-black text-amber-500">
                      <Star className="w-5 h-5 fill-current" />{" "}
                      {game.priceStars} XTR
                    </div>
                    <div className="flex flex-col gap-2">
                      <Button
                        onClick={() => handleStarsPayment(game.gameId)}
                        disabled={processingId === game.gameId}
                        className="w-full bg-[#2AABEE] hover:bg-[#2298D6] text-white border-none flex items-center justify-center gap-2"
                      >
                        {processingId === game.gameId ? (
                          <span className="inline-block w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <>
                            Оплатити зірками{" "}
                            <Star className="w-4 h-4 fill-current" />
                          </>
                        )}
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={() => handleManualPaymentClick(game.gameId)}
                        disabled={processingId === game.gameId}
                        className="w-full flex items-center justify-center gap-2"
                      >
                        Переказ на картку <CreditCard className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      ) : (
        /* ДОДАНО: Відображення дуелей */
        <div className="space-y-4">
          {DUEL_REGISTRY.length === 0 ? (
            <Card className="p-8 text-center border-dashed border-[var(--border-color)] bg-transparent">
              <div className="w-16 h-16 mx-auto bg-[var(--bg-card)] rounded-full flex items-center justify-center text-[var(--text-muted)] mb-4">
                <Users className="w-8 h-8" />
              </div>
              <p className="text-base font-bold text-[var(--text-main)] mb-1">
                Парні ігри готуються
              </p>
              <p className="text-sm text-[var(--text-muted)]">
                Зовсім скоро ти зможеш викликати друзів на реал-тайм поєдинки!
              </p>
            </Card>
          ) : (
            DUEL_REGISTRY.map((duel) => (
              <Card
                key={duel.id}
                className="p-4 flex flex-col gap-3 relative overflow-hidden"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-lg font-bold text-[var(--text-main)]">
                      {duel.title}
                    </h3>
                    <p className="text-sm text-[var(--text-muted)] mt-1 leading-snug">
                      {duel.description}
                    </p>
                  </div>
                  {duel.status === "coming_soon" && (
                    <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider bg-amber-500/10 text-amber-500 border border-amber-500/20 rounded-lg shrink-0 ml-2">
                      Скоро
                    </div>
                  )}
                </div>
                <div className="mt-1 pt-3 border-t border-[var(--border-color)] flex justify-between items-center">
                  <span className="text-sm font-bold text-blue-500">
                    Гра з другом
                  </span>
                  <Link to="/room/new">
                    <Button
                      variant="secondary"
                      className="px-4 py-2 border-blue-500/30 text-blue-500 bg-blue-500/10"
                    >
                      Створити кімнату
                    </Button>
                  </Link>
                </div>
              </Card>
            ))
          )}
        </div>
      )}

      {/* Модалка Історії Платежів */}
      {showHistoryModal && (
        <div className="fixed inset-0 z-[110] flex flex-col bg-[var(--bg-app)] animate-in fade-in slide-in-from-bottom-4 duration-200">
          <div className="flex items-center justify-between p-4 border-b border-[var(--border-color)] bg-[var(--bg-card)]">
            <h2 className="text-xl font-bold text-[var(--text-main)] flex items-center gap-2">
              <Receipt className="w-6 h-6 text-[var(--accent-cta)]" /> Мої
              платежі
            </h2>
            <button
              onClick={() => setShowHistoryModal(false)}
              className="p-2 rounded-xl bg-[var(--bg-app)] text-[var(--text-muted)] border border-[var(--border-color)]"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {payments.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center space-y-4 opacity-70 mt-20">
                <Receipt className="w-16 h-16 text-[var(--text-muted)]" />
                <p className="text-[var(--text-muted)] text-sm max-w-[240px]">
                  Тут з'являться твої платежі, коли розблокуєш платну гру
                </p>
              </div>
            ) : (
              payments.map((payment) => (
                <Card key={payment.id} className="p-4 flex flex-col gap-2">
                  <div className="flex items-start justify-between">
                    <span className="font-bold text-[var(--text-main)]">
                      {payment.gameTitle}
                    </span>
                    {payment.status === "pending" && (
                      <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-amber-500/10 text-amber-500 border border-amber-500/20 rounded-lg">
                        Очікує
                      </span>
                    )}
                    {payment.status === "approved" && (
                      <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-[var(--accent-success)]/10 text-[var(--accent-success)] border border-[var(--accent-success)]/20 rounded-lg">
                        Успішно
                      </span>
                    )}
                    {payment.status === "rejected" && (
                      <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-red-500/10 text-red-500 border border-red-500/20 rounded-lg">
                        Відхилено
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between text-xs text-[var(--text-muted)] font-medium">
                    <span>{payment.method}</span>
                    <span>
                      {new Date(payment.date).toLocaleString("uk-UA")}
                    </span>
                  </div>
                </Card>
              ))
            )}
          </div>
        </div>
      )}

      {/* Модалка Ручної Оплати */}
      {manualModal && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <Card className="w-full max-w-sm p-5 space-y-5 animate-in fade-in zoom-in duration-200">
            {/* Логіка модалки залишилася ідентичною до GamesPage_2.tsx */}
            {manualModal.step !== "success" && (
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-[var(--text-main)] flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-[var(--accent-cta)]" />{" "}
                  Ручна оплата
                </h2>
                <button
                  onClick={() => setManualModal(null)}
                  className="p-1 rounded-lg bg-[var(--bg-app)] text-[var(--text-muted)]"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            )}

            {manualModal.step === "info" && (
              <>
                <div className="space-y-4">
                  <div className="bg-[var(--bg-app)] p-3 rounded-xl border border-[var(--border-color)]">
                    <div className="text-xs text-[var(--text-muted)] mb-1">
                      Реквізити картки
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[var(--text-main)] font-bold">
                        {manualModal.cardNumber}
                      </span>
                      <button
                        onClick={() =>
                          handleCopy(manualModal.cardNumber, "card")
                        }
                        className="p-2 text-[var(--accent-cta)] bg-[var(--accent-cta)]/10 rounded-lg"
                      >
                        {copied === "card" ? (
                          <Check className="w-4 h-4" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>
                  <div className="bg-[var(--accent-success)]/10 p-3 rounded-xl border border-[var(--accent-success)]/30">
                    <div className="text-xs text-[var(--accent-success)] font-bold mb-1 uppercase tracking-wider">
                      Ваш унікальний код
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xl text-[var(--text-main)] font-black tracking-widest">
                        {manualModal.uniqueCode}
                      </span>
                      <button
                        onClick={() =>
                          handleCopy(manualModal.uniqueCode, "code")
                        }
                        className="p-2 text-[var(--accent-success)] bg-[var(--accent-success)]/20 rounded-lg"
                      >
                        {copied === "code" ? (
                          <Check className="w-4 h-4" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 text-sm text-[var(--text-muted)] bg-[var(--bg-app)] p-3 rounded-xl">
                    <Info className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                    <div className="leading-snug">
                      Зробіть переказ та обов'язково вкажіть код{" "}
                      <b>{manualModal.uniqueCode}</b> у коментарі, після чого
                      прикріпіть квитанцію.
                    </div>
                  </div>
                </div>
                <Button
                  onClick={() =>
                    setManualModal({ ...manualModal, step: "upload" })
                  }
                  className="w-full"
                >
                  Я сплатив, додати квитанцію
                </Button>
              </>
            )}

            {manualModal.step === "upload" && (
              <div className="space-y-4">
                <p className="text-sm text-[var(--text-muted)] text-center">
                  Завантажте скріншот успішного переказу
                </p>
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-[var(--border-color)] rounded-xl p-4 flex flex-col items-center justify-center cursor-pointer min-h-[160px] bg-[var(--bg-app)] overflow-hidden"
                >
                  {receiptPreview ? (
                    <img
                      src={receiptPreview}
                      alt="Preview"
                      className="max-h-40 rounded-lg object-contain"
                    />
                  ) : (
                    <div className="text-center text-[var(--text-muted)]">
                      <Camera className="w-8 h-8 mx-auto mb-2 text-[var(--accent-cta)]" />
                      <span className="text-sm font-medium">
                        Обрати зображення
                      </span>
                    </div>
                  )}
                </div>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                />
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    onClick={() =>
                      setManualModal({ ...manualModal, step: "info" })
                    }
                    className="flex-1"
                  >
                    Назад
                  </Button>
                  <Button
                    onClick={handleReceiptSubmit}
                    disabled={!receiptFile || isUploading}
                    className="flex-1"
                  >
                    {isUploading ? "Надсилаємо..." : "Надіслати"}
                  </Button>
                </div>
              </div>
            )}

            {manualModal.step === "success" && (
              <div className="flex flex-col items-center justify-center space-y-4 text-center py-4">
                <div className="w-16 h-16 bg-[var(--accent-success)]/10 text-[var(--accent-success)] rounded-full flex items-center justify-center">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-[var(--text-main)]">
                    Квитанцію надіслано!
                  </h2>
                  <p className="text-sm text-[var(--text-muted)] mt-2">
                    Адміністратор підтвердить оплату найближчим часом.
                  </p>
                </div>
                <Button
                  onClick={() => setManualModal(null)}
                  className="w-full mt-2"
                >
                  Повернутись до ігор
                </Button>
              </div>
            )}
          </Card>
        </div>
      )}
    </Screen>
  );
};
