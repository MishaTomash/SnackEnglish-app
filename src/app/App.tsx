import { useEffect } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { SDKProvider } from "@telegram-apps/sdk-react";
import {
  initTelegramApp,
  getUserData,
  subscribeToTheme,
  isTelegramEnvironment,
} from "../shared/lib/telegram";
import { useUserStore } from "../store/userStore";
import { IndexPage } from "../pages/IndexPage";
import { HomePage } from "../pages/HomePage";

export const App = () => {
  const setUser = useUserStore((state) => state.setUser);

  useEffect(() => {
    // 1. Ініціалізація TMA
    initTelegramApp();

    // 2. Перевірка середовища та логування юзера
    const isTg = isTelegramEnvironment();
    console.log("Чи запущено в Telegram:", isTg);

    const tgData = getUserData();
    console.log("Дані користувача (initDataUnsafe):", tgData?.initDataUnsafe);

    if (tgData?.initDataUnsafe?.user) {
      setUser(tgData.initDataUnsafe.user);
    } else {
      // Fallback/Mock для локальної розробки
      setUser({ id: 1, first_name: "Local", last_name: "Dev" });
    }

    // 3. Підписка на тему
    subscribeToTheme((isDark) => {
      if (isDark) {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
    });
  }, [setUser]);

  return (
    <SDKProvider acceptCustomStyles debug>
      <BrowserRouter>
        {/* Базова обгортка з Tailwind класами для підтримки темної теми */}
        <div className="min-h-screen bg-white dark:bg-gray-900 text-black dark:text-white transition-colors duration-200 p-4">
          <Routes>
            <Route path="/" element={<IndexPage />} />
            <Route path="/home" element={<HomePage />} />
          </Routes>
        </div>
      </BrowserRouter>
    </SDKProvider>
  );
};
