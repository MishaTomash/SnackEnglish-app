// 📁 Файл: SnackEnglish-app/src/features/admin-panel/ui/UserAvatar.tsx
import { useState } from "react";
import type { FC } from "react";
import { resolveAvatarUrl } from "../../../shared/lib/avatarUrl";
import type { AdminUser } from "../api";

export const userDisplayName = (u: AdminUser): string =>
    u.customDisplayName || u.username || u.telegramFirstName || `#${u.telegramId}`;

/** Аватар юзера з запасною літерою, якщо картинки немає або вона не вантажиться */
export const UserAvatar: FC<{ user: AdminUser; size?: number }> = ({ user, size = 40 }) => {
    const url = resolveAvatarUrl(user.customAvatarUrl) || user.telegramPhotoUrl || null;
    const [broken, setBroken] = useState(false);
    const style = { width: size, height: size };

    if (!url || broken) {
        return (
            <div
                style={style}
                className="flex shrink-0 items-center justify-center rounded-full bg-[var(--bg-app)] text-sm font-black uppercase text-[var(--text-main)]"
                aria-hidden="true"
            >
                {userDisplayName(user).replace(/^[#@]/, "").charAt(0) || "U"}
            </div>
        );
    }
    return (
        <img src={url} alt="" style={style} className="shrink-0 rounded-full object-cover" onError={() => setBroken(true)} />
    );
};