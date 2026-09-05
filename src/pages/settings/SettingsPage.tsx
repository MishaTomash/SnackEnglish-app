import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useUserStore } from "../../store/userStore";
import { useProgressStore } from "../../store/progressStore";
import type { EnglishLevel } from "../../entities/word/types";
import { LevelPlacementTest } from "../../shared/ui/LevelPlacementTest";

import { SettingsList } from "./ui/SettingsList";
import { EditProfile } from "./ui/EditProfile";
import { EditNickname } from "./ui/EditNickname";
import { ConfirmLevel } from "./ui/ConfirmLevel";
import { TestResult } from "./ui/TestResult";

export type SettingsStep =
  | "list"
  | "choice"
  | "test"
  | "result"
  | "edit_profile"
  | "edit_nickname";

export const SettingsPage = () => {
  const navigate = useNavigate();
  const { updateLevel } = useUserStore();
  const { loadUnits } = useProgressStore();

  const [step, setStep] = useState<SettingsStep>("list");
  const [pendingLevel, setPendingLevel] = useState<EnglishLevel | null>(null);
  const [localLoading, setLocalLoading] = useState<EnglishLevel | null>(null);
  const [globalError, setGlobalError] = useState<string | null>(null);

  const processChange = async (newLevel: EnglishLevel) => {
    setStep("list");
    setGlobalError(null);
    setLocalLoading(newLevel);
    try {
      const success = await updateLevel(newLevel);
      if (success) {
        await loadUnits(newLevel);
        navigate("/");
      } else {
        setGlobalError("Не вдалося оновити рівень. Спробуй ще раз.");
      }
    } catch (err) {
      setGlobalError("Помилка з'єднання. Перевір інтернет і спробуй ще раз.");
    } finally {
      setLocalLoading(null);
    }
  };

  if (step === "edit_profile")
    return <EditProfile onBack={() => setStep("list")} />;
  if (step === "edit_nickname")
    return <EditNickname onBack={() => setStep("list")} />;
  if (step === "test") {
    return (
      <LevelPlacementTest
        onFinish={(testedLevel) => {
          setPendingLevel(testedLevel);
          setStep("result");
        }}
        onCancel={() => setStep("list")}
      />
    );
  }
  if (step === "choice") {
    return (
      <ConfirmLevel
        pendingLevel={pendingLevel}
        onConfirm={(lvl) => processChange(lvl)}
        onTest={() => setStep("test")}
        onCancel={() => setStep("list")}
      />
    );
  }
  if (step === "result") {
    return (
      <TestResult
        pendingLevel={pendingLevel}
        onConfirm={(lvl) => processChange(lvl)}
        onCancel={() => setStep("list")}
      />
    );
  }

  return (
    <SettingsList
      error={globalError}
      localLoading={localLoading}
      onNavigate={setStep}
      onSelectLevel={(lvl) => {
        setPendingLevel(lvl);
        setStep("choice");
      }}
    />
  );
};
