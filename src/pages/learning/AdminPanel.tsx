import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  BookA,
  Check,
  CheckSquare,
  Headphones,
  Loader2,
  Mic,
  Plus,
  Save,
  ShieldAlert,
  Trash2,
  X,
} from "lucide-react";
import { Card } from "../../shared/ui/Card";
import { Button } from "../../shared/ui/Button";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000/api";

type ContentTab = "words" | "quizzes" | "listening" | "speaking";

interface WordItem {
  id: string;
  word: string;
  translation: string;
  transcription: string;
}
interface QuizItem {
  id: string;
  question: string;
  options: string[];
  correctAnswer: string;
}
interface ListeningItem {
  id: string;
  phrase: string;
  options: string[];
  correctAnswer: string;
}
interface SpeakingItem {
  id: string;
  phrase: string;
  translation: string;
}

interface AdminPanelProps {
  onClose: () => void;
  onSaved: () => void;
  defaultLevel?: string;
  defaultDay?: number;
}

const LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;
const uid = () => Math.random().toString(36).slice(2, 10);

const newWord = (): WordItem => ({
  id: uid(),
  word: "",
  translation: "",
  transcription: "",
});
const newQuiz = (): QuizItem => ({
  id: uid(),
  question: "",
  options: ["", ""],
  correctAnswer: "",
});
const newListening = (): ListeningItem => ({
  id: uid(),
  phrase: "",
  options: ["", ""],
  correctAnswer: "",
});
const newSpeaking = (): SpeakingItem => ({
  id: uid(),
  phrase: "",
  translation: "",
});

const inputCls =
  "w-full bg-[var(--bg-app)] border border-[var(--border-color)] rounded-lg p-2.5 text-sm text-[var(--text-main)] outline-none focus:border-[var(--accent-cta)]/60 transition-colors";
const labelCls =
  "text-[11px] text-[var(--text-muted)] font-bold uppercase tracking-wide mb-1.5 block";

const AddButton = ({
  onClick,
  label,
}: {
  onClick: () => void;
  label: string;
}) => (
  <button
    type="button"
    onClick={onClick}
    className="w-full py-3 rounded-2xl border-2 border-dashed border-[var(--border-color)] text-[var(--text-muted)] text-xs font-bold flex items-center justify-center gap-1.5 active:opacity-70"
  >
    <Plus className="w-4 h-4" /> {label}
  </button>
);

const EmptyBlock = ({ text }: { text: string }) => (
  <div className="text-center py-6 text-xs text-[var(--text-muted)]">
    {text}
  </div>
);

// ---------------- Tab: Words ----------------

const WordsTab = ({
  items,
  setItems,
}: {
  items: WordItem[];
  setItems: React.Dispatch<React.SetStateAction<WordItem[]>>;
}) => {
  const update = (id: string, patch: Partial<WordItem>) =>
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, ...patch } : it)),
    );
  const remove = (id: string) =>
    setItems((prev) => prev.filter((it) => it.id !== id));

  return (
    <div className="space-y-3">
      {items.length === 0 && (
        <EmptyBlock text="Немає слів. Додай перший блок 👇" />
      )}
      {items.map((it, i) => (
        <Card key={it.id} className="p-3 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-[var(--text-muted)]">
              Слово #{i + 1}
            </span>
            <button
              type="button"
              onClick={() => remove(it.id)}
              className="p-1 text-red-400/70 active:text-red-400"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
          <input
            value={it.word}
            onChange={(e) => update(it.id, { word: e.target.value })}
            placeholder="Слово (en)"
            className={inputCls}
          />
          <input
            value={it.translation}
            onChange={(e) => update(it.id, { translation: e.target.value })}
            placeholder="Переклад (ua)"
            className={inputCls}
          />
          <input
            value={it.transcription}
            onChange={(e) => update(it.id, { transcription: e.target.value })}
            placeholder="Транскрипція (опційно)"
            className={inputCls}
          />
        </Card>
      ))}
      <AddButton
        onClick={() => setItems((p) => [...p, newWord()])}
        label="Додати слово"
      />
    </div>
  );
};

// ---------------- Tab: Quizzes ----------------

const QuizTab = ({
  items,
  setItems,
}: {
  items: QuizItem[];
  setItems: React.Dispatch<React.SetStateAction<QuizItem[]>>;
}) => {
  const update = (id: string, patch: Partial<QuizItem>) =>
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, ...patch } : it)),
    );
  const remove = (id: string) =>
    setItems((prev) => prev.filter((it) => it.id !== id));

  const updateOption = (id: string, idx: number, value: string) =>
    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== id) return it;
        const wasCorrect =
          it.correctAnswer !== "" && it.options[idx] === it.correctAnswer;
        const newOptions = it.options.map((o, i) => (i === idx ? value : o));
        return {
          ...it,
          options: newOptions,
          correctAnswer: wasCorrect ? value : it.correctAnswer,
        };
      }),
    );

  const toggleCorrect = (id: string, opt: string) =>
    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== id) return it;
        if (!opt.trim()) return it;
        return { ...it, correctAnswer: it.correctAnswer === opt ? "" : opt };
      }),
    );

  const addOption = (id: string) =>
    setItems((prev) =>
      prev.map((it) =>
        it.id === id ? { ...it, options: [...it.options, ""] } : it,
      ),
    );
  const removeOption = (id: string, idx: number) =>
    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== id) return it;
        const removed = it.options[idx];
        const newOptions = it.options.filter((_, i) => i !== idx);
        return {
          ...it,
          options: newOptions,
          correctAnswer: it.correctAnswer === removed ? "" : it.correctAnswer,
        };
      }),
    );

  return (
    <div className="space-y-3">
      {items.length === 0 && (
        <EmptyBlock text="Немає тестів. Додай перший 👇" />
      )}
      {items.map((it, i) => (
        <Card key={it.id} className="p-3 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-[var(--text-muted)]">
              Тест #{i + 1}
            </span>
            <button
              type="button"
              onClick={() => remove(it.id)}
              className="p-1 text-red-400/70 active:text-red-400"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
          <input
            value={it.question}
            onChange={(e) => update(it.id, { question: e.target.value })}
            placeholder="Питання"
            className={inputCls}
          />
          <div>
            <label className={labelCls}>
              Варіанти (клікни кружечок — правильний)
            </label>
            <div className="space-y-2">
              {it.options.map((opt, oi) => {
                const isCorrect = opt.trim() !== "" && it.correctAnswer === opt;
                return (
                  <div key={oi} className="flex gap-2 items-center">
                    <button
                      type="button"
                      onClick={() => toggleCorrect(it.id, opt)}
                      className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${isCorrect ? "bg-emerald-500 border-emerald-500 text-white" : "border-[var(--border-color)]"}`}
                    >
                      {isCorrect && (
                        <Check className="w-3.5 h-3.5" strokeWidth={3} />
                      )}
                    </button>
                    <input
                      value={opt}
                      onChange={(e) => updateOption(it.id, oi, e.target.value)}
                      placeholder={`Варіант ${oi + 1}`}
                      className={inputCls}
                    />
                    {it.options.length > 2 && (
                      <button
                        type="button"
                        onClick={() => removeOption(it.id, oi)}
                        className="p-1 text-red-400/70 active:text-red-400 shrink-0"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
            <button
              type="button"
              onClick={() => addOption(it.id)}
              className="mt-2 text-xs text-[var(--accent-cta)] font-bold flex items-center gap-1 active:opacity-70"
            >
              <Plus className="w-3 h-3" /> Додати варіант
            </button>
          </div>
        </Card>
      ))}
      <AddButton
        onClick={() => setItems((p) => [...p, newQuiz()])}
        label="Додати тест"
      />
    </div>
  );
};

// ---------------- Tab: Listening ----------------

const ListeningTab = ({
  items,
  setItems,
}: {
  items: ListeningItem[];
  setItems: React.Dispatch<React.SetStateAction<ListeningItem[]>>;
}) => {
  const update = (id: string, patch: Partial<ListeningItem>) =>
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, ...patch } : it)),
    );
  const remove = (id: string) =>
    setItems((prev) => prev.filter((it) => it.id !== id));

  const updateOption = (id: string, idx: number, value: string) =>
    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== id) return it;
        const wasCorrect =
          it.correctAnswer !== "" && it.options[idx] === it.correctAnswer;
        const newOptions = it.options.map((o, i) => (i === idx ? value : o));
        return {
          ...it,
          options: newOptions,
          correctAnswer: wasCorrect ? value : it.correctAnswer,
        };
      }),
    );

  const toggleCorrect = (id: string, opt: string) =>
    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== id) return it;
        if (!opt.trim()) return it;
        return { ...it, correctAnswer: it.correctAnswer === opt ? "" : opt };
      }),
    );

  const addOption = (id: string) =>
    setItems((prev) =>
      prev.map((it) =>
        it.id === id ? { ...it, options: [...it.options, ""] } : it,
      ),
    );
  const removeOption = (id: string, idx: number) =>
    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== id) return it;
        const removed = it.options[idx];
        const newOptions = it.options.filter((_, i) => i !== idx);
        return {
          ...it,
          options: newOptions,
          correctAnswer: it.correctAnswer === removed ? "" : it.correctAnswer,
        };
      }),
    );

  return (
    <div className="space-y-3">
      {items.length === 0 && (
        <EmptyBlock text="Немає аудіо-завдань. Додай перше 👇" />
      )}
      {items.map((it, i) => (
        <Card key={it.id} className="p-3 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-[var(--text-muted)]">
              Аудіо #{i + 1}
            </span>
            <button
              type="button"
              onClick={() => remove(it.id)}
              className="p-1 text-red-400/70 active:text-red-400"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
          <input
            value={it.phrase}
            onChange={(e) => update(it.id, { phrase: e.target.value })}
            placeholder="Фраза англійською (її озвучить TTS)"
            className={inputCls}
          />
          <div>
            <label className={labelCls}>
              Варіанти перекладу (кружечок — правильний)
            </label>
            <div className="space-y-2">
              {it.options.map((opt, oi) => {
                const isCorrect = opt.trim() !== "" && it.correctAnswer === opt;
                return (
                  <div key={oi} className="flex gap-2 items-center">
                    <button
                      type="button"
                      onClick={() => toggleCorrect(it.id, opt)}
                      className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${isCorrect ? "bg-emerald-500 border-emerald-500 text-white" : "border-[var(--border-color)]"}`}
                    >
                      {isCorrect && (
                        <Check className="w-3.5 h-3.5" strokeWidth={3} />
                      )}
                    </button>
                    <input
                      value={opt}
                      onChange={(e) => updateOption(it.id, oi, e.target.value)}
                      placeholder={`Переклад ${oi + 1}`}
                      className={inputCls}
                    />
                    {it.options.length > 2 && (
                      <button
                        type="button"
                        onClick={() => removeOption(it.id, oi)}
                        className="p-1 text-red-400/70 active:text-red-400 shrink-0"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
            <button
              type="button"
              onClick={() => addOption(it.id)}
              className="mt-2 text-xs text-[var(--accent-cta)] font-bold flex items-center gap-1 active:opacity-70"
            >
              <Plus className="w-3 h-3" /> Додати варіант
            </button>
          </div>
        </Card>
      ))}
      <AddButton
        onClick={() => setItems((p) => [...p, newListening()])}
        label="Додати аудіо"
      />
    </div>
  );
};

// ---------------- Tab: Speaking ----------------

const SpeakingTab = ({
  items,
  setItems,
}: {
  items: SpeakingItem[];
  setItems: React.Dispatch<React.SetStateAction<SpeakingItem[]>>;
}) => {
  const update = (id: string, patch: Partial<SpeakingItem>) =>
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, ...patch } : it)),
    );
  const remove = (id: string) =>
    setItems((prev) => prev.filter((it) => it.id !== id));

  return (
    <div className="space-y-3">
      {items.length === 0 && (
        <EmptyBlock text="Немає фраз для говоріння. Додай першу 👇" />
      )}
      {items.map((it, i) => (
        <Card key={it.id} className="p-3 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-[var(--text-muted)]">
              Фраза #{i + 1}
            </span>
            <button
              type="button"
              onClick={() => remove(it.id)}
              className="p-1 text-red-400/70 active:text-red-400"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
          <input
            value={it.phrase}
            onChange={(e) => update(it.id, { phrase: e.target.value })}
            placeholder="Фраза англійською"
            className={inputCls}
          />
          <input
            value={it.translation}
            onChange={(e) => update(it.id, { translation: e.target.value })}
            placeholder="Переклад (ua)"
            className={inputCls}
          />
        </Card>
      ))}
      <AddButton
        onClick={() => setItems((p) => [...p, newSpeaking()])}
        label="Додати фразу"
      />
    </div>
  );
};

// ---------------- Main Panel ----------------

export const AdminPanel = ({
  onClose,
  onSaved,
  defaultLevel = "A1",
  defaultDay = 1,
}: AdminPanelProps) => {
  const [level, setLevel] = useState<string>(defaultLevel);
  const [dayNumber, setDayNumber] = useState<number>(defaultDay);
  const [isLoadingDay, setIsLoadingDay] = useState(false);
  const [title, setTitle] = useState("");

  const [tab, setTab] = useState<ContentTab>("words");
  const [words, setWords] = useState<WordItem[]>([newWord()]);
  const [quizzes, setQuizzes] = useState<QuizItem[]>([newQuiz()]);
  const [listening, setListening] = useState<ListeningItem[]>([newListening()]);
  const [speaking, setSpeaking] = useState<SpeakingItem[]>([newSpeaking()]);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedOk, setSavedOk] = useState(false);

  // ДОДАНО: Ефект для автоматичного підтягування наступного вільного дня при зміні рівня
  useEffect(() => {
    const fetchNextDay = async () => {
      setIsLoadingDay(true);
      try {
        const initData =
          window.Telegram?.WebApp?.initData || "mock_hash_for_dev_mode";
        const res = await fetch(
          `${API_URL}/progress/categories/next-day?level=${level}`,
          {
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${initData}`,
              "ngrok-skip-browser-warning": "true",
              "Bypass-Tunnel-Reminder": "true",
            },
          },
        );
        if (res.ok) {
          const data = await res.json();
          if (data.nextDay) setDayNumber(data.nextDay);
        }
      } catch (err) {
        console.error("Failed to fetch next day", err);
      } finally {
        setIsLoadingDay(false);
      }
    };
    fetchNextDay();
  }, [level]);

  const errors = useMemo(() => {
    const e: string[] = [];
    if (!title.trim()) e.push("Заповни «Тема дня»");
    if (!level) e.push("Обери рівень");
    if (dayNumber < 1) e.push("Номер дня має бути ≥ 1");

    words.forEach((w, i) => {
      if (!w.word.trim()) e.push(`Слово #${i + 1}: порожнє «Слово»`);
      if (!w.translation.trim()) e.push(`Слово #${i + 1}: порожній «Переклад»`);
    });

    quizzes.forEach((q, i) => {
      if (!q.question.trim()) e.push(`Тест #${i + 1}: порожнє питання`);
      const opts = q.options.filter((o) => o.trim());
      if (opts.length < 2)
        e.push(`Тест #${i + 1}: потрібно мінімум 2 варіанти`);
      if (!q.correctAnswer)
        e.push(`Тест #${i + 1}: не обрано правильний варіант`);
      else if (!opts.includes(q.correctAnswer))
        e.push(`Тест #${i + 1}: правильний варіант не серед опцій`);
    });

    listening.forEach((l, i) => {
      if (!l.phrase.trim()) e.push(`Аудіо #${i + 1}: порожня фраза`);
      const opts = l.options.filter((o) => o.trim());
      if (opts.length < 2)
        e.push(`Аудіо #${i + 1}: потрібно мінімум 2 варіанти`);
      if (!l.correctAnswer)
        e.push(`Аудіо #${i + 1}: не обрано правильний варіант`);
      else if (!opts.includes(l.correctAnswer))
        e.push(`Аудіо #${i + 1}: правильний варіант не серед опцій`);
    });

    speaking.forEach((s, i) => {
      if (!s.phrase.trim()) e.push(`Говоріння #${i + 1}: порожня фраза`);
      if (!s.translation.trim())
        e.push(`Говоріння #${i + 1}: порожній переклад`);
    });

    const total =
      words.length + quizzes.length + listening.length + speaking.length;
    if (total === 0) e.push("Додай хоча б один блок контенту");

    return e;
  }, [title, level, dayNumber, words, quizzes, listening, speaking]);

  const totalItems =
    words.length + quizzes.length + listening.length + speaking.length;

  const handleSave = async () => {
    if (errors.length > 0 || saving) return;
    setSaving(true);
    setSaveError(null);

    try {
      const initData =
        window.Telegram?.WebApp?.initData || "mock_hash_for_dev_mode";

      const payload = {
        level,
        dayNumber,
        title: title.trim(),
        words: words.map((w) => ({
          word: w.word.trim(),
          translation: w.translation.trim(),
          transcription: w.transcription.trim(),
        })),
        quizzes: quizzes.map((q) => ({
          question: q.question.trim(),
          options: q.options.map((o) => o.trim()).filter(Boolean),
          correctAnswer: q.correctAnswer,
        })),
        listening: listening.map((l) => ({
          phrase: l.phrase.trim(),
          options: l.options.map((o) => o.trim()).filter(Boolean),
          correctAnswer: l.correctAnswer,
        })),
        speaking: speaking.map((s) => ({
          phrase: s.phrase.trim(),
          translation: s.translation.trim(),
        })),
      };

      const res = await fetch(`${API_URL}/progress/categories/admin`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${initData}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok)
        throw new Error(
          "Сервер повернув помилку (можливо такий день вже існує)",
        );

      setSavedOk(true);

      // Скидаємо форму для можливості додати ще один день, не закриваючи панель
      setTimeout(() => {
        setSavedOk(false);
        setTitle("");
        setWords([newWord()]);
        setQuizzes([newQuiz()]);
        setListening([newListening()]);
        setSpeaking([newSpeaking()]);
        setDayNumber((prev) => prev + 1); // Автоматично перекидаємо на наступний день
      }, 1500);
    } catch (e: any) {
      setSaveError(e?.message || "Невідома помилка");
    } finally {
      setSaving(false);
    }
  };

  const tabs = [
    { id: "words" as const, label: "Слова", icon: BookA, count: words.length },
    {
      id: "quizzes" as const,
      label: "Тести",
      icon: CheckSquare,
      count: quizzes.length,
    },
    {
      id: "listening" as const,
      label: "Аудіо",
      icon: Headphones,
      count: listening.length,
    },
    {
      id: "speaking" as const,
      label: "Говоріння",
      icon: Mic,
      count: speaking.length,
    },
  ];

  return (
    <div className="fixed inset-0 z-[100] bg-[var(--bg-app)] flex flex-col">
      <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-[var(--border-color)] bg-[var(--bg-card)]">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-5 h-5 text-[var(--accent-cta)]" />
          <h2 className="text-sm font-black text-[var(--text-main)]">
            Створити навчальний день
          </h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-2 -mr-2 active:opacity-70"
        >
          <X className="w-5 h-5 text-[var(--text-main)]" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-40">
        <Card className="p-4 space-y-4">
          <div>
            <label className={labelCls}>Рівень</label>
            <div className="grid grid-cols-6 gap-1.5">
              {LEVELS.map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => setLevel(l)}
                  className={`py-2 rounded-lg text-xs font-black transition-colors ${
                    level === l
                      ? "bg-[var(--accent-cta)] text-[var(--text-accent)]"
                      : "bg-[var(--bg-app)] text-[var(--text-muted)] border border-[var(--border-color)]"
                  }`}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-3">
            <div className="w-24 shrink-0 relative">
              <label className={labelCls}>День №</label>
              <div className="relative flex items-center">
                <input
                  type="number"
                  min={1}
                  value={dayNumber}
                  disabled={isLoadingDay}
                  onChange={(e) =>
                    setDayNumber(Math.max(1, Number(e.target.value) || 1))
                  }
                  className={`${inputCls} ${isLoadingDay ? "opacity-50" : ""}`}
                />
                {isLoadingDay && (
                  <Loader2 className="absolute right-2 w-4 h-4 animate-spin text-[var(--text-muted)]" />
                )}
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <label className={labelCls}>Тема дня</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Наприклад: Привітання"
                className={inputCls}
              />
            </div>
          </div>
        </Card>

        <div className="flex gap-2 overflow-x-auto -mx-4 px-4 pb-1">
          {tabs.map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-colors ${
                  active
                    ? "bg-[var(--accent-cta)] text-[var(--text-accent)]"
                    : "bg-[var(--bg-card)] text-[var(--text-muted)] border border-[var(--border-color)]"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {t.label}
                <span
                  className={`px-1.5 rounded text-[10px] font-black tabular-nums ${active ? "bg-[var(--text-accent)]/15" : "bg-[var(--bg-app)]"}`}
                >
                  {t.count}
                </span>
              </button>
            );
          })}
        </div>

        {tab === "words" && <WordsTab items={words} setItems={setWords} />}
        {tab === "quizzes" && <QuizTab items={quizzes} setItems={setQuizzes} />}
        {tab === "listening" && (
          <ListeningTab items={listening} setItems={setListening} />
        )}
        {tab === "speaking" && (
          <SpeakingTab items={speaking} setItems={setSpeaking} />
        )}

        {errors.length > 0 && (
          <Card className="p-3 border-red-500/30 bg-red-500/5">
            <div className="flex items-start gap-2 text-red-400 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="font-bold mb-1">
                  Не можна зберегти ({errors.length}):
                </p>
                <ul className="list-disc pl-4 space-y-0.5">
                  {errors.slice(0, 5).map((e, i) => (
                    <li key={i}>{e}</li>
                  ))}
                  {errors.length > 5 && <li>…та ще {errors.length - 5}</li>}
                </ul>
              </div>
            </div>
          </Card>
        )}

        {saveError && (
          <Card className="p-3 border-red-500/30 bg-red-500/5">
            <div className="flex items-center gap-2 text-red-400 text-xs font-bold">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {saveError}
            </div>
          </Card>
        )}
      </div>

      <div
        className="shrink-0 px-4 py-3 border-t border-[var(--border-color)] bg-[var(--bg-card)]"
        style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}
      >
        {savedOk ? (
          <div className="flex items-center justify-center gap-2 text-emerald-400 font-bold text-sm py-3">
            <Check className="w-5 h-5" /> Успішно збережено!
          </div>
        ) : (
          <Button
            variant="primary"
            className="w-full"
            disabled={errors.length > 0 || saving}
            onClick={handleSave}
          >
            <Save className="w-4 h-4 mr-2" />
            {saving ? "Збереження…" : `Зберегти план · ${totalItems} блоків`}
          </Button>
        )}
      </div>
    </div>
  );
};
