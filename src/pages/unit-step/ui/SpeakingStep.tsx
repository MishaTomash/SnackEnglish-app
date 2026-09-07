// src/pages/unit-step/ui/SpeakingStep.tsx
import { useState } from "react";
import { SpeechPracticeBlock } from "../../../shared/lib/SpeechPracticeBlock";
import { StepLayout } from "../../../shared/ui/StepLayout";
import type { Word } from "../../../entities/word/types";

export const SpeakingStep = ({
  words,
  onComplete,
}: {
  words: Word[];
  onComplete: () => void;
}) => {
  const [canProceed, setCanProceed] = useState(false);
  const targetSentence =
    words[0]?.exampleSentence ?? "Hello, nice to meet you!";

  return (
    <StepLayout onComplete={onComplete} isCompleteDisabled={!canProceed}>
      <SpeechPracticeBlock
        targetText={targetSentence}
        onStatusChange={setCanProceed}
        threshold={70}
        maxAttempts={Infinity}
      />
    </StepLayout>
  );
};
