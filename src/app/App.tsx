import { useEffect } from "react";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { initTelegramApp, subscribeToTheme } from "../shared/lib/telegram";
import { HomePage } from "../pages/HomePage";
import { UnitPathPage } from "../pages/UnitPathPage";
import { UnitStepPage } from "../pages/UnitStepPage";
import { PracticePage } from "../pages/PracticePage";
import { BottomNav } from "../widgets/BottomNav";

const AppContent = () => {
  const location = useLocation();
  // Приховуємо нижній бар під час проходження окремого кроку для фокусу
  const isInsideStep = location.pathname.includes("/step/");

  return (
    <div className="relative min-h-screen bg-[var(--tg-theme-bg-color,#ffffff)] text-[var(--tg-theme-text-color,#000000)]">
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/path" element={<UnitPathPage />} />
        <Route path="/path/:unitId" element={<UnitPathPage />} />
        <Route path="/unit/:unitId/step/:stepType" element={<UnitStepPage />} />
        <Route path="/practice" element={<PracticePage />} />
      </Routes>

      {!isInsideStep && <BottomNav />}
    </div>
  );
};

export const App = () => {
  useEffect(() => {
    initTelegramApp();

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
