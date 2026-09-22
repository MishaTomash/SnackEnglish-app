import { useState } from "react";
import { X, Camera, Send, AlertCircle } from "lucide-react";
import { apiClient } from "../api/apiClient";
import { CookieMascot } from "./CookieMascot";

interface Props {
  onClose: () => void;
}

const MAX_PHOTOS = 3;

export const FeedbackModal = ({ onClose }: Props) => {
  const [text, setText] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAddPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setPhotos((prev) => [...prev, ...files].slice(0, MAX_PHOTOS));
    e.target.value = "";
  };

  const handleRemovePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!text.trim() || isSending) return;
    setIsSending(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("text", text.trim());
      photos.forEach((photo) => formData.append("photos", photo));

      await apiClient.post("/feedback", formData);
      onClose();
    } catch (err) {
      console.error("Feedback send failed:", err);
      setError("Не вдалося надіслати. Спробуй ще раз.");
    } finally {
      setIsSending(false);
    }
  };

  const canSend = text.trim().length > 0 && !isSending;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm h-[100dvh]"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-[var(--bg-card)] rounded-t-3xl flex flex-col max-h-[85dvh] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1 rounded-full bg-[var(--border-color)]" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-1 pb-3 border-b border-[var(--border-color)] shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-full bg-[var(--accent-cta)]/10 flex items-center justify-center shrink-0">
              <CookieMascot state="happy" size={28} />
            </div>
            <div className="min-w-0">
              <h2 className="font-black text-[var(--text-main)] text-sm leading-tight truncate">
                Повідомити про проблему
              </h2>
              <p className="text-[10px] text-[var(--text-muted)] font-medium leading-tight">
                Піде напряму адміністратору
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Закрити"
            className="p-1.5 rounded-full text-[var(--text-muted)] active:opacity-60 shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-3">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Що сталося? Опиши проблему або ідею…"
            rows={5}
            maxLength={2000}
            className="w-full p-3 rounded-2xl bg-[var(--bg-app)] border border-[var(--border-color)] text-[var(--text-main)] text-sm resize-none focus:outline-none focus:border-[var(--accent-cta)] transition-colors"
          />

          {photos.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              {photos.map((photo, index) => (
                <div key={index} className="relative w-16 h-16">
                  <img
                    src={URL.createObjectURL(photo)}
                    alt=""
                    className="w-full h-full object-cover rounded-xl border border-[var(--border-color)]"
                  />
                  <button
                    onClick={() => handleRemovePhoto(index)}
                    aria-label="Прибрати фото"
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 text-white text-xs font-bold flex items-center justify-center border-2 border-[var(--bg-card)]"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          <label
            className={`w-full py-3 rounded-2xl border border-dashed flex items-center justify-center gap-2 text-sm font-bold transition-colors ${
              photos.length >= MAX_PHOTOS
                ? "border-[var(--border-color)] text-[var(--text-muted)] cursor-not-allowed opacity-60"
                : "border-[var(--accent-cta)] text-[var(--accent-cta)] cursor-pointer active:opacity-70"
            }`}
          >
            <Camera className="w-4 h-4" />
            {photos.length >= MAX_PHOTOS
              ? "Максимум фото"
              : `Додати фото (${photos.length}/${MAX_PHOTOS})`}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAddPhoto}
              disabled={photos.length >= MAX_PHOTOS}
            />
          </label>

          {error && (
            <div className="flex items-center gap-2 text-xs text-red-500 font-medium bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Sticky footer — кнопка завжди видима */}
        <div
          className="px-5 pt-3 border-t border-[var(--border-color)] bg-[var(--bg-card)] shrink-0"
          style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
        >
          <button
            onClick={handleSubmit}
            disabled={!canSend}
            className="w-full py-3.5 rounded-2xl bg-[var(--accent-cta)] text-white font-black text-sm flex items-center justify-center gap-2 shadow-lg active:scale-[0.98] transition-transform disabled:opacity-40 disabled:active:scale-100"
          >
            <Send className="w-4 h-4" />
            {isSending ? "Надсилання…" : "Надіслати"}
          </button>
        </div>
      </div>
    </div>
  );
};
