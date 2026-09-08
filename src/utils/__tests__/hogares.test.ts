import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/**
 * La migracion toca datos financieros reales, asi que se prueba sobre un
 * directorio de usar y tirar. Cada test recarga el servidor con su propio
 * DATA_DIR: las rutas se fijan al importar el modulo.
 */
function cargarServidor(dir: string) {
  process.env.DATA_DIR = dir;
  const ruta = require.resolve('../../../server.cjs');
  delete require.cache[ruta];
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require('../../../server.cjs');
}

let dir = '';
const DATA_DIR_ORIGINAL = process.env.DATA_DIR;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hogares-'));
});
afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
  if (DATA_DIR_ORIGINAL === undefined) delete process.env.DATA_DIR;
  else process.env.DATA_DIR = DATA_DIR_ORIGINAL;
});

const datosDeEjemplo = {
  transactions: [{ id: '1', amount: 10 }, { id: '2', amount: 20 }],
  recurring: [{ id: 'r1' }],
  currency: 'PEN',
};

describe('migracion a hogares', () => {
  it('mueve el data.json al hogar principal SIN borrar el original', async () => {
    fs.writeFileSync(path.join(dir, 'data.json'), JSON.stringify(datosDeEjemplo));
    const s = cargarServidor(dir);

    await s.migrarAHogares();

    const migrado = JSON.parse(fs.readFileSync(s.archivoDeHogar('principal'), 'utf8'));
    expect(migrado.transactions).toHaveLength(2);
    expect(migrado).toEqual(datosDeEjemplo);
    // El original se conserva: es el respaldo de la migracion.
    expect(fs.existsSync(path.join(dir, 'data.json'))).toBe(true);
  });

  it('es idempotente: correrla dos veces no duplica ni pisa', async () => {
    fs.writeFileSync(path.join(dir, 'data.json'), JSON.stringify(datosDeEjemplo));
    const s = cargarServidor(dir);

    await s.migrarAHogares();
    fs.writeFileSync(s.archivoDeHogar('principal'), JSON.stringify({ transactions: [{ id: 'nuevo' }] }));
    await s.migrarAHogares();

    const tras = JSON.parse(fs.readFileSync(s.archivoDeHogar('principal'), 'utf8'));
    expect(tras.transactions).toEqual([{ id: 'nuevo' }]);
    const mapa = await s.leerHogares();
    expect(Object.keys(mapa.hogares)).toEqual(['principal']);
  });

  it('en instalacion nueva no inventa ningun hogar', async () => {
    const s = cargarServidor(dir);
    await s.migrarAHogares();
    const mapa = await s.leerHogares();
    expect(Object.keys(mapa.hogares)).toHaveLength(0);
  });

  it('no migra un data.json corrupto', async () => {
    fs.writeFileSync(path.join(dir, 'data.json'), '{esto no es json');
    const s = cargarServidor(dir);
    await s.migrarAHogares();
    expect(Object.keys((await s.leerHogares()).hogares)).toHaveLength(0);
  });
});

describe('a que hogar va cada quien', () => {
  it('el directorio de trabajo entra al hogar migrado', async () => {
    fs.writeFileSync(path.join(dir, 'data.json'), JSON.stringify(datosDeEjemplo));
    const s = cargarServidor(dir);
    await s.migrarAHogares();

    const req = { user: { oid: 'jorge-oid' }, emisor: 'trabajo' };
    expect(await s.hogarDe(req)).toBe('principal');

    // La pareja, con otra identidad, cae en el MISMO hogar: es lo que hace que
    // la aplicacion siga siendo compartida.
    const pareja = { user: { oid: 'zumy-oid' }, emisor: 'trabajo' };
    expect(await s.hogarDe(pareja)).toBe('principal');
  });

  // El caso que justifica la particion entera.
  it('alguien del tenant externo NO ve el hogar de la pareja', async () => {
    fs.writeFileSync(path.join(dir, 'data.json'), JSON.stringify(datosDeEjemplo));
    const s = cargarServidor(dir);
    await s.migrarAHogares();

    const ajeno = { user: { oid: 'gmail-oid', email: 'quien@gmail.com' }, emisor: 'externo' };
    expect(await s.hogarDe(ajeno)).toBeNull();
  });

  it('quien estrena hogar recibe uno vacio y solo suyo', async () => {
    fs.writeFileSync(path.join(dir, 'data.json'), JSON.stringify(datosDeEjemplo));
    const s = cargarServidor(dir);
    await s.migrarAHogares();

    const ajeno = { user: { oid: 'gmail-oid' }, emisor: 'externo' };
    const id = await s.crearHogar(ajeno, 'Casa de Ana');
    expect(id).not.toBe('principal');
    expect(await s.hogarDe(ajeno)).toBe(id);

    const suyos = JSON.parse(fs.readFileSync(s.archivoDeHogar(id), 'utf8'));
    expect(suyos.transactions).toEqual([]);

    // Y el hogar de la pareja sigue intacto.
    const dela = JSON.parse(fs.readFileSync(s.archivoDeHogar('principal'), 'utf8'));
    expect(dela.transactions).toHaveLength(2);
  });

  it('un token sin identidad utilizable no obtiene hogar', async () => {
    const s = cargarServidor(dir);
    expect(await s.hogarDe({ user: {}, emisor: 'externo' })).toBeNull();
  });
});

describe('la copia se verifica, no se supone', () => {
  it('cuenta las transacciones antes y despues', async () => {
    const muchas = { transactions: Array.from({ length: 525 }, (_, i) => ({ id: String(i) })) };
    fs.writeFileSync(path.join(dir, 'data.json'), JSON.stringify(muchas));
    const s = cargarServidor(dir);

    await s.migrarAHogares();

    const copia = JSON.parse(fs.readFileSync(s.archivoDeHogar('principal'), 'utf8'));
    expect(copia.transactions).toHaveLength(525);
    const mapa = await s.leerHogares();
    expect(mapa.hogares.principal).toBeTruthy();
  });
});

// ─── Llamar a alguien a tu hogar ────────────────────────────────────

const ana = { user: { oid: 'ana-oid', email: 'ana@gmail.com' }, emisor: 'externo' };
const beto = { user: { oid: 'beto-oid', email: 'beto@gmail.com' }, emisor: 'externo' };
const tercero = { user: { oid: 'ter-oid', email: 'tercero@gmail.com' }, emisor: 'externo' };

describe('a quien se puede llamar', () => {
  it('no se puede llamar a quien todavia no tiene cuenta', async () => {
    const s = cargarServidor(dir);
    await s.crearHogar(ana, 'Casa de Ana');

    const r = await s.invitar(ana, 'nadie@gmail.com');
    expect(r.error).toBe('sin_cuenta');
  });

  it('se llama por correo a quien ya entro, y le aparece la invitacion', async () => {
    const s = cargarServidor(dir);
    const casaDeAna = await s.crearHogar(ana, 'Casa de Ana');
    await s.crearHogar(beto, 'Casa de Beto');

    expect((await s.invitar(ana, 'Beto@Gmail.com')).hogarId).toBe(casaDeAna);

    const suyas = await s.invitacionesPara(beto);
    expect(suyas).toHaveLength(1);
    expect(suyas[0].hogarId).toBe(casaDeAna);
    expect(suyas[0].de).toBe('ana@gmail.com');
  });

  it('nadie se invita a si mismo ni invita a quien ya esta dentro', async () => {
    const s = cargarServidor(dir);
    const casa = await s.crearHogar(ana, 'Casa de Ana');
    await s.crearHogar(beto, 'Casa de Beto');
    await s.invitar(ana, 'beto@gmail.com');
    await s.aceptarInvitacion(beto, casa);

    expect((await s.invitar(ana, 'ana@gmail.com')).error).toBe('eres_tu');
    expect((await s.invitar(ana, 'beto@gmail.com')).error).toBe('ya_es_miembro');
  });

  it('un hogar de dos no admite a un tercero', async () => {
    const s = cargarServidor(dir);
    const casa = await s.crearHogar(ana, 'Casa de Ana');
    await s.crearHogar(beto, 'Casa de Beto');
    await s.invitar(ana, 'beto@gmail.com');
    await s.aceptarInvitacion(beto, casa);
    await s.crearHogar(tercero, 'Casa del tercero');

    expect((await s.invitar(ana, 'tercero@gmail.com')).error).toBe('hogar_lleno');
  });

  it('una invitacion ajena no sirve para colarse', async () => {
    const s = cargarServidor(dir);
    const casa = await s.crearHogar(ana, 'Casa de Ana');
    await s.crearHogar(beto, 'Casa de Beto');
    await s.crearHogar(tercero, 'Casa del tercero');
    await s.invitar(ana, 'beto@gmail.com');

    expect((await s.aceptarInvitacion(tercero, casa)).error).toBe('no_invitado');
    expect(await s.hogarDe(tercero)).not.toBe(casa);
  });
});

describe('lo que ya apunto cada quien se consolida', () => {
  it('al aceptar, sus movimientos entran en el hogar que la llamo', async () => {
    const s = cargarServidor(dir);
    const casa = await s.crearHogar(ana, 'Casa de Ana');
    const suya = await s.crearHogar(beto, 'Casa de Beto');
    fs.writeFileSync(s.archivoDeHogar(casa), JSON.stringify({
      transactions: [{ id: 'a1', amount: 10 }], recurring: [], currency: 'PEN',
    }));
    fs.writeFileSync(s.archivoDeHogar(suya), JSON.stringify({
      transactions: [{ id: 'b1', amount: 20 }, { id: 'b2', amount: 30 }],
      recurring: [{ id: 'br' }], currency: 'PEN',
    }));

    const r = await s.invitar(ana, 'beto@gmail.com');
    expect(r.error).toBeUndefined();
    const fin = await s.aceptarInvitacion(beto, casa);
    expect(fin.fusionadas).toBe(2);

    const juntos = JSON.parse(fs.readFileSync(s.archivoDeHogar(casa), 'utf8'));
    expect(juntos.transactions.map((t: { id: string }) => t.id)).toEqual(['a1', 'b1', 'b2']);
    expect(juntos.recurring).toHaveLength(1);
    // Y los dos miran el mismo archivo.
    expect(await s.hogarDe(beto)).toBe(casa);
    expect(await s.hogarDe(ana)).toBe(casa);
  });

  it('el hogar de origen conserva sus datos: es el respaldo de la mudanza', async () => {
    const s = cargarServidor(dir);
    const casa = await s.crearHogar(ana, 'Casa de Ana');
    const suya = await s.crearHogar(beto, 'Casa de Beto');
    fs.writeFileSync(s.archivoDeHogar(suya), JSON.stringify({ transactions: [{ id: 'b1' }] }));

    await s.invitar(ana, 'beto@gmail.com');
    await s.aceptarInvitacion(beto, casa);

    const origen = JSON.parse(fs.readFileSync(s.archivoDeHogar(suya), 'utf8'));
    expect(origen.transactions).toEqual([{ id: 'b1' }]);
    const mapa = await s.leerHogares();
    expect(mapa.hogares[suya].absorbidoPor).toBe(casa);
  });

  it('antes de fusionar deja una copia fechada del hogar anfitrion', async () => {
    const s = cargarServidor(dir);
    const casa = await s.crearHogar(ana, 'Casa de Ana');
    const suya = await s.crearHogar(beto, 'Casa de Beto');
    fs.writeFileSync(s.archivoDeHogar(casa), JSON.stringify({ transactions: [{ id: 'a1' }] }));
    fs.writeFileSync(s.archivoDeHogar(suya), JSON.stringify({ transactions: [{ id: 'b1' }] }));

    await s.invitar(ana, 'beto@gmail.com');
    await s.aceptarInvitacion(beto, casa);

    const carpeta = path.dirname(s.archivoDeHogar(casa));
    const copias = fs.readdirSync(carpeta).filter(f => f.startsWith('antes-de-fusionar-'));
    expect(copias).toHaveLength(1);
    const antes = JSON.parse(fs.readFileSync(path.join(carpeta, copias[0]), 'utf8'));
    expect(antes.transactions).toEqual([{ id: 'a1' }]);
  });

  it('quien acepta sin haber guardado nada no rompe la fusion', async () => {
    const s = cargarServidor(dir);
    const casa = await s.crearHogar(ana, 'Casa de Ana');
    fs.writeFileSync(s.archivoDeHogar(casa), JSON.stringify({ transactions: [{ id: 'a1' }] }));
    // Beto entra y se le anota el correo, pero nunca crea hogar.
    expect(await s.hogarDe(beto)).toBeNull();

    await s.invitar(ana, 'beto@gmail.com');
    const fin = await s.aceptarInvitacion(beto, casa);
    expect(fin.fusionadas).toBe(0);
    expect(await s.hogarDe(beto)).toBe(casa);
    const juntos = JSON.parse(fs.readFileSync(s.archivoDeHogar(casa), 'utf8'));
    expect(juntos.transactions).toEqual([{ id: 'a1' }]);
  });
});

describe('como se unen dos juegos de datos', () => {
  it('en choque de id manda el anfitrion, y nada se pierde', () => {
    const s = cargarServidor(dir);
    const unido = s.fusionarDatos(
      { transactions: [{ id: 'x', amount: 1 }], currency: 'PEN' },
      { transactions: [{ id: 'x', amount: 999 }, { id: 'y', amount: 2 }], currency: 'USD' }
    );
    expect(unido.transactions).toEqual([{ id: 'x', amount: 1 }, { id: 'y', amount: 2 }]);
    expect(unido.currency).toBe('PEN');
  });

  it('los ids sueltos se unen sin duplicar', () => {
    const s = cargarServidor(dir);
    const unido = s.fusionarDatos(
      { dismissedSubscriptions: ['s1', 's2'] },
      { dismissedSubscriptions: ['s2', 's3'] }
    );
    expect(unido.dismissedSubscriptions).toEqual(['s1', 's2', 's3']);
  });

  it('lo que no tiene id entra igual: perder un movimiento es peor que repetirlo', () => {
    const s = cargarServidor(dir);
    const unido = s.fusionarDatos(
      { transactions: [{ amount: 1 }] },
      { transactions: [{ amount: 2 }] }
    );
    expect(unido.transactions).toHaveLength(2);
  });

  it('las cuentas locales con contraseña NO se mezclan', () => {
    const s = cargarServidor(dir);
    const unido = s.fusionarDatos(
      { users: [{ id: 'u1', password: 'x' }] },
      { users: [{ id: 'u2', password: 'y' }] }
    );
    expect(unido.users).toEqual([{ id: 'u1', password: 'x' }]);
  });
});
