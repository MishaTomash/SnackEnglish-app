import React from "react";

export const COOKIE_STATES = [
  // Існуючі стани (API не змінено)
  "happy",
  "thinking",
  "sleeping",
  "celebrating",
  // Емоції для степів dialogue/reply
  "idle",
  "scared",
  "surprised",
  "excited",
  "sad",
] as const;

export type CookieState = (typeof COOKIE_STATES)[number];

export const isCookieState = (value: unknown): value is CookieState =>
  typeof value === "string" &&
  (COOKIE_STATES as readonly string[]).includes(value);

/**
 * Емоція з контенту кроку -> стан маскота.
 * Приймає і "scared", і прототипний формат "emo-scared"; невідоме -> fallback.
 */
export const toCookieState = (
  emotion: string | null | undefined,
  fallback: CookieState = "idle",
): CookieState => {
  const value = emotion?.trim().toLowerCase().replace(/^emo-/, "");
  return isCookieState(value) ? value : fallback;
};

interface CookieMascotProps {
  state?: CookieState;
  size?: number;
  className?: string;
}

const INK = "#3D1A04";
const MOUTH = "#991B1B";
const TEAR = "#7DD3FC";

// Інтенсивність рум'янцю під емоцію (для старих станів лишаємо 0.6, як було)
const BLUSH_OPACITY: Record<CookieState, number> = {
  happy: 0.6,
  thinking: 0.6,
  sleeping: 0.6,
  celebrating: 0.6,
  idle: 0.5,
  scared: 0.25,
  surprised: 0.5,
  excited: 0.85,
  sad: 0.3,
};

const Face: React.FC<{ state: CookieState }> = ({ state }) => {
  switch (state) {
    case "happy":
      return (
        <g>
          {/* Очі-дуги (радісні) */}
          <path d="M34 46C36 41 42 41 44 46" stroke={INK} strokeWidth="3.5" strokeLinecap="round" />
          <path d="M56 46C58 41 64 41 66 46" stroke={INK} strokeWidth="3.5" strokeLinecap="round" />
          {/* Посмішка з язичком */}
          <path d="M40 57C40 64 60 64 60 57" stroke={INK} strokeWidth="3.5" strokeLinecap="round" fill={MOUTH} />
        </g>
      );

    case "thinking":
      return (
        <g>
          {/* Очі спрямовані вгору-вбік */}
          <circle cx="38" cy="44" r="4" fill={INK} />
          <circle cx="62" cy="44" r="4" fill={INK} />
          {/* Піднята брова */}
          <path d="M57 37C61 35 67 36 69 39" stroke={INK} strokeWidth="2.5" strokeLinecap="round" />
          {/* Замислений рот набік */}
          <path d="M44 60Q52 57 58 61" stroke={INK} strokeWidth="3.5" strokeLinecap="round" />
          {/* Значок запитання */}
          <text x="76" y="28" fill="#B45309" fontSize="18" fontWeight="bold" fontFamily="sans-serif">
            ?
          </text>
        </g>
      );

    case "sleeping":
      return (
        <g>
          {/* Заплющені очі */}
          <path d="M33 46H43" stroke={INK} strokeWidth="3" strokeLinecap="round" />
          <path d="M57 46H67" stroke={INK} strokeWidth="3" strokeLinecap="round" />
          {/* Спокійний маленький рот */}
          <ellipse cx="50" cy="58" rx="3.5" ry="2" fill={INK} />
          {/* Zzz */}
          <text x="70" y="24" fill="#D97706" fontSize="14" fontWeight="bold">
            Z
          </text>
          <text x="80" y="16" fill="#D97706" fontSize="10" fontWeight="bold">
            z
          </text>
        </g>
      );

    case "celebrating":
      return (
        <g>
          {/* Очі-зірочки */}
          <path d="M39 41L41 49M35 45L45 45" stroke={INK} strokeWidth="3" strokeLinecap="round" />
          <path d="M61 41L63 49M57 45L67 45" stroke={INK} strokeWidth="3" strokeLinecap="round" />
          {/* Широкий радісний відкритий рот */}
          <path d="M38 56C38 66 62 66 62 56Z" fill={MOUTH} stroke={INK} strokeWidth="3" />
          {/* Святкові іскорки навколо */}
          <circle cx="16" cy="24" r="2.5" fill="#F59E0B" />
          <circle cx="84" cy="22" r="3" fill="#F59E0B" />
          <circle cx="88" cy="50" r="2" fill="#EF4444" />
        </g>
      );

    case "idle":
      return (
        <g>
          {/* Спокійні очі з відблиском */}
          <circle cx="39" cy="45" r="4" fill={INK} />
          <circle cx="61" cy="45" r="4" fill={INK} />
          <circle cx="40.3" cy="43.6" r="1.2" fill="#FFFFFF" />
          <circle cx="62.3" cy="43.6" r="1.2" fill="#FFFFFF" />
          {/* Легка посмішка */}
          <path d="M43 58Q50 63 57 58" stroke={INK} strokeWidth="3.5" strokeLinecap="round" />
        </g>
      );

    case "scared":
      return (
        <g>
          {/* Стривожені брови */}
          <path d="M33 39L43 34" stroke={INK} strokeWidth="2.5" strokeLinecap="round" />
          <path d="M67 39L57 34" stroke={INK} strokeWidth="2.5" strokeLinecap="round" />
          {/* Широко розплющені очі з маленькими зіницями */}
          <circle cx="39" cy="46" r="6" fill="#FFFFFF" stroke={INK} strokeWidth="2.5" />
          <circle cx="61" cy="46" r="6" fill="#FFFFFF" stroke={INK} strokeWidth="2.5" />
          <circle cx="39" cy="47" r="2.2" fill={INK} />
          <circle cx="61" cy="47" r="2.2" fill={INK} />
          {/* Тремтячий хвилястий рот */}
          <path d="M40 62Q43 58 46 62Q49 66 52 62Q55 58 58 62" stroke={INK} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          {/* Крапля поту */}
          <path d="M84 24C84 24 79.5 31 79.5 34A4.5 4.5 0 0 0 88.5 34C88.5 31 84 24 84 24Z" fill={TEAR} stroke="#0284C7" strokeWidth="1.2" />
        </g>
      );

    case "surprised":
      return (
        <g>
          {/* Високо підняті брови */}
          <path d="M33 36C35 32 41 32 43 35" stroke={INK} strokeWidth="2.5" strokeLinecap="round" />
          <path d="M57 35C59 32 65 32 67 36" stroke={INK} strokeWidth="2.5" strokeLinecap="round" />
          {/* Круглі очі */}
          <circle cx="39" cy="45" r="5.5" fill="#FFFFFF" stroke={INK} strokeWidth="2.5" />
          <circle cx="61" cy="45" r="5.5" fill="#FFFFFF" stroke={INK} strokeWidth="2.5" />
          <circle cx="39" cy="45" r="3" fill={INK} />
          <circle cx="61" cy="45" r="3" fill={INK} />
          {/* Рот "О" */}
          <ellipse cx="50" cy="61" rx="4.5" ry="5.5" fill={MOUTH} stroke={INK} strokeWidth="3" />
        </g>
      );

    case "excited":
      return (
        <g>
          {/* Великі блискучі очі */}
          <circle cx="39" cy="45" r="5.5" fill={INK} />
          <circle cx="61" cy="45" r="5.5" fill={INK} />
          <circle cx="41" cy="43" r="2" fill="#FFFFFF" />
          <circle cx="63" cy="43" r="2" fill="#FFFFFF" />
          <circle cx="37.5" cy="47.5" r="1" fill="#FFFFFF" />
          <circle cx="59.5" cy="47.5" r="1" fill="#FFFFFF" />
          {/* Широка відкрита посмішка */}
          <path d="M36 55C36 69 64 69 64 55Z" fill={MOUTH} stroke={INK} strokeWidth="3" strokeLinejoin="round" />
          <path d="M43 63Q50 60 57 63" stroke="#F87171" strokeWidth="3" strokeLinecap="round" />
          {/* Іскра біля голови */}
          <path d="M86 14L88 20L94 22L88 24L86 30L84 24L78 22L84 20Z" fill="#FCD34D" />
        </g>
      );

    case "sad":
      return (
        <g>
          {/* Брови "будиночком": внутрішні кінці підняті */}
          <path d="M33 41L43 37" stroke={INK} strokeWidth="2.5" strokeLinecap="round" />
          <path d="M67 41L57 37" stroke={INK} strokeWidth="2.5" strokeLinecap="round" />
          {/* Опущені очі */}
          <circle cx="39" cy="47" r="3.5" fill={INK} />
          <circle cx="61" cy="47" r="3.5" fill={INK} />
          {/* Сумний рот */}
          <path d="M42 64Q50 57 58 64" stroke={INK} strokeWidth="3.5" strokeLinecap="round" />
          {/* Сльоза */}
          <path d="M36 51C36 51 32.5 56 32.5 58.5A3.5 3.5 0 0 0 39.5 58.5C39.5 56 36 51 36 51Z" fill={TEAR} stroke="#0284C7" strokeWidth="1" />
        </g>
      );
  }
};

export const CookieMascot: React.FC<CookieMascotProps> = ({
  state = "happy",
  size = 80,
  className = "",
}) => {
  const blushOpacity = BLUSH_OPACITY[state];

  return (
    <div
      className={`relative inline-flex items-center justify-center select-none ${className}`}
      style={{ width: size, height: size }}
      role="img"
      aria-label={`Cookie mascot - ${state}`}
    >
      <svg
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full drop-shadow-[0_0_12px_rgba(232,163,61,0.15)]"
      >
        {/* Тіло печива */}
        <circle cx="50" cy="50" r="44" fill="#E09F3E" stroke="#B45309" strokeWidth="3.5" />
        <circle cx="48" cy="48" r="41" fill="#F4B251" />

        {/* Шоколадні крихти (choc chips) */}
        <circle cx="28" cy="30" r="4" fill="#582F0E" />
        <circle cx="74" cy="34" r="3.5" fill="#582F0E" />
        <circle cx="25" cy="65" r="4.5" fill="#582F0E" />
        <circle cx="75" cy="68" r="4" fill="#582F0E" />
        <circle cx="50" cy="20" r="3" fill="#582F0E" />

        {/* Рум'янець */}
        <ellipse cx="28" cy="56" rx="5" ry="3" fill="#F87171" opacity={blushOpacity} />
        <ellipse cx="72" cy="56" rx="5" ry="3" fill="#F87171" opacity={blushOpacity} />

        {/* Емоційні стани */}
        <Face state={state} />
      </svg>
    </div>
  );
};