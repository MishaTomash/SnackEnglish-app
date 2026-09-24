import { Screen } from "../../shared/ui/Screen";
import { Card } from "../../shared/ui/Card";
import { CookieMascot } from "../../shared/ui/CookieMascot";

export const LearningHubPage = () => {
  return (
    <Screen className="justify-center items-center p-4 space-y-6 text-center h-[85vh]">
      <div className="animate-pulse">
        <CookieMascot state="thinking" size={140} />
      </div>
      <Card className="p-6 border-dashed border-[var(--accent-cta)]/40 bg-[var(--accent-cta)]/5">
        <h1 className="text-xl font-black text-[var(--text-main)] mb-3">
          Скоро тут буде навчання
        </h1>
        <p className="text-sm text-[var(--text-muted)] leading-relaxed">
          Ми активно працюємо над новою, ще крутішою системою вивчення
          англійської. Залишайтеся з нами, оновлення вже зовсім близько! 🚀
        </p>
      </Card>
    </Screen>
  );
};
