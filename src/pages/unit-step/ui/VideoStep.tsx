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
  const getEmbedUrl = (url: string) => url.replace("watch?v=", "embed/");

  return (
    <div className="space-y-4 my-auto">
      <div className="w-full aspect-video rounded-3xl overflow-hidden shadow-md bg-black border border-[var(--border-color)]">
        <iframe
          className="w-full h-full"
          src={getEmbedUrl(unit.videoUrl)}
          title={unit.title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
      <Card className="p-4 text-xs text-[var(--text-muted)] text-center">
        Подивіться це короткохвилинне відео для закріплення правильної
        артикуляції та темпу мови.
      </Card>
      <Button onClick={onComplete} variant="primary" className="w-full">
        Я подивився, продовжити
      </Button>
    </div>
  );
};
