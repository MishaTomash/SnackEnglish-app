import { useState, useEffect, useRef, useCallback } from "react";
import {
  isRecognitionSupported,
  listen,
  ListenError,
  loadSpeechMode,
  stopListening as stopActiveListening,
} from "./speech";
import type { ListenErrorCode } from "./speech";

/**
 * Хук розпізнавання однієї фрази для SpeechPracticeBlock.
 *
 * ВИПРАВЛЕНО: раніше хук напряму використовував Web Speech API (window.SpeechRecognition),
 * який у Telegram (Desktop, Android, iOS) одразу падає з помилкою "network".
 * Тепер він працює через спільний listen() із speech.ts — той самий механізм, що й
 * крок "Скажи вголос": запис + розпізнавання на сервері або браузерний режим,
 * залежно від SPEECH_PROVIDER на бекенді. Інтерфейс хука не змінився.
 */

interface UseSpeechRecognitionOptions {
  lang?: string;
  /** Викликається після кожної спроби: розпізнаний текст або "" (тиша чи помилка) */
  onEnd?: (finalTranscript: string) => void;
}

interface UseSpeechRecognitionReturn {
  /** Іде запис голосу */
  isListening: boolean;
  /** Запис завершено, чекаємо розпізнавання на сервері */
  isProcessing: boolean;
  transcript: string;
  isSupported: boolean;
  /** Код помилки останньої спроби (ListenErrorCode) або null */
  errorMessage: ListenErrorCode | null;
  startListening: () => void;
  stopListening: () => void;
  resetTranscript: () => void;
}

export const useSpeechRecognition = (
  options: UseSpeechRecognitionOptions = {},
): UseSpeechRecognitionReturn => {
  const { lang = "en-US", onEnd } = options;

  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [errorMessage, setErrorMessage] = useState<ListenErrorCode | null>(null);
  // Лише щоб перемалювати компонент, коли сервер повідомив режим розпізнавання
  const [, setModeLoaded] = useState(false);

  const onEndRef = useRef(onEnd);
  const abortRef = useRef<AbortController | null>(null);
  const activeRef = useRef(false);

  useEffect(() => {
    onEndRef.current = onEnd;
  }, [onEnd]);

  useEffect(() => {
    let alive = true;
    void loadSpeechMode().then(() => {
      if (alive) setModeLoaded(true);
    });
    return () => {
      alive = false;
      abortRef.current?.abort(); // вихід зі сторінки — зупиняємо мікрофон і запит
    };
  }, []);

  // Поки режим не відомий, вважається "server" — тож кнопка не зникає даремно
  const isSupported = isRecognitionSupported();

  const startListening = useCallback(() => {
    if (activeRef.current) return;
    activeRef.current = true;

    setTranscript("");
    setErrorMessage(null);
    setIsListening(true);
    setIsProcessing(false);

    const controller = new AbortController();
    abortRef.current = controller;

    // listen() викликається синхронно в межах тапу — важливо для мікрофона на iOS
    void listen({
      lang,
      signal: controller.signal,
      onPhase: (phase) => {
        if (controller.signal.aborted) return;
        setIsListening(phase === "recording");
        setIsProcessing(phase === "processing");
      },
    })
      .then((result) => {
        if (controller.signal.aborted) return;
        setTranscript(result.transcript);
        onEndRef.current?.(result.transcript);
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        const code: ListenErrorCode = error instanceof ListenError ? error.code : "unknown";
        if (code === "aborted") return;
        setErrorMessage(code);
        // Як і раніше: невдала спроба завершується порожнім текстом
        onEndRef.current?.("");
      })
      .finally(() => {
        if (abortRef.current === controller) abortRef.current = null;
        activeRef.current = false;
        if (controller.signal.aborted) return;
        setIsListening(false);
        setIsProcessing(false);
      });
  }, [lang]);

  const stopListening = useCallback(() => {
    // М'яко: записане буде розпізнано
    if (activeRef.current) stopActiveListening();
  }, []);

  const resetTranscript = useCallback(() => {
    setTranscript("");
    setErrorMessage(null);
  }, []);

  return {
    isListening,
    isProcessing,
    transcript,
    isSupported,
    errorMessage,
    startListening,
    stopListening,
    resetTranscript,
  };
};