import { Card } from "../../../shared/ui/Card";
import { Button } from "../../../shared/ui/Button";
import { Badge } from "../../../shared/ui/Badge";
import type { Unit } from "../../../entities/unit/types";

// Допоміжна функція для рендеру підсвітки
const renderWithHighlight = (text: string) => {
  if (!text) return null;
  const parts = text.split(/\*\*(.*?)\*\*/g);

  return parts.map((part, index) =>
    index % 2 === 1 ? (
      <span
        key={index}
        className="font-bold text-[var(--tg-theme-button-color)]"
      >
        {part}
      </span>
    ) : (
      part
    ),
  );
};

export const GrammarStep = ({
  unit,
  onComplete,
}: {
  unit: Unit;
  onComplete: () => void;
}) => {
  const title = unit.grammar?.title || unit.grammarTopic;
  const explanation = unit.grammar?.explanation || unit.grammarExplanation;
  const examples = unit.grammar?.examples || [];

  const hasContent = !!title || !!explanation;

  return (
    <div className="space-y-4 my-auto">
      <Card className="p-5 space-y-4">
        {hasContent ? (
          <>
            {title && (
              <Badge className="text-xs bg-[var(--tg-theme-button-color)] text-[var(--tg-theme-button-text-color)]">
                {title}
              </Badge>
            )}

            {explanation && (
              <div className="text-base font-medium leading-relaxed text-[var(--tg-theme-text-color)]">
                {explanation}
              </div>
            )}

            {examples.length > 0 && (
              <div className="space-y-2 pt-3 border-t border-[var(--tg-theme-hint-color)]/20">
                <span className="text-xs font-bold text-[var(--tg-theme-hint-color)] uppercase">
                  Приклади речень:
                </span>
                <div className="p-3 bg-[var(--tg-theme-secondary-bg-color)] rounded-2xl space-y-2 text-sm text-[var(--tg-theme-text-color)]">
                  {examples.map((ex: any, idx: number) => (
                    <div key={idx} className="space-y-0.5">
                      <p className="font-semibold">
                        • {renderWithHighlight(ex.en)}
                      </p>
                      <p className="text-xs text-[var(--tg-theme-hint-color)] pl-3">
                        {renderWithHighlight(ex.ua)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-6 space-y-2">
            <span className="text-3xl">📝</span>
            <p className="text-sm text-[var(--tg-theme-hint-color)] font-medium">
              Правило ще не додано.
            </p>
          </div>
        )}
      </Card>

      <Button onClick={onComplete} variant="primary" className="w-full">
        Зрозуміло, продовжити
      </Button>
    </div>
  );
};
