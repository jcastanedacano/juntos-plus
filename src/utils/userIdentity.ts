import { useEffect, useState } from 'react';
import { Owner } from '../types';
import { getMsalInstance } from '../auth/getToken';

/**
 * Maps email addresses → owner roles, so the app can tag activity to the
 * right person when either member of the couple signs in.
 *
 *   'me'      → the primary user (Jorge by default)
 *   'partner' → the partner (configured email in Pareja settings)
 *
 * Persisted in localStorage. The "me" email is taken from the currently
 * signed-in MSAL account if not set explicitly. The "partner" email is
 * set in the Pareja modal.
 */

const STORAGE_KEY = 'juntos:userEmailMap';
const CHANGE_EVENT = 'juntos:userEmailMap:change';

export interface UserEmailMap {
  /** Optional override for the primary user — if empty, uses active MSAL account. */
  me?: string;
  /** Partner's email — when this address signs in, defaults become 'partner'. */
  partner?: string;
}

function readFromStorage(): UserEmailMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as UserEmailMap;
    return {
      me: parsed.me?.trim().toLowerCase() || undefined,
      partner: parsed.partner?.trim().toLowerCase() || undefined,
    };
  } catch {
    return {};
  }
}

export function getUserEmailMap(): UserEmailMap {
  return readFromStorage();
}

export function setUserEmailMap(map: Partial<UserEmailMap>): void {
  const merged = { ...readFromStorage(), ...map };
  // Drop empty values
  if (!merged.me) delete merged.me;
  if (!merged.partner) delete merged.partner;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
}

/** Email of the currently signed-in MSAL account, lowercased. */
export function getCurrentUserEmail(): string | undefined {
  try {
    const instance = getMsalInstance();
    const account = instance?.getActiveAccount() || instance?.getAllAccounts()?.[0];
    return account?.username?.toLowerCase();
  } catch {
    return undefined;
  }
}

/**
 * Returns the owner role for the currently signed-in user — 'partner' if
 * their email matches the configured partner address, 'me' otherwise.
 * Used to default new transactions / imports / adjustments to the right
 * person without needing the user to think about it.
 */
export function getMyOwnerRole(): Owner {
  const map = readFromStorage();
  const email = getCurrentUserEmail();
  if (email && map.partner && email === map.partner) return 'partner';
  return 'me';
}

// ─── React hook so components re-render when the map changes ──────

function subscribe(cb: () => void): () => void {
  window.addEventListener(CHANGE_EVENT, cb);
  window.addEventListener('storage', cb);
  return () => {
    window.removeEventListener(CHANGE_EVENT, cb);
    window.removeEventListener('storage', cb);
  };
}

export function useMyOwnerRole(): Owner {
  const [role, setRole] = useState<Owner>(() => getMyOwnerRole());
  useEffect(() => {
    const update = () => setRole(getMyOwnerRole());
    update();
    return subscribe(update);
  }, []);
  return role;
}
