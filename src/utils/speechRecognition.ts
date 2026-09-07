/**
 * Envoltura fina sobre la Web Speech API.
 *
 * Va aparte del parser a proposito: el parser es puro y se puede probar en
 * Node, esto necesita navegador. La API sigue siendo prefijada en la mayoria
 * de los navegadores, de ahi el acceso por window con cast.
 */

type SpeechRecognitionCtor = new () => any;

function getRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as any;
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

export function isSpeechSupported(): boolean {
  return getRecognitionCtor() !== null;
}

export interface ListenCallbacks {
  /** Texto provisional mientras se habla, para dar señal de vida. */
  onPartial?: (text: string) => void;
  onResult: (text: string) => void;
  onError: (message: string) => void;
  onEnd?: () => void;
}

export interface Listener {
  stop: () => void;
}

const ERROR_MESSAGES: Record<string, string> = {
  'no-speech': 'No escuché nada. Probá de nuevo.',
  'audio-capture': 'No encuentro un micrófono disponible.',
  'not-allowed': 'Falta permiso para usar el micrófono.',
  'service-not-allowed': 'El navegador bloqueó el reconocimiento de voz.',
  network: 'El reconocimiento de voz necesita conexión.',
  aborted: 'Dictado cancelado.',
};

/**
 * Arranca el dictado en español. Devuelve un handle para cortarlo; si el
 * navegador no soporta la API, avisa por onError y devuelve null.
 */
export function listenOnce(callbacks: ListenCallbacks): Listener | null {
  const Ctor = getRecognitionCtor();
  if (!Ctor) {
    callbacks.onError('Este navegador no soporta dictado por voz.');
    return null;
  }

  const recognition = new Ctor();
  recognition.lang = 'es-PE';
  recognition.continuous = false;
  recognition.interimResults = true;
  recognition.maxAlternatives = 1;

  let finalText = '';

  recognition.onresult = (event: any) => {
    let interim = '';
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const result = event.results[i];
      if (result.isFinal) finalText += result[0].transcript;
      else interim += result[0].transcript;
    }
    if (interim && callbacks.onPartial) callbacks.onPartial(interim);
  };

  recognition.onerror = (event: any) => {
    callbacks.onError(ERROR_MESSAGES[event.error] || 'No se pudo escuchar.');
  };

  recognition.onend = () => {
    // El resultado se entrega en onend y no en onresult: asi llega una sola
    // vez y ya completo, aunque el motor haya emitido varios fragmentos.
    const text = finalText.trim();
    if (text) callbacks.onResult(text);
    callbacks.onEnd?.();
  };

  try {
    recognition.start();
  } catch {
    callbacks.onError('No se pudo iniciar el micrófono.');
    return null;
  }

  return {
    stop: () => {
      try { recognition.stop(); } catch { /* ya estaba detenido */ }
    },
  };
}
