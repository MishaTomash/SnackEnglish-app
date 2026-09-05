import { useEffect, useState } from "react";
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
import { HomePage } from "../pages/HomePage";
import { PathMapPage } from "../pages/path/PathMapPage";
import { UnitPathPage } from "../pages/UnitPathPage";
import { UnitStepPage } from "../pages/unit-step/UnitStepPage";
import { PracticePage } from "../pages/PracticePage";
import { SettingsPage } from "../pages/settings/SettingsPage";
import { BottomNav } from "../widgets/BottomNav";
import { Screen } from "../shared/ui/Screen";
import { CookieMascot } from "../shared/ui/CookieMascot";
import { useProgressStore } from "../store/progressStore";

const AppContent = () => {
  const { onboardingCompleted, fetchUser } = useUserStore();
  const location = useLocation();
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    const initApp = async () => {
      // Усунення Waterfall: якщо рівень відомий з кешу persist, вантажимо дані паралельно
      const cachedLevel = useUserStore.getState().level;

      if (cachedLevel) {
        await Promise.all([
          fetchUser(),
          useProgressStore.getState().loadUnits(cachedLevel),
        ]);
      } else {
        await fetchUser();
      }

      setIsInitializing(false);
    };
    void initApp();
  }, [fetchUser]);

  // Показуємо завантажувач, щоб уникнути "блимання" екранів до отримання відповіді від API
  if (isInitializing) {
    return (
      <Screen className="justify-center items-center">
        <CookieMascot state="thinking" size={64} className="animate-pulse" />
      </Screen>
    );
  }

  const isInsideStep = location.pathname.includes("/step/");
  const isOnboarding = location.pathname === "/onboarding";

  // Якщо онбординг не завершено — обов'язково ведемо на сторінку онбордингу
  if (!onboardingCompleted && !isOnboarding) {
    return <Navigate to="/onboarding" replace />;
  }

  // Якщо онбординг завершено, але користувач намагається зайти на нього — ведемо на головну
  if (onboardingCompleted && isOnboarding) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="relative min-h-[100dvh] bg-[var(--bg-app)] text-[var(--text-main)]">
      <Routes>
        <Route path="/onboarding" element={<OnboardingPage />} />

        {/* Головна сторінка з дашбордом */}
        <Route path="/" element={<HomePage />} />

        {/* Налаштування */}
        <Route path="/settings" element={<SettingsPage />} />

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
