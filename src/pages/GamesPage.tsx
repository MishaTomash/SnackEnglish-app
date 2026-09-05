import { Link } from "react-router-dom";
import { Gamepad2, Star, Lock } from "lucide-react";
import { Screen } from "../shared/ui/Screen";
import { Card } from "../shared/ui/Card";
import { GAME_REGISTRY } from "../games/registry";

export const GamesPage = () => {
  return (
    <Screen className="justify-start p-4 space-y-6 bg-[var(--bg-app)] pb-24">
      <div className="flex items-center gap-2">
        <Gamepad2 className="w-7 h-7 text-[var(--accent-cta)]" />
        <h1 className="text-2xl font-black text-[var(--text-main)]">
          Ігрова кімната
        </h1>
      </div>

      <div className="space-y-4">
        {GAME_REGISTRY.map((game) => (
          <Card
            key={game.id}
            className="p-4 flex flex-col gap-3 relative overflow-hidden"
          >
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-lg font-bold text-[var(--text-main)]">
                  {game.title}
                </h3>
                <p className="text-sm text-[var(--text-muted)] mt-1 leading-snug">
                  {game.description}
                </p>
              </div>
              {game.status === "coming_soon" && (
                <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider bg-amber-500/10 text-amber-500 border border-amber-500/20 rounded-lg shrink-0 ml-2">
                  Скоро
                </div>
              )}
            </div>

            <div className="flex items-center justify-between mt-1 pt-3 border-t border-[var(--border-color)]">
              <div className="flex items-center gap-1 text-sm font-bold">
                {game.isFree ? (
                  <span className="text-[var(--accent-success)]">
                    Безкоштовно
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-amber-500">
                    <Star className="w-4 h-4 fill-current" /> {game.priceStars}{" "}
                    XTR
                  </span>
                )}
              </div>
              <Link
                to={`/games/${game.id}`}
                className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                  game.status === "coming_soon"
                    ? "bg-[var(--bg-app)] text-[var(--text-muted)] border border-[var(--border-color)] pointer-events-none"
                    : "bg-[var(--accent-cta)] text-white"
                }`}
              >
                {game.status === "coming_soon" ? (
                  <span className="flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5" /> Зачинено
                  </span>
                ) : (
                  "Грати"
                )}
              </Link>
            </div>
          </Card>
        ))}
      </div>
    </Screen>
  );
};
