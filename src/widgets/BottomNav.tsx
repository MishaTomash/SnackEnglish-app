import { NavLink } from "react-router-dom";
import { Home, GraduationCap, Dumbbell, Trophy, Gamepad2 } from "lucide-react";

export const BottomNav = () => {
  const navItems = [
    { path: "/leaderboard", label: "Топ", icon: Trophy },
    { path: "/games", label: "Ігри", icon: Gamepad2 },
    { path: "/", label: "Головна", icon: Home },
    { path: "/learning", label: "Навчання", icon: GraduationCap },
    { path: "/practice", label: "Практика", icon: Dumbbell },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 h-[calc(65px+env(safe-area-inset-bottom))] bg-[var(--bg-app)] border-t border-[var(--border-color)] flex justify-around items-center pb-[env(safe-area-inset-bottom)] z-50">
      {navItems.map(({ path, label, icon: Icon }) => (
        <NavLink
          key={path}
          to={path}
          className={({ isActive }) =>
            `flex flex-col items-center justify-center w-1/5 space-y-1 transition-colors ${
              isActive ? "text-[var(--accent-cta)]" : "text-[var(--text-muted)]"
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
