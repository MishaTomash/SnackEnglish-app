import { Sparkles } from "lucide-react";
import { Card } from "../../../shared/ui/Card";
import { Button } from "../../../shared/ui/Button";
import type { Unit } from "../../../entities/unit/types";

export const WarmupStep = ({
  unit,
  onComplete,
}: {
  unit: Unit;
  onComplete: () => void;
}) => (
  <div className="space-y-4 my-auto">
    <Card className="text-center p-6 space-y-3">
      <div className="w-14 h-14 bg-amber-500/10 text-amber-500 rounded-full flex items-center justify-center mx-auto">
        <Sparkles className="w-8 h-8" />
      </div>
      <h2 className="text-xl font-bold">Готові до нового матеріалу?</h2>
      <p className="text-sm text-slate-500">
        У цьому юніті ми зануримось у тему{" "}
        <span className="font-semibold text-slate-800">«{unit.title}»</span>. Ви
        вивчите {unit.wordIds?.length || 0} нових слів та опануєте правило «
        {unit.grammarTopic}».
      </p>
    </Card>
    <Button onClick={onComplete} variant="primary" className="w-full">
      Почати урок
    </Button>
  </div>
);
