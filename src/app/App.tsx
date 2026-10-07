// 📁 Файл: SnackEnglish-app/src/app/App.tsx
import { lazy, Suspense, useEffect, useState } from "react";
import type { ComponentType, ReactNode } from "react";
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
import { HomePage } from "../pages/HomePage";
import { BottomNav } from "../widgets/BottomNav";
import { Screen } from "../shared/ui/Screen";
import { CookieMascot } from "../shared/ui/CookieMascot";
import { useIsAdmin } from "../features/story-admin/lib/useIsAdmin";

/**
 * Сторінки вантажаться окремими файлами, коли юзер на них переходить.
 * Раніше весь застосунок був одним файлом ~546 КБ — Mini App довше відкривався
 * на мобільному інтернеті. Головна (HomePage) лишається в основному файлі.
 */
const lazyPage = <K extends string>(
  load: () => Promise<Record<K, ComponentType>>,
  name: K,
) => lazy(() => load().then((module) => ({ default: module[name] })));

const OnboardingPage = lazyPage(() => import("../pages/OnboardingPage"), "OnboardingPage");
const SettingsPage = lazyPage(() => import("../pages/settings/SettingsPage"), "SettingsPage");
const LeaderboardPage = lazyPage(() => import("../pages/LeaderboardPage"), "LeaderboardPage");
const GamesPage = lazyPage(() => import("../pages/GamesPage"), "GamesPage");
const GameRunnerPage = lazyPage(() => import("../pages/GameRunnerPage"), "GameRunnerPage");
const ProfilePage = lazyPage(() => import("../pages/ProfilePage"), "ProfilePage");
const FriendsPage = lazyPage(() => import("../pages/FriendsPage"), "FriendsPage");
const DuelRoomPage = lazyPage(() => import("../pages/DuelRoomPage"), "DuelRoomPage");
const LearningHubPage = lazyPage(() => import("../pages/learning/LearningHubPage"), "LearningHubPage");
const ChapterMapPage = lazyPage(() => import("../pages/learning/ChapterMapPage"), "ChapterMapPage");
const LessonRunnerPage = lazyPage(() => import("../pages/learning/LessonRunnerPage"), "LessonRunnerPage");
const StoryAdminPage = lazyPage(() => import("../pages/learning/admin/StoryAdminPage"), "StoryAdminPage");
const AdminPanelPage = lazyPage(() => import("../pages/admin/AdminPanelPage"), "AdminPanelPage");
const StoryAdminChapterPage = lazyPage(
  () => import("../pages/learning/admin/StoryAdminChapterPage"),
  "StoryAdminChapterPage",
);

interface TelegramWebAppLike {
  ready?: () => void;
  expand?: () => void;
  disableVerticalSwipes?: () => void;
  setBackgroundColor?: (color: string) => void;
  setHeaderColor?: (color: string) => void;
  initDataUnsafe?: { start_param?: string };
}

const getTelegramWebApp = (): TelegramWebAppLike | undefined =>
  (window as unknown as { Telegram?: { WebApp?: TelegramWebAppLike } }).Telegram?.WebApp;

/** Заглушка, поки вантажиться сторінка (той самий маскот, що й при старті) */
const PageLoader = () => (
  <Screen className="justify-center items-center">
    <CookieMascot state="thinking" size={64} className="animate-pulse" />
  </Screen>
);

/** Сторінки лише для адміна. Справжній захист — на сервері (adminOnly) */
const AdminOnly = ({ children }: { children: ReactNode }) =>
  useIsAdmin() ? <>{children}</> : <Navigate to="/learning" replace />;

const AppContent = () => {
  const { onboardingCompleted, fetchUser } = useUserStore();
  const location = useLocation();
  const navigate = useNavigate();
  const [isInitializing, setIsInitializing] = useState(true);

  const [pendingRoom, setPendingRoom] = useState<string | null>(null);

  useEffect(() => {
    try {
      const tg = getTelegramWebApp();
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
      await fetchUser();
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

  // Новачок із запрошенням на дуель спершу проходить онбординг; pendingRoom зберігається,
  // і після онбордингу ефект вище відкриє кімнату. Раніше тут був вічний лоадер.
  if (isInitializing) {
    return <PageLoader />;
  }

  const isDuel = location.pathname.includes("/room/");
  const isOnboarding = location.pathname === "/onboarding";
  // Адмін-панель — на весь екран, без нижнього меню
  const isAdminPanel = location.pathname === "/admin";
  // Урок — повноекранний режим без нижнього меню
  const isLesson = /^\/learning\/[^/]+\/lesson\//.test(location.pathname);

  if (!onboardingCompleted && !isOnboarding)
    return <Navigate to="/onboarding" replace />;
  if (onboardingCompleted && isOnboarding) return <Navigate to="/" replace />;

  return (
    <div className="relative min-h-[100dvh] bg-[var(--bg-app)] text-[var(--text-main)]">
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/onboarding" element={<OnboardingPage />} />
          <Route path="/" element={<HomePage />} />
          <Route path="/settings" element={<SettingsPage />} />

          <Route
            path="/admin"
            element={
              <AdminOnly>
                <AdminPanelPage />
              </AdminOnly>
            }
          />

          <Route path="/learning" element={<LearningHubPage />} />
          {/* Статичний "admin" має пріоритет над :chapterId (slug "admin" зарезервовано на сервері) */}
          <Route
            path="/learning/admin"
            element={
              <AdminOnly>
                <StoryAdminPage />
              </AdminOnly>
            }
          />
          <Route
            path="/learning/admin/:chapterId"
            element={
              <AdminOnly>
                <StoryAdminChapterPage />
              </AdminOnly>
            }
          />
          <Route path="/learning/:chapterId" element={<ChapterMapPage />} />
          <Route
            path="/learning/:chapterId/lesson/:nodeId"
            element={<LessonRunnerPage />}
          />

          <Route path="/leaderboard" element={<LeaderboardPage />} />
          <Route path="/games" element={<GamesPage />} />
          <Route path="/games/:gameId" element={<GameRunnerPage />} />
          <Route path="/profile/:userId" element={<ProfilePage />} />
          <Route path="/friends" element={<FriendsPage />} />
          <Route path="/room/:roomId" element={<DuelRoomPage />} />
        </Routes>
      </Suspense>
      {!isOnboarding && !isDuel && !isLesson && !isAdminPanel && <BottomNav />}
    </div>
  );
};

export const App = () => {
  useEffect(() => {
    const tg = getTelegramWebApp();
    if (tg) {
      tg.ready?.();
      tg.expand?.();
      try {
        if (tg.disableVerticalSwipes) tg.disableVerticalSwipes();
        if (tg.setBackgroundColor) tg.setBackgroundColor("#241812");
        if (tg.setHeaderColor) tg.setHeaderColor("#241812");
      } catch (e) { }
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
    } catch (e) { }
  }, []);

  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
};