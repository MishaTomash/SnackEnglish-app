import { Screen } from "../shared/ui/Screen";
import { Card } from "../shared/ui/Card";

export const PathPage = () => {
  return (
    <Screen>
      <h1 className="text-2xl font-bold mb-6">Ваш шлях</h1>
      <Card>
        <p className="text-center text-[var(--tg-theme-hint-color,#9ca3af)] py-10">
          Тут буде карта уроків...
        </p>
      </Card>
    </Screen>
  );
};
