import { useEffect } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  useLocation,
  Navigate,
} from "react-router-dom";
import { initTelegramApp, subscribeToTheme } from "../shared/lib/telegram";
import { useUserStore } from "../store/userStore";
import { OnboardingPage } from "../pages/OnboardingPage";
import { HomePage } from "../pages/HomePage"; // Додано імпорт головної сторінки
import { PathMapPage } from "../pages/path/PathMapPage";
import { UnitPathPage } from "../pages/UnitPathPage";
import { UnitStepPage } from "../pages/unit-step/UnitStepPage";
import { PracticePage } from "../pages/PracticePage";
import { BottomNav } from "../widgets/BottomNav";

const AppContent = () => {
  const level = useUserStore((state) => state.level);
  const location = useLocation();

  const isInsideStep = location.pathname.includes("/step/");
  const isOnboarding = location.pathname === "/onboarding";

  // Якщо рівень ще не обрано — перенаправляємо на онбординг
  if (!level && !isOnboarding) {
    return <Navigate to="/onboarding" replace />;
  }

  // Якщо рівень уже є, але користувач заходить на онбординг — ведемо на головну
  if (level && isOnboarding) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="relative min-h-screen bg-[var(--tg-theme-bg-color,#ffffff)] text-[var(--tg-theme-text-color,#000000)]">
      <Routes>
        <Route path="/onboarding" element={<OnboardingPage />} />

        {/* Головна сторінка з дашбордом */}
        <Route path="/" element={<HomePage />} />

        {/* Карта-шлях уроків */}
        <Route path="/path" element={<PathMapPage />} />

        {/* Кроки конкретного юніта */}
        <Route path="/path/:unitId" element={<UnitPathPage />} />
        <Route path="/unit/:unitId/step/:stepType" element={<UnitStepPage />} />
        <Route path="/practice" element={<PracticePage />} />
      </Routes>

      {!isInsideStep && !isOnboarding && <BottomNav />}
    </div>
  );
};

export const App = () => {
  useEffect(() => {
    // 1. Негайний виклик ready() та expand() для мобільного клієнта Telegram
    const tg = (
      window as unknown as {
        Telegram?: {
          WebApp?: {
            ready: () => void;
            expand: () => void;
          };
        };
      }
    ).Telegram?.WebApp;

    if (tg) {
      tg.ready();
      tg.expand();
    }

    // 2. Ініціалізація внутрішньої логіки та підписка на зміну теми
    try {
      initTelegramApp();
    } catch (err: unknown) {
      console.warn("Помилка ініціалізації Telegram App:", err);
    }

    subscribeToTheme((isDark) => {
      if (isDark) {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
    });
  }, []);

  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
};
