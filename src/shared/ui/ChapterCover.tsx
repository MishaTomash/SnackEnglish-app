// 📁 Файл: SnackEnglish-app/src/shared/ui/ChapterCover.tsx
import { useState } from "react";
import type { FC } from "react";
import { resolveMediaUrl } from "../lib/avatarUrl";

/**
 * Обкладинка розділу: фото (якщо є) або емодзі на тлі кольору розділу.
 * Фото не завантажилось — тихо показуємо емодзі, а не "биту" картинку.
 */

export interface ChapterCoverProps {
    cover: string;
    coverImage?: string;
    accent: string;
    /** Квадратна мініатюра (px) */
    size: number;
    locked?: boolean;
    className?: string;
}

const accentBg = (accent: string): string => `color-mix(in srgb, ${accent || "#888888"} 22%, transparent)`;

export const ChapterCover: FC<ChapterCoverProps> = ({ cover, coverImage, accent, size, locked = false, className = "" }) => {
    const [failed, setFailed] = useState(false);
    const src = coverImage && !failed ? resolveMediaUrl(coverImage) : null;

    return (
        <div
            className={`relative flex shrink-0 items-center justify-center overflow-hidden ${className}`}
            style={{ width: size, height: size, backgroundColor: accentBg(accent), fontSize: size * 0.55 }}
            aria-hidden="true"
        >
            {src ? (
                <img
                    src={src}
                    alt=""
                    loading="lazy"
                    onError={() => setFailed(true)}
                    className={`h-full w-full object-cover ${locked ? "grayscale" : ""}`}
                />
            ) : (
                <span className="leading-none">{locked ? "🔒" : cover || "📖"}</span>
            )}
            {src && locked && (
                <span className="absolute inset-0 flex items-center justify-center bg-black/45" style={{ fontSize: size * 0.4 }}>
                    🔒
                </span>
            )}
        </div>
    );
};

/**
 * Широкий банер 16:9 для картки розділу з фото: знизу м'який перехід у колір розділу,
 * щоб фото "вросло" в картку, а не висіло окремою прямокутною плямою.
 */
export const ChapterBanner: FC<{
    coverImage: string;
    accent: string;
    locked?: boolean;
    badge?: string;
    onError?: () => void;
}> = ({ coverImage, accent, locked = false, badge, onError }) => {
    const src = resolveMediaUrl(coverImage);
    return (
        <div className="relative aspect-[16/9] w-full overflow-hidden rounded-t-3xl" aria-hidden="true">
            {src && (
                <img
                    src={src}
                    alt=""
                    loading="lazy"
                    onError={onError}
                    className={`h-full w-full object-cover transition-transform duration-500 ${locked ? "grayscale" : ""}`}
                />
            )}
            <div
                className="absolute inset-x-0 bottom-0 h-1/2"
                style={{ background: `linear-gradient(to bottom, transparent, color-mix(in srgb, ${accent} 35%, var(--bg-card)))` }}
            />
            {badge && (
                <span className="absolute left-3 top-3 rounded-full bg-black/55 px-2.5 py-1 text-xs font-extrabold text-white backdrop-blur-sm">
                    {badge}
                </span>
            )}
            {locked && (
                <span className="absolute inset-0 flex items-center justify-center bg-black/40 text-4xl">🔒</span>
            )}
        </div>
    );
};