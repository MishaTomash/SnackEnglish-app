import { Screen } from "../shared/ui/Screen";
import { Button } from "../shared/ui/Button";

export const PracticePage = () => {
  return (
    <Screen className="justify-center items-center">
      <h1 className="text-2xl font-bold mb-4">Практика</h1>
      <p className="text-center text-[var(--tg-theme-hint-color,#9ca3af)] mb-8">
        Тренування слів та граматики.
      </p>
      <Button variant="danger">Почати хардкор-тест</Button>
    </Screen>
  );
};
