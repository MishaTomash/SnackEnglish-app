/**
 * Запис голосу з мікрофона: getUserMedia + MediaRecorder.
 * Працює і у вбудованих WebView Telegram (iOS, Android, Desktop), де немає
 * робочого Web Speech Recognition. Розпізнає записане сервер (shared/api/speechApi).
 *
 * Паралельно із записом AudioContext + AnalyserNode міряє гучність:
 * - рівень для анімації індикатора (onLevel);
 * - автозупинка після паузи в мовленні;
 * - чи був у записі хоч якийсь звук (тишу на сервер не шлемо).
 * Якщо AudioContext недоступний — запис однаково працює, просто без автозупинки.
 */

const DEFAULT_MAX_DURATION_MS = 6000;
/** Пауза після мовлення, яка завершує запис */
const DEFAULT_SILENCE_MS = 1200;
/** Коротше не зупиняємо по тиші: людина може почати говорити не одразу */
const MIN_RECORD_MS = 800;
/** Бітрейт мовлення: 6 с ≈ 25–50 КБ, розбірливість не страждає */
const AUDIO_BITS_PER_SECOND = 32000;

// Поріг "це мовлення" рахується від рівня шуму, але в цих межах
const SPEECH_RMS_MIN = 0.012;
const SPEECH_RMS_MAX = 0.04;
/** Пік нижче цього — практично тиша (мікрофон заглушено, юзер мовчав) */
const SILENT_PEAK_RMS = 0.006;
/** Будь-який живий мікрофон дає хоч трохи шуму; нулі = аналізатор не отримує звук */
const ANALYSER_ALIVE_RMS = 0.0005;

// Порядок важливий: Chrome/Android/Desktop — webm/opus, iOS Safari — mp4 (AAC)
const MIME_CANDIDATES = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/ogg;codecs=opus",
] as const;

// ==================== ПІДТРИМКА ====================

export const isRecordingSupported = (): boolean =>
    typeof window !== "undefined" &&
    window.isSecureContext !== false && // getUserMedia є лише на HTTPS / localhost
    typeof navigator !== "undefined" &&
    typeof navigator.mediaDevices?.getUserMedia === "function" &&
    typeof window.MediaRecorder === "function";

/**
 * Формат запису, який підтримує браузер.
 * "" — isTypeSupported недоступний або нічого не підійшло: хай браузер обере сам.
 */
export const pickRecorderMimeType = (): string => {
    if (typeof MediaRecorder === "undefined" || typeof MediaRecorder.isTypeSupported !== "function") {
        return "";
    }
    return MIME_CANDIDATES.find((type) => MediaRecorder.isTypeSupported(type)) ?? "";
};

type AudioContextCtor = typeof AudioContext;

const createAudioContext = (): AudioContext | null => {
    const w = window as unknown as {
        AudioContext?: AudioContextCtor;
        webkitAudioContext?: AudioContextCtor;
    };
    const Ctor = w.AudioContext ?? w.webkitAudioContext;
    if (!Ctor) return null;
    try {
        return new Ctor();
    } catch {
        return null;
    }
};

// ==================== ПОМИЛКИ ====================

export type RecordErrorCode =
    | "not-supported" // немає getUserMedia / MediaRecorder або не HTTPS
    | "not-allowed" // юзер, WebView або ОС заборонили мікрофон
    | "no-microphone" // мікрофона немає або він зайнятий іншою програмою
    | "aborted"
    | "unknown";

export class RecordError extends Error {
    readonly code: RecordErrorCode;

    constructor(code: RecordErrorCode, message?: string) {
        super(message ?? `Voice recording failed: ${code}`);
        this.name = "RecordError";
        this.code = code;
    }
}

const mapGetUserMediaError = (error: unknown): RecordErrorCode => {
    const name = error instanceof Error ? error.name : "";
    switch (name) {
        case "NotAllowedError":
        case "PermissionDeniedError":
        case "SecurityError":
            return "not-allowed";
        case "NotFoundError":
        case "DevicesNotFoundError":
        case "OverconstrainedError":
        case "NotReadableError": // мікрофон зайнятий іншою програмою або збій драйвера
        case "TrackStartError":
            return "no-microphone";
        case "TypeError": // небезпечний контекст (http) у деяких WebView
            return "not-supported";
        default:
            return "unknown";
    }
};

// ==================== ЗАПИС ====================

export interface RecordOptions {
    /** Жорсткий ліміт тривалості запису */
    maxDurationMs?: number;
    /** Скільки мс тиші після мовлення завершують запис */
    silenceMs?: number;
    /** Рівень гучності 0..1 і час від початку запису — для анімації (викликається ~60 разів/с) */
    onLevel?: (level: number, elapsedMs: number) => void;
    /** Скасування — Promise відхиляється з "aborted", запис викидається */
    signal?: AbortSignal;
}

export interface RecordResult {
    blob: Blob;
    mimeType: string;
    durationMs: number;
    /** true — у записі практично тиша; null — аналізатор недоступний, невідомо */
    silent: boolean | null;
}

let activeRecording: { stop: () => void; cancel: () => void } | null = null;

/**
 * Записує одну фразу з мікрофона. Завершується кнопкою (stopRecording),
 * паузою в мовленні або за maxDurationMs. Одночасно активний лише один запис.
 * Викликати з обробника жесту юзера (тап) — інакше iOS не дасть мікрофон/звук.
 */
export function recordVoice(options: RecordOptions = {}): Promise<RecordResult> {
    if (!isRecordingSupported()) return Promise.reject(new RecordError("not-supported"));
    if (options.signal?.aborted) return Promise.reject(new RecordError("aborted"));

    activeRecording?.cancel();

    const maxDurationMs = options.maxDurationMs ?? DEFAULT_MAX_DURATION_MS;
    const silenceMs = options.silenceMs ?? DEFAULT_SILENCE_MS;
    const preferredMime = pickRecorderMimeType();

    // AudioContext створюємо синхронно, ще в межах жесту юзера: інакше iOS лишить його "suspended"
    const audioContext = createAudioContext();

    return new Promise<RecordResult>((resolve, reject) => {
        let settled = false;
        let stopRequested = false;
        let stream: MediaStream | null = null;
        let recorder: MediaRecorder | null = null;
        let analyser: AnalyserNode | null = null;
        let samples: Float32Array<ArrayBuffer> | null = null;
        let startedAt = 0;
        let maxTimer: ReturnType<typeof setTimeout> | undefined;
        let frameId = 0;
        const chunks: Blob[] = [];

        // Стан детектора мовлення
        let smoothed = 0;
        let noiseFloor = Number.POSITIVE_INFINITY;
        let peak = 0;
        let analyserAlive = false;
        let speechDetected = false;
        let lastSpeechAt = 0;

        const cleanup = () => {
            clearTimeout(maxTimer);
            cancelAnimationFrame(frameId);
            options.signal?.removeEventListener("abort", cancel);
            // Зупинка треків гасить індикатор мікрофона в ОС і повертає звук iOS у звичайний режим
            stream?.getTracks().forEach((track) => track.stop());
            if (audioContext && audioContext.state !== "closed") {
                void audioContext.close().catch(() => undefined);
            }
            if (activeRecording === handle) activeRecording = null;
        };

        const fail = (error: RecordError) => {
            if (settled) return;
            settled = true;
            if (recorder && recorder.state !== "inactive") {
                recorder.ondataavailable = null;
                recorder.onstop = null;
                try {
                    recorder.stop();
                } catch {
                    // вже зупинено
                }
            }
            cleanup();
            reject(error);
        };

        const finish = () => {
            if (settled) return;
            settled = true;
            cleanup();
            const mimeType = recorder?.mimeType || preferredMime || "audio/webm";
            resolve({
                blob: new Blob(chunks, { type: mimeType }),
                mimeType,
                durationMs: startedAt ? performance.now() - startedAt : 0,
                silent: analyserAlive ? peak < SILENT_PEAK_RMS : null,
            });
        };

        const stop = () => {
            if (settled) return;
            stopRequested = true;
            // Якщо запис ще не стартував (чекаємо дозвіл) — зупинимось одразу після старту
            if (recorder && recorder.state !== "inactive") recorder.stop(); // далі onstop -> finish
        };

        const cancel = () => fail(new RecordError("aborted"));

        const handle = { stop, cancel };
        activeRecording = handle;
        options.signal?.addEventListener("abort", cancel, { once: true });

        const measure = (now: number) => {
            if (!analyser || !samples) return;
            analyser.getFloatTimeDomainData(samples);
            let sum = 0;
            for (let i = 0; i < samples.length; i++) sum += samples[i] * samples[i];
            const rms = Math.sqrt(sum / samples.length);

            if (rms > ANALYSER_ALIVE_RMS) analyserAlive = true;
            smoothed = smoothed * 0.7 + rms * 0.3;
            peak = Math.max(peak, smoothed);

            const elapsed = now - startedAt;
            if (elapsed > 150) noiseFloor = Math.min(noiseFloor, smoothed);
            const floor = Number.isFinite(noiseFloor) ? noiseFloor : 0;
            const threshold = Math.min(SPEECH_RMS_MAX, Math.max(SPEECH_RMS_MIN, floor * 3));

            if (smoothed > threshold) {
                speechDetected = true;
                lastSpeechAt = now;
            } else if (speechDetected && elapsed > MIN_RECORD_MS && now - lastSpeechAt > silenceMs) {
                stop(); // людина договорила — не чекаємо до кінця ліміту
            }
        };

        const tick = () => {
            if (settled) return;
            const now = performance.now();
            measure(now);
            // Корінь робить анімацію чутливішою до тихого голосу
            const level = Math.min(1, Math.sqrt(smoothed / 0.2));
            options.onLevel?.(level, now - startedAt);
            frameId = requestAnimationFrame(tick);
        };

        const startAnalyser = (mediaStream: MediaStream) => {
            if (!audioContext) return;
            try {
                const source = audioContext.createMediaStreamSource(mediaStream);
                analyser = audioContext.createAnalyser();
                analyser.fftSize = 1024;
                source.connect(analyser); // до destination не підключаємо — інакше юзер чутиме себе
                samples = new Float32Array(new ArrayBuffer(analyser.fftSize * Float32Array.BYTES_PER_ELEMENT));
                void audioContext.resume().catch(() => undefined);
            } catch {
                analyser = null; // без аналізатора: лише ліміт часу й кнопка
            }
        };

        navigator.mediaDevices
            .getUserMedia({
                audio: {
                    channelCount: 1,
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                },
            })
            .then((mediaStream) => {
                if (settled) {
                    // Поки чекали дозвіл, запис скасували — одразу відпускаємо мікрофон
                    mediaStream.getTracks().forEach((track) => track.stop());
                    return;
                }
                stream = mediaStream;

                try {
                    recorder = preferredMime
                        ? new MediaRecorder(mediaStream, { mimeType: preferredMime, audioBitsPerSecond: AUDIO_BITS_PER_SECOND })
                        : new MediaRecorder(mediaStream, { audioBitsPerSecond: AUDIO_BITS_PER_SECOND });
                } catch {
                    // Деякі WebView не приймають опції — пробуємо з налаштуваннями за замовчуванням
                    recorder = new MediaRecorder(mediaStream);
                }

                recorder.ondataavailable = (event: BlobEvent) => {
                    if (event.data && event.data.size > 0) chunks.push(event.data);
                };
                recorder.onstop = finish;
                recorder.onerror = () => fail(new RecordError("unknown"));

                recorder.start(250); // шматками: якщо запис обірветься, щось уже буде
                startedAt = performance.now();
                maxTimer = setTimeout(stop, maxDurationMs);
                startAnalyser(mediaStream);
                frameId = requestAnimationFrame(tick);

                if (stopRequested) recorder.stop(); // "Стоп" натиснули ще до старту запису
            })
            .catch((error: unknown) => {
                if (settled) return;
                if (error instanceof RecordError) {
                    fail(error);
                    return;
                }
                // Помилка конструктора MediaRecorder теж потрапляє сюди
                const code = stream ? "unknown" : mapGetUserMediaError(error);
                fail(new RecordError(code, error instanceof Error ? error.message : undefined));
            });
    });
}

/** М'яко завершує поточний запис (кнопка "Стоп") — recordVoice() віддасть записане */
export function stopRecording(): void {
    activeRecording?.stop();
}