import { describe, it, expect } from 'vitest';

// El servidor es CommonJS; se importan solo los helpers puros de autorizacion.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { correoDelToken, permitido } = require('../../../server.cjs');

const externo = { nombre: 'externo', exigeLista: true };
const trabajo = { nombre: 'trabajo', exigeLista: false };

describe('de donde sale el correo del token', () => {
  it('lee preferred_username, email o upn, en ese orden', () => {
    expect(correoDelToken({ preferred_username: 'Ana@Example.com' })).toBe('ana@example.com');
    expect(correoDelToken({ email: 'b@example.com' })).toBe('b@example.com');
    expect(correoDelToken({ upn: 'c@example.com' })).toBe('c@example.com');
  });

  it('sin ninguno de los tres devuelve cadena vacia, no undefined', () => {
    expect(correoDelToken({})).toBe('');
    expect(correoDelToken({ sub: 'abc' })).toBe('');
  });
});

describe('quien puede entrar', () => {
  it('el tenant de trabajo no exige lista: el directorio ya es la lista', () => {
    expect(permitido({ preferred_username: 'quien@sea.com' }, trabajo)).toBe(true);
    expect(permitido({}, trabajo)).toBe(true);
  });

  // Lo que sigue es la razon de ser de todo esto: con registro libre en el
  // tenant externo, cualquiera consigue un token valido. Si la lista fallara
  // abierta, un Gmail cualquiera leeria las finanzas de la pareja.
  it('un token externo sin lista configurada NO entra', () => {
    expect(permitido({ preferred_username: 'desconocido@gmail.com' }, externo)).toBe(false);
  });

  it('un token externo sin correo tampoco entra', () => {
    expect(permitido({ sub: 'oid-suelto' }, externo)).toBe(false);
    expect(permitido({ preferred_username: '' }, externo)).toBe(false);
  });
});
