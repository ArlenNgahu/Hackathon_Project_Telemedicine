// Text-to-speech (expo-speech, works in Expo Go) and speech-to-text
// (expo-speech-recognition, needs a dev build - it's a native module that
// isn't compiled into Expo Go). We feature-detect it and fall back to a
// typed-confirmation modal wherever the native module isn't available.

import { useCallback, useContext, useRef, useState } from 'react';
import * as Speech from 'expo-speech';
import { AppContext } from '../context/AppContext';
import { speechLocale } from '../theme/accessibility';

// Feature-detect the optional native STT module without hard-depending on it.
// `requireNativeModule` (called at import time inside the package) throws
// synchronously when the native module isn't registered - e.g. in Expo Go,
// or before a dev build has been compiled with this package included. That
// throw is caught here, same as the "package not installed at all" case.
let ExpoSpeechRecognitionModule = null;
let useSpeechRecognitionEvent = () => {};
try {
  // eslint-disable-next-line global-require
  const mod = require('expo-speech-recognition');
  ExpoSpeechRecognitionModule = mod.ExpoSpeechRecognitionModule;
  useSpeechRecognitionEvent = mod.useSpeechRecognitionEvent;
} catch (e) {
  ExpoSpeechRecognitionModule = null;
}

export const STT_AVAILABLE = !!ExpoSpeechRecognitionModule;

export function useSpeech() {
  const { lang } = useContext(AppContext);
  const [listening, setListening] = useState(false);
  const onResultRef = useRef(null);
  const onErrorRef = useRef(null);

  // These hooks are always called (rules of hooks) - when the native module
  // isn't available, `useSpeechRecognitionEvent` is the no-op fallback above.
  useSpeechRecognitionEvent('result', (event) => {
    if (!event.isFinal) return;
    const transcript = event.results?.[0]?.transcript?.trim();
    setListening(false);
    if (transcript && onResultRef.current) onResultRef.current(transcript);
  });

  useSpeechRecognitionEvent('end', () => setListening(false));

  useSpeechRecognitionEvent('error', (event) => {
    setListening(false);
    if (onErrorRef.current) onErrorRef.current(event);
  });

  const speak = useCallback(
    (text, opts = {}) => {
      if (!text) return;
      Speech.stop();
      Speech.speak(text, {
        language: speechLocale(lang),
        rate: opts.rate ?? 0.98,
        pitch: opts.pitch ?? 1.0,
        ...opts,
      });
    },
    [lang]
  );

  const stop = useCallback(() => Speech.stop(), []);

  // Starts listening. Calls onResult(transcript) with the final transcript,
  // or onError(event) if permission is denied / recognition fails - callers
  // use onError to fall back to the typed-confirmation modal.
  const startListening = useCallback(
    async (onResult, { onError } = {}) => {
      if (!STT_AVAILABLE) {
        onError?.({ error: 'not-allowed', message: 'STT unavailable' });
        return false;
      }
      onResultRef.current = onResult;
      onErrorRef.current = onError || null;

      const perm = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!perm.granted) {
        onError?.({ error: 'not-allowed', message: 'Permission denied' });
        return false;
      }

      setListening(true);
      ExpoSpeechRecognitionModule.start({
        lang: speechLocale(lang),
        interimResults: false,
        continuous: false,
      });
      return true;
    },
    [lang]
  );

  const stopListening = useCallback(() => {
    if (STT_AVAILABLE) ExpoSpeechRecognitionModule.stop();
    setListening(false);
  }, []);

  return { speak, stop, sttAvailable: STT_AVAILABLE, listening, startListening, stopListening };
}
