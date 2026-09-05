import { Card } from "../../../shared/ui/Card";
import { Button } from "../../../shared/ui/Button";
import { Badge } from "../../../shared/ui/Badge";
import type { Unit } from "../../../entities/unit/types";

export const GrammarStep = ({
  unit,
  onComplete,
}: {
  unit: Unit;
  onComplete: () => void;
}) => (
  <div className="space-y-4 my-auto">
    <Card className="p-5 space-y-4">
      <Badge className="text-xs">{unit.grammarTopic}</Badge>
      <div className="text-base font-medium leading-relaxed">
        {unit.grammarExplanation}
      </div>
      <div className="space-y-2 pt-2 border-t border-slate-200">
        <span className="text-xs font-bold text-slate-400 uppercase">
          Приклади речень:
        </span>
        <div className="p-3 bg-slate-50 rounded-2xl space-y-1 text-sm text-slate-700">
          <p>
            • I <span className="font-bold underline text-blue-600">am</span>{" "}
            from Ukraine.
          </p>
          <p>
            • She <span className="font-bold underline text-blue-600">is</span>{" "}
            a great student.
          </p>
          <p>
            • They{" "}
            <span className="font-bold underline text-blue-600">are</span> our
            best friends.
          </p>
        </div>
      </div>
    </Card>
    <Button onClick={onComplete} variant="primary" className="w-full">
      Зрозуміло, продовжити
    </Button>
  </div>
);
