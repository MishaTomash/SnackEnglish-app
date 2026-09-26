// 📁 Файл: SnackEnglish-app/src/shared/lib/avatarUrl.ts
/**
 * Повна адреса аватара для <img>.
 * customAvatarUrl з бекенду відносний ("/uploads/avatars/..."), telegramPhotoUrl — повний.
 *
 * Раніше ця функція була скопійована в кілька сторінок і за замовчуванням додавала
 * http://localhost:3000 — на телефоні юзера такі картинки не вантажились.
 * Тепер без VITE_API_URL використовується той самий домен, що й у застосунку.
 */
const API_URL = (import.meta.env.VITE_API_URL as string | undefined) || "";
const API_ORIGIN = API_URL.replace(/\/api\/?$/, "").replace(/\/$/, "");

export const resolveAvatarUrl = (url: string | null | undefined): string | null => {
    if (!url) return null;
    if (/^(https?:|data:|blob:)/i.test(url)) return url;
    const path = url.startsWith("/") ? url : `/${url}`;
    // Для <img> заголовок не передати, тому параметр для ngrok — у самому URL
    return `${API_ORIGIN}${path}?ngrok-skip-browser-warning=true`;
};

/** Та сама логіка для аудіо й інших файлів з бекенду (/uploads/...) */
export const resolveMediaUrl = resolveAvatarUrl;