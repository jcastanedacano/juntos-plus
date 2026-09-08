import { describe, it, expect, afterEach } from 'vitest';

// El servidor es CommonJS; se importan solo los helpers puros de autorizacion.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { correoDelToken, permitido } = require('../../../server.cjs');

const externo = { nombre: 'externo', sujetoALista: true };
const trabajo = { nombre: 'trabajo', sujetoALista: false };

/**
 * ALLOWED_USERS se lee al cargar el modulo, asi que probar el modo cerrado
 * exige recargarlo con la variable puesta.
 */
function cargarConLista(lista: string) {
  process.env.ALLOWED_USERS = lista;
  const ruta = require.resolve('../../../server.cjs');
  delete require.cache[ruta];
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require('../../../server.cjs');
}

const ALLOWED_ORIGINAL = process.env.ALLOWED_USERS;
afterEach(() => {
  if (ALLOWED_ORIGINAL === undefined) delete process.env.ALLOWED_USERS;
  else process.env.ALLOWED_USERS = ALLOWED_ORIGINAL;
  delete require.cache[require.resolve('../../../server.cjs')];
});

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
  it('el tenant de trabajo no mira la lista: el directorio ya es la lista', () => {
    expect(permitido({ preferred_username: 'quien@sea.com' }, trabajo)).toBe(true);
    expect(permitido({}, trabajo)).toBe(true);
  });

  // La lista dejo de ser el candado de los datos el dia que cada quien tiene su
  // hogar: sin lista, cualquiera entra, y lo que ve es un hogar vacio suyo.
  it('sin lista configurada, el registro esta abierto', () => {
    expect(permitido({ preferred_username: 'desconocida@gmail.com' }, externo)).toBe(true);
  });

  it('con lista configurada, solo entra quien esta en ella', () => {
    const s = cargarConLista('ana@gmail.com, Beto@Gmail.com');
    expect(s.permitido({ preferred_username: 'ana@gmail.com' }, externo)).toBe(true);
    // La lista se normaliza al leerla, asi que las mayusculas no dejan a nadie fuera.
    expect(s.permitido({ preferred_username: 'beto@gmail.com' }, externo)).toBe(true);
    expect(s.permitido({ preferred_username: 'otro@gmail.com' }, externo)).toBe(false);
  });

  it('con lista, un token sin correo no entra', () => {
    const s = cargarConLista('ana@gmail.com');
    expect(s.permitido({ sub: 'oid-suelto' }, externo)).toBe(false);
    expect(s.permitido({ preferred_username: '' }, externo)).toBe(false);
  });
});
