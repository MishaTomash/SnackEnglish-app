// 📁 Файл: SnackEnglish-app/src/shared/lib/speech.ts
/**
 * Озвучка (Web Speech Synthesis), розпізнавання мовлення та утиліти порівняння
 * відповіді юзера з еталоном.
 *
 * Розпізнавання має три режими — їх обирає сервер (SPEECH_PROVIDER у backend/.env):
 * - "server"  — запис MediaRecorder + транскрипція на бекенді (Groq безкоштовно або OpenAI);
 * - "browser" — Web Speech Recognition браузера (безкоштовно, але лише Chrome/Edge);
 * - "off"     — вимкнено, голосові вправи лише пропускаються.
 *
 * Підтримка у WebView Telegram залежить від платформи, тому степ-компоненти
 * мають перевіряти isSynthesisSupported() / isRecognitionSupported()
 * і показувати фолбек (наприклад, текст замість озвучки, кнопки замість голосу).
 */

import { getCachedSpeechMode, loadSpeechMode, transcribeAudio, TranscribeError } from "../api/speechApi";
import type { SpeechMode } from "../api/speechApi";
import {
  BrowserRecognitionError,
  isBrowserRecognitionAvailable,
  recognizeInBrowser,
  stopBrowserRecognition,
} from "./browserRecognition";
import { isRecordingSupported, recordVoice, RecordError, stopRecording } from "./voiceRecorder";
import type { RecordResult } from "./voiceRecorder";
import { resolveMediaUrl } from "./avatarUrl";

export { loadSpeechMode };
export type { SpeechMode };

const DEFAULT_LANG = "en-US";
// Звичайна швидкість голосу телефона. Повільніше — лише кнопка "Повільно"
const DEFAULT_RATE = 1;
const DEFAULT_LISTEN_TIMEOUT_MS = 6000; // максимальна довжина запису фрази
/** Менший запис — це випадковий тап, а не фраза: на сервер не шлемо */
const MIN_AUDIO_BYTES = 800;

// ==================== ПІДТРИМКА ====================

export const isSynthesisSupported = (): boolean =>
  typeof window !== "undefined" &&
  "speechSynthesis" in window &&
  typeof window.SpeechSynthesisUtterance === "function";

/**
 * Режим розпізнавання для цієї сесії. Поки loadSpeechMode() не відповів — null.
 * listen() і isRecognitionSupported() до завантаження вважають режим "server".
 */
export const getSpeechMode = (): SpeechMode | null => getCachedSpeechMode();

/** Чи можна в цьому середовищі розпізнати голос у поточному режимі */
export const isRecognitionSupported = (): boolean => {
  switch (getCachedSpeechMode() ?? "server") {
    case "browser":
      return isBrowserRecognitionAvailable();
    case "off":
      return false;
    default:
      return isRecordingSupported(); // getUserMedia + MediaRecorder на HTTPS
  }
};

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
function speakWithSynthesis(text: string, options: SpeakOptions = {}): Promise<void> {
  const trimmed = text.trim();
  if (!trimmed || !isSynthesisSupported()) return Promise.resolve();

  const synth = window.speechSynthesis;
  // Українська репліка (пояснення в діалозі) — українським голосом, а не англійським
  const lang = options.lang ?? (/[а-яіїєґ]/i.test(text) ? "uk-UA" : DEFAULT_LANG);

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
  stopClip();
  settleCurrentSpeech?.();
  if (isSynthesisSupported()) window.speechSynthesis.cancel();
}

// ==================== ОЗВУЧКА УРОКУ (ГОТОВЕ АУДІО) ====================

/*
 * Урок приходить з мапою "фраза -> mp3" (озвучка OpenAI, згенерована в адмінці).
 * Якщо для фрази є файл — speak() грає його: однаковий природний голос на всіх
 * пристроях. Немає файлу (гра, нова фраза) — голос телефона, як раніше.
 */

const MAX_PRELOADED_CLIPS = 40;
const CLIP_TIMEOUT_MS = 20000;

const lessonAudio = new Map<string, string>();
/** Та сама озвучка, проіндексована «вільним» ключем (див. looseKey) */
const lessonAudioLoose = new Map<string, string>();
const clipElements = new Map<string, HTMLAudioElement>();
let currentClip: HTMLAudioElement | null = null;
let settleCurrentClip: (() => void) | null = null;

/**
 * Ключ фрази — ТАКИЙ САМИЙ рахує сервер (ttsService → speechKey):
 * без розмітки, з нормальними пробілами й апострофами, у нижньому регістрі.
 */
export const speechKey = (raw: string): string =>
  raw
    .replace(/<[^>]*>/g, " ")
    .replace(/[’‘`´]/g, "'")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

/**
 * «Вільний» ключ — страховка від розбіжностей у пробілах біля розмітки.
 * Сервер замінює теги <en> пробілами ("додаємо <en>not</en>:" → "not :"), а текст,
 * очищений в іншому місці без пробілів, дає "not:". Тут пробіли біля розділових
 * знаків не важать, тож обидва варіанти знаходять той самий файл.
 */
const looseKey = (raw: string): string =>
  speechKey(raw)
    .replace(/\s+([,.:;!?…»)\]])/g, "$1")
    .replace(/([«(\[])\s+/g, "$1");

/** Текст для голосу телефона: без розмітки <en>…</en> */
const plainText = (raw: string): string => raw.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();

/** Реєструє озвучку уроку й заздалегідь підвантажує файли, щоб звук вмикався миттєво */
export function setLessonAudio(map: Record<string, string>): void {
  lessonAudio.clear();
  lessonAudioLoose.clear();
  clipElements.clear();
  Object.entries(map).forEach(([key, url], index) => {
    const resolved = resolveMediaUrl(url);
    if (!resolved) return;
    lessonAudio.set(key, resolved);
    lessonAudioLoose.set(looseKey(key), resolved);
    if (index < MAX_PRELOADED_CLIPS && typeof Audio !== "undefined") {
      const audio = new Audio();
      audio.preload = "auto";
      audio.src = resolved;
      clipElements.set(resolved, audio);
    }
  });
}

/** Прибирає озвучку уроку (вихід з уроку) */
export function clearLessonAudio(): void {
  stopClip();
  lessonAudio.clear();
  lessonAudioLoose.clear();
  clipElements.clear();
}

/** Чи є готове аудіо для фрази */
/** Файл озвучки для фрази: точний ключ, а якщо ні — «вільний» */
const findClip = (text: string): string | undefined =>
  lessonAudio.get(speechKey(text)) ?? lessonAudioLoose.get(looseKey(text));

export const hasLessonAudio = (text: string): boolean => findClip(text) !== undefined;

function stopClip(): void {
  // ВИПРАВЛЕНО: спершу запам'ятовуємо файл, потім завершуємо його Promise.
  // Раніше settle() обнуляв currentClip ДО pause() — попередня фраза грала далі,
  // і при швидкому "Далі" кілька реплік звучали одночасно.
  const clip = currentClip;
  currentClip = null;
  const settle = settleCurrentClip;
  settleCurrentClip = null;
  settle?.();
  clip?.pause();
}

/** Нижче цієї швидкості — це кнопка "Повільно"; вище — звичайне відтворення */
const SLOW_RATE_THRESHOLD = 0.75;

/** Швидкість звичайного відтворення файлів (з адмінки: Озвучка → Швидкість у уроках) */
let clipBaseRate = 1;

export function setClipBaseRate(rate: number): void {
  clipBaseRate = Number.isFinite(rate) ? Math.min(1.5, Math.max(0.8, rate)) : 1;
}

/**
 * Швидкість файлу. Записи вже в зручному для новачків темпі (так налаштовано голос),
 * тому звичайні виклики — завжди 1×, навіть якщо крок просить трохи повільніший голос
 * телефона (0.8–0.9). Уповільнюємо лише явне "Повільно": rate 0.5 -> ~0.55× від запису.
 */
const clipPlaybackRate = (rate: number | undefined): number => {
  if (rate === undefined || rate >= SLOW_RATE_THRESHOLD) return clipBaseRate;
  // "Повільно" — від звичайної швидкості запису, незалежно від пришвидшення
  return Math.max(0.5, Math.min(0.75, rate / 0.9));
};

/** Грає файл; якщо браузер не дав відтворити — голос телефона */
function playClip(url: string, fallback: () => Promise<void>, rate?: number): Promise<void> {
  stopClip();
  settleCurrentSpeech?.();
  if (isSynthesisSupported()) window.speechSynthesis.cancel();

  const audio = clipElements.get(url) ?? new Audio(url);
  audio.currentTime = 0;
  // Уповільнення без "басу": тембр зберігається (preservesPitch — типово true, ставимо явно)
  audio.preservesPitch = true;
  audio.playbackRate = clipPlaybackRate(rate);
  currentClip = audio;

  return new Promise<void>((resolve) => {
    let settled = false;
    const settle = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      audio.removeEventListener("ended", settle);
      audio.removeEventListener("error", onError);
      if (currentClip === audio) {
        currentClip = null;
        settleCurrentClip = null;
      }
      resolve();
    };
    // Файл не завантажився (немає на сервері, збій мережі) — фраза не повинна мовчати
    const onError = () => {
      if (settled) return;
      settle();
      void fallback();
    };
    // Уповільнений запис грає довше — запас часу пропорційний швидкості
    const timer = setTimeout(settle, CLIP_TIMEOUT_MS / audio.playbackRate);
    audio.addEventListener("ended", settle);
    audio.addEventListener("error", onError);
    settleCurrentClip = settle;

    // play() — синхронно в межах тапу (важливо для iOS)
    const playing = audio.play();
    if (playing) {
      playing.catch((error: unknown) => {
        if (settled) return;
        settle();
        // AbortError — відтворення перервала наступна фраза: це нормально, голос телефона не потрібен
        if ((error as { name?: string } | null)?.name === "AbortError") return;
        void fallback(); // напр., автовідтворення без тапу заборонене — пробуємо голос телефона
      });
    }
  });
}

/**
 * Озвучує текст. Перериває попередню фразу.
 * Є готове аудіо уроку — грає його, інакше голос телефона (Web Speech Synthesis).
 * Promise завжди резолвиться — UI може безпечно робити `await speak(...)`.
 */
export function speak(text: string, options: SpeakOptions = {}): Promise<void> {
  // Текст може містити розмітку <en>…</en>: ключ рахуємо з нього (як сервер),
  // а голосу телефона віддаємо чистий текст
  const plain = plainText(text);
  if (!plain) return Promise.resolve();
  const clipUrl = findClip(text);
  if (clipUrl) return playClip(clipUrl, () => speakWithSynthesis(plain, options), options.rate);
  return speakWithSynthesis(plain, options);
}

// ==================== РОЗПІЗНАВАННЯ ====================

/*
 * Web Speech Recognition надсилає звук на сервери Google/Microsoft і працює лише
 * у звичайних Chrome та Edge: у WebView Telegram (Desktop, Android, iOS) конструктор є,
 * але start() одразу закінчується помилкою "network". Тому основний режим — "server":
 * запис через MediaRecorder (voiceRecorder) + транскрипція на бекенді (speechApi).
 * Режим "browser" лишився як безкоштовний варіант для звичайного браузера.
 * Публічний API (listen, stopListening, ListenError, ListenResult) лишився тим самим.
 */

export type ListenErrorCode =
  | "not-supported" // розпізнавання неможливе в цьому середовищі / режимі
  | "not-allowed" // юзер/WebView/ОС заборонили мікрофон
  | "no-speech" // тиша або нічого не розпізнано
  | "audio-capture" // мікрофона немає або він зайнятий
  | "network" // немає зв'язку з сервером (у режимі "browser" — з сервісом браузера)
  | "server" // сервер розпізнавання відповів помилкою
  | "rate-limited" // забагато спроб поспіль
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

/** Етап прослуховування — для UI: "Слухаю…" / "Розпізнаю…" */
export type ListenPhase = "recording" | "processing";

export interface ListenOptions {
  /** Мова для режиму "browser"; сервер завжди розпізнає англійську (language: "en") */
  lang?: string;
  /** Кількість варіантів у режимі "browser"; сервер повертає один */
  maxAlternatives?: number;
  /** Максимальна тривалість запису, мс (за замовчуванням 6000) */
  timeoutMs?: number;
  /** Проміжний текст — лише в режимі "browser" */
  onInterim?: (transcript: string) => void;
  /** Скасування (наприклад, у cleanup useEffect) — Promise відхиляється з "aborted" */
  signal?: AbortSignal;
  /** Рівень гучності 0..1 і час від початку запису — для анімованого індикатора */
  onLevel?: (level: number, elapsedMs: number) => void;
  /** Зміна етапу: запис -> розпізнавання на сервері */
  onPhase?: (phase: ListenPhase) => void;
}

export interface ListenResult {
  transcript: string; // найімовірніший варіант
  alternatives: string[]; // усі варіанти, включно з transcript
  confidence: number; // 0..1; серверне розпізнавання не повертає — 0
}

const toListenError = (error: unknown): ListenError => {
  if (error instanceof ListenError) return error;

  // Коди браузерного розпізнавання збігаються з ListenErrorCode
  if (error instanceof BrowserRecognitionError) return new ListenError(error.code, error.message);

  if (error instanceof RecordError) {
    switch (error.code) {
      case "not-supported":
      case "not-allowed":
      case "aborted":
        return new ListenError(error.code, error.message);
      case "no-microphone":
        return new ListenError("audio-capture", error.message);
      default:
        return new ListenError("unknown", error.message);
    }
  }

  if (error instanceof TranscribeError) {
    switch (error.code) {
      case "network":
      case "rate-limited":
      case "aborted":
        return new ListenError(error.code, error.message);
      default:
        return new ListenError("server", error.message);
    }
  }

  return new ListenError("unknown", error instanceof Error ? error.message : undefined);
};

// У тексті має бути хоч одна літера чи цифра: "…" або "." — це не відповідь
const hasWords = (text: string): boolean => /[\p{L}\p{N}]/u.test(text);

/** Режим "browser": Web Speech Recognition, без запису й без сервера */
const listenInBrowser = async (options: ListenOptions): Promise<ListenResult> => {
  options.onPhase?.("recording");
  // Рівня гучності браузер не дає — лише час, щоб рухалась смужка ліміту
  const startedAt = performance.now();
  const progressTimer = options.onLevel
    ? setInterval(() => options.onLevel?.(0, performance.now() - startedAt), 100)
    : undefined;

  try {
    const result = await recognizeInBrowser({
      lang: options.lang,
      maxAlternatives: options.maxAlternatives,
      timeoutMs: options.timeoutMs ?? DEFAULT_LISTEN_TIMEOUT_MS,
      onInterim: options.onInterim,
      signal: options.signal,
    });
    return { transcript: result.transcript, alternatives: result.alternatives, confidence: result.confidence };
  } catch (error) {
    throw toListenError(error);
  } finally {
    clearInterval(progressTimer);
  }
};

/** Режим "server": запис з мікрофона, потім розпізнавання на бекенді */
const listenViaServer = async (options: ListenOptions): Promise<ListenResult> => {
  if (!isRecordingSupported()) throw new ListenError("not-supported");

  let recording: RecordResult;
  try {
    options.onPhase?.("recording");
    recording = await recordVoice({
      maxDurationMs: options.timeoutMs ?? DEFAULT_LISTEN_TIMEOUT_MS,
      onLevel: options.onLevel,
      signal: options.signal,
    });
  } catch (error) {
    throw toListenError(error);
  }

  if (options.signal?.aborted) throw new ListenError("aborted");
  // Тишу й випадкові тапи не відправляємо: економія запитів і чесне "не почули"
  if (recording.silent === true || recording.blob.size < MIN_AUDIO_BYTES) {
    throw new ListenError("no-speech");
  }

  let text: string;
  try {
    options.onPhase?.("processing");
    text = await transcribeAudio(recording.blob, recording.mimeType, options.signal);
  } catch (error) {
    throw toListenError(error);
  }

  const transcript = text.trim();
  if (!transcript || !hasWords(transcript)) throw new ListenError("no-speech");

  return { transcript, alternatives: [transcript], confidence: 0 };
};

/**
 * Слухає одну фразу в поточному режимі (див. getSpeechMode). Резолвиться результатом
 * або відхиляється з ListenError. Одночасно активне лише одне прослуховування.
 * Викликати з обробника тапу: iOS дає мікрофон лише у відповідь на жест юзера,
 * тому режим береться синхронно з кешу, без await перед стартом запису.
 */
export async function listen(options: ListenOptions = {}): Promise<ListenResult> {
  if (options.signal?.aborted) throw new ListenError("aborted");

  const mode = getCachedSpeechMode() ?? "server";
  if (mode === "off") throw new ListenError("not-supported");

  stopSpeaking(); // інакше мікрофон "почує" нашу ж озвучку
  return mode === "browser" ? listenInBrowser(options) : listenViaServer(options);
}

/** М'яко завершує поточне прослуховування (кнопка "Готово") — listen() віддасть почуте */
export function stopListening(): void {
  stopRecording();
  stopBrowserRecognition();
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