import { useState } from "react";
import { Button } from "../../../shared/ui/Button";
import type { Word } from "../../../entities/word/types";
import { SpeechPracticeBlock } from "../../../shared/lib/SpeechPracticeBlock";

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
    <div className="space-y-4 my-auto">
      <SpeechPracticeBlock
        targetText={targetSentence}
        onStatusChange={setCanProceed}
        threshold={70}
        maxAttempts={Infinity} // Speaking лишаємо безлімітним, або можеш поставити 3
      />

      <Button
        onClick={onComplete}
        variant="primary"
        className="w-full"
        disabled={!canProceed}
      >
        Продовжити
      </Button>
    </div>
  );
};
