import { useCallback, useState } from "react";
import { Mic, AlertCircle, CheckCircle2, RotateCcw } from "lucide-react";
import { Card } from "../../../shared/ui/Card";
import { Button } from "../../../shared/ui/Button";
import { useSpeechRecognition } from "../../../shared/lib/useSpeechRecognition";
import { calculateSimilarity } from "../../../shared/lib/similarity";
import type { Word } from "../../../entities/word/types";

export const SpeakingStep = ({
  words,
  onComplete,
}: {
  words: Word[];
  onComplete: () => void;
}) => {
  const [similarityScore, setSimilarityScore] = useState<number | null>(null);
  const [hasEvaluated, setHasEvaluated] = useState(false);
  const targetSentence =
    words[0]?.exampleSentence ?? "Hello, nice to meet you!";

  const handleSpeechEnd = useCallback(
    (finalTranscript: string) => {
      if (!finalTranscript.trim()) {
        setSimilarityScore(0);
        setHasEvaluated(true);
        return;
      }
      setSimilarityScore(calculateSimilarity(finalTranscript, targetSentence));
      setHasEvaluated(true);
    },
    [targetSentence],
  );

  const {
    isListening,
    transcript,
    isSupported,
    startListening,
    stopListening,
    resetTranscript,
  } = useSpeechRecognition({
    lang: "en-US",
    onEnd: handleSpeechEnd,
  });

  const isPassed = (similarityScore ?? 0) >= 70;

  const handleMicClick = () => {
    if (isListening) stopListening();
    else {
      setHasEvaluated(false);
      setSimilarityScore(null);
      resetTranscript();
      startListening();
    }
  };

  if (!isSupported) {
    return (
      <div className="space-y-4 my-auto">
        <Card className="p-6 text-center space-y-4">
          <AlertCircle className="w-10 h-10 mx-auto text-amber-500" />
          <h3 className="font-bold">Розпізнавання недоступне</h3>
          <p className="text-xs text-slate-500">
            Браузер не підтримує мікрофон. Повторіть фразу подумки.
          </p>
          <div className="p-4 bg-slate-50 rounded-2xl font-bold text-lg">
            "{targetSentence}"
          </div>
        </Card>
        <Button onClick={onComplete} variant="primary" className="w-full">
          Продовжити
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4 my-auto">
      <Card className="p-6 text-center space-y-4">
        <span className="text-xs uppercase font-bold text-slate-400">
          Вимовіть уголос
        </span>
        <p className="text-xl font-bold text-slate-800">"{targetSentence}"</p>

        {transcript && (
          <div className="p-3 bg-slate-50 rounded-2xl text-xs space-y-1">
            <span className="text-slate-400 font-medium">Ви сказали:</span>
            <p className="font-semibold text-slate-700 italic">
              "{transcript}"
            </p>
          </div>
        )}

        <div className="pt-2 flex flex-col items-center gap-3">
          {!isListening && !hasEvaluated && (
            <button
              onClick={handleMicClick}
              className="w-16 h-16 rounded-full bg-blue-500 text-white flex items-center justify-center shadow-lg active:scale-95"
            >
              <Mic className="w-7 h-7" />
            </button>
          )}
          {isListening && (
            <button
              onClick={handleMicClick}
              className="w-16 h-16 rounded-full bg-red-500 text-white flex items-center justify-center animate-pulse shadow-lg"
            >
              <Mic className="w-7 h-7" />
            </button>
          )}

          {!isListening && hasEvaluated && (
            <div
              className={`w-full p-4 border rounded-2xl ${isPassed ? "bg-emerald-50 border-emerald-200" : "bg-amber-50 border-amber-200"}`}
            >
              <div
                className={`flex items-center justify-center gap-1.5 font-bold ${isPassed ? "text-emerald-600" : "text-amber-700"}`}
              >
                {isPassed ? (
                  <CheckCircle2 className="w-5 h-5" />
                ) : (
                  <RotateCcw className="w-5 h-5" />
                )}
                <span>Збіг: {similarityScore}%</span>
              </div>
              {!isPassed && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleMicClick}
                  className="w-full mt-3"
                >
                  Спробувати ще раз
                </Button>
              )}
            </div>
          )}
        </div>
      </Card>
      <Button
        onClick={onComplete}
        variant="primary"
        className="w-full"
        disabled={!isPassed}
      >
        Продовжити
      </Button>
    </div>
  );
};
