import { NavLink } from "react-router-dom";
import { Home, Map, Dumbbell } from "lucide-react";

export const BottomNav = () => {
  const navItems = [
    { path: "/", label: "Головна", icon: Home },
    // "/path" тепер веде на PathMapPage (гейміфікована мапа юнітів),
    // тому іконку і підпис змінено з "Урок"/BookOpen на "Карта"/Map.
    { path: "/path", label: "Карта", icon: Map },
    { path: "/practice", label: "Практика", icon: Dumbbell },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 h-[65px] bg-[var(--tg-theme-bg-color,#ffffff)] border-t border-[var(--tg-theme-hint-color,#d1d5db)]/30 flex justify-around items-center pb-[env(safe-area-inset-bottom)] z-50">
      {navItems.map(({ path, label, icon: Icon }) => (
        <NavLink
          key={path}
          to={path}
          className={({ isActive }) =>
            `flex flex-col items-center justify-center w-1/3 space-y-1 transition-colors ${
              isActive
                ? "text-[var(--tg-theme-button-color,#3390ec)]"
                : "text-[var(--tg-theme-hint-color,#9ca3af)]"
            }`
          }
        >
          <Icon size={24} />
          <span className="text-[10px] font-medium">{label}</span>
        </NavLink>
      ))}
    </nav>
  );
};
