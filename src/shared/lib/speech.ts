/**
 * Generation counter для speak():
 * кожен виклик отримує унікальний токен; усередині setTimeout
 * перевіряємо, що токен ще актуальний — інакше виходимо без звуку.
 * Це прибирає накладання, коли speak() викликається кілька разів
 * підряд швидше, ніж спрацьовує попередній setTimeout(60).
 */
let speakToken = 0;
let lastText = "";
let lastTextAt = 0;
const DEDUPE_WINDOW_MS = 150;

const PREFERRED_VOICE_NAMES: string[] = [
  "Samantha",
  "Ava (Premium)",
  "Allison (Enhanced)",
  "Samantha (Enhanced)",
  "Alex",
  "Karen",
  "Moira",
  "Tessa",
  "Fiona",
  "Daniel",
  "Google US English",
  "Google UK English Female",
  "Google UK English Male",
  "Microsoft Aria Online (Natural) - English (United States)",
  "Microsoft Jenny Online (Natural) - English (United States)",
  "Microsoft Michelle Online (Natural) - English (United States)",
  "Microsoft Ana Online (Natural) - English (United States)",
];

let voicesCache: SpeechSynthesisVoice[] = [];

const refreshVoices = (): void => {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  voicesCache = window.speechSynthesis.getVoices();
};

if (typeof window !== "undefined" && window.speechSynthesis) {
  refreshVoices();
  window.speechSynthesis.onvoiceschanged = refreshVoices;
  setTimeout(refreshVoices, 100);
  setTimeout(refreshVoices, 500);
  setTimeout(refreshVoices, 1500);
}

const getVoices = (): SpeechSynthesisVoice[] => {
  if (typeof window === "undefined" || !window.speechSynthesis) return [];
  if (!voicesCache.length) refreshVoices();
  return voicesCache.length ? voicesCache : window.speechSynthesis.getVoices();
};

const pickBestVoice = (): SpeechSynthesisVoice | null => {
  const voices = getVoices();
  if (!voices.length) return null;

  const us = voices.filter((v) => v.lang === "en-US" || v.lang === "en_US");
  const en = voices.filter((v) => v.lang.toLowerCase().startsWith("en"));
  const pool = us.length ? us : en;
  if (!pool.length) return null;

  for (const name of PREFERRED_VOICE_NAMES) {
    const v = pool.find((x) => x.name === name);
    if (v) return v;
  }
  const enhanced = pool.find((v) =>
    /premium|enhanced|natural|neural/i.test(v.name),
  );
  if (enhanced) return enhanced;

  const branded = pool.find((v) => /^(Google|Microsoft)\b/.test(v.name));
  if (branded) return branded;

  const decent = pool.find((v) => !/compact|espeak/i.test(v.name));
  return decent ?? pool[0];
};

export interface SpeakOptions {
  rate?: number;
  pitch?: number;
  lang?: string;
  onStart?: () => void;
  onEnd?: () => void;
  /** Якщо true — ігнорує dedupe-вікно (для явного тапу "Прослухати"). */
  force?: boolean;
}

export const speak = (text: string, opts: SpeakOptions = {}): void => {
  if (typeof window === "undefined" || !window.speechSynthesis) return;

  const now = Date.now();
  if (!opts.force && text === lastText && now - lastTextAt < DEDUPE_WINDOW_MS) {
    return;
  }
  lastText = text;
  lastTextAt = now;

  const myToken = ++speakToken;
  window.speechSynthesis.cancel();

  setTimeout(() => {
    if (myToken !== speakToken) return; // хтось новіший переміг — мовчимо
    // Ще раз скасовуємо — на випадок, якщо між setTimeout і зараз
    // щось встигло потрапити в чергу (Safari іноді так робить).
    window.speechSynthesis.cancel();

    const u = new SpeechSynthesisUtterance(text);
    u.lang = opts.lang ?? "en-US";
    u.rate = opts.rate ?? 0.9;
    u.pitch = opts.pitch ?? 1.0;
    u.volume = 1;

    const voice = pickBestVoice();
    if (voice) u.voice = voice;

    if (opts.onStart) u.onstart = opts.onStart;
    if (opts.onEnd) u.onend = opts.onEnd;
    window.speechSynthesis.speak(u);
  }, 60);
};

export const speakSlow = (text: string, onEnd?: () => void): void =>
  speak(text, { rate: 0.65, pitch: 1.0, onEnd, force: true });

export const stopSpeech = (): void => {
  if (typeof window !== "undefined" && window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
};

export const getCurrentVoiceName = (): string | null =>
  pickBestVoice()?.name ?? null;

export const isSpeechRecognitionAvailable = (): boolean => {
  if (typeof window === "undefined") return false;
  return "SpeechRecognition" in window || "webkitSpeechRecognition" in window;
};

const normalize = (s: string): string =>
  s
    .trim()
    .toLowerCase()
    .replace(/[.,!?'"]/g, "")
    .replace(/\s+/g, " ");

const levenshtein = (a: string, b: string): number => {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    new Array(n + 1).fill(0),
  );
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
};

export const similarity = (a: string, b: string): number => {
  const s1 = normalize(a);
  const s2 = normalize(b);
  if (!s1 || !s2) return 0;
  if (s1 === s2) return 1;
  const len = Math.max(s1.length, s2.length);
  return 1 - levenshtein(s1, s2) / len;
};
