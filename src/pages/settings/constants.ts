import type { EnglishLevel } from "../../entities/word/types";

export const LEVELS: { id: EnglishLevel; desc: string }[] = [
  { id: "A1", desc: "Початківець (Beginner)" },
  { id: "A2", desc: "Базовий (Elementary)" },
  { id: "B1", desc: "Середній (Intermediate)" },
  { id: "B2", desc: "Вище середнього (Upper-Int.)" },
  { id: "C1", desc: "Просунутий (Advanced)" },
  { id: "C2", desc: "Просунутий+ (Proficiency)" },
];

export const resolveAvatarUrl = (url: string | null) => {
  if (!url) return null;
  if (url.startsWith("http")) return url;

  try {
    // Беремо URL з .env (наприклад "https://...ngrok-free.dev/api")
    const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:3000";

    // Витягуємо тільки чистий домен "https://...ngrok-free.dev"
    const urlObj = new URL(apiUrl);
    const apiBase = urlObj.origin;

    // Додаємо ngrok-skip-browser-warning, щоб ngrok не блокував картинку
    return `${apiBase}${url}?ngrok-skip-browser-warning=true`;
  } catch (e) {
    // Якщо .env пустий або сталася помилка — використовуємо твій поточний ngrok як запасний варіант
    return `https://trustable-kerchief-cringing.ngrok-free.dev${url}?ngrok-skip-browser-warning=true`;
  }
};
