import { NavLink } from "react-router-dom";
import { Home, Map, Dumbbell } from "lucide-react";

export const BottomNav = () => {
  const navItems = [
    { path: "/", label: "Головна", icon: Home },
    { path: "/path", label: "Карта", icon: Map },
    { path: "/practice", label: "Практика", icon: Dumbbell },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 h-[calc(65px+env(safe-area-inset-bottom))] bg-[var(--bg-app)] border-t border-[var(--border-color)] flex justify-around items-center pb-[env(safe-area-inset-bottom)] z-50">
      {navItems.map(({ path, label, icon: Icon }) => (
        <NavLink
          key={path}
          to={path}
          className={({ isActive }) =>
            `flex flex-col items-center justify-center w-1/3 space-y-1 transition-colors ${
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
