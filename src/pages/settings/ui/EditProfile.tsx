import { useState, useRef } from "react";
import { ArrowLeft, AlertCircle, Camera, Save } from "lucide-react";
import { Screen } from "../../../shared/ui/Screen";
import { Card } from "../../../shared/ui/Card";
import { Button } from "../../../shared/ui/Button";
import { useUserStore } from "../../../store/userStore";
import { resolveAvatarUrl } from "../constants"; // ДОДАНО ІМПОРТ

interface Props {
  onBack: () => void;
}

export const EditProfile = ({ onBack }: Props) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const {
    isLoading,
    telegramFirstName,
    telegramPhotoUrl,
    customDisplayName,
    customAvatarUrl,
    updateProfile,
  } = useUserStore();

  const [editName, setEditName] = useState(customDisplayName || "");
  const [editPhotoFile, setEditPhotoFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Використовуємо універсальну функцію
  const currentPhotoUrl = resolveAvatarUrl(customAvatarUrl) || telegramPhotoUrl;
  const displayAvatar = previewUrl || currentPhotoUrl;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setEditPhotoFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleSaveProfile = async () => {
    setError(null);
    const success = await updateProfile(editName.trim() || null, editPhotoFile);
    if (success) {
      onBack();
    } else {
      setError("Не вдалося оновити профіль.");
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
          Редагувати профіль
        </h1>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 text-sm rounded-xl bg-[var(--accent-error)]/10 text-[var(--accent-error)] border border-[var(--accent-error)]/20">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <p>{error}</p>
        </div>
      )}

      <Card className="p-4 space-y-6">
        <div className="flex flex-col items-center gap-3">
          <div
            onClick={() => fileInputRef.current?.click()}
            className="relative w-24 h-24 rounded-full bg-[var(--bg-app)] border-2 border-dashed border-[var(--border-color)] flex items-center justify-center cursor-pointer overflow-hidden group"
          >
            {displayAvatar ? (
              <>
                <img
                  src={displayAvatar}
                  alt="Avatar"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <Camera className="w-6 h-6 text-white" />
                </div>
              </>
            ) : (
              <Camera className="w-8 h-8 text-[var(--text-muted)]" />
            )}
          </div>
          <p
            className="text-sm text-[var(--accent-cta)] font-medium cursor-pointer"
            onClick={() => fileInputRef.current?.click()}
          >
            Змінити фото
          </p>
          <input
            type="file"
            accept="image/*"
            className="hidden"
            ref={fileInputRef}
            onChange={handleFileChange}
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-[var(--text-muted)]">
            Ім'я, що відображається
          </label>
          <input
            type="text"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            placeholder={telegramFirstName || "Твоє ім'я"}
            className="w-full p-3 rounded-xl bg-[var(--bg-app)] border border-[var(--border-color)] text-[var(--text-main)] outline-none focus:border-[var(--accent-cta)]"
          />
        </div>

        <Button
          onClick={handleSaveProfile}
          disabled={isLoading}
          className="w-full mt-2 flex items-center justify-center gap-2"
        >
          {isLoading ? (
            <span className="inline-block w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              <Save className="w-4 h-4" /> Зберегти
            </>
          )}
        </Button>
      </Card>
    </Screen>
  );
};
