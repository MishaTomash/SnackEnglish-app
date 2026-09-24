/**
 * Озвучка (Web Speech Synthesis), розпізнавання мовлення (Web Speech Recognition)
 * та утиліти порівняння відповіді юзера з еталоном.
 *
 * Підтримка у WebView Telegram залежить від платформи, тому степ-компоненти
 * мають перевіряти isSynthesisSupported() / isRecognitionSupported()
 * і показувати фолбек (наприклад, текст замість озвучки, кнопки замість голосу).
 */

const DEFAULT_LANG = "en-US";
const DEFAULT_RATE = 0.9; // трохи повільніше за норму — для тих, хто вчиться
const DEFAULT_LISTEN_TIMEOUT_MS = 8000;

// ==================== ПІДТРИМКА ====================

// Типи Web Speech Recognition описані локально: у lib.dom їх немає
interface RecognitionAlternativeLike {
  readonly transcript: string;
  readonly confidence: number;
}

interface RecognitionResultLike {
  readonly length: number;
  readonly isFinal: boolean;
  readonly [index: number]: RecognitionAlternativeLike;
}

interface RecognitionEventLike {
  readonly resultIndex: number;
  readonly results: {
    readonly length: number;
    readonly [index: number]: RecognitionResultLike;
  };
}

interface RecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: RecognitionEventLike) => void) | null;
  onerror: ((event: { readonly error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

type RecognitionCtor = new () => RecognitionLike;

const getRecognitionCtor = (): RecognitionCtor | null => {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: RecognitionCtor;
    webkitSpeechRecognition?: RecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
};

export const isSynthesisSupported = (): boolean =>
  typeof window !== "undefined" &&
  "speechSynthesis" in window &&
  typeof window.SpeechSynthesisUtterance === "function";

export const isRecognitionSupported = (): boolean =>
  getRecognitionCtor() !== null;

// ==================== ГОЛОСИ ====================

// Голоси, що звучать найприродніше на поширених платформах (в порядку пріоритету)
const PREFERRED_VOICE_NAMES = [
  "Google US English",
  "Samantha",
  "Microsoft Aria",
  "Microsoft Jenny",
  "Microsoft Guy",
  "Karen",
  "Daniel",
  "Google UK English Female",
];

const voiceCache = new Map<string, SpeechSynthesisVoice>();
let voicesPromise: Promise<SpeechSynthesisVoice[]> | null = null;

const normalizeLang = (lang: string): string =>
  lang.replace("_", "-").toLowerCase();

const pickVoice = (
  voices: SpeechSynthesisVoice[],
  lang: string,
): SpeechSynthesisVoice | null => {
  const target = normalizeLang(lang);
  const prefix = target.split("-")[0];
  let best: SpeechSynthesisVoice | null = null;
  let bestScore = -1;

  for (const voice of voices) {
    const voiceLang = normalizeLang(voice.lang);
    if (!voiceLang.startsWith(prefix)) continue;

    let score = voiceLang === target ? 20 : 10;
    const nameIndex = PREFERRED_VOICE_NAMES.findIndex((name) =>
      voice.name.includes(name),
    );
    if (nameIndex !== -1) score += PREFERRED_VOICE_NAMES.length - nameIndex;
    if (voice.localService) score += 1; // працює без мережі

    if (score > bestScore) {
      best = voice;
      bestScore = score;
    }
  }
  return best;
};

/**
 * Список голосів у більшості браузерів з'являється асинхронно (voiceschanged).
 * Можна викликати заздалегідь (наприклад, на старті уроку), щоб перша фраза
 * одразу звучала правильним голосом.
 */
export const preloadVoices = (): Promise<SpeechSynthesisVoice[]> => {
  if (!isSynthesisSupported()) return Promise.resolve([]);
  if (voicesPromise) return voicesPromise;

  const synth = window.speechSynthesis;
  voicesPromise = new Promise<SpeechSynthesisVoice[]>((resolve) => {
    const initial = synth.getVoices();
    if (initial.length > 0) {
      resolve(initial);
      return;
    }
    const done = () => {
      clearTimeout(timer);
      synth.removeEventListener("voiceschanged", done);
      resolve(synth.getVoices());
    };
    // Деякі WebView ніколи не надсилають voiceschanged
    const timer = setTimeout(done, 1500);
    synth.addEventListener("voiceschanged", done);
  }).then((voices) => {
    if (voices.length === 0) voicesPromise = null; // спробуємо ще раз пізніше
    return voices;
  });

  return voicesPromise;
};

/** Синхронний вибір голосу — speak() не може чекати: iOS вимагає виклик у жесті юзера */
const getVoiceSync = (lang: string): SpeechSynthesisVoice | null => {
  const cached = voiceCache.get(lang);
  if (cached) return cached;
  const voice = pickVoice(window.speechSynthesis.getVoices(), lang);
  if (voice) voiceCache.set(lang, voice);
  return voice;
};

// ==================== ОЗВУЧКА ====================

export interface SpeakOptions {
  lang?: string;
  rate?: number;
  pitch?: number;
  volume?: number;
}

// Тримаємо посилання на utterance: інакше Chrome може зібрати його GC до onend
let currentUtterance: SpeechSynthesisUtterance | null = null;
let settleCurrentSpeech: (() => void) | null = null;

const estimateDurationMs = (text: string, rate: number): number => {
  const words = text.split(/\s+/).filter(Boolean).length;
  return (words * 450) / Math.max(rate, 0.1) + 2500;
};

/**
 * Озвучує текст. Перериває попередню фразу.
 * Promise завжди резолвиться (кінець, помилка або страховий таймаут) —
 * UI може безпечно робити `await speak(...)` і йти далі.
 */
export function speak(text: string, options: SpeakOptions = {}): Promise<void> {
  const trimmed = text.trim();
  if (!trimmed || !isSynthesisSupported()) return Promise.resolve();

  const synth = window.speechSynthesis;
  const lang = options.lang ?? DEFAULT_LANG;

  const utterance = new SpeechSynthesisUtterance(trimmed);
  utterance.lang = lang;
  utterance.rate = options.rate ?? DEFAULT_RATE;
  utterance.pitch = options.pitch ?? 1;
  utterance.volume = options.volume ?? 1;
  const voice = getVoiceSync(lang);
  if (voice) utterance.voice = voice;
  else void preloadVoices(); // наступна фраза вже отримає правильний голос

  settleCurrentSpeech?.(); // не всі браузери шлють onend/onerror після cancel()
  synth.cancel();

  return new Promise<void>((resolve) => {
    let settled = false;
    let fallbackTimer: ReturnType<typeof setTimeout> | undefined;

    const settle = () => {
      if (settled) return;
      settled = true;
      clearTimeout(fallbackTimer);
      if (currentUtterance === utterance) {
        currentUtterance = null;
        settleCurrentSpeech = null;
      }
      resolve();
    };

    // Страховка: деякі рушії не надсилають onend зовсім
    fallbackTimer = setTimeout(
      settle,
      estimateDurationMs(trimmed, utterance.rate),
    );
    utterance.onend = settle;
    utterance.onerror = settle;

    currentUtterance = utterance;
    settleCurrentSpeech = settle;
    synth.speak(utterance); // синхронно в межах виклику — важливо для iOS
  });
}

/** Зупиняє озвучку (наприклад, при виході з уроку) */
export function stopSpeaking(): void {
  settleCurrentSpeech?.();
  if (isSynthesisSupported()) window.speechSynthesis.cancel();
}

// ==================== РОЗПІЗНАВАННЯ ====================

export type ListenErrorCode =
  | "not-supported"
  | "not-allowed" // юзер/WebView заборонив мікрофон
  | "no-speech"
  | "audio-capture"
  | "network"
  | "language-not-supported"
  | "aborted"
  | "unknown";

export class ListenError extends Error {
  readonly code: ListenErrorCode;

  constructor(code: ListenErrorCode, message?: string) {
    super(message ?? `Speech recognition failed: ${code}`);
    this.name = "ListenError";
    this.code = code;
  }
}

const mapRecognitionError = (error: string): ListenErrorCode => {
  switch (error) {
    case "not-allowed":
    case "service-not-allowed":
      return "not-allowed";
    case "no-speech":
    case "audio-capture":
    case "network":
    case "aborted":
    case "language-not-supported":
      return error;
    default:
      return "unknown";
  }
};

export interface ListenOptions {
  lang?: string;
  /** Скільки варіантів розпізнавання повертати (для bestMatch) */
  maxAlternatives?: number;
  /** Через скільки мс перестати слухати, якщо юзер мовчить або говорить довго */
  timeoutMs?: number;
  /** Проміжний текст під час мовлення — для live-підпису */
  onInterim?: (transcript: string) => void;
  /** Скасування (наприклад, у cleanup useEffect) — Promise відхиляється з "aborted" */
  signal?: AbortSignal;
}

export interface ListenResult {
  transcript: string; // найімовірніший варіант
  alternatives: string[]; // усі варіанти, включно з transcript
  confidence: number; // 0..1; деякі браузери завжди дають 0
}

let activeListen: { recognition: RecognitionLike; cancel: () => void } | null =
  null;

/**
 * Слухає одну фразу. Резолвиться результатом або відхиляється з ListenError.
 * Одночасно активне лише одне прослуховування — новий виклик скасовує попереднє.
 */
export function listen(options: ListenOptions = {}): Promise<ListenResult> {
  const Ctor = getRecognitionCtor();
  if (!Ctor) return Promise.reject(new ListenError("not-supported"));
  if (options.signal?.aborted) return Promise.reject(new ListenError("aborted"));

  stopSpeaking(); // інакше мікрофон "почує" нашу ж озвучку
  activeListen?.cancel();

  const recognition = new Ctor();
  recognition.lang = options.lang ?? DEFAULT_LANG;
  recognition.continuous = false;
  recognition.interimResults = Boolean(options.onInterim);
  recognition.maxAlternatives = options.maxAlternatives ?? 5;

  return new Promise<ListenResult>((resolve, reject) => {
    const timeoutMs = options.timeoutMs ?? DEFAULT_LISTEN_TIMEOUT_MS;
    let result: ListenResult | null = null;
    let error: ListenError | null = null;
    let settled = false;

    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(stopTimer);
      clearTimeout(hardTimer);
      options.signal?.removeEventListener("abort", cancel);
      if (activeListen?.recognition === recognition) activeListen = null;
      if (result && !error) resolve(result);
      else reject(error ?? new ListenError("no-speech"));
    };

    const cancel = () => {
      error = new ListenError("aborted");
      result = null;
      try {
        recognition.abort();
      } catch {
        // вже зупинено
      }
      finish();
    };

    // stop() — м'яко: браузер ще віддасть те, що встиг розпізнати
    const stopTimer = setTimeout(() => recognition.stop(), timeoutMs);
    // Страховка: деякі реалізації не надсилають onend після помилки
    const hardTimer = setTimeout(finish, timeoutMs + 3000);

    recognition.onresult = (event) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const res = event.results[i];
        if (res.isFinal) {
          const alternatives: string[] = [];
          for (let k = 0; k < res.length; k++) {
            const text = res[k].transcript.trim();
            if (text) alternatives.push(text);
          }
          if (alternatives.length > 0) {
            result = {
              transcript: alternatives[0],
              alternatives,
              confidence: res[0]?.confidence ?? 0,
            };
          }
        } else {
          options.onInterim?.(res[0]?.transcript ?? "");
        }
      }
    };

    recognition.onerror = (event) => {
      // no-speech після вже отриманого результату — не помилка
      if (event.error === "no-speech" && result) return;
      error = new ListenError(mapRecognitionError(event.error));
    };

    recognition.onend = finish;

    options.signal?.addEventListener("abort", cancel, { once: true });
    activeListen = { recognition, cancel };

    try {
      recognition.start();
    } catch (e) {
      error = new ListenError("unknown", e instanceof Error ? e.message : undefined);
      finish();
    }
  });
}

/** М'яко завершує поточне прослуховування (кнопка "Готово") — listen() віддасть почуте */
export function stopListening(): void {
  activeListen?.recognition.stop();
}

// ==================== ПОРІВНЯННЯ ТЕКСТУ ====================

// Скорочення розгортаються з обох боків порівняння:
// юзер сказав "I am", а в еталоні "I'm" — це збіг
const CONTRACTIONS: Record<string, string> = {
  "i'm": "i am",
  "you're": "you are",
  "we're": "we are",
  "they're": "they are",
  "he's": "he is",
  "she's": "she is",
  "it's": "it is",
  "that's": "that is",
  "what's": "what is",
  "where's": "where is",
  "there's": "there is",
  "here's": "here is",
  "who's": "who is",
  "let's": "let us",
  "i've": "i have",
  "you've": "you have",
  "we've": "we have",
  "they've": "they have",
  "i'll": "i will",
  "you'll": "you will",
  "we'll": "we will",
  "they'll": "they will",
  "he'll": "he will",
  "she'll": "she will",
  "it'll": "it will",
  "i'd": "i would",
  "you'd": "you would",
  "we'd": "we would",
  "they'd": "they would",
  "he'd": "he would",
  "she'd": "she would",
  "don't": "do not",
  "doesn't": "does not",
  "didn't": "did not",
  "isn't": "is not",
  "aren't": "are not",
  "wasn't": "was not",
  "weren't": "were not",
  "haven't": "have not",
  "hasn't": "has not",
  "hadn't": "had not",
  "won't": "will not",
  "wouldn't": "would not",
  "can't": "can not",
  "cannot": "can not",
  "couldn't": "could not",
  "shouldn't": "should not",
  "mustn't": "must not",
};

// Розпізнавання часто повертає цифри замість слів: "2" замість "two"
const NUMBER_WORDS: Record<string, string> = {
  "0": "zero", "1": "one", "2": "two", "3": "three", "4": "four",
  "5": "five", "6": "six", "7": "seven", "8": "eight", "9": "nine",
  "10": "ten", "11": "eleven", "12": "twelve", "13": "thirteen",
  "14": "fourteen", "15": "fifteen", "16": "sixteen", "17": "seventeen",
  "18": "eighteen", "19": "nineteen", "20": "twenty",
};

const tokenize = (text: string): string[] =>
  text
    .normalize("NFD")
    .replace(/([a-z])[\u0300-\u036f]+/gi, "$1") // café -> cafe; кирилицю (й, ї) не чіпаємо
    .normalize("NFC")
    .toLowerCase()
    .replace(/[’‘`´]/g, "'")
    .replace(/[^\p{L}\p{N}'\s]/gu, " ") // пунктуація й дефіси -> пробіл
    .split(/\s+/)
    .map((word) => word.replace(/^'+|'+$/g, ""))
    .filter(Boolean)
    .flatMap((word) => (CONTRACTIONS[word] ?? NUMBER_WORDS[word] ?? word).split(" "));

/** Нижній регістр, без пунктуації, скорочення розгорнуті, цифри 0–20 словами */
export function normalize(text: string): string {
  return tokenize(text).join(" ");
}

const levenshtein = (a: string, b: string): number => {
  const x = Array.from(a);
  const y = Array.from(b);
  if (x.length === 0) return y.length;
  if (y.length === 0) return x.length;

  let prev = Array.from({ length: y.length + 1 }, (_, j) => j);
  for (let i = 1; i <= x.length; i++) {
    const curr = [i];
    for (let j = 1; j <= y.length; j++) {
      curr[j] = Math.min(
        prev[j] + 1,
        curr[j - 1] + 1,
        prev[j - 1] + (x[i - 1] === y[j - 1] ? 0 : 1),
      );
    }
    prev = curr;
  }
  return prev[y.length];
};

const rawSimilarity = (a: string, b: string): number => {
  if (a === b) return 1;
  if (!a || !b) return 0;
  const maxLength = Math.max(Array.from(a).length, Array.from(b).length);
  return 1 - levenshtein(a, b) / maxLength;
};

/** Схожість двох фраз після normalize(): 0 (зовсім різні) .. 1 (однакові) */
export function similarity(a: string, b: string): number {
  return rawSimilarity(normalize(a), normalize(b));
}

export interface BestMatch {
  candidate: string;
  index: number; // індекс у candidates
  input: string; // який із вхідних варіантів дав збіг
  score: number;
}

/**
 * Найкращий збіг серед candidates для одного або кількох вхідних варіантів
 * (зручно передавати ListenResult.alternatives).
 * Повертає null, якщо немає кандидатів або найкращий score < minScore.
 */
export function bestMatch(
  inputs: string | readonly string[],
  candidates: readonly string[],
  minScore = 0,
): BestMatch | null {
  const inputList = (typeof inputs === "string" ? [inputs] : inputs).filter(
    (s) => s.trim(),
  );
  const normalizedCandidates = candidates.map(normalize);
  let best: BestMatch | null = null;

  for (const input of inputList) {
    const normalizedInput = normalize(input);
    normalizedCandidates.forEach((candidate, index) => {
      const score = rawSimilarity(normalizedInput, candidate);
      if (!best || score > best.score) {
        best = { candidate: candidates[index], index, input, score };
      }
    });
  }

  const result = best as BestMatch | null;
  return result && result.score >= minScore ? result : null;
}

export type WordDiffStatus = "match" | "missing" | "extra";

export interface WordDiffToken {
  word: string; // для match/missing — слово з еталону як є (з великою літерою, пунктуацією)
  status: WordDiffStatus;
}

export interface WordDiffResult {
  tokens: WordDiffToken[]; // слова еталону по порядку + зайві сказані слова на своїх місцях
  matched: number;
  total: number; // кількість слів в еталоні
  accuracy: number; // matched / total, 0..1
}

// Дрібні огріхи розпізнавання в довгих словах ("colour"/"color") не рахуємо помилкою
const tokensEqual = (a: string, b: string): boolean =>
  a === b || (Math.min(a.length, b.length) >= 4 && rawSimilarity(a, b) >= 0.8);

/**
 * Пословне порівняння еталону й сказаного (вирівнювання через LCS).
 * Для підсвітки в voice-кроці: зелені match, сірі missing, закреслені extra.
 */
export function wordDiff(expected: string, actual: string): WordDiffResult {
  // Одне слово еталону може дати кілька токенів ("I'm" -> "i", "am")
  const expectedWords = expected.split(/\s+/).filter(Boolean);
  const expTokens: { token: string; wordIndex: number }[] = [];
  expectedWords.forEach((word, wordIndex) => {
    tokenize(word).forEach((token) => expTokens.push({ token, wordIndex }));
  });
  const actTokens = tokenize(actual);

  const n = expTokens.length;
  const m = actTokens.length;
  // lcs[i][j] — довжина LCS для хвостів exp[i..] і act[j..]
  const lcs = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i][j] = tokensEqual(expTokens[i].token, actTokens[j])
        ? lcs[i + 1][j + 1] + 1
        : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }

  const tokens: WordDiffToken[] = [];
  const wordPosition = new Map<number, number>(); // wordIndex -> індекс у tokens
  const wordMatched = new Map<number, boolean>();

  const pushExpected = (wordIndex: number, isMatch: boolean) => {
    if (!wordPosition.has(wordIndex)) {
      wordPosition.set(wordIndex, tokens.length);
      tokens.push({ word: expectedWords[wordIndex], status: "match" });
      wordMatched.set(wordIndex, true);
    }
    // Слово зараховано, лише якщо збіглися всі його токени
    if (!isMatch) wordMatched.set(wordIndex, false);
  };

  let i = 0;
  let j = 0;
  while (i < n || j < m) {
    if (
      i < n &&
      j < m &&
      tokensEqual(expTokens[i].token, actTokens[j]) &&
      lcs[i][j] === lcs[i + 1][j + 1] + 1
    ) {
      pushExpected(expTokens[i].wordIndex, true);
      i++;
      j++;
    } else if (i < n && (j >= m || lcs[i + 1][j] >= lcs[i][j + 1])) {
      pushExpected(expTokens[i].wordIndex, false);
      i++;
    } else {
      tokens.push({ word: actTokens[j], status: "extra" });
      j++;
    }
  }

  wordPosition.forEach((position, wordIndex) => {
    if (!wordMatched.get(wordIndex)) tokens[position].status = "missing";
  });

  const total = wordPosition.size; // слова з самої пунктуації ("—") не рахуємо
  const matched = Array.from(wordMatched.values()).filter(Boolean).length;

  return {
    tokens,
    matched,
    total,
    accuracy: total === 0 ? 0 : matched / total,
  };
}