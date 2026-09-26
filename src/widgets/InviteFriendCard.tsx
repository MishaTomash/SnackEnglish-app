// 📁 Файл: SnackEnglish-app/src/widgets/InviteFriendCard.tsx
import { useEffect, useState } from "react";
import type { FC } from "react";
import { Check, Copy, Gift, Send } from "lucide-react";
import { apiClient } from "../shared/api/apiClient";
import { Card } from "../shared/ui/Card";

/**
 * "Запроси друга": особисте посилання на бота. Бонус обом нараховується,
 * коли друг пройде свій перший урок (не за просту реєстрацію).
 */

interface ReferralInfo {
    link: string | null;
    invited: number;
    rewarded: number;
    bonus: number;
}

interface TelegramShareApi {
    openTelegramLink?: (url: string) => void;
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

const parseReferral = (data: unknown): ReferralInfo | null => {
    if (!isRecord(data)) return null;
    return {
        link: typeof data.link === "string" ? data.link : null,
        invited: typeof data.invited === "number" ? data.invited : 0,
        rewarded: typeof data.rewarded === "number" ? data.rewarded : 0,
        bonus: typeof data.bonus === "number" ? data.bonus : 0,
    };
};

const SHARE_TEXT = "Вчу англійську з печивком Снекі 🍪 Короткі уроки-історії щодня — приєднуйся!";

export const InviteFriendCard: FC<{ className?: string }> = ({ className = "" }) => {
    const [info, setInfo] = useState<ReferralInfo | null>(null);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        let alive = true;
        apiClient
            .get<unknown>("/user/referral")
            .then(({ data }) => {
                if (alive) setInfo(parseReferral(data));
            })
            .catch((error: unknown) => console.error("[referral]", error));
        return () => {
            alive = false;
        };
    }, []);

    if (!info?.link) return null;
    const link = info.link;

    const share = () => {
        const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(SHARE_TEXT)}`;
        const tg = (window as unknown as { Telegram?: { WebApp?: TelegramShareApi } }).Telegram?.WebApp;
        if (tg?.openTelegramLink) tg.openTelegramLink(shareUrl);
        else window.open(shareUrl, "_blank", "noopener,noreferrer");
    };

    const copy = async () => {
        try {
            await navigator.clipboard.writeText(link);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            // Буфер обміну недоступний у цьому WebView — лишається кнопка "Надіслати"
        }
    };

    return (
        <Card className={`p-4 bg-[var(--bg-card)] border-[var(--border-color)] ${className}`}>
            <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[var(--accent-cta)]/15 text-[var(--accent-cta)]">
                    <Gift className="h-5 w-5" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                    <h3 className="text-sm font-black text-[var(--text-main)]">Запроси друга</h3>
                    <p className="mt-0.5 text-xs leading-relaxed text-[var(--text-muted)]">
                        {info.bonus > 0
                            ? `Коли друг пройде перший урок, ви обидва отримаєте +${info.bonus} 🏆 до рейтингу тижня.`
                            : "Вчитися разом веселіше — і можна змагатися в дуелях!"}
                    </p>
                    {info.invited > 0 && (
                        <p className="mt-1 text-xs font-bold text-[var(--accent-success)]">
                            Запрошено: {info.invited}
                            {info.bonus > 0 ? ` · бонус отримано: ${info.rewarded}` : ""}
                        </p>
                    )}
                </div>
            </div>
            <div className="mt-3 flex gap-2">
                <button
                    type="button"
                    onClick={share}
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[var(--accent-cta)] py-2.5 text-sm font-extrabold text-[var(--text-accent)] active:opacity-80"
                >
                    <Send className="h-4 w-4" aria-hidden="true" /> Надіслати друзям
                </button>
                <button
                    type="button"
                    onClick={() => void copy()}
                    aria-label="Скопіювати посилання"
                    className="flex items-center justify-center rounded-xl border border-[var(--border-color)] bg-[var(--bg-app)] px-3 text-[var(--text-main)] active:opacity-80"
                >
                    {copied ? <Check className="h-4 w-4 text-[var(--accent-success)]" /> : <Copy className="h-4 w-4" />}
                </button>
            </div>
        </Card>
    );
};