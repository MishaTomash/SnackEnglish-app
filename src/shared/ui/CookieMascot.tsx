import React from "react";

export type CookieState = "happy" | "thinking" | "sleeping" | "celebrating";

interface CookieMascotProps {
  state?: CookieState;
  size?: number;
  className?: string;
}

export const CookieMascot: React.FC<CookieMascotProps> = ({
  state = "happy",
  size = 80,
  className = "",
}) => {
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
        <circle
          cx="50"
          cy="50"
          r="44"
          fill="#E09F3E"
          stroke="#B45309"
          strokeWidth="3.5"
        />
        <circle cx="48" cy="48" r="41" fill="#F4B251" />

        {/* Шоколадні крихти (choc chips) */}
        <circle cx="28" cy="30" r="4" fill="#582F0E" />
        <circle cx="74" cy="34" r="3.5" fill="#582F0E" />
        <circle cx="25" cy="65" r="4.5" fill="#582F0E" />
        <circle cx="75" cy="68" r="4" fill="#582F0E" />
        <circle cx="50" cy="20" r="3" fill="#582F0E" />

        {/* Рум'янець */}
        <ellipse cx="28" cy="56" rx="5" ry="3" fill="#F87171" opacity="0.6" />
        <ellipse cx="72" cy="56" rx="5" ry="3" fill="#F87171" opacity="0.6" />

        {/* Емоційні стани */}
        {state === "happy" && (
          <g>
            {/* Очі-дуги (радісні) */}
            <path
              d="M34 46C36 41 42 41 44 46"
              stroke="#3D1A04"
              strokeWidth="3.5"
              strokeLinecap="round"
            />
            <path
              d="M56 46C58 41 64 41 66 46"
              stroke="#3D1A04"
              strokeWidth="3.5"
              strokeLinecap="round"
            />
            {/* Посмішка з язичком */}
            <path
              d="M40 57C40 64 60 64 60 57"
              stroke="#3D1A04"
              strokeWidth="3.5"
              strokeLinecap="round"
              fill="#991B1B"
            />
          </g>
        )}

        {state === "thinking" && (
          <g>
            {/* Очі спрямовані вгору-вбік */}
            <circle cx="38" cy="44" r="4" fill="#3D1A04" />
            <circle cx="62" cy="44" r="4" fill="#3D1A04" />
            {/* Піднята брова */}
            <path
              d="M57 37C61 35 67 36 69 39"
              stroke="#3D1A04"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
            {/* Замислений рот набік */}
            <path
              d="M44 60Q52 57 58 61"
              stroke="#3D1A04"
              strokeWidth="3.5"
              strokeLinecap="round"
            />
            {/* Значок запитання */}
            <text
              x="76"
              y="28"
              fill="#B45309"
              fontSize="18"
              fontWeight="bold"
              fontFamily="sans-serif"
            >
              ?
            </text>
          </g>
        )}

        {state === "sleeping" && (
          <g>
            {/* Заплющені очі */}
            <path
              d="M33 46H43"
              stroke="#3D1A04"
              strokeWidth="3"
              strokeLinecap="round"
            />
            <path
              d="M57 46H67"
              stroke="#3D1A04"
              strokeWidth="3"
              strokeLinecap="round"
            />
            {/* Спокійний маленький рот */}
            <ellipse cx="50" cy="58" rx="3.5" ry="2" fill="#3D1A04" />
            {/* Zzz */}
            <text x="70" y="24" fill="#D97706" fontSize="14" fontWeight="bold">
              Z
            </text>
            <text x="80" y="16" fill="#D97706" fontSize="10" fontWeight="bold">
              z
            </text>
          </g>
        )}

        {state === "celebrating" && (
          <g>
            {/* Очі-зірочки */}
            <path
              d="M39 41L41 49M35 45L45 45"
              stroke="#3D1A04"
              strokeWidth="3"
              strokeLinecap="round"
            />
            <path
              d="M61 41L63 49M57 45L67 45"
              stroke="#3D1A04"
              strokeWidth="3"
              strokeLinecap="round"
            />
            {/* Широкий радісний відкритий рот */}
            <path
              d="M38 56C38 66 62 66 62 56Z"
              fill="#991B1B"
              stroke="#3D1A04"
              strokeWidth="3"
            />
            {/* Святкові іскорки навколо */}
            <circle cx="16" cy="24" r="2.5" fill="#F59E0B" />
            <circle cx="84" cy="22" r="3" fill="#F59E0B" />
            <circle cx="88" cy="50" r="2" fill="#EF4444" />
          </g>
        )}
      </svg>
    </div>
  );
};
