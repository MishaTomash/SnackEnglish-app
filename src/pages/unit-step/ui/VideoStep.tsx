// src/pages/unit-step/ui/VideoStep.tsx
import { Card } from "../../../shared/ui/Card";
import { Button } from "../../../shared/ui/Button";
import type { Unit } from "../../../entities/unit/types";

export const VideoStep = ({
  unit,
  onComplete,
}: {
  unit: Unit;
  onComplete: () => void;
}) => {
  // Адаптація для нової (unit.steps.video) та старої (unit.videoUrl) структури
  // Використовуємо 'any' тимчасово, якщо тип Unit ще не оновлено
  const unitData = unit as any;
  const videoData = unitData.steps?.video || {};

  const rawUrl = videoData.url || unitData.videoUrl;
  const caption =
    videoData.caption ||
    "Подивіться це короткохвилинне відео для закріплення правильної артикуляції та темпу мови.";

  const getEmbedUrl = (url: string) => url.replace("watch?v=", "embed/");

  if (!rawUrl) {
    return (
      <div className="space-y-4 my-auto text-center">
        <p className="text-[var(--text-muted)]">
          Відео для цього уроку не знайдено.
        </p>
        <Button onClick={onComplete} variant="primary" className="w-full">
          Продовжити
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4 my-auto">
      <div className="w-full aspect-video rounded-3xl overflow-hidden shadow-md bg-black border border-[var(--border-color)]">
        <iframe
          className="w-full h-full"
          src={getEmbedUrl(rawUrl)}
          title={unit.title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
      <Card className="p-4 text-sm font-medium leading-relaxed text-[var(--text-main)] text-center">
        {caption}
      </Card>
      <Button onClick={onComplete} variant="primary" className="w-full">
        Я подивився, продовжити
      </Button>
    </div>
  );
};
