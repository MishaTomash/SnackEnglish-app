import { Construction } from "lucide-react";
import { Screen } from "../shared/ui/Screen";
import { Card } from "../shared/ui/Card";

export const PathPage = () => {
  return (
    <Screen className="justify-center items-center">
      <Card className="max-w-sm w-full text-center p-8 space-y-3">
        <div className="w-14 h-14 mx-auto rounded-full bg-[var(--accent-cta)]/10 text-[var(--accent-cta)] flex items-center justify-center">
          <Construction className="w-7 h-7" />
        </div>
        <h1 className="text-xl font-bold text-[var(--text-main)]">
          Карта уроків
        </h1>
        <p className="text-sm text-[var(--text-muted)]">
          Розділ у розробці. Повертайся пізніше!
        </p>
      </Card>
    </Screen>
  );
};
