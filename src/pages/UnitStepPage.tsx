import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Volume2,
  CheckCircle2,
  XCircle,
  Trophy,
  RotateCcw,
  Sparkles,
  ChevronRight,
  Mic,
  AlertCircle,
  MessageSquare,
} from "lucide-react";
import { Screen } from "../shared/ui/Screen";
import { Card } from "../shared/ui/Card";
import { Button } from "../shared/ui/Button";
import { Badge } from "../shared/ui/Badge";
import { ProgressBar } from "../shared/ui/ProgressBar";
import { CookieMascot } from "../shared/ui/CookieMascot";
import { useProgressStore } from "../store/progressStore";
import { useUserStore } from "../store/userStore";
import { getWordsByIds } from "../entities/word/api";
import type { Word } from "../entities/word/types";
import type { UnitStepType } from "../entities/unit/types";
import { useSpeechRecognition } from "../shared/lib/useSpeechRecognition";
import { calculateSimilarity } from "../shared/lib/similarity";

interface ChatMessage {
  id: string;
  speaker: "bot" | "user";
  text: string;
}

export const UnitStepPage = () => {
  const { unitId, stepType } = useParams<{
    unitId: string;
    stepType: UnitStepType;
  }>();
  const navigate = useNavigate();

  const { units, completeStep } = useProgressStore();
  const incrementWordsLearned = useUserStore(
    (state) => state.incrementWordsLearned,
  );

  const unit = units.find((u) => u.id === unitId);
  const [words, setWords] = useState<Word[]>([]);
  const [isLoadingWords, setIsLoadingWords] = useState(true);

  // Стан фіналу юніта
  const [isUnitFinishedModalOpen, setIsUnitFinishedModalOpen] = useState(false);

  // Стан для vocabulary
  const [vocabIndex, setVocabIndex] = useState(0);

  // Стан для reading
  const [showReadingTranslation, setShowReadingTranslation] = useState(false);
  const [readingAnswer, setReadingAnswer] = useState<number | null>(null);

  // Стан для speaking
  const [similarityScore, setSimilarityScore] = useState<number | null>(null);
  const [hasEvaluated, setHasEvaluated] = useState(false);

  // Стан для test
  const [testQuestionIdx, setTestQuestionIdx] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<number[]>([]);
  const [isTestFinished, setIsTestFinished] = useState(false);

  // Стан для roleplay
  const [dialogueStepIndex, setDialogueStepIndex] = useState(0);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [roleplayHint, setRoleplayHint] = useState<string | null>(null);
  const [isRoleplayFinished, setIsRoleplayFinished] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  const scenario = unit?.roleplayScenario;

  // Ініціалізація та просування діалогу бота
  useEffect(() => {
    if (stepType !== "roleplay" || !scenario) return;

    const currentItem = scenario.dialogue[dialogueStepIndex];
    if (!currentItem) {
      setIsRoleplayFinished(true);
      return;
    }

    if (currentItem.speaker === "bot") {
      const timer = setTimeout(() => {
        setChatHistory((prev) => [
          ...prev,
          {
            id: `msg-${dialogueStepIndex}-${Date.now()}`,
            speaker: "bot",
            text: currentItem.text,
          },
        ]);

        if (dialogueStepIndex === scenario.dialogue.length - 1) {
          setIsRoleplayFinished(true);
        } else {
          setDialogueStepIndex((prev) => prev + 1);
        }
      }, 400);

      return () => clearTimeout(timer);
    }
  }, [stepType, dialogueStepIndex, scenario]);

  // Автоскрол чату
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory, roleplayHint]);

  const targetSentence = words[0]?.exampleSentence ?? "Hello, nice to meet you!";[cite: 1]

  const handleSpeechEnd = useCallback(
    (finalTranscript: string) => {
      if (!finalTranscript.trim()) {
        setSimilarityScore(0);
        setHasEvaluated(true);
        return;
      }
      const score = calculateSimilarity(finalTranscript, targetSentence);
      setSimilarityScore(score);
      setHasEvaluated(true);
    },
    [targetSentence]
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

  useEffect(() => {
    if (unit?.wordIds) {
      getWordsByIds(unit.wordIds).then((res) => {
        setWords(res);
        setIsLoadingWords(false);
      });
    }
  }, [unit?.wordIds]);

  if (!unit || !stepType) {
    return (
      <Screen className="justify-center items-center">
        <p>Дані уроку не знайдено</p>
        <Button onClick={() => navigate("/")} className="mt-4">
          На головну
        </Button>
      </Screen>
    );
  }

  const handleStepCompletion = () => {
    completeStep(unit.id, stepType);
    if (stepType === "vocabulary") {
      incrementWordsLearned(words.length);
    }

    if (stepType === "test") {
      setIsUnitFinishedModalOpen(true);
    } else {
      navigate(`/path/${unit.id}`);
    }
  };

  // 1. КРОК: РОЗІГРІВ (WARMUP)
  const renderWarmup = () => (
    <div className="space-y-4 my-auto">
      <Card className="text-center p-6 space-y-3">
        <div className="w-14 h-14 bg-amber-500/10 text-amber-500 rounded-full flex items-center justify-center mx-auto">
          <Sparkles className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold">Готові до нового матеріалу?</h2>
        <p className="text-sm text-[var(--tg-theme-hint-color,#8e8e93)]">
          У цьому юніті ми зануримось у тему{" "}
          <span className="font-semibold text-[var(--tg-theme-text-color,#000000)]">
            «{unit.title}»
          </span>
          . Ви вивчите {unit.wordIds.length} нових слів та опануєте правило «
          {unit.grammarTopic}».
        </p>
      </Card>
      <Button onClick={handleStepCompletion} variant="primary">
        Почати урок
      </Button>
    </div>
  );

  // 2. КРОК: СЛОВНИЧОК (VOCABULARY)
  const renderVocabulary = () => {
    if (isLoadingWords || words.length === 0) {
      return (
        <div className="text-center py-20 text-sm">Завантаження слів...</div>
      );
    }

    const word = words[vocabIndex];
    const isLastWord = vocabIndex === words.length - 1;

    return (
      <div className="space-y-4 my-auto">
        <div className="flex justify-between items-center text-xs font-semibold text-[var(--tg-theme-hint-color,#8e8e93)]">
          <span>
            Слово {vocabIndex + 1} з {words.length}
          </span>
          <span>{Math.round(((vocabIndex + 1) / words.length) * 100)}%</span>
        </div>
        <ProgressBar progress={((vocabIndex + 1) / words.length) * 100} />

        <Card className="p-6 text-center space-y-4 min-h-[260px] flex flex-col justify-center">
          <div className="flex items-center justify-center gap-2">
            <span className="text-3xl font-extrabold">{word.text}</span>
            <Volume2 className="w-5 h-5 text-primary cursor-pointer" />
          </div>
          <span className="text-sm text-cookieText-muted font-mono">
            {word.transcription}
          </span>
          <div className="text-xl font-semibold text-primary">
            {word.translation}
          </div>

          <div className="mt-4 pt-4 border-t border-card-border text-left text-sm space-y-1 bg-amber-50/50 dark:bg-amber-950/20 p-3 rounded-2xl">
            <p className="font-medium">"{word.exampleSentence}"</p>
            <p className="text-xs text-cookieText-muted">
              {word.exampleTranslation}
            </p>
          </div>
        </Card>

        <div className="flex gap-2">
          {vocabIndex > 0 && (
            <Button
              variant="secondary"
              onClick={() => setVocabIndex((prev) => prev - 1)}
              className="w-1/3"
            >
              Назад
            </Button>
          )}
          <Button
            variant="primary"
            onClick={() => {
              if (isLastWord) {
                handleStepCompletion();
              } else {
                setVocabIndex((prev) => prev + 1);
              }
            }}
          >
            {isLastWord ? "Завершити словничок" : "Далі"}
          </Button>
        </div>
      </div>
    );
  };

  // 3. КРОК: ГРАМАТИКА (GRAMMAR)
  const renderGrammar = () => (
    <div className="space-y-4 my-auto">
      <Card className="p-5 space-y-4">
        <Badge className="text-xs">{unit.grammarTopic}</Badge>
        <div className="text-base font-medium leading-relaxed">
          {unit.grammarExplanation}
        </div>

        <div className="space-y-2 pt-2 border-t border-card-border">
          <span className="text-xs font-bold text-cookieText-muted uppercase">
            Приклади речень:
          </span>
          <div className="p-3 bg-secondary rounded-2xl space-y-1 text-sm">
            <p>
              • I <span className="font-bold underline text-primary">am</span> from Ukraine.
            </p>
            <p>
              • She <span className="font-bold underline text-primary">is</span> a great student.
            </p>
            <p>
              • They <span className="font-bold underline text-primary">are</span> our best friends.
            </p>
          </div>
        </div>
      </Card>
      <Button onClick={handleStepCompletion} variant="primary">
        Зрозуміло, продовжити
      </Button>
    </div>
  );

  // 4. КРОК: ВІДЕОУРОК (VIDEO)
  const getEmbedUrl = (url: string) => url.replace("watch?v=", "embed/");

  const renderVideo = () => (
    <div className="space-y-4 my-auto">
      <div className="w-full aspect-video rounded-3xl overflow-hidden shadow-md bg-black">
        <iframe
          className="w-full h-full"
          src={getEmbedUrl(unit.videoUrl)}
          title={unit.title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
      <Card className="p-4 text-xs text-cookieText-muted">
        Подивіться це короткохвилинне відео для закріплення правильної артикуляції та темпу мови.
      </Card>
      <Button onClick={handleStepCompletion} variant="primary">
        Я подивився, продовжити
      </Button>
    </div>
  );

  // 5. КРОК: ЧИТАННЯ (READING)
  const renderReading = () => (
    <div className="space-y-4 my-auto">
      <Card className="p-5 space-y-4">
        <h3 className="font-bold text-base">Прочитайте текст:</h3>
        <p className="text-base leading-relaxed tracking-wide font-normal">
          {unit.readingText}
        </p>

        {showReadingTranslation && (
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 rounded-2xl text-sm leading-relaxed">
            {unit.readingTranslation}
          </div>
        )}

        <Button
          variant="secondary"
          onClick={() => setShowReadingTranslation((prev) => !prev)}
          className="py-2 text-xs"
        >
          {showReadingTranslation ? "Сховати переклад" : "Показати переклад"}
        </Button>
      </Card>

      <Card className="p-4 space-y-3">
        <span className="text-xs font-semibold text-cookieText-muted">
          Запитання на розуміння:
        </span>
        <p className="text-sm font-medium">Is Anna from Ukraine?</p>
        <div className="grid grid-cols-2 gap-2">
          {["Yes, she is", "No, she is not"].map((opt, i) => (
            <button
              key={opt}
              onClick={() => setReadingAnswer(i)}
              className={`py-2 px-3 text-xs font-bold rounded-xl border transition-all ${
                readingAnswer === i
                  ? "bg-primary text-primary-foreground border-transparent"
                  : "bg-secondary text-secondary-foreground border-transparent"
              }`}
            >
              {opt}
            </button>
          ))}
        </div>
      </Card>

      <Button
        onClick={handleStepCompletion}
        variant="primary"
        disabled={readingAnswer === null}
      >
        Завершити читання
      </Button>
    </div>
  );

  // 6. КРОК: ГОВОРІННЯ (REAL SPEECH RECOGNITION)
  const renderSpeaking = () => {
    const isPassed = (similarityScore ?? 0) >= 70;

    const handleMicClick = () => {
      if (isListening) {
        stopListening();
      } else {
        setHasEvaluated(false);
        setSimilarityScore(null);
        resetTranscript();
        startListening();
      }
    };

    const handleRetry = () => {
      setHasEvaluated(false);
      setSimilarityScore(null);
      resetTranscript();
    };

    if (!isSupported) {
      return (
        <div className="space-y-4 my-auto">
          <Card className="p-6 text-center space-y-4">
            <div className="w-14 h-14 mx-auto rounded-full bg-amber-500/10 text-amber-600 flex items-center justify-center">
              <AlertCircle className="w-7 h-7" />
            </div>
            <div className="space-y-1">
              <h3 className="font-bold text-lg">Розпізнавання недоступне</h3>
              <p className="text-xs text-cookieText-muted">
                Ваш браузер або клієнт Telegram не підтримує Web Speech API.
                Ви можете повторити фразу подумки та продовжити урок.
              </p>
            </div>
            <div className="p-4 bg-secondary rounded-2xl">
              <p className="text-lg font-bold text-cookieText-primary">
                "{targetSentence}"
              </p>
            </div>
          </Card>
          <Button onClick={handleStepCompletion} variant="primary">
            Пропустити та продовжити
          </Button>
        </div>
      );
    }

    return (
      <div className="space-y-4 my-auto">
        <Card className="p-6 text-center space-y-4">
          <span className="text-xs uppercase font-bold text-cookieText-muted tracking-wider">
            Вимовіть уголос
          </span>
          <p className="text-xl font-bold text-cookieText-primary leading-relaxed">
            "{targetSentence}"
          </p>

          {transcript && (
            <div className="p-3 bg-secondary rounded-2xl text-xs space-y-1">
              <span className="text-cookieText-muted font-medium">Ви сказали:</span>
              <p className="font-semibold text-cookieText-primary italic">
                "{transcript}"
              </p>
            </div>
          )}

          <div className="pt-2 flex flex-col items-center gap-3">
            {!isListening && !hasEvaluated && (
              <button
                onClick={handleMicClick}
                className="w-16 h-16 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-cookie active:scale-95 transition-transform"
                title="Почати запис"
              >
                <Mic className="w-7 h-7" />
              </button>
            )}

            {isListening && (
              <div className="flex flex-col items-center gap-2">
                <button
                  onClick={handleMicClick}
                  className="w-16 h-16 rounded-full bg-red-500 text-white flex items-center justify-center animate-pulse shadow-lg"
                  title="Зупинити запис"
                >
                  <Mic className="w-7 h-7" />
                </button>
                <span className="text-xs font-semibold text-red-500 animate-pulse">
                  Слухаємо... Натисніть, щоб завершити
                </span>
              </div>
            )}

            {!isListening && hasEvaluated && isPassed && (
              <div className="w-full p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl space-y-1">
                <div className="flex items-center justify-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-bold text-base">
                  <CheckCircle2 className="w-5 h-5" />
                  <span>Відмінно! {similarityScore}% збіг</span>
                </div>
                <p className="text-xs text-cookieText-muted">
                  Чудова вимова! Ви подолали поріг у 70%.
                </p>
              </div>
            )}

            {!isListening && hasEvaluated && !isPassed && (
              <div className="w-full p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl space-y-3">
                <div className="flex items-center justify-center gap-1.5 text-amber-700 dark:text-amber-400 font-bold text-base">
                  <RotateCcw className="w-5 h-5" />
                  <span>Збіг: {similarityScore}% (потрібно 70%)</span>
                </div>
                <p className="text-xs text-cookieText-muted">
                  Спробуйте чіткіше артикулювати слова та повторіть знову.
                </p>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleRetry}
                  className="w-full"
                >
                  Спробувати ще раз
                </Button>
              </div>
            )}
          </div>
        </Card>

        <Button
          onClick={handleStepCompletion}
          variant="primary"
          disabled={!isPassed}
        >
          Продовжити
        </Button>
      </div>
    );
  };

  // 7. КРОК: РОЛЬОВА ГРА / СИМУЛЯЦІЯ ДІАЛОГУ (ROLEPLAY)
  const renderRoleplay = () => {
    if (!scenario) {
      return (
        <div className="space-y-4 my-auto">
          <Card className="p-6 text-center space-y-2">
            <p className="text-sm font-medium">Для цього уроку ще немає сценарію рольової гри.</p>
          </Card>
          <Button onClick={handleStepCompletion} variant="primary">
            Пропустити крок
          </Button>
        </div>
      );
    }

    const currentItem = scenario.dialogue[dialogueStepIndex];
    const isUserTurn = currentItem?.speaker === "user";

    const handleSelectOption = (chosenText: string) => {
      if (!currentItem || currentItem.speaker !== "user") return;

      if (chosenText === currentItem.text) {
        setChatHistory((prev) => [
          ...prev,
          {
            id: `msg-${dialogueStepIndex}-${Date.now()}`,
            speaker: "user",
            text: chosenText,
          },
        ]);
        setRoleplayHint(null);

        if (dialogueStepIndex === scenario.dialogue.length - 1) {
          setIsRoleplayFinished(true);
        } else {
          setDialogueStepIndex((prev) => prev + 1);
        }
      } else {
        setRoleplayHint(
          currentItem.hint ?? "Хм, це не зовсім природна фраза для цієї ситуації. Спробуй ще раз!"
        );
      }
    };

    return (
      <div className="flex flex-col h-full max-h-[75vh] space-y-3 justify-between">
        {/* Контекст ситуації */}
        <div className="flex items-center gap-2 p-3 bg-amber-50/70 dark:bg-amber-950/20 border border-card-border rounded-2xl text-xs text-cookieText-muted shrink-0">
          <MessageSquare className="w-4 h-4 text-primary shrink-0" />
          <span>{scenario.context}</span>
        </div>

        {/* Вікно чату */}
        <div className="flex-1 overflow-y-auto space-y-3 p-2 rounded-2xl">
          {chatHistory.map((msg) => {
            const isBot = msg.speaker === "bot";
            return (
              <div
                key={msg.id}
                className={`flex items-end gap-2 ${isBot ? "justify-start" : "justify-end"}`}
              >
                {isBot && <CookieMascot state="happy" size={28} className="shrink-0" />}
                <div
                  className={`max-w-[80%] p-3.5 text-sm rounded-3xl shadow-sm ${
                    isBot
                      ? "bg-card text-cookieText-primary border border-card-border rounded-bl-sm"
                      : "bg-primary text-primary-foreground font-medium rounded-br-sm"
                  }`}
                >
                  {msg.text}
                </div>
              </div>
            );
          })}

          {/* Підказка маскота у разі помилки */}
          {roleplayHint && (
            <div className="flex items-start gap-2.5 p-3 rounded-2xl bg-amber-100/70 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-xs text-amber-950 dark:text-amber-200 animate-in fade-in duration-200">
              <CookieMascot state="thinking" size={32} className="shrink-0" />
              <div>
                <span className="font-bold">Підказка від Печива:</span>
                <p className="mt-0.5">{roleplayHint}</p>
              </div>
            </div>
          )}

          <div ref={chatBottomRef} />
        </div>

        {/* Панель вибору реплік або кнопка завершення */}
        <div className="pt-2 shrink-0">
          {!isRoleplayFinished && isUserTurn && currentItem.options && (
            <div className="space-y-2">
              <span className="text-[11px] font-bold text-cookieText-muted uppercase tracking-wider block text-center">
                Оберіть вашу репліку
              </span>
              <div className="space-y-1.5">
                {currentItem.options.map((option) => (
                  <button
                    key={option}
                    onClick={() => handleSelectOption(option)}
                    className="w-full p-3 rounded-2xl text-left text-xs font-semibold border border-card-border bg-card text-cookieText-primary hover:bg-card-hover active:bg-primary active:text-primary-foreground shadow-cookie-sm transition-all"
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>
          )}

          {isRoleplayFinished && (
            <div className="space-y-2">
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 rounded-2xl text-center text-xs font-bold flex items-center justify-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" />
                <span>Діалог завершено! Чудова робота.</span>
              </div>
              <Button onClick={handleStepCompletion} variant="primary" className="w-full">
                Завершити крок
              </Button>
            </div>
          )}
        </div>
      </div>
    );
  };

  // 8. КРОК: ТЕСТ (5 ПИТАНЬ З МОК-СЛІВ)
  const testWords = words.slice(0, 5);

  const handleSelectTestOption = (optionIndex: number) => {
    const nextAnswers = [...selectedAnswers];
    nextAnswers[testQuestionIdx] = optionIndex;
    setSelectedAnswers(nextAnswers);

    if (testQuestionIdx < 4) {
      setTestQuestionIdx((prev) => prev + 1);
    } else {
      setIsTestFinished(true);
    }
  };

  const renderTest = () => {
    if (isLoadingWords || testWords.length < 5) {
      return <div className="text-center py-20">Формування тесту...</div>;
    }

    if (isTestFinished) {
      const correctCount = selectedAnswers.filter((ans) => ans === 0).length;
      const scorePercent = Math.round((correctCount / 5) * 100);
      const isPassed = scorePercent >= 75;

      return (
        <div className="space-y-4 my-auto">
          <Card className="text-center p-6 space-y-4">
            <div
              className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto ${
                isPassed
                  ? "bg-emerald-500/10 text-emerald-500"
                  : "bg-red-500/10 text-red-500"
              }`}
            >
              {isPassed ? (
                <Trophy className="w-8 h-8" />
              ) : (
                <XCircle className="w-8 h-8" />
              )}
            </div>

            <div>
              <h2 className="text-2xl font-black">{scorePercent}%</h2>
              <p className="text-sm font-semibold mt-1">
                {isPassed
                  ? "Тест складено успішно!"
                  : "Не вистачило балів для проходження"}
              </p>
              <p className="text-xs text-cookieText-muted mt-1">
                Правильних відповідей: {correctCount} з 5 (потрібно мінімум 4)
              </p>
            </div>
          </Card>

          {isPassed ? (
            <Button onClick={handleStepCompletion} variant="primary">
              Завершити крок
            </Button>
          ) : (
            <Button
              variant="outline"
              onClick={() => {
                setSelectedAnswers([]);
                setTestQuestionIdx(0);
                setIsTestFinished(false);
              }}
              className="w-full flex items-center justify-center gap-2 border-red-500 text-red-500 hover:bg-red-500/10"
            >
              <RotateCcw className="w-4 h-4" />
              Спробувати ще раз
            </Button>
          )}
        </div>
      );
    }

    const currentWord = testWords[testQuestionIdx];
    const otherTranslations = words
      .filter((w) => w.id !== currentWord.id)
      .map((w) => w.translation)
      .slice(0, 3);
    const options = [currentWord.translation, ...otherTranslations];

    return (
      <div className="space-y-4 my-auto">
        <div className="flex justify-between items-center text-xs font-semibold text-cookieText-muted">
          <span>Питання {testQuestionIdx + 1} з 5</span>
          <span>{Math.round(((testQuestionIdx + 1) / 5) * 100)}%</span>
        </div>
        <ProgressBar progress={((testQuestionIdx + 1) / 5) * 100} />

        <Card className="p-6 text-center space-y-2">
          <span className="text-xs text-cookieText-muted uppercase font-semibold">
            Оберіть правильний переклад
          </span>
          <h2 className="text-3xl font-extrabold text-cookieText-primary">
            {currentWord.text}
          </h2>
        </Card>

        <div className="space-y-2">
          {options.map((opt, idx) => (
            <button
              key={opt}
              onClick={() => handleSelectTestOption(idx)}
              className="w-full p-4 rounded-2xl font-semibold text-left border border-card-border bg-card text-cookieText-primary hover:bg-card-hover active:bg-primary active:text-primary-foreground transition-all flex items-center justify-between shadow-cookie-sm"
            >
              <span>{opt}</span>
              <ChevronRight className="w-4 h-4 text-cookieText-muted" />
            </button>
          ))}
        </div>
      </div>
    );
  };

  // Відображення модалки "Юніт завершено!"
  if (isUnitFinishedModalOpen) {
    return (
      <Screen className="justify-center items-center text-center p-6 space-y-6">
        <div className="w-20 h-20 bg-amber-500/10 text-amber-500 rounded-full flex items-center justify-center animate-bounce">
          <Trophy className="w-10 h-10" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-black text-cookieText-primary">
            Юніт завершено! 🎉
          </h1>
          <p className="text-sm text-cookieText-muted max-w-xs">
            Ви успішно пройшли всі кроки теми «{unit.title}». Наступний юніт розблоковано!
          </p>
        </div>
        <Button
          onClick={() => navigate("/")}
          variant="primary"
          className="w-full"
        >
          Повернутися на Головну
        </Button>
      </Screen>
    );
  }

  return (
    <Screen className="justify-between">
      {/* Навігаційний заголовок кроку */}
      <div className="flex items-center justify-between pb-3 border-b border-card-border">
        <button
          onClick={() => navigate(`/path/${unit.id}`)}
          className="p-2 rounded-2xl bg-secondary text-secondary-foreground"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <Badge className="text-xs uppercase">{stepType}</Badge>
      </div>

      {/* Динамічний контент залежно від типу кроку */}
      {stepType === "warmup" && renderWarmup()}
      {stepType === "vocabulary" && renderVocabulary()}
      {stepType === "grammar" && renderGrammar()}
      {stepType === "video" && renderVideo()}
      {stepType === "reading" && renderReading()}
      {stepType === "speaking" && renderSpeaking()}
      {stepType === "roleplay" && renderRoleplay()}
      {stepType === "test" && renderTest()}

      <div />
    </Screen>
  );
};