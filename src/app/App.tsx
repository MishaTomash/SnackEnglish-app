import { useEffect } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { initTelegramApp, subscribeToTheme } from "../shared/lib/telegram";
import { HomePage } from "../pages/HomePage";
import { PathPage } from "../pages/PathPage";
import { PracticePage } from "../pages/PracticePage";
import { BottomNav } from "../widgets/BottomNav";

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
      <div className="relative min-h-screen bg-[var(--tg-theme-bg-color,#ffffff)] text-[var(--tg-theme-text-color,#000000)]">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/path" element={<PathPage />} />
          <Route path="/path/:unitId" element={<PathPage />} />
          <Route path="/practice" element={<PracticePage />} />
        </Routes>

        <BottomNav />
      </div>
    </BrowserRouter>
  );
};
