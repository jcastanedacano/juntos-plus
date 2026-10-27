import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const decisiones = require('../../../decisiones.cjs');

const { validarNueva, crear, votar, resolver, consultar, montarRutas } = decisiones;

/**
 * Lo importante de este modulo es lo que NO sale: el voto de la otra persona no
 * puede llegar a quien todavia no ha votado, porque conocerlo cambiaria lo que
 * vota. Estas pruebas lo fijan sobre el JSON serializado que sale al cliente.
 */

let dir = '';
beforeEach(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), 'decisiones-')); });
afterEach(() => { fs.rmSync(dir, { recursive: true, force: true }); });

const ANA = 'ana-oid-7731';
const BETO = 'beto-oid-9402';
const PAREJA = [ANA, BETO];
const AHORA = new Date('2026-10-27T12:00:00Z');
const VOTO_BETO = new Date('2031-05-05T05:05:05Z');

const nueva = { pregunta: '¿Compramos el sofá?', opciones: ['Sí', 'No', 'Esperar'], monto: 1200 };

/** Crea la decision y devuelve su id. */
async function plantear(entrada = nueva, clave = ANA) {
  const r = await crear({ dir, clave, miembros: PAREJA, entrada, ahora: AHORA });
  expect(r.ok).toBe(true);
  return r.id as string;
}
const ver = async (clave: string, id: string) =>
  (await consultar({ dir, clave, miembros: PAREJA })).decisiones.find((d: { id: string }) => d.id === id);

describe('validar una decision nueva', () => {
  it('acepta pregunta con 2 a 4 opciones y asigna los ids', () => {
    const v = validarNueva(nueva);
    expect(v.error).toBeUndefined();
    expect(v.opciones.map((o: { id: string }) => o.id)).toEqual(['o1', 'o2', 'o3']);
    expect(v.monto).toBe(1200);
  });

  it('el monto es opcional', () => {
    expect(validarNueva({ pregunta: 'x', opciones: ['a', 'b'] }).monto).toBeNull();
    expect(validarNueva({ pregunta: 'x', opciones: ['a', 'b'], monto: null }).monto).toBeNull();
  });

  it('rechaza lo que no sirve', () => {
    expect(validarNueva(null).error).toBe('decision_invalida');
    expect(validarNueva({ pregunta: '  ', opciones: ['a', 'b'] }).error).toBe('pregunta_vacia');
    expect(validarNueva({ pregunta: 'x'.repeat(141), opciones: ['a', 'b'] }).error).toBe('pregunta_larga');
    expect(validarNueva({ pregunta: 'x', opciones: ['a'] }).error).toBe('opciones_cantidad');
    expect(validarNueva({ pregunta: 'x', opciones: ['a', 'b', 'c', 'd', 'e'] }).error).toBe('opciones_cantidad');
    expect(validarNueva({ pregunta: 'x', opciones: ['a', ''] }).error).toBe('opciones_invalidas');
    expect(validarNueva({ pregunta: 'x', opciones: 'ab' }).error).toBe('opciones_invalidas');
    expect(validarNueva({ pregunta: 'x', opciones: ['a', 'A'] }).error).toBe('opciones_repetidas');
    expect(validarNueva({ pregunta: 'x', opciones: ['a', 'b'.repeat(61)] }).error).toBe('opcion_larga');
    for (const m of [0, -5, '10', NaN, Infinity]) {
      expect(validarNueva({ pregunta: 'x', opciones: ['a', 'b'], monto: m }).error).toBe('monto_invalido');
    }
  });
});

describe('el voto de la otra persona no se filtra', () => {
  it('quien vota primero: la otra persona no ve voto, ni fecha, ni identidad', async () => {
    const id = await plantear();
    await votar({ dir, clave: BETO, miembros: PAREJA, id, opcion: 'o3', ahora: VOTO_BETO });

    const vistaAna = await consultar({ dir, clave: ANA, miembros: PAREJA });
    const d = vistaAna.decisiones[0];
    expect(d.pareja).toEqual({ voto: true });
    expect(d.yo).toBeNull();
    expect(d.estado).toBe('votando');
    expect(d.coinciden).toBeUndefined();

    // Sin la lista de opciones (que es publica), nada de lo de Beto aparece.
    const { opciones: _opciones, ...resto } = d;
    void _opciones;
    const salida = JSON.stringify(resto);
    expect(salida).not.toContain('o3');
    expect(salida).not.toContain('2031');
    expect(salida).not.toContain(BETO);
    expect(JSON.stringify(vistaAna)).not.toContain(BETO);
  });

  it('con la otra persona sin votar, no hay voto ni marca', async () => {
    const id = await plantear();
    await votar({ dir, clave: ANA, miembros: PAREJA, id, opcion: 'o1', ahora: AHORA });
    const d = await ver(ANA, id);
    expect(d.pareja).toEqual({ voto: false });
    expect(d.yo.opcion).toBe('o1');
  });

  it('cuando votan las dos, cada una ve la de la otra', async () => {
    const id = await plantear();
    await votar({ dir, clave: ANA, miembros: PAREJA, id, opcion: 'o1', ahora: AHORA });
    await votar({ dir, clave: BETO, miembros: PAREJA, id, opcion: 'o2', ahora: AHORA });
    const a = await ver(ANA, id);
    const b = await ver(BETO, id);
    expect(a.pareja.opcion).toBe('o2');
    expect(b.pareja.opcion).toBe('o1');
    expect(a.coinciden).toBe(false);
    expect(a.estado).toBe('hablarlo');
  });

  it('el archivo lo guarda todo, pero aparte de data.json', async () => {
    await plantear();
    expect(fs.existsSync(path.join(dir, 'decisiones.json'))).toBe(true);
    expect(fs.existsSync(path.join(dir, 'data.json'))).toBe(false);
  });

  it('el voto ajeno no se filtra por la respuesta de ninguna ruta', async () => {
    const rutas = montarRutasFalsas();
    const alta = respuesta();
    await rutas['POST /api/hogar/decisiones']({ user: { oid: ANA }, body: nueva }, alta);
    const id = (alta.cuerpo as { decisiones: { id: string }[] }).decisiones[0].id;

    await rutas['POST /api/hogar/decisiones/:id/voto']({ user: { oid: BETO }, params: { id }, body: { opcion: 'o3' } }, respuesta());

    for (const [ruta, req] of [
      ['GET /api/hogar/decisiones', { user: { oid: ANA } }],
      ['POST /api/hogar/decisiones', { user: { oid: ANA }, body: { pregunta: 'otra', opciones: ['a', 'b'] } }],
    ] as const) {
      const res = respuesta();
      await rutas[ruta](req, res);
      const d = (res.cuerpo as { decisiones: Record<string, unknown>[] }).decisiones.find(x => x.id === id) as Record<string, unknown>;
      expect(d.pareja).toEqual({ voto: true });
      expect(JSON.stringify(d.pareja)).not.toContain('o3');
      expect(JSON.stringify(res.cuerpo)).not.toContain(BETO);
    }
  });
});

describe('cambiar el voto', () => {
  it('se puede corregir mientras la otra persona no haya votado', async () => {
    const id = await plantear();
    await votar({ dir, clave: ANA, miembros: PAREJA, id, opcion: 'o1', ahora: AHORA });
    const r = await votar({ dir, clave: ANA, miembros: PAREJA, id, opcion: 'o2', ahora: AHORA });
    expect(r.ok).toBe(true);
    expect((await ver(ANA, id)).yo.opcion).toBe('o2');
  });

  it('con las dos dentro queda cerrado', async () => {
    const id = await plantear();
    await votar({ dir, clave: ANA, miembros: PAREJA, id, opcion: 'o1', ahora: AHORA });
    await votar({ dir, clave: BETO, miembros: PAREJA, id, opcion: 'o2', ahora: AHORA });
    const r = await votar({ dir, clave: ANA, miembros: PAREJA, id, opcion: 'o3', ahora: AHORA });
    expect(r.error).toBe('decision_cerrada');
    expect((await ver(ANA, id)).yo.opcion).toBe('o1');
  });

  it('opcion inexistente, decision inexistente y ajenos se rechazan', async () => {
    const id = await plantear();
    expect((await votar({ dir, clave: ANA, miembros: PAREJA, id, opcion: 'o9', ahora: AHORA })).error).toBe('opcion_desconocida');
    expect((await votar({ dir, clave: ANA, miembros: PAREJA, id, opcion: 7, ahora: AHORA })).error).toBe('opcion_desconocida');
    expect((await votar({ dir, clave: ANA, miembros: PAREJA, id: 'nada', opcion: 'o1', ahora: AHORA })).error).toBe('no_existe');
    expect((await votar({ dir, clave: 'intruso', miembros: PAREJA, id, opcion: 'o1', ahora: AHORA })).error).toBe('no_es_miembro');
    expect((await crear({ dir, clave: 'intruso', miembros: PAREJA, entrada: nueva })).error).toBe('no_es_miembro');
  });
});

describe('coincidir, hablarlo y resolver', () => {
  it('si eligen lo mismo coinciden y no hay nada que resolver', async () => {
    const id = await plantear();
    await votar({ dir, clave: ANA, miembros: PAREJA, id, opcion: 'o2', ahora: AHORA });
    await votar({ dir, clave: BETO, miembros: PAREJA, id, opcion: 'o2', ahora: AHORA });
    const d = await ver(BETO, id);
    expect(d.coinciden).toBe(true);
    expect(d.estado).toBe('coinciden');
    const r = await resolver({ dir, clave: ANA, miembros: PAREJA, id, opcion: 'o2', ahora: AHORA });
    expect(r.error).toBe('ya_coinciden');
  });

  it('no se resuelve antes de que voten los dos', async () => {
    const id = await plantear();
    await votar({ dir, clave: ANA, miembros: PAREJA, id, opcion: 'o1', ahora: AHORA });
    const r = await resolver({ dir, clave: ANA, miembros: PAREJA, id, opcion: 'o1', ahora: AHORA });
    expect(r.error).toBe('faltan_votos');
  });

  it('cualquiera resuelve con opcion final y nota, y pasa al historial', async () => {
    const id = await plantear();
    await votar({ dir, clave: ANA, miembros: PAREJA, id, opcion: 'o1', ahora: AHORA });
    await votar({ dir, clave: BETO, miembros: PAREJA, id, opcion: 'o3', ahora: AHORA });
    const r = await resolver({ dir, clave: BETO, miembros: PAREJA, id, opcion: 'o3', nota: '  Esperamos   a   la quincena ', ahora: AHORA });
    expect(r.ok).toBe(true);
    const d = await ver(ANA, id);
    expect(d.estado).toBe('resuelta');
    expect(d.resolucion.opcion).toBe('o3');
    expect(d.resolucion.nota).toBe('Esperamos a la quincena');
    expect(JSON.stringify(d)).not.toContain(BETO);
  });

  it('la nota es opcional, tiene tope y la opcion tiene que existir', async () => {
    const id = await plantear();
    await votar({ dir, clave: ANA, miembros: PAREJA, id, opcion: 'o1', ahora: AHORA });
    await votar({ dir, clave: BETO, miembros: PAREJA, id, opcion: 'o2', ahora: AHORA });
    expect((await resolver({ dir, clave: ANA, miembros: PAREJA, id, opcion: 'o1', nota: 'x'.repeat(281) })).error).toBe('nota_larga');
    expect((await resolver({ dir, clave: ANA, miembros: PAREJA, id, opcion: 'o1', nota: 5 })).error).toBe('nota_invalida');
    expect((await resolver({ dir, clave: ANA, miembros: PAREJA, id, opcion: 'zzz' })).error).toBe('opcion_desconocida');
    const ok = await resolver({ dir, clave: ANA, miembros: PAREJA, id, opcion: 'o1' });
    expect(ok.ok).toBe(true);
    expect((await ver(ANA, id)).resolucion.nota).toBe('');
  });

  it('una resuelta no se vuelve a resolver ni a votar', async () => {
    const id = await plantear();
    await votar({ dir, clave: ANA, miembros: PAREJA, id, opcion: 'o1', ahora: AHORA });
    await votar({ dir, clave: BETO, miembros: PAREJA, id, opcion: 'o2', ahora: AHORA });
    await resolver({ dir, clave: ANA, miembros: PAREJA, id, opcion: 'o1' });
    expect((await resolver({ dir, clave: BETO, miembros: PAREJA, id, opcion: 'o2' })).error).toBe('decision_cerrada');
    expect((await votar({ dir, clave: ANA, miembros: PAREJA, id, opcion: 'o2' })).error).toBe('decision_cerrada');
  });

  it('el historial conserva las anteriores, la mas reciente primero', async () => {
    const a = await plantear({ ...nueva, pregunta: 'primera' });
    const r = await crear({ dir, clave: ANA, miembros: PAREJA, entrada: { ...nueva, pregunta: 'segunda' }, ahora: new Date('2026-10-28T12:00:00Z') });
    const lista = (await consultar({ dir, clave: ANA, miembros: PAREJA })).decisiones;
    expect(lista.map((d: { pregunta: string }) => d.pregunta)).toEqual(['segunda', 'primera']);
    expect(lista[1].id).toBe(a);
    expect(r.ok).toBe(true);
  });
});

describe('hogares de una sola persona y miembros que se van', () => {
  it('una persona sola puede votar, pero nunca se completa', async () => {
    const r = await crear({ dir, clave: ANA, miembros: [ANA], entrada: nueva, ahora: AHORA });
    await votar({ dir, clave: ANA, miembros: [ANA], id: r.id, opcion: 'o1', ahora: AHORA });
    const v = await consultar({ dir, clave: ANA, miembros: [ANA] });
    expect(v.miembros).toBe(1);
    expect(v.decisiones[0].estado).toBe('votando');
    expect(v.decisiones[0].pareja).toEqual({ voto: false });
  });

  it('el voto de alguien que ya no es del hogar no cuenta', async () => {
    const r = await crear({ dir, clave: 'ex', miembros: ['ex', ANA], entrada: nueva, ahora: AHORA });
    await votar({ dir, clave: 'ex', miembros: ['ex', ANA], id: r.id, opcion: 'o1', ahora: AHORA });
    const v = await consultar({ dir, clave: ANA, miembros: [ANA, BETO] });
    expect(v.decisiones[0].pareja).toEqual({ voto: false });
  });
});

describe('robustez', () => {
  it('dos personas votando a la vez no se pisan', async () => {
    const id = await plantear();
    await Promise.all([
      votar({ dir, clave: ANA, miembros: PAREJA, id, opcion: 'o1', ahora: AHORA }),
      votar({ dir, clave: BETO, miembros: PAREJA, id, opcion: 'o1', ahora: AHORA }),
    ]);
    const d = await ver(ANA, id);
    expect(d.estado).toBe('coinciden');
  });

  it('un archivo corrupto o con otra forma se trata como vacio', async () => {
    fs.writeFileSync(path.join(dir, 'decisiones.json'), '{no es json');
    expect((await consultar({ dir, clave: ANA, miembros: PAREJA })).decisiones).toEqual([]);
    fs.writeFileSync(path.join(dir, 'decisiones.json'), JSON.stringify({ decisiones: 'raro' }));
    expect((await consultar({ dir, clave: ANA, miembros: PAREJA })).decisiones).toEqual([]);
  });
});

// ─── Rutas ──────────────────────────────────────────────────────────

type Manejador = (req: unknown, res: unknown) => Promise<void>;
function montarFalsas(conHogar: (req: { hogarId?: string }, res: unknown) => Promise<string | null>) {
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
}
const conHogarOk = async (req: { hogarId?: string }) => { req.hogarId = 'h1'; return 'h1'; };
const montarRutasFalsas = () => montarFalsas(conHogarOk);

function respuesta() {
  const r: { estado: number; cuerpo: unknown; cabeceras: Record<string, string>; status: (n: number) => typeof r; json: (c: unknown) => typeof r; setHeader: (k: string, v: string) => void } = {
    estado: 200, cuerpo: undefined, cabeceras: {},
    status(n) { r.estado = n; return r; },
    json(c) { r.cuerpo = c; return r; },
    setHeader(k, v) { r.cabeceras[k] = v; },
  };
  return r;
}

describe('las rutas', () => {
  it('POST crea y devuelve la lista', async () => {
    const rutas = montarRutasFalsas();
    const res = respuesta();
    await rutas['POST /api/hogar/decisiones']({ user: { oid: ANA }, body: nueva }, res);
    expect(res.estado).toBe(200);
    expect((res.cuerpo as { decisiones: unknown[] }).decisiones).toHaveLength(1);
  });

  it('una decision invalida da 400 con codigo', async () => {
    const rutas = montarRutasFalsas();
    const res = respuesta();
    await rutas['POST /api/hogar/decisiones']({ user: { oid: ANA }, body: { pregunta: 'x', opciones: ['a'] } }, res);
    expect(res.estado).toBe(400);
    expect(res.cuerpo).toEqual({ codigo: 'opciones_cantidad' });
  });

  it('votar en una decision inexistente da 404, y en una cerrada 409', async () => {
    const rutas = montarRutasFalsas();
    const res = respuesta();
    await rutas['POST /api/hogar/decisiones/:id/voto']({ user: { oid: ANA }, params: { id: 'nada' }, body: { opcion: 'o1' } }, res);
    expect(res.estado).toBe(404);

    const alta = respuesta();
    await rutas['POST /api/hogar/decisiones']({ user: { oid: ANA }, body: nueva }, alta);
    const id = (alta.cuerpo as { decisiones: { id: string }[] }).decisiones[0].id;
    for (const [oid, op] of [[ANA, 'o1'], [BETO, 'o2']]) {
      await rutas['POST /api/hogar/decisiones/:id/voto']({ user: { oid }, params: { id }, body: { opcion: op } }, respuesta());
    }
    const cerrada = respuesta();
    await rutas['POST /api/hogar/decisiones/:id/voto']({ user: { oid: ANA }, params: { id }, body: { opcion: 'o3' } }, cerrada);
    expect(cerrada.estado).toBe(409);

    const resuelve = respuesta();
    await rutas['POST /api/hogar/decisiones/:id/resolver']({ user: { oid: ANA }, params: { id }, body: { opcion: 'o2', nota: 'ok' } }, resuelve);
    expect(resuelve.estado).toBe(200);
  });

  it('GET no se cachea', async () => {
    const rutas = montarRutasFalsas();
    const res = respuesta();
    await rutas['GET /api/hogar/decisiones']({ user: { oid: ANA } }, res);
    expect(res.cabeceras['Cache-Control']).toBe('no-store');
  });

  it('sin hogar la ruta corta, y sin identidad da 400', async () => {
    const sin = respuesta();
    await montarFalsas(async () => null)['GET /api/hogar/decisiones']({ user: { oid: ANA } }, sin);
    expect(sin.cuerpo).toBeUndefined();
    const anon = respuesta();
    await montarRutasFalsas()['GET /api/hogar/decisiones']({ user: {} }, anon);
    expect(anon.estado).toBe(400);
  });
});
