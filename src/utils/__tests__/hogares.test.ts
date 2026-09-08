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
