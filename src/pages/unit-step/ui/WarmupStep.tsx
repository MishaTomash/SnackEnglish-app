import { Sparkles } from "lucide-react";
import { Card } from "../../../shared/ui/Card";
import { StepLayout } from "../../../shared/ui/StepLayout";
import type { Unit } from "../../../entities/unit/types";

export const WarmupStep = ({
  unit,
  onComplete,
}: {
  unit: Unit;
  onComplete: () => void;
}) => (
  <StepLayout onComplete={onComplete} completeLabel="Почати урок">
    <Card className="text-center p-6 space-y-3">
      <div className="w-14 h-14 bg-[var(--accent-cta)]/10 text-[var(--accent-cta)] rounded-full flex items-center justify-center mx-auto">
        <Sparkles className="w-8 h-8" />
      </div>
      <h2 className="text-xl font-bold text-[var(--text-main)]">
        Готові до нового матеріалу?
      </h2>
      <p className="text-sm text-[var(--text-muted)]">
        У цьому юніті ми зануримось у тему{" "}
        <span className="font-semibold text-[var(--text-main)]">
          «{unit.title}»
        </span>
        . Ви вивчите {unit.wordIds?.length || 0} нових слів та опануєте правило
        «{unit.grammarTopic || unit.grammar?.title || "Граматика"}».
      </p>
    </Card>
  </StepLayout>
);
