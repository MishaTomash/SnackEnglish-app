/**
 * Розпізнавання мовлення засобами браузера (Web Speech Recognition).
 * Безкоштовне, але звук іде на сервери Google/Microsoft, тому стабільно працює
 * лише у звичайних Chrome та Edge. У WebView Telegram (Desktop, Android, iOS)
 * конструктор часто є, але start() одразу закінчується помилкою "network".
 * Використовується лише в режимі SPEECH_PROVIDER=browser.
 */

const DEFAULT_LANG = "en-US";
const DEFAULT_TIMEOUT_MS = 6000;

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

/** Чи є в браузері Web Speech Recognition (не гарантує, що сервіс за ним працює) */
export const isBrowserRecognitionAvailable = (): boolean => getRecognitionCtor() !== null;

export type BrowserRecognitionErrorCode =
    | "not-supported"
    | "not-allowed"
    | "no-speech"
    | "audio-capture"
    | "network"
    | "language-not-supported"
    | "aborted"
    | "unknown";

export class BrowserRecognitionError extends Error {
    readonly code: BrowserRecognitionErrorCode;

    constructor(code: BrowserRecognitionErrorCode, message?: string) {
        super(message ?? `Browser speech recognition failed: ${code}`);
        this.name = "BrowserRecognitionError";
        this.code = code;
    }
}

const mapRecognitionError = (error: string): BrowserRecognitionErrorCode => {
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

export interface BrowserRecognitionOptions {
    lang?: string;
    maxAlternatives?: number;
    timeoutMs?: number;
    onInterim?: (transcript: string) => void;
    signal?: AbortSignal;
}

export interface BrowserRecognitionResult {
    transcript: string;
    alternatives: string[];
    confidence: number;
}

let activeRecognition: { recognition: RecognitionLike; cancel: () => void } | null = null;

/**
 * Слухає одну фразу. Резолвиться результатом або відхиляється з BrowserRecognitionError.
 * Одночасно активне лише одне прослуховування — новий виклик скасовує попереднє.
 */
export function recognizeInBrowser(options: BrowserRecognitionOptions = {}): Promise<BrowserRecognitionResult> {
    const Ctor = getRecognitionCtor();
    if (!Ctor) return Promise.reject(new BrowserRecognitionError("not-supported"));
    if (options.signal?.aborted) return Promise.reject(new BrowserRecognitionError("aborted"));

    activeRecognition?.cancel();

    const recognition = new Ctor();
    recognition.lang = options.lang ?? DEFAULT_LANG;
    recognition.continuous = false;
    recognition.interimResults = Boolean(options.onInterim);
    recognition.maxAlternatives = options.maxAlternatives ?? 5;

    return new Promise<BrowserRecognitionResult>((resolve, reject) => {
        const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
        let result: BrowserRecognitionResult | null = null;
        let error: BrowserRecognitionError | null = null;
        let settled = false;

        const finish = () => {
            if (settled) return;
            settled = true;
            clearTimeout(stopTimer);
            clearTimeout(hardTimer);
            options.signal?.removeEventListener("abort", cancel);
            if (activeRecognition?.recognition === recognition) activeRecognition = null;
            if (result && !error) resolve(result);
            else reject(error ?? new BrowserRecognitionError("no-speech"));
        };

        const cancel = () => {
            error = new BrowserRecognitionError("aborted");
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
            error = new BrowserRecognitionError(mapRecognitionError(event.error));
        };

        recognition.onend = finish;

        options.signal?.addEventListener("abort", cancel, { once: true });
        activeRecognition = { recognition, cancel };

        try {
            recognition.start();
        } catch (e) {
            error = new BrowserRecognitionError("unknown", e instanceof Error ? e.message : undefined);
            finish();
        }
    });
}

/** М'яко завершує поточне прослуховування — recognizeInBrowser() віддасть почуте */
export function stopBrowserRecognition(): void {
    activeRecognition?.recognition.stop();
}