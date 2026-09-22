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

  const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:3000";

  let apiBase: string;
  try {
    apiBase = new URL(apiUrl).origin;
  } catch {
    // apiUrl відносний (наприклад "/api") — беремо поточний домен сторінки
    apiBase = window.location.origin;
  }

  return `${apiBase}${url}`;
};
