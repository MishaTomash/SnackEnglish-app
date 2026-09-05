import { Suspense } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Screen } from "../shared/ui/Screen";
import { GAME_REGISTRY } from "../games/registry";

export const GameRunnerPage = () => {
  const { gameId } = useParams();
  const navigate = useNavigate();

  const gameDef = GAME_REGISTRY.find((g) => g.id === gameId);

  if (!gameDef) {
    return (
      <Screen className="justify-center items-center bg-[var(--bg-app)]">
        <p className="text-[var(--text-muted)]">Гру не знайдено</p>
        <button
          onClick={() => navigate("/games")}
          className="mt-4 text-[var(--accent-cta)] underline"
        >
          Повернутися
        </button>
      </Screen>
    );
  }

  const GameComponent = gameDef.component;

  return (
    <Screen className="bg-[var(--bg-app)]">
      <div className="p-4 flex items-center gap-3 border-b border-[var(--border-color)] bg-[var(--bg-card)]">
        <button
          onClick={() => navigate("/games")}
          className="p-2 bg-[var(--bg-app)] rounded-xl border border-[var(--border-color)]"
        >
          <ArrowLeft className="w-5 h-5 text-[var(--text-main)]" />
        </button>
        <h1 className="font-bold text-[var(--text-main)]">{gameDef.title}</h1>
      </div>

      <div className="flex-1 overflow-y-auto">
        <Suspense
          fallback={
            <div className="p-8 text-center text-[var(--text-muted)] text-sm">
              Завантаження гри...
            </div>
          }
        >
          {/* Передаємо callback для завершення гри */}
          <GameComponent onFinish={() => navigate("/games")} />
        </Suspense>
      </div>
    </Screen>
  );
};
