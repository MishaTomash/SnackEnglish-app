import { useState, useEffect, useRef, useCallback } from "react";

interface SpeechRecognitionErrorEvent extends Event {
  readonly error: string;
  readonly message?: string;
}

interface SpeechRecognitionAlternative {
  readonly transcript: string;
  readonly confidence: number;
}

interface SpeechRecognitionResult {
  readonly isFinal: boolean;
  readonly length: number;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionResultList {
  readonly length: number;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionEvent extends Event {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultList;
}

interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onstart: ((this: SpeechRecognitionInstance, ev: Event) => void) | null;
  onend: ((this: SpeechRecognitionInstance, ev: Event) => void) | null;
  onerror:
    | ((
        this: SpeechRecognitionInstance,
        ev: SpeechRecognitionErrorEvent,
      ) => void)
    | null;
  onresult:
    | ((this: SpeechRecognitionInstance, ev: SpeechRecognitionEvent) => void)
    | null;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;

interface UseSpeechRecognitionOptions {
  lang?: string;
  onEnd?: (finalTranscript: string) => void;
}

interface UseSpeechRecognitionReturn {
  isListening: boolean;
  transcript: string;
  isSupported: boolean;
  errorMessage: string | null;
  startListening: () => void;
  stopListening: () => void;
  resetTranscript: () => void;
}

export const useSpeechRecognition = (
  options: UseSpeechRecognitionOptions = {},
): UseSpeechRecognitionReturn => {
  const { lang = "en-US", onEnd } = options;

  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const transcriptRef = useRef("");
  const onEndRef = useRef(onEnd);

  useEffect(() => {
    onEndRef.current = onEnd;
  }, [onEnd]);

  const getRecognitionConstructor = (): SpeechRecognitionConstructor | null => {
    if (typeof window === "undefined") return null;

    const windowWithSpeech = window as unknown as {
      SpeechRecognition?: SpeechRecognitionConstructor;
      webkitSpeechRecognition?: SpeechRecognitionConstructor;
    };

    return (
      windowWithSpeech.SpeechRecognition ??
      windowWithSpeech.webkitSpeechRecognition ??
      null
    );
  };

  const isSupported = Boolean(getRecognitionConstructor());

  useEffect(() => {
    const SpeechRecognitionClass = getRecognitionConstructor();
    if (!SpeechRecognitionClass) return;

    const recognition = new SpeechRecognitionClass();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = lang;

    recognition.onstart = () => {
      setIsListening(true);
      setErrorMessage(null);
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let currentResult = "";
      for (let i = 0; i < event.results.length; i += 1) {
        const item = event.results[i];
        if (item && item[0]) {
          currentResult += item[0].transcript;
        }
      }
      transcriptRef.current = currentResult;
      setTranscript(currentResult);
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      setIsListening(false);
      setErrorMessage(event.error);
    };

    recognition.onend = () => {
      setIsListening(false);
      if (onEndRef.current) {
        onEndRef.current(transcriptRef.current);
      }
    };

    recognitionRef.current = recognition;

    return () => {
      recognition.abort();
    };
  }, [lang]);

  const startListening = useCallback(() => {
    if (!recognitionRef.current || isListening) return;
    transcriptRef.current = "";
    setTranscript("");
    setErrorMessage(null);
    try {
      recognitionRef.current.start();
    } catch {
      // Захист від подвійного запуску інстансу в DOM
    }
  }, [isListening]);

  const stopListening = useCallback(() => {
    if (!recognitionRef.current || !isListening) return;
    recognitionRef.current.stop();
  }, [isListening]);

  const resetTranscript = useCallback(() => {
    transcriptRef.current = "";
    setTranscript("");
    setErrorMessage(null);
  }, []);

  return {
    isListening,
    transcript,
    isSupported,
    errorMessage,
    startListening,
    stopListening,
    resetTranscript,
  };
};
