// 📁 Файл: SnackEnglish-app/src/pages/admin/AdminPanelPage.tsx
import type { FC } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, AudioLines, BarChart3, BookOpen, CreditCard, Flag, Megaphone, Server, SlidersHorizontal, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { DashboardTab } from "../../features/admin-panel/ui/DashboardTab";
import { UsersTab } from "../../features/admin-panel/ui/UsersTab";
import { BroadcastTab } from "../../features/admin-panel/ui/BroadcastTab";
import { PaymentsTab } from "../../features/admin-panel/ui/PaymentsTab";
import { GiveawayTab } from "../../features/admin-panel/ui/GiveawayTab";
import { ContentTab } from "../../features/admin-panel/ui/ContentTab";
import { SystemTab } from "../../features/admin-panel/ui/SystemTab";
import { SettingsTab } from "../../features/admin-panel/ui/SettingsTab";
import { TtsTab } from "../../features/admin-panel/ui/TtsTab";

type TabId = "dashboard" | "users" | "broadcast" | "payments" | "giveaway" | "content" | "tts" | "settings" | "system";

const TABS: { id: TabId; label: string; icon: LucideIcon }[] = [
  { id: "dashboard", label: "Огляд", icon: BarChart3 },
  { id: "users", label: "Юзери", icon: Users },
  { id: "broadcast", label: "Розсилка", icon: Megaphone },
  { id: "payments", label: "Оплати", icon: CreditCard },
  { id: "giveaway", label: "Змагання", icon: Flag },
  { id: "content", label: "Контент", icon: BookOpen },
  { id: "tts", label: "Озвучка", icon: AudioLines },
  { id: "settings", label: "Налаштування", icon: SlidersHorizontal },
  { id: "system", label: "Система", icon: Server },
];

const isTabId = (value: string | null): value is TabId => TABS.some((t) => t.id === value);

/**
 * Адмін-панель. Доступ — лише для VITE_ADMIN_ID (AdminOnly у App.tsx),
 * а справжній захист — на сервері (adminOnly на всіх /api/admin/*).
 * Активна вкладка зберігається в ?tab=, тож повернення "Назад" відкриває ту саму вкладку.
 */
export const AdminPanelPage: FC = () => {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const tabParam = params.get("tab");
  const tab: TabId = isTabId(tabParam) ? tabParam : "dashboard";

  const openTab = (id: TabId) => setParams({ tab: id }, { replace: true });

  return (
    <div className="min-h-[100dvh] bg-[var(--bg-app)] text-[var(--text-main)]">
      <header className="sticky top-0 z-40 border-b border-[var(--border-color)] bg-[var(--bg-app)]/95 pt-[env(safe-area-inset-top)] backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center gap-3 px-4 py-3">
          <button
            type="button"
            onClick={() => navigate("/")}
            className="rounded-full p-2 text-[var(--text-muted)] hover:bg-[var(--bg-card)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-cta)]"
            aria-label="На головну"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-xl font-black">Адмін-панель</h1>
        </div>
        <nav className="mx-auto max-w-4xl overflow-x-auto px-2 pb-2" aria-label="Розділи адмін-панелі">
          <ul className="flex min-w-max gap-1" role="tablist">
            {TABS.map(({ id, label, icon: Icon }) => (
              <li key={id}>
                <button
                  type="button"
                  role="tab"
                  aria-selected={tab === id}
                  onClick={() => openTab(id)}
                  className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-bold transition-colors ${tab === id
                      ? "bg-[var(--accent-cta)] text-[var(--text-accent)]"
                      : "text-[var(--text-muted)] hover:bg-[var(--bg-card)] hover:text-[var(--text-main)]"
                    }`}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  {label}
                </button>
              </li>
            ))}
          </ul>
        </nav>
      </header>

      <main className="mx-auto max-w-4xl px-4 pb-[calc(env(safe-area-inset-bottom)+32px)] pt-4" role="tabpanel">
        {tab === "dashboard" && <DashboardTab onOpenPayments={() => openTab("payments")} />}
        {tab === "users" && <UsersTab />}
        {tab === "broadcast" && <BroadcastTab />}
        {tab === "payments" && <PaymentsTab />}
        {tab === "giveaway" && <GiveawayTab />}
        {tab === "content" && <ContentTab />}
        {tab === "tts" && <TtsTab />}
        {tab === "settings" && <SettingsTab />}
        {tab === "system" && <SystemTab />}
      </main>
    </div>
  );
};