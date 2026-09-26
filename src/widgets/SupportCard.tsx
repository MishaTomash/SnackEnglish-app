// 📁 Файл: SnackEnglish-app/src/widgets/SupportCard.tsx
import { useEffect } from "react";
import type { FC } from "react";
import { Heart } from "lucide-react";
import { apiClient } from "../shared/api/apiClient";
import { CookieMascot } from "../shared/ui/CookieMascot";
import { useAppConfigStore } from "../store/appConfigStore";

export type SupportPlace = "victory" | "giveaway" | "settings";

interface TelegramLinkApi {
    openLink?: (url: string) => void;
}

/** Зовнішнє посилання з Mini App: через Telegram (відкриє браузер/Monobank), інакше нова вкладка */
const openExternal = (url: string): void => {
    const tg = (window as unknown as { Telegram?: { WebApp?: TelegramLinkApi } }).Telegram?.WebApp;
    if (tg?.openLink) tg.openLink(url);
    else window.open(url, "_blank", "noopener,noreferrer");
};

/**
 * Блок "Підтримати Снекі" з кнопкою на банку Monobank.
 * Нічого не показує, якщо підтримку вимкнено в адмін-панелі.
 * Клік рахується в статистиці адмінки (звідки саме натиснули).
 */
export const SupportCard: FC<{ place: SupportPlace; className?: string }> = ({ place, className = "" }) => {
    const support = useAppConfigStore((s) => s.config?.support ?? null);
    const loadConfig = useAppConfigStore((s) => s.load);

    useEffect(() => {
        void loadConfig();
    }, [loadConfig]);

    if (!support) return null;

    const text = place === "giveaway" ? support.giveawayText : support.text;

    const handleClick = () => {
        openExternal(support.url);
        // Статистика не повинна заважати переходу — помилку ігноруємо
        apiClient.post("/user/support-click", { place }).catch(() => undefined);
    };

    return (
        <div
            className={`w-full rounded-3xl border border-[var(--accent-cta)]/40 bg-[var(--accent-cta)]/10 p-4 text-left ${className}`}
        >
            <div className="flex items-start gap-3">
                <CookieMascot state="happy" size={48} className="shrink-0" />
                <div className="min-w-0">
                    <p className="font-extrabold text-[var(--text-main)]">{support.title}</p>
                    {text && <p className="mt-1 text-sm leading-relaxed text-[var(--text-muted)]">{text}</p>}
                </div>
            </div>
            <button
                type="button"
                onClick={handleClick}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-[var(--accent-cta)] py-3 text-sm font-extrabold text-[var(--text-accent)] transition-transform active:scale-[0.98] focus:outline-none focus-visible:ring-4 focus-visible:ring-[var(--accent-cta)]/40"
            >
                <Heart className="h-4 w-4" aria-hidden="true" /> Підтримати
            </button>
        </div>
    );
};