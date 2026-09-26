// 📁 Файл: SnackEnglish-app/src/pages/settings/ui/SettingsList.tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ChevronRight,
  BarChart2,
  AlertCircle,
  User as UserIcon,
} from "lucide-react";
import { Screen } from "../../../shared/ui/Screen";
import { Card } from "../../../shared/ui/Card";
import { useUserStore } from "../../../store/userStore";
import type { EnglishLevel } from "../../../entities/word/types";
import type { SettingsStep } from "../SettingsPage";
import { LEVELS, resolveAvatarUrl } from "../constants";
import { SupportCard } from "../../../widgets/SupportCard";

interface Props {
  error: string | null;
  localLoading: EnglishLevel | null;
  onNavigate: (step: SettingsStep) => void;
  onSelectLevel: (level: EnglishLevel) => void;
}

export const SettingsList = ({
  error,
  localLoading,
  onNavigate,
  onSelectLevel,
}: Props) => {
  const navigate = useNavigate();
  const [imgError, setImgError] = useState(false);

  const {
    level,
    streak,
    wordsLearnedCount,
    isLoading,
    telegramFirstName,
    telegramPhotoUrl,
    customDisplayName,
    customAvatarUrl,
  } = useUserStore();

  const currentDisplayName =
    customDisplayName || telegramFirstName || "Користувач";
  const currentPhotoUrl = resolveAvatarUrl(customAvatarUrl) || telegramPhotoUrl;

  return (
    <Screen className="justify-start p-4 space-y-6 bg-[var(--bg-app)] pb-20">
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate("/")}
          className="p-2 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-main)] active:opacity-70"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-xl font-bold text-[var(--text-main)]">
          Налаштування
        </h1>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 text-sm rounded-xl bg-[var(--accent-error)]/10 text-[var(--accent-error)] border border-[var(--accent-error)]/20">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <p>{error}</p>
        </div>
      )}

      <Card className="p-4 space-y-4">
        <div className="flex items-center gap-2 text-[var(--text-muted)] mb-2">
          <UserIcon className="w-5 h-5" />
          <h2 className="text-sm font-bold uppercase tracking-wider">
            Профіль
          </h2>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {currentPhotoUrl && !imgError ? (
              <img
                src={currentPhotoUrl}
                alt="Avatar"
                className="w-12 h-12 rounded-full object-cover bg-[var(--bg-app)]"
                onError={() => setImgError(true)}
              />
            ) : (
              <div className="w-12 h-12 rounded-full bg-[var(--bg-app)] flex items-center justify-center text-[var(--text-muted)] border border-[var(--border-color)]">
                <UserIcon className="w-6 h-6" />
              </div>
            )}
            <div>
              <div className="text-[var(--text-main)] font-bold">
                {currentDisplayName}
              </div>
              <button
                onClick={() => onNavigate("edit_profile")}
                className="text-xs text-[var(--accent-cta)] font-medium mt-1"
              >
                Редагувати профіль
              </button>
            </div>
          </div>
        </div>
      </Card>

      <Card className="p-4 space-y-4">
        <div className="flex items-center gap-2 text-[var(--text-muted)] mb-2">
          <BarChart2 className="w-5 h-5" />
          <h2 className="text-sm font-bold uppercase tracking-wider">
            Статистика
          </h2>
        </div>
        <div className="flex justify-between items-center text-sm">
          <span className="text-[var(--text-main)] font-medium">
            Днів поспіль (Streak)
          </span>
          <span className="font-bold text-amber-500">{streak} 🔥</span>
        </div>
        <div className="flex justify-between items-center text-sm">
          <span className="text-[var(--text-main)] font-medium">
            Вивчено слів
          </span>
          <span className="font-bold text-[var(--accent-cta)]">
            {wordsLearnedCount}
          </span>
        </div>
      </Card>

      {/* Підтримка проєкту — видно лише якщо увімкнено в адмінці */}
      <SupportCard place="settings" />

      <div className="space-y-3">
        <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--text-muted)] ml-1">
          Змінити рівень
        </h2>
        {LEVELS.map((lvl) => {
          const isActive = level === lvl.id;
          const isCurrentLoading = localLoading === lvl.id;

          return (
            <button
              key={lvl.id}
              onClick={() => onSelectLevel(lvl.id)}
              disabled={isLoading || localLoading !== null}
              className={`w-full p-4 rounded-2xl text-left border transition-all flex items-center justify-between shadow-sm disabled:opacity-50 ${isActive
                  ? "bg-[var(--accent-cta)] border-[var(--accent-cta-active)] text-[var(--text-accent)]"
                  : "bg-[var(--bg-card)] border-[var(--border-color)] text-[var(--text-main)] hover:bg-[var(--bg-card-elevated)] active:opacity-70"
                }`}
            >
              <div>
                <span className="font-bold text-lg mr-3">{lvl.id}</span>
                <span
                  className={`text-sm ${isActive ? "opacity-90" : "text-[var(--text-muted)]"}`}
                >
                  {lvl.desc}
                </span>
              </div>
              {isCurrentLoading ? (
                <span className="inline-block w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin text-[var(--accent-cta)]" />
              ) : isActive ? (
                <span className="text-xs font-bold uppercase tracking-wide">
                  Поточний
                </span>
              ) : (
                <ChevronRight className="w-5 h-5 text-[var(--text-muted)] opacity-60" />
              )}
            </button>
          );
        })}
      </div>
    </Screen>
  );
};