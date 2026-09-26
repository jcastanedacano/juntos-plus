import { describe, it, expect, beforeEach } from 'vitest';
import {
  fijarRolDelServidor, getRolDelServidor, suscribirRol, resolverRol,
} from '../rolPropio';

/**
 * «Yo» tiene que ser el mismo en los dos dispositivos. Lo decide el servidor;
 * la deduccion por correo de antes queda solo como respaldo mientras no ha
 * contestado.
 */

beforeEach(() => fijarRolDelServidor(null));

describe('el rol que manda el servidor', () => {
  it('se guarda y se lee', () => {
    fijarRolDelServidor('partner');
    expect(getRolDelServidor()).toBe('partner');
  });

  it('cualquier otra cosa se ignora y deja al servidor sin contestar', () => {
    fijarRolDelServidor('me');
    for (const raro of ['shared', 'jorge', '', null, undefined, 42, {}]) {
      fijarRolDelServidor(raro);
      expect(getRolDelServidor()).toBeNull();
    }
  });

  it('avisa a quien mira solo cuando cambia', () => {
    let avisos = 0;
    const baja = suscribirRol(() => { avisos++; });
    fijarRolDelServidor('me');
    fijarRolDelServidor('me');      // igual: nada que avisar
    fijarRolDelServidor('partner');
    expect(avisos).toBe(2);
    baja();
    fijarRolDelServidor('me');
    expect(avisos).toBe(2);         // ya no oye
  });
});

describe('resolver el rol', () => {
  it('el servidor manda, aunque el correo diga otra cosa', () => {
    // El caso que estaba roto: la pareja abre la app en SU dispositivo y en
    // el localStorage no hay nada que la distinga. El servidor si lo sabe.
    expect(resolverRol('partner', undefined, undefined)).toBe('partner');
    expect(resolverRol('me', 'zumy@x.com', 'zumy@x.com')).toBe('me');
  });

  it('sin respuesta del servidor cae a la deduccion por correo de antes', () => {
    expect(resolverRol(null, 'zumy@x.com', 'zumy@x.com')).toBe('partner');
    expect(resolverRol(null, 'jorge@x.com', 'zumy@x.com')).toBe('me');
  });

  it('sin nada que comparar, «yo»', () => {
    expect(resolverRol(null, undefined, undefined)).toBe('me');
    expect(resolverRol(null, 'jorge@x.com', undefined)).toBe('me');
  });
});
