import { useEffect, useState } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  useLocation,
  Navigate,
  useNavigate,
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
import { LeaderboardPage } from "../pages/LeaderboardPage";
import { BottomNav } from "../widgets/BottomNav";
import { Screen } from "../shared/ui/Screen";
import { CookieMascot } from "../shared/ui/CookieMascot";
import { useProgressStore } from "../store/progressStore";
import { GamesPage } from "../pages/GamesPage";
import { GameRunnerPage } from "../pages/GameRunnerPage";
import { ProfilePage } from "../pages/ProfilePage";
import { FriendsPage } from "../pages/FriendsPage";
import { DuelLobbyPage } from "../pages/DuelLobbyPage";

const AppContent = () => {
  const { onboardingCompleted, fetchUser } = useUserStore();
  const location = useLocation();
  const navigate = useNavigate(); // ВИПРАВЛЕННЯ: надійний хук навігації
  const [isInitializing, setIsInitializing] = useState(true);

  // 1. ПАРСЕР ЗАПРОШЕНЬ (Перевіряємо і Telegram дані, і URL)
  useEffect(() => {
    try {
      const tg = (window as any).Telegram?.WebApp;
      const searchParams = new URLSearchParams(window.location.search);

      // Читаємо параметр або з Telegram, або прямо з URL (куди веде кнопка)
      const startParam =
        tg?.initDataUnsafe?.start_param || searchParams.get("startapp");

      if (startParam && startParam.startsWith("duel_")) {
        const roomId = startParam.replace("duel_", "");
        sessionStorage.setItem("pendingDuelRoute", `/duel/${roomId}`);
      }
    } catch (e) {
      console.error("Deep link error:", e);
    }
  }, []);

  useEffect(() => {
    const initApp = async () => {
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

  // 2. БЕЗПЕЧНИЙ РЕДИРЕКТ НА ДУЕЛЬ (тільки після повного завантаження)
  useEffect(() => {
    if (!isInitializing && onboardingCompleted) {
      const pendingDuelRoute = sessionStorage.getItem("pendingDuelRoute");
      if (pendingDuelRoute) {
        sessionStorage.removeItem("pendingDuelRoute");
        navigate(pendingDuelRoute, { replace: true });
      }
    }
  }, [isInitializing, onboardingCompleted, navigate]);

  if (isInitializing) {
    return (
      <Screen className="justify-center items-center">
        <CookieMascot state="thinking" size={64} className="animate-pulse" />
      </Screen>
    );
  }

  const isInsideStep = location.pathname.includes("/step/");
  const isDuel = location.pathname.includes("/duel/"); // Щоб сховати меню
  const isOnboarding = location.pathname === "/onboarding";

  if (!onboardingCompleted && !isOnboarding) {
    return <Navigate to="/onboarding" replace />;
  }

  if (onboardingCompleted && isOnboarding) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="relative min-h-[100dvh] bg-[var(--bg-app)] text-[var(--text-main)]">
      <Routes>
        <Route path="/onboarding" element={<OnboardingPage />} />
        <Route path="/" element={<HomePage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/path" element={<PathMapPage />} />
        <Route path="/path/:unitId" element={<UnitPathPage />} />
        <Route path="/unit/:unitId/step/:stepType" element={<UnitStepPage />} />
        <Route path="/practice" element={<PracticePage />} />
        <Route path="/leaderboard" element={<LeaderboardPage />} />
        <Route path="/games" element={<GamesPage />} />
        <Route path="/games/:gameId" element={<GameRunnerPage />} />
        <Route path="/profile/:userId" element={<ProfilePage />} />
        <Route path="/friends" element={<FriendsPage />} />
        <Route path="/duel/:roomId" element={<DuelLobbyPage />} />
      </Routes>

      {/* Якщо ми в дуелі — ховаємо нижнє меню */}
      {!isInsideStep && !isOnboarding && !isDuel && <BottomNav />}
    </div>
  );
};

export const App = () => {
  useEffect(() => {
    const tg = (window as any).Telegram?.WebApp;
    if (tg) {
      tg.ready();
      tg.expand();
      try {
        if (tg.disableVerticalSwipes) tg.disableVerticalSwipes();
        if (tg.setBackgroundColor) tg.setBackgroundColor("#241812");
        if (tg.setHeaderColor) tg.setHeaderColor("#241812");
      } catch (err: unknown) {
        console.warn("Помилка налаштування Telegram WebApp:", err);
      }
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
