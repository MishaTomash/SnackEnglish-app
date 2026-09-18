import { useEffect, useState } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  useLocation,
  Navigate,
  useNavigate,
} from "react-router-dom";
import { initTelegramApp } from "../shared/lib/telegram";
import { useUserStore } from "../store/userStore";
import { OnboardingPage } from "../pages/OnboardingPage";
import { HomePage } from "../pages/HomePage";
import { PracticePage } from "../pages/PracticePage";
import { SettingsPage } from "../pages/settings/SettingsPage";
import { LeaderboardPage } from "../pages/LeaderboardPage";
import { BottomNav } from "../widgets/BottomNav";
import { Screen } from "../shared/ui/Screen";
import { CookieMascot } from "../shared/ui/CookieMascot";
import { useLearningStore } from "../store/learningStore";
import { GamesPage } from "../pages/GamesPage";
import { GameRunnerPage } from "../pages/GameRunnerPage";
import { ProfilePage } from "../pages/ProfilePage";
import { FriendsPage } from "../pages/FriendsPage";
import { DuelRoomPage } from "../pages/DuelRoomPage";

import { LearningHubPage } from "../pages/learning/LearningHubPage";
import { CategoryPathPage } from "../pages/learning/CategoryPathPage";
import { LessonRunner } from "../pages/learning/LessonRunner";

const AppContent = () => {
  const { onboardingCompleted, fetchUser } = useUserStore();
  const location = useLocation();
  const navigate = useNavigate();
  const [isInitializing, setIsInitializing] = useState(true);

  const [pendingRoom, setPendingRoom] = useState<string | null>(null);

  useEffect(() => {
    try {
      const tg = (window as any).Telegram?.WebApp;
      let param = tg?.initDataUnsafe?.start_param;

      if (!param) {
        const match = window.location.href.match(/duel_([a-zA-Z0-9]+)/);
        if (match) param = "duel_" + match[1];
      }

      if (param && param.startsWith("duel_")) {
        setPendingRoom(param.replace("duel_", ""));
      }
    } catch (e) {
      console.error("Deep link parse error:", e);
    }
  }, []);

  useEffect(() => {
    const initApp = async () => {
      const cachedLevel = useUserStore.getState().level;
      if (cachedLevel) {
        await Promise.all([
          fetchUser(),
          useLearningStore.getState().fetchCategories(cachedLevel),
        ]);
      } else {
        await fetchUser();
      }
      setIsInitializing(false);
    };
    void initApp();
  }, [fetchUser]);

  useEffect(() => {
    if (!isInitializing && onboardingCompleted && pendingRoom) {
      setTimeout(() => {
        navigate(`/room/${pendingRoom}`, { replace: true });
        setPendingRoom(null);
      }, 50);
    }
  }, [isInitializing, onboardingCompleted, pendingRoom, navigate]);

  if (isInitializing || (pendingRoom && !onboardingCompleted)) {
    return (
      <Screen className="justify-center items-center">
        <CookieMascot state="thinking" size={64} className="animate-pulse" />
      </Screen>
    );
  }

  const isInsideLesson = location.pathname.startsWith("/learning/unit/");
  const isDuel = location.pathname.includes("/room/");
  const isOnboarding = location.pathname === "/onboarding";

  if (!onboardingCompleted && !isOnboarding)
    return <Navigate to="/onboarding" replace />;
  if (onboardingCompleted && isOnboarding) return <Navigate to="/" replace />;

  return (
    <div className="relative min-h-[100dvh] bg-[var(--bg-app)] text-[var(--text-main)]">
      <Routes>
        <Route path="/onboarding" element={<OnboardingPage />} />
        <Route path="/" element={<HomePage />} />
        <Route path="/settings" element={<SettingsPage />} />

        <Route path="/learning" element={<LearningHubPage />} />
        <Route
          path="/learning/category/:categoryId"
          element={<CategoryPathPage />}
        />
        <Route path="/learning/unit/:unitId" element={<LessonRunner />} />

        <Route path="/practice" element={<PracticePage />} />
        <Route path="/leaderboard" element={<LeaderboardPage />} />
        <Route path="/games" element={<GamesPage />} />
        <Route path="/games/:gameId" element={<GameRunnerPage />} />
        <Route path="/profile/:userId" element={<ProfilePage />} />
        <Route path="/friends" element={<FriendsPage />} />
        <Route path="/room/:roomId" element={<DuelRoomPage />} />
      </Routes>
      {!isInsideLesson && !isOnboarding && !isDuel && <BottomNav />}
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
      } catch (e) {}
    }

    document.body.style.setProperty("background-color", "#241812", "important");
    document.documentElement.style.setProperty(
      "background-color",
      "#241812",
      "important",
    );
    document.documentElement.classList.add("dark");

    try {
      initTelegramApp();
    } catch (e) {}
  }, []);

  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
};
