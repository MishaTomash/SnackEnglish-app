import { useState } from "react";
import { ArrowLeft, AlertCircle, Trophy } from "lucide-react";
import { Screen } from "../../../shared/ui/Screen";
import { Card } from "../../../shared/ui/Card";
import { Button } from "../../../shared/ui/Button";
import { useUserStore } from "../../../store/userStore";

interface Props {
  onBack: () => void;
}

export const EditNickname = ({ onBack }: Props) => {
  const { isLoading, nickname, updateNickname } = useUserStore();
  const [editNickname, setEditNickname] = useState(nickname || "");
  const [error, setError] = useState<string | null>(null);

  const handleSaveNickname = async () => {
    setError(null);
    if (!editNickname.trim()) {
      setError("Нікнейм не може бути порожнім");
      return;
    }
    const result = await updateNickname(editNickname.trim());
    if (result.success) {
      onBack();
    } else {
      setError(result.error || "Помилка оновлення нікнейму");
    }
  };

  return (
    <Screen className="justify-start p-4 space-y-6 bg-[var(--bg-app)]">
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="p-2 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-main)] active:opacity-70"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-xl font-bold text-[var(--text-main)]">
          Нікнейм для Топу
        </h1>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 text-sm rounded-xl bg-[var(--accent-error)]/10 text-[var(--accent-error)] border border-[var(--accent-error)]/20">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <p>{error}</p>
        </div>
      )}

      <Card className="p-4 space-y-4">
        <div className="p-3 bg-[var(--accent-cta)]/10 rounded-xl border border-[var(--accent-cta)]/20">
          <p className="text-sm text-[var(--text-main)] leading-relaxed">
            Потрібен, щоб брати участь у рейтингу гравців і щотижневих
            розіграшах. <b>Без нікнейму тебе не буде видно в Топі.</b>
          </p>
        </div>

        <div className="space-y-2">
          <input
            type="text"
            value={editNickname}
            onChange={(e) => setEditNickname(e.target.value)}
            placeholder="Введи унікальний нікнейм"
            className="w-full p-3 rounded-xl bg-[var(--bg-app)] border border-[var(--border-color)] text-[var(--text-main)] outline-none focus:border-[var(--accent-cta)]"
          />
        </div>
        <Button
          onClick={handleSaveNickname}
          disabled={isLoading}
          className="w-full mt-2 flex items-center justify-center gap-2"
        >
          {isLoading ? (
            <span className="inline-block w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              <Trophy className="w-4 h-4" /> Зберегти нікнейм
            </>
          )}
        </Button>
      </Card>
    </Screen>
  );
};
