import { Owner } from '../types';

/**
 * Quien soy yo DENTRO DEL HOGAR: 'me' o 'partner', segun lo que dice el
 * servidor.
 *
 * Sin MSAL, sin localStorage y sin window a proposito, para poder probarlo.
 * userIdentity.ts lo consulta y, si el servidor aun no ha contestado, cae a la
 * deduccion antigua por correo.
 *
 * Por que esta en el servidor: cada navegador lo deducia por su cuenta y lo
 * guardaba en localStorage. En el movil de la pareja «yo» seguia siendo el
 * otro --y quien entraba por Google no tenia correo de MSAL con el que
 * compararse--, asi que todo lo que ella apuntaba quedaba a nombre de quien
 * creo el hogar. Con un dato por hogar y no por dispositivo, los dos ven lo
 * mismo.
 */

export type RolDelHogar = Extract<Owner, 'me' | 'partner'>;

let rolDelServidor: RolDelHogar | null = null;
const oyentes = new Set<() => void>();

/** Lo que el servidor dijo en la ultima consulta; cualquier otra cosa se ignora. */
export function fijarRolDelServidor(rol: unknown): void {
  const nuevo: RolDelHogar | null = rol === 'me' || rol === 'partner' ? rol : null;
  if (nuevo === rolDelServidor) return;
  rolDelServidor = nuevo;
  oyentes.forEach(cb => cb());
}

export function getRolDelServidor(): RolDelHogar | null {
  return rolDelServidor;
}

/** Para que useMyOwnerRole vuelva a pintar cuando llega el rol. */
export function suscribirRol(cb: () => void): () => void {
  oyentes.add(cb);
  return () => { oyentes.delete(cb); };
}

/**
 * El rol de quien esta mirando. El servidor manda; solo si todavia no ha
 * contestado --o esta caido-- se usa la deduccion por correo de antes.
 */
export function resolverRol(
  delServidor: RolDelHogar | null,
  correoActual: string | undefined,
  correoPareja: string | undefined,
): RolDelHogar {
  if (delServidor) return delServidor;
  if (correoActual && correoPareja && correoActual === correoPareja) return 'partner';
  return 'me';
}
