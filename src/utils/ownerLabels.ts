import { useEffect, useState, useSyncExternalStore } from 'react';
import { Owner } from '../types';

// Defaults — also fall back to these for any missing key.
export const DEFAULT_OWNER_LABELS: Record<Owner, string> = {
  shared: 'Compartido',
  me: 'Yo',
  partner: 'Pareja',
};

const STORAGE_KEY = 'juntos:ownerLabels';
const CHANGE_EVENT = 'juntos:ownerLabels:change';

function readFromStorage(): Record<Owner, string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_OWNER_LABELS };
    const parsed = JSON.parse(raw) as Partial<Record<Owner, string>>;
    return {
      shared: parsed.shared?.trim() || DEFAULT_OWNER_LABELS.shared,
      me: parsed.me?.trim() || DEFAULT_OWNER_LABELS.me,
      partner: parsed.partner?.trim() || DEFAULT_OWNER_LABELS.partner,
    };
  } catch {
    return { ...DEFAULT_OWNER_LABELS };
  }
}

export function getOwnerLabels(): Record<Owner, string> {
  return readFromStorage();
}

export function setOwnerLabels(labels: Partial<Record<Owner, string>>): void {
  const merged = { ...readFromStorage(), ...labels };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
  // Notify same-tab listeners (storage event only fires across tabs).
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
}

// useSyncExternalStore for cross-tab + custom event subscription.
function subscribe(cb: () => void): () => void {
  window.addEventListener(CHANGE_EVENT, cb);
  window.addEventListener('storage', cb);
  return () => {
    window.removeEventListener(CHANGE_EVENT, cb);
    window.removeEventListener('storage', cb);
  };
}

// Cache the snapshot so React can stable-compare.
let cachedSnapshot: Record<Owner, string> = readFromStorage();
let cachedSerialized: string = JSON.stringify(cachedSnapshot);
function getSnapshot(): Record<Owner, string> {
  const fresh = readFromStorage();
  const ser = JSON.stringify(fresh);
  if (ser !== cachedSerialized) {
    cachedSnapshot = fresh;
    cachedSerialized = ser;
  }
  return cachedSnapshot;
}

/**
 * Subscribe to the user's custom owner labels. Components re-render when
 * the user updates labels in Settings. Falls back to DEFAULT_OWNER_LABELS.
 */
export function useOwnerLabels(): Record<Owner, string> {
  // useSyncExternalStore would be ideal but is React 18-only and requires
  // a stable getSnapshot. We use the equivalent useState + useEffect pattern
  // so this works regardless of the bundler's React version.
  const [labels, setLabels] = useState<Record<Owner, string>>(() => getSnapshot());
  useEffect(() => {
    const update = () => setLabels(getSnapshot());
    update(); // sync after mount
    return subscribe(update);
  }, []);
  return labels;
}
// Re-export useSyncExternalStore-style helper for internal callers that want it.
export { useSyncExternalStore };
