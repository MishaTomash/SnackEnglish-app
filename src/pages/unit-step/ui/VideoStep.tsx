import { Card } from "../../../shared/ui/Card";
import { StepLayout } from "../../../shared/ui/StepLayout";
import type { Unit } from "../../../entities/unit/types";

export const VideoStep = ({
  unit,
  onComplete,
}: {
  unit: Unit;
  onComplete: () => void;
}) => {
  // Адаптація для нової (unit.steps.video) та старої (unit.videoUrl) структури
  const unitData = unit as any;
  const videoData = unitData.steps?.video || {};

  const rawUrl = videoData.url || unitData.videoUrl;
  const caption =
    videoData.caption ||
    "Подивіться це короткохвилинне відео для закріплення правильної артикуляції та темпу мови.";

  const getEmbedUrl = (url: string) => url.replace("watch?v=", "embed/");

  if (!rawUrl) {
    return (
      <StepLayout onComplete={onComplete} className="text-center">
        <p className="text-[var(--text-muted)]">
          Відео для цього уроку не знайдено.
        </p>
      </StepLayout>
    );
  }

  return (
    <StepLayout onComplete={onComplete} completeLabel="Я подивився, продовжити">
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
    </StepLayout>
  );
};
