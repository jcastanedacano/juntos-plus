import { describe, it, expect, afterEach } from 'vitest';

/**
 * La sesion de Google es una cookie firmada por NOSOTROS: si se puede falsificar
 * o si sobrevive a un cambio de secreto, cualquiera entra al hogar de otro. Eso
 * es lo que se prueba aqui.
 */
function cargar(secreto?: string) {
  if (secreto === undefined) delete process.env.SESSION_SECRET;
  else process.env.SESSION_SECRET = secreto;
  const ruta = require.resolve('../../../googleAuth.cjs');
  delete require.cache[ruta];
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require('../../../googleAuth.cjs');
}

const SECRETO_ORIGINAL = process.env.SESSION_SECRET;
afterEach(() => {
  if (SECRETO_ORIGINAL === undefined) delete process.env.SESSION_SECRET;
  else process.env.SESSION_SECRET = SECRETO_ORIGINAL;
  delete require.cache[require.resolve('../../../googleAuth.cjs')];
});

const conCookie = (valor: string) => ({ headers: { cookie: valor } });

describe('lectura de cookies', () => {
  it('separa varias y descodifica el valor', () => {
    const s = cargar('x');
    const c = s.leerCookies(conCookie('a=1; juntos_sesion=ab%40c; b=2'));
    expect(c.a).toBe('1');
    expect(c.juntos_sesion).toBe('ab@c');
    expect(c.b).toBe('2');
  });

  it('sin cabecera devuelve un objeto vacio, no revienta', () => {
    const s = cargar('x');
    expect(s.leerCookies({ headers: {} })).toEqual({});
  });
});

describe('la sesion que emitimos', () => {
  it('ida y vuelta: conserva quien es', () => {
    const s = cargar('secreto-de-prueba');
    const token = s.firmarSesion({ sub: 'g-123', email: 'Ana@Gmail.com', name: 'Ana' });
    const perfil = s.sesionDe(conCookie(`juntos_sesion=${token}`));
    expect(perfil.sub).toBe('g-123');
    expect(perfil.email).toBe('Ana@Gmail.com');
  });

  // Lo que impide que alguien se fabrique una sesion a mano.
  it('una cookie inventada no vale', () => {
    const s = cargar('secreto-de-prueba');
    expect(s.sesionDe(conCookie('juntos_sesion=esto.no.es'))).toBeNull();
    expect(s.sesionDe(conCookie('juntos_sesion='))).toBeNull();
    expect(s.sesionDe({ headers: {} })).toBeNull();
  });

  it('una sesion firmada con OTRO secreto se rechaza', () => {
    const antes = cargar('secreto-viejo');
    const token = antes.firmarSesion({ sub: 'g-123', email: 'ana@gmail.com' });
    const despues = cargar('secreto-nuevo');
    expect(despues.sesionDe(conCookie(`juntos_sesion=${token}`))).toBeNull();
  });

  it('sin secreto configurado no se reconoce ninguna sesion', () => {
    const s = cargar(undefined);
    expect(s.sesionDe(conCookie('juntos_sesion=loquesea'))).toBeNull();
    expect(s.GOOGLE_ACTIVO).toBe(false);
  });
});

describe('el perfil que ve el resto del servidor', () => {
  // hogares identifica por `oid || sub` y el correo por `preferred_username ||
  // email || upn`. Un perfil de Google tiene sub y email, asi que encaja sin
  // que el modulo de hogares sepa de donde vino.
  it('trae sub y email, que es lo que hogares necesita', () => {
    const s = cargar('secreto-de-prueba');
    const token = s.firmarSesion({ sub: 'g-9', email: 'beto@gmail.com' });
    const perfil = s.sesionDe(conCookie(`juntos_sesion=${token}`));
    expect(perfil.sub).toBeTruthy();
    expect(perfil.email).toBeTruthy();
  });
});
