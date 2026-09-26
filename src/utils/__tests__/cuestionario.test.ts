import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const cuestionario = require('../../../cuestionario.cjs');

const { CATEGORIAS, validarRespuesta, rondaActual, guardarRespuesta, consultar, montarRutas } = cuestionario;

/**
 * Lo importante de este modulo es lo que NO sale: la respuesta de la otra
 * persona no puede llegar a quien todavia no ha respondido, porque conocerla
 * cambiaria lo que responde. Estas pruebas lo fijan con cifras que se pueden
 * buscar en el JSON serializado.
 */

let dir = '';
beforeEach(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cuestionario-')); });
afterEach(() => { fs.rmSync(dir, { recursive: true, force: true }); });

const ANA = 'ana-oid';
const BETO = 'beto-oid';
const PAREJA = [ANA, BETO];
const AHORA = new Date('2026-09-26T12:00:00Z');

/** Reparto que suma 100, con un valor «marca» facil de rastrear. */
const reparto = (extra: Record<string, number>) => ({ ahorro: 100 - Object.values(extra).reduce((a, b) => a + b, 0), ...extra });

const ana = reparto({ viajes: 37 });      // 37 solo aparece en Ana
const beto = reparto({ familia: 41 });    // 41 solo aparece en Beto

describe('validar una respuesta', () => {
  it('acepta un reparto que suma 100 y rellena con cero lo que falta', () => {
    const r = validarRespuesta({ ahorro: 60, viajes: 40 });
    expect(r.error).toBeUndefined();
    expect(Object.keys(r.puntos)).toHaveLength(CATEGORIAS.length);
    expect(r.puntos.deudas).toBe(0);
    expect(r.puntos.ahorro).toBe(60);
  });

  it('la suma tiene que ser exactamente 100', () => {
    expect(validarRespuesta({ ahorro: 99 }).error).toBe('suma_invalida');
    expect(validarRespuesta({ ahorro: 60, viajes: 41 }).error).toBe('suma_invalida');
    expect(validarRespuesta({}).error).toBe('suma_invalida');
  });

  it('rechaza lo que no son enteros no negativos', () => {
    for (const malo of [-5, 12.5, '50', NaN, Infinity, null, 101]) {
      expect(validarRespuesta({ ahorro: malo, viajes: 50 }).error).toBe('puntos_invalidos');
    }
  });

  it('rechaza categorias que no existen', () => {
    expect(validarRespuesta({ ahorro: 50, inventada: 50 }).error).toBe('categoria_desconocida');
  });

  it('rechaza lo que ni siquiera es un objeto', () => {
    for (const malo of [null, undefined, 'x', 42, [1, 2, 3]]) {
      expect(validarRespuesta(malo).error).toBe('respuesta_invalida');
    }
  });
});

describe('la ronda es el año', () => {
  it('sale de la fecha', () => {
    expect(rondaActual(new Date('2026-01-01T00:00:00Z'))).toBe('2026');
    expect(rondaActual(new Date('2027-12-31T23:59:59Z'))).toBe('2027');
  });
});

describe('lo que la otra persona respondio no se filtra', () => {
  it('quien responde primero no ve nada de la otra hasta que la otra responda', async () => {
    await guardarRespuesta({ dir, clave: BETO, miembros: PAREJA, entrada: beto, ahora: AHORA });

    const vistaAna = await consultar({ dir, clave: ANA, miembros: PAREJA, ahora: AHORA });
    expect(vistaAna.pareja).toEqual({ respondio: true });
    expect(vistaAna.completa).toBe(false);
    // Ni el numero marca de Beto aparece en NINGUN sitio de lo que sale al cliente de Ana.
    expect(JSON.stringify(vistaAna)).not.toContain('41');
  });

  it('con la otra persona sin responder, tampoco hay puntos ni marca de respuesta', async () => {
    await guardarRespuesta({ dir, clave: ANA, miembros: PAREJA, entrada: ana, ahora: AHORA });
    const v = await consultar({ dir, clave: ANA, miembros: PAREJA, ahora: AHORA });
    expect(v.pareja).toEqual({ respondio: false });
    expect(v.yo.puntos.viajes).toBe(37);
  });

  it('cuando responden las dos, cada una ve la de la otra', async () => {
    await guardarRespuesta({ dir, clave: ANA, miembros: PAREJA, entrada: ana, ahora: AHORA });
    await guardarRespuesta({ dir, clave: BETO, miembros: PAREJA, entrada: beto, ahora: AHORA });

    const a = await consultar({ dir, clave: ANA, miembros: PAREJA, ahora: AHORA });
    const b = await consultar({ dir, clave: BETO, miembros: PAREJA, ahora: AHORA });
    expect(a.completa).toBe(true);
    expect(a.pareja.puntos.familia).toBe(41);
    expect(b.pareja.puntos.viajes).toBe(37);
    expect(a.yo.puntos.viajes).toBe(37);
  });

  it('el archivo lo guarda todo, pero solo salen al cliente las vistas de arriba', async () => {
    await guardarRespuesta({ dir, clave: ANA, miembros: PAREJA, entrada: ana, ahora: AHORA });
    expect(fs.existsSync(path.join(dir, 'cuestionario.json'))).toBe(true);
    // Y NO se mezcla con los datos del hogar, que GET /api/data devuelve enteros.
    expect(fs.existsSync(path.join(dir, 'data.json'))).toBe(false);
  });
});

describe('cambiar la respuesta', () => {
  it('se puede corregir mientras la otra persona no haya respondido', async () => {
    await guardarRespuesta({ dir, clave: ANA, miembros: PAREJA, entrada: ana, ahora: AHORA });
    const r = await guardarRespuesta({ dir, clave: ANA, miembros: PAREJA, entrada: { ahorro: 100 }, ahora: AHORA });
    expect(r.ok).toBe(true);
    const v = await consultar({ dir, clave: ANA, miembros: PAREJA, ahora: AHORA });
    expect(v.yo.puntos.ahorro).toBe(100);
    expect(v.yo.puntos.viajes).toBe(0);
  });

  it('con las dos dentro la ronda se cierra: cambiar tras ver la otra es lo que se evita', async () => {
    await guardarRespuesta({ dir, clave: ANA, miembros: PAREJA, entrada: ana, ahora: AHORA });
    await guardarRespuesta({ dir, clave: BETO, miembros: PAREJA, entrada: beto, ahora: AHORA });
    const r = await guardarRespuesta({ dir, clave: ANA, miembros: PAREJA, entrada: { ahorro: 100 }, ahora: AHORA });
    expect(r.error).toBe('ronda_cerrada');
    const v = await consultar({ dir, clave: ANA, miembros: PAREJA, ahora: AHORA });
    expect(v.yo.puntos.viajes).toBe(37);
  });

  it('quien no es del hogar no puede responder', async () => {
    const r = await guardarRespuesta({ dir, clave: 'intruso', miembros: PAREJA, entrada: ana, ahora: AHORA });
    expect(r.error).toBe('no_es_miembro');
    expect(fs.existsSync(path.join(dir, 'cuestionario.json'))).toBe(false);
  });

  it('una respuesta invalida no toca el archivo', async () => {
    const r = await guardarRespuesta({ dir, clave: ANA, miembros: PAREJA, entrada: { ahorro: 50 }, ahora: AHORA });
    expect(r.error).toBe('suma_invalida');
    expect(fs.existsSync(path.join(dir, 'cuestionario.json'))).toBe(false);
  });
});

describe('hogares de una sola persona y miembros que se van', () => {
  it('una persona sola puede responder, pero la ronda no se completa', async () => {
    await guardarRespuesta({ dir, clave: ANA, miembros: [ANA], entrada: ana, ahora: AHORA });
    const v = await consultar({ dir, clave: ANA, miembros: [ANA], ahora: AHORA });
    expect(v.completa).toBe(false);
    expect(v.miembros).toBe(1);
    expect(v.pareja.respondio).toBe(false);
  });

  it('la respuesta de alguien que ya no es del hogar no cuenta', async () => {
    await guardarRespuesta({ dir, clave: 'ex', miembros: ['ex', ANA], entrada: beto, ahora: AHORA });
    const v = await consultar({ dir, clave: ANA, miembros: [ANA, BETO], ahora: AHORA });
    expect(v.pareja.respondio).toBe(false);
    expect(v.completa).toBe(false);
  });
});

describe('rondas anuales', () => {
  const cerrar = async (ahora: Date, a = ana, b = beto) => {
    await guardarRespuesta({ dir, clave: ANA, miembros: PAREJA, entrada: a, ahora });
    await guardarRespuesta({ dir, clave: BETO, miembros: PAREJA, entrada: b, ahora });
  };

  it('el año siguiente abre una ronda nueva y trae la anterior para comparar', async () => {
    await cerrar(AHORA);
    const siguiente = new Date('2027-03-01T12:00:00Z');
    const v = await consultar({ dir, clave: ANA, miembros: PAREJA, ahora: siguiente });
    expect(v.ronda).toBe('2027');
    expect(v.yo).toBeNull();
    expect(v.completa).toBe(false);
    expect(v.previa.ronda).toBe('2026');
    expect(v.previa.yo.viajes).toBe(37);
    expect(v.previa.pareja.familia).toBe(41);
  });

  it('la anterior se ve desde el lado de quien pregunta', async () => {
    await cerrar(AHORA);
    const v = await consultar({ dir, clave: BETO, miembros: PAREJA, ahora: new Date('2027-03-01T12:00:00Z') });
    expect(v.previa.yo.familia).toBe(41);
    expect(v.previa.pareja.viajes).toBe(37);
  });

  it('cerrar la ronda nueva no toca la anterior', async () => {
    await cerrar(AHORA);
    const proximo = new Date('2027-03-01T12:00:00Z');
    await cerrar(proximo, { ahorro: 100 }, { ahorro: 100 });
    const v = await consultar({ dir, clave: ANA, miembros: PAREJA, ahora: proximo });
    expect(v.completa).toBe(true);
    expect(v.previa.ronda).toBe('2026');
    expect(v.previa.yo.viajes).toBe(37);
  });

  it('una ronda anterior sin cerrar no sirve de comparacion: se salta a la ultima cerrada', async () => {
    await cerrar(new Date('2025-06-01T12:00:00Z'));
    // 2026: solo respondio Ana.
    await guardarRespuesta({ dir, clave: ANA, miembros: PAREJA, entrada: ana, ahora: AHORA });
    const v = await consultar({ dir, clave: ANA, miembros: PAREJA, ahora: new Date('2027-03-01T12:00:00Z') });
    expect(v.previa.ronda).toBe('2025');
  });

  it('sin ninguna ronda cerrada antes, no hay comparacion', async () => {
    await guardarRespuesta({ dir, clave: ANA, miembros: PAREJA, entrada: ana, ahora: AHORA });
    const v = await consultar({ dir, clave: ANA, miembros: PAREJA, ahora: new Date('2027-03-01T12:00:00Z') });
    expect(v.previa).toBeNull();
  });
});

describe('robustez', () => {
  it('dos personas respondiendo a la vez no se pisan', async () => {
    await Promise.all([
      guardarRespuesta({ dir, clave: ANA, miembros: PAREJA, entrada: ana, ahora: AHORA }),
      guardarRespuesta({ dir, clave: BETO, miembros: PAREJA, entrada: beto, ahora: AHORA }),
    ]);
    const v = await consultar({ dir, clave: ANA, miembros: PAREJA, ahora: AHORA });
    expect(v.completa).toBe(true);
    expect(v.pareja.puntos.familia).toBe(41);
  });

  it('un archivo corrupto se trata como vacio, sin reventar', async () => {
    fs.writeFileSync(path.join(dir, 'cuestionario.json'), '{no es json');
    const v = await consultar({ dir, clave: ANA, miembros: PAREJA, ahora: AHORA });
    expect(v.yo).toBeNull();
    expect(v.categorias).toHaveLength(CATEGORIAS.length);
  });

  it('un archivo con otra forma tambien', async () => {
    fs.writeFileSync(path.join(dir, 'cuestionario.json'), JSON.stringify({ rondas: 'raro' }));
    const v = await consultar({ dir, clave: ANA, miembros: PAREJA, ahora: AHORA });
    expect(v.yo).toBeNull();
  });
});

describe('las rutas', () => {
  type Manejador = (req: unknown, res: unknown) => Promise<void>;
  const montar = (conHogar: (req: { hogarId?: string }, res: unknown) => Promise<string | null>) => {
    const rutas: Record<string, Manejador> = {};
    const app = {
      get: (p: string, h: Manejador) => { rutas['GET ' + p] = h; },
      post: (p: string, h: Manejador) => { rutas['POST ' + p] = h; },
    };
    montarRutas(app, {
      conHogar,
      leerHogares: async () => ({}),
      miembrosDe: () => PAREJA,
      claveDeUsuario: (u: { oid?: string }) => u && u.oid,
      archivoDeHogar: () => path.join(dir, 'data.json'),
    });
    return rutas;
  };
  const respuesta = () => {
    const r: { estado: number; cuerpo: unknown; cabeceras: Record<string, string>; status: (n: number) => typeof r; json: (c: unknown) => typeof r; setHeader: (k: string, v: string) => void } = {
      estado: 200, cuerpo: undefined, cabeceras: {},
      status(n) { r.estado = n; return r; },
      json(c) { r.cuerpo = c; return r; },
      setHeader(k, v) { r.cabeceras[k] = v; },
    };
    return r;
  };
  const conHogarOk = async (req: { hogarId?: string }) => { req.hogarId = 'h1'; return 'h1'; };

  it('POST devuelve 400 con un codigo cuando la suma no es 100', async () => {
    const rutas = montar(conHogarOk);
    const res = respuesta();
    await rutas['POST /api/hogar/cuestionario']({ user: { oid: ANA }, body: { puntos: { ahorro: 50 } } }, res);
    expect(res.estado).toBe(400);
    expect(res.cuerpo).toEqual({ codigo: 'suma_invalida' });
  });

  it('POST guarda y devuelve la vista de quien responde', async () => {
    const rutas = montar(conHogarOk);
    const res = respuesta();
    await rutas['POST /api/hogar/cuestionario']({ user: { oid: ANA }, body: { puntos: ana } }, res);
    expect(res.estado).toBe(200);
    expect((res.cuerpo as { yo: { puntos: { viajes: number } } }).yo.puntos.viajes).toBe(37);
  });

  it('POST con la ronda cerrada devuelve 409', async () => {
    const rutas = montar(conHogarOk);
    await rutas['POST /api/hogar/cuestionario']({ user: { oid: ANA }, body: { puntos: ana } }, respuesta());
    await rutas['POST /api/hogar/cuestionario']({ user: { oid: BETO }, body: { puntos: beto } }, respuesta());
    const res = respuesta();
    await rutas['POST /api/hogar/cuestionario']({ user: { oid: ANA }, body: { puntos: { ahorro: 100 } } }, res);
    expect(res.estado).toBe(409);
  });

  it('GET no se cachea: lo que se ve cambia cuando responde la otra persona', async () => {
    const rutas = montar(conHogarOk);
    const res = respuesta();
    await rutas['GET /api/hogar/cuestionario']({ user: { oid: ANA } }, res);
    expect(res.cabeceras['Cache-Control']).toBe('no-store');
  });

  it('sin hogar, la ruta corta y no toca nada', async () => {
    const rutas = montar(async () => null);
    const res = respuesta();
    await rutas['GET /api/hogar/cuestionario']({ user: { oid: ANA } }, res);
    expect(res.cuerpo).toBeUndefined();
  });

  it('sin identidad utilizable, 400', async () => {
    const rutas = montar(conHogarOk);
    const res = respuesta();
    await rutas['GET /api/hogar/cuestionario']({ user: {} }, res);
    expect(res.estado).toBe(400);
  });
});
