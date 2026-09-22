import { useState } from "react";
import { X, Camera, Send } from "lucide-react";
import { apiClient } from "../api/apiClient";

interface Props {
  onClose: () => void;
}

export const FeedbackModal = ({ onClose }: Props) => {
  const [text, setText] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);
  const [isSending, setIsSending] = useState(false);

  const handleAddPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || photos.length >= 3) return;
    setPhotos((prev) => [...prev, file]);
    e.target.value = "";
  };

  const handleRemovePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!text.trim()) return;
    setIsSending(true);
    try {
      const formData = new FormData();
      formData.append("text", text.trim());
      photos.forEach((photo) => formData.append("photos", photo));

      await apiClient.post("/feedback", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      onClose();
    } catch (error) {
      console.error("Feedback send failed:", error);
      alert("Не вдалося надіслати. Спробуй ще раз.");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-[var(--bg-card)] rounded-t-3xl p-4 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="font-black text-[var(--text-main)]">
            Повідомити про проблему
          </h2>
          <button onClick={onClose} className="p-1 text-[var(--text-muted)]">
            <X className="w-5 h-5" />
          </button>
        </div>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Що сталося? Опишіть проблему або пропозицію..."
          rows={4}
          className="w-full p-3 rounded-xl bg-[var(--bg-app)] border border-[var(--border-color)] text-[var(--text-main)] text-sm resize-none focus:outline-none focus:border-[var(--accent-cta)]"
        />

        {photos.length > 0 && (
          <div className="flex gap-2">
            {photos.map((photo, index) => (
              <div key={index} className="relative w-16 h-16">
                <img
                  src={URL.createObjectURL(photo)}
                  alt=""
                  className="w-full h-full object-cover rounded-lg"
                />
                <button
                  onClick={() => handleRemovePhoto(index)}
                  className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}

        <label className="w-full py-2.5 rounded-xl border border-dashed border-[var(--accent-cta)] text-[var(--accent-cta)] font-bold text-sm flex items-center justify-center gap-2 cursor-pointer">
          <Camera className="w-4 h-4" />
          Додати фото ({photos.length}/3)
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleAddPhoto}
            disabled={photos.length >= 3}
          />
        </label>

        <button
          onClick={handleSubmit}
          disabled={isSending || !text.trim()}
          className="w-full py-3 rounded-xl bg-[var(--accent-cta)] text-white font-bold flex items-center justify-center gap-2 disabled:opacity-50"
        >
          <Send className="w-4 h-4" />
          {isSending ? "Надсилання..." : "Надіслати"}
        </button>
      </div>
    </div>
  );
};
