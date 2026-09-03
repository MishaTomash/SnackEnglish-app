import { Screen } from "../shared/ui/Screen";
import { Card } from "../shared/ui/Card";
import { Button } from "../shared/ui/Button";
import { Badge } from "../shared/ui/Badge";
import { ProgressBar } from "../shared/ui/ProgressBar";

export const HomePage = () => {
  return (
    <Screen>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Головна</h1>
        <Badge>🔥 5 днів</Badge>
      </div>

      <Card className="mb-4">
        <h2 className="text-lg font-semibold mb-2">Прогрес курсу</h2>
        <ProgressBar progress={45} className="mb-2" />
        <p className="text-sm text-[var(--tg-theme-hint-color,#9ca3af)]">
          45% завершено
        </p>
      </Card>

      <div className="mt-auto space-y-3">
        <Button variant="primary">Продовжити навчання</Button>
        <Button variant="secondary">Налаштування</Button>
      </div>
    </Screen>
  );
};
