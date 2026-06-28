declare module 'react-speech-recognition' {
  export interface SpeechRecognitionOptions {
    transcribing?: boolean;
    clearTranscriptOnListen?: boolean;
    commands?: Array<{
      command: string | RegExp | string[];
      callback: (...args: any[]) => void;
      isFuzzyMatch?: boolean;
      fuzzyMatchingThreshold?: number;
      bestMatchOnly?: boolean;
      matchInterim?: boolean;
    }>;
  }

  export interface ListeningOptions {
    continuous?: boolean;
    language?: string;
  }

  export interface SpeechRecognition {
    startListening: (options?: ListeningOptions) => Promise<void>;
    stopListening: () => Promise<void>;
    abortListening: () => Promise<void>;
    browserSupportsSpeechRecognition: () => boolean;
    applyPolyfill: (polyfill: any) => void;
  }

  export interface UseSpeechRecognitionReturn {
    transcript: string;
    interimTranscript: string;
    finalTranscript: string;
    listening: boolean;
    resetTranscript: () => void;
    browserSupportsSpeechRecognition: boolean;
    isMicrophoneAvailable: boolean;
  }

  export const useSpeechRecognition: (options?: SpeechRecognitionOptions) => UseSpeechRecognitionReturn;
  const SpeechRecognition: SpeechRecognition;
  export default SpeechRecognition;
}
