import type { EnglishLevel } from "../../entities/word/types";

export const LEVELS: { id: EnglishLevel; desc: string }[] = [
  { id: "A1", desc: "Початківець (Beginner)" },
  { id: "A2", desc: "Базовий (Elementary)" },
  { id: "B1", desc: "Середній (Intermediate)" },
  { id: "B2", desc: "Вище середнього (Upper-Int.)" },
  { id: "C1", desc: "Просунутий (Advanced)" },
  { id: "C2", desc: "Просунутий+ (Proficiency)" },
];

/**
 * Адреса аватара — спільна функція для всього застосунку (shared/lib/avatarUrl).
 * Раніше тут була своя копія з http://localhost:3000 за замовчуванням —
 * на телефонах юзерів аватари в налаштуваннях не вантажились.
 * Реекспорт лишає старий імпорт з "./constants" робочим.
 */
export { resolveAvatarUrl } from "../../shared/lib/avatarUrl";