import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/**
 * La migracion toca datos financieros reales, asi que se prueba sobre un
 * directorio de usar y tirar. Cada test recarga el servidor con su propio
 * DATA_DIR: las rutas se fijan al importar el modulo.
 */
function cargarServidor(dir: string, miembros = '') {
  process.env.DATA_DIR = dir;
  process.env.MIEMBROS_PRINCIPAL = miembros;
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
  it('solo las cuentas NOMBRADAS entran al hogar migrado', async () => {
    fs.writeFileSync(path.join(dir, 'data.json'), JSON.stringify(datosDeEjemplo));
    const s = cargarServidor(dir, 'jorge-oid,me@ejemplo.com');
    await s.migrarAHogares();

    // Una por oid y otra por correo: las dos formas valen.
    expect(await s.hogarDe({ user: { oid: 'jorge-oid' } })).toBe('principal');
    expect(await s.hogarDe({ user: { oid: 'zumy-oid', email: 'me@ejemplo.com' } })).toBe('principal');
  });

  // El caso que justifica la particion entera, y el que corrige la premisa
  // falsa que tenia antes: el directorio de trabajo NO es la pareja, tiene
  // cientos de cuentas. Venir del mismo directorio no da derecho a nada.
  it('otra cuenta del MISMO directorio no ve el hogar de la pareja', async () => {
    fs.writeFileSync(path.join(dir, 'data.json'), JSON.stringify(datosDeEjemplo));
    const s = cargarServidor(dir, 'jorge-oid,me@ejemplo.com');
    await s.migrarAHogares();

    const companero = { user: { oid: 'otro-oid', email: 'otro@itdemos.com' }, emisor: 'trabajo' };
    expect(await s.hogarDe(companero)).toBeNull();
  });

  it('sin lista de miembros, nadie hereda los datos migrados', async () => {
    fs.writeFileSync(path.join(dir, 'data.json'), JSON.stringify(datosDeEjemplo));
    const s = cargarServidor(dir);
    await s.migrarAHogares();

    expect(await s.hogarDe({ user: { oid: 'jorge-oid' } })).toBeNull();
  });

  it('un invitado con Gmail NO ve el hogar de la pareja', async () => {
    fs.writeFileSync(path.join(dir, 'data.json'), JSON.stringify(datosDeEjemplo));
    const s = cargarServidor(dir, 'jorge-oid');
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

describe('la moneda del hogar', () => {
  it('se fija al estrenarlo y queda en sus datos', async () => {
    const s = cargarServidor(dir);
    const id = await s.crearHogar(ana, 'Casa de Ana', 'EUR');
    const datos = JSON.parse(fs.readFileSync(s.archivoDeHogar(id), 'utf8'));
    expect(datos.currency).toBe('EUR');
  });

  it('acepta minusculas y cae en soles si no se dice nada', async () => {
    const s = cargarServidor(dir);
    const a = await s.crearHogar(ana, 'A', 'usd');
    expect(JSON.parse(fs.readFileSync(s.archivoDeHogar(a), 'utf8')).currency).toBe('USD');
    const b = await s.crearHogar(beto, 'B', undefined);
    expect(JSON.parse(fs.readFileSync(s.archivoDeHogar(b), 'utf8')).currency).toBe('PEN');
  });

  // Una moneda que la aplicacion no sabe formatear saldria como un importe sin
  // simbolo o con el de otra: mejor caer en la de casa que inventar.
  it('una moneda desconocida no entra', async () => {
    const s = cargarServidor(dir);
    const id = await s.crearHogar(ana, 'A', 'BTC');
    expect(JSON.parse(fs.readFileSync(s.archivoDeHogar(id), 'utf8')).currency).toBe('PEN');
  });
});

describe('la pareja nombrada ya es de la casa', () => {
  const jorge = { user: { oid: 'jorge-oid', email: 'jorge@itdemos.com' }, emisor: 'trabajo' };

  it('cuenta como miembro aunque todavia no haya entrado nunca', async () => {
    fs.writeFileSync(path.join(dir, 'data.json'), JSON.stringify(datosDeEjemplo));
    const s = cargarServidor(dir, 'jorge@itdemos.com,me@zumyalvarez.com');
    await s.migrarAHogares();
    await s.hogarDe(jorge);

    const mapa = await s.leerHogares();
    // Zumy no ha visitado: no esta en el indice de correos.
    expect(mapa.correos['me@zumyalvarez.com']).toBeUndefined();
    // Y aun asi es miembro del hogar migrado.
    expect(s.nombradosDe(mapa, 'principal')).toContain('me@zumyalvarez.com');
  });

  // El sintoma que lo destapo: la pantalla ofrecia invitarla y al hacerlo
  // contestaba «esa persona todavia no ha entrado». Las dos cosas falsas.
  it('invitarla dice que ya esta dentro, no que no tenga cuenta', async () => {
    fs.writeFileSync(path.join(dir, 'data.json'), JSON.stringify(datosDeEjemplo));
    const s = cargarServidor(dir, 'jorge@itdemos.com,me@zumyalvarez.com');
    await s.migrarAHogares();
    await s.hogarDe(jorge);

    expect((await s.invitar(jorge, 'me@zumyalvarez.com')).error).toBe('ya_es_miembro');
  });

  it('en un hogar normal la lista no aplica: ahi si hay que invitar', async () => {
    const s = cargarServidor(dir, 'jorge@itdemos.com,me@zumyalvarez.com');
    await s.crearHogar(ana, 'Casa de Ana');
    const mapa = await s.leerHogares();
    const suyo = mapa.usuarios['ana-oid'];
    expect(s.nombradosDe(mapa, suyo)).toEqual([]);
    expect((await s.invitar(ana, 'me@zumyalvarez.com')).error).toBe('sin_cuenta');
  });
});

describe('cambiar la moneda del hogar', () => {
  it('marca con la moneda vieja lo que no tenia moneda propia', async () => {
    const s = cargarServidor(dir);
    const id = await s.crearHogar(ana, 'Casa de Ana', 'PEN');
    fs.writeFileSync(s.archivoDeHogar(id), JSON.stringify({
      currency: 'PEN',
      transactions: [
        { id: 't1', amount: 100 },              // sin moneda: es soles, implicito
        { id: 't2', amount: 50, currency: 'USD' }, // ya tenia la suya: no se toca
      ],
      budgets: [{ id: 'b1', amount: 10 }],
      goals: [{ id: 'g1', targetAmount: 5 }],
      recurring: [{ id: 'r1', amount: 20 }],
      accounts: [], investments: [], autosave: [], users: [], dismissedSubscriptions: [],
    }));

    const r = await s.cambiarMonedaHogar(id, 'EUR');
    expect(r.error).toBeUndefined();
    expect(r.moneda).toBe('EUR');
    expect(r.marcados).toBe(4); // t1, b1, g1, r1 -- no t2, que ya era USD

    const datos = JSON.parse(fs.readFileSync(s.archivoDeHogar(id), 'utf8'));
    expect(datos.currency).toBe('EUR');
    expect(datos.transactions[0].currency).toBe('PEN'); // sellado con la vieja
    expect(datos.transactions[1].currency).toBe('USD'); // intacto
    expect(datos.budgets[0].currency).toBe('PEN');
    expect(datos.goals[0].currency).toBe('PEN');
    expect(datos.recurring[0].currency).toBe('PEN');
  });

  it('una moneda que no existe se rechaza sin tocar el archivo', async () => {
    const s = cargarServidor(dir);
    const id = await s.crearHogar(ana, 'Casa de Ana', 'PEN');
    const antes = fs.readFileSync(s.archivoDeHogar(id), 'utf8');

    const r = await s.cambiarMonedaHogar(id, 'BTC');
    expect(r.error).toBe('moneda_invalida');
    expect(fs.readFileSync(s.archivoDeHogar(id), 'utf8')).toBe(antes);
  });

  it('pedir la misma moneda no hace nada', async () => {
    const s = cargarServidor(dir);
    const id = await s.crearHogar(ana, 'Casa de Ana', 'EUR');
    const r = await s.cambiarMonedaHogar(id, 'EUR');
    expect(r.error).toBeUndefined();
    expect(r.cambio).toBe(false);
    expect(r.marcados).toBe(0);
  });

  it('acepta minusculas, igual que crear el hogar', async () => {
    const s = cargarServidor(dir);
    const id = await s.crearHogar(ana, 'Casa de Ana', 'PEN');
    const r = await s.cambiarMonedaHogar(id, 'usd');
    expect(r.moneda).toBe('USD');
  });

  it('un hogar que no existe no revienta, devuelve un error', async () => {
    const s = cargarServidor(dir);
    const r = await s.cambiarMonedaHogar('h_no_existe', 'EUR');
    expect(r.error).toBe('hogar_ilegible');
  });

  // Cuentas e inversiones no tienen campo de moneda: quedan con su numero tal
  // cual, leidas bajo el simbolo nuevo. Es la limitacion conocida, y este test
  // fija que el cambio no intenta tocarlas ni falla por su ausencia.
  it('cuentas e inversiones se quedan igual, sin campo de moneda', async () => {
    const s = cargarServidor(dir);
    const id = await s.crearHogar(ana, 'Casa de Ana', 'PEN');
    fs.writeFileSync(s.archivoDeHogar(id), JSON.stringify({
      currency: 'PEN',
      transactions: [], budgets: [], goals: [], recurring: [],
      accounts: [{ id: 'a1', balance: 500 }],
      investments: [{ id: 'i1', currentAmount: 1000 }],
      autosave: [], users: [], dismissedSubscriptions: [],
    }));

    const r = await s.cambiarMonedaHogar(id, 'EUR');
    expect(r.error).toBeUndefined();
    const datos = JSON.parse(fs.readFileSync(s.archivoDeHogar(id), 'utf8'));
    expect(datos.accounts[0]).toEqual({ id: 'a1', balance: 500 });
    expect(datos.investments[0]).toEqual({ id: 'i1', currentAmount: 1000 });
  });
});

// «Yo» y «pareja» son roles del HOGAR: los decide el servidor una vez y valen
// igual en los dos dispositivos. Antes los decidia cada navegador con su
// localStorage, y en el movil de la pareja «yo» seguia siendo el otro.
describe('quien es yo y quien es pareja', () => {
  it('quien estrena el hogar es «yo»', async () => {
    const s = cargarServidor(dir);
    const casa = await s.crearHogar(ana, 'Casa de Ana');
    const mapa = await s.leerHogares();
    expect(s.rolDe(mapa, casa, ana.user)).toBe('me');
  });

  it('quien llega por invitacion es «pareja», y el anfitrion sigue siendo «yo»', async () => {
    const s = cargarServidor(dir);
    const casa = await s.crearHogar(ana, 'Casa de Ana');
    await s.crearHogar(beto, 'Casa de Beto');
    await s.invitar(ana, 'beto@gmail.com');
    await s.aceptarInvitacion(beto, casa);

    const mapa = await s.leerHogares();
    expect(s.rolDe(mapa, casa, ana.user)).toBe('me');
    expect(s.rolDe(mapa, casa, beto.user)).toBe('partner');
  });

  it('no depende de quien mire ni del orden en que entraron al directorio', async () => {
    const s = cargarServidor(dir);
    // Beto entra al directorio ANTES que Ana, pero Ana es quien crea la casa.
    await s.crearHogar(beto, 'Casa de Beto');
    const casa = await s.crearHogar(ana, 'Casa de Ana');
    await s.invitar(ana, 'beto@gmail.com');
    await s.aceptarInvitacion(beto, casa);

    const mapa = await s.leerHogares();
    expect(s.rolDe(mapa, casa, ana.user)).toBe('me');
    expect(s.rolDe(mapa, casa, beto.user)).toBe('partner');
  });

  it('un hogar de antes de guardar el creador lo aprende al aceptar la invitacion', async () => {
    const s = cargarServidor(dir);
    const casa = await s.crearHogar(ana, 'Casa de Ana');
    await s.crearHogar(beto, 'Casa de Beto');
    // Se simula un hogar antiguo: sin el campo `creador`.
    const antes = await s.leerHogares();
    delete antes.hogares[casa].creador;
    await s.guardarHogares(antes);

    await s.invitar(ana, 'beto@gmail.com');
    await s.aceptarInvitacion(beto, casa);

    const mapa = await s.leerHogares();
    expect(mapa.hogares[casa].creador).toBe('ana-oid');
    expect(s.rolDe(mapa, casa, ana.user)).toBe('me');
    expect(s.rolDe(mapa, casa, beto.user)).toBe('partner');
  });

  it('un hogar antiguo con un solo miembro: ese miembro es «yo»', async () => {
    const s = cargarServidor(dir);
    const casa = await s.crearHogar(ana, 'Casa de Ana');
    const mapa = await s.leerHogares();
    delete mapa.hogares[casa].creador;
    expect(s.rolDe(mapa, casa, ana.user)).toBe('me');
  });

  it('en el hogar migrado manda el orden de la lista: el primero es «yo»', async () => {
    fs.writeFileSync(path.join(dir, 'data.json'), JSON.stringify(datosDeEjemplo));
    const s = cargarServidor(dir, 'jorge@ejemplo.com,zumy@ejemplo.com');
    await s.migrarAHogares();
    const mapa = await s.leerHogares();

    const jorge = { oid: 'jorge-oid', email: 'jorge@ejemplo.com' };
    const zumy = { oid: 'zumy-oid', email: 'zumy@ejemplo.com' };
    expect(s.rolDe(mapa, 'principal', jorge)).toBe('me');
    expect(s.rolDe(mapa, 'principal', zumy)).toBe('partner');
  });

  it('en el hogar migrado tambien vale nombrarlos por identificador', async () => {
    fs.writeFileSync(path.join(dir, 'data.json'), JSON.stringify(datosDeEjemplo));
    const s = cargarServidor(dir, 'jorge-oid,zumy-oid');
    await s.migrarAHogares();
    const mapa = await s.leerHogares();

    expect(s.rolDe(mapa, 'principal', { oid: 'jorge-oid' })).toBe('me');
    expect(s.rolDe(mapa, 'principal', { oid: 'zumy-oid' })).toBe('partner');
  });

  it('en el hogar migrado, quien entra fuera de la lista es «pareja»', async () => {
    fs.writeFileSync(path.join(dir, 'data.json'), JSON.stringify(datosDeEjemplo));
    const s = cargarServidor(dir, 'jorge@ejemplo.com');
    await s.migrarAHogares();
    const mapa = await s.leerHogares();

    expect(s.rolDe(mapa, 'principal', { oid: 'otro-oid', email: 'otro@ejemplo.com' })).toBe('partner');
  });

  it('sin identidad o sin hogar no hay rol que dar', async () => {
    const s = cargarServidor(dir);
    const casa = await s.crearHogar(ana, 'Casa de Ana');
    const mapa = await s.leerHogares();
    expect(s.rolDe(mapa, casa, {})).toBeNull();
    expect(s.rolDe(mapa, 'h_no_existe', ana.user)).toBeNull();
  });
});

describe('los ajustes del hogar', () => {
  it('un hogar nuevo nace con un objeto de ajustes vacio', async () => {
    const s = cargarServidor(dir);
    const casa = await s.crearHogar(ana, 'Casa de Ana');
    const datos = JSON.parse(fs.readFileSync(s.archivoDeHogar(casa), 'utf8'));
    expect(datos.hogarConfig).toEqual({});
  });

  // Cada uno guarda lo suyo desde su dispositivo. Con «gana el ultimo», el
  // guardado de la tasa de retiro borraria la mesada que la otra acaba de poner.
  it('guardar una clave no borra las demas', () => {
    const s = cargarServidor(dir);
    const r = s.fusionarAjustes({ mesada: { me: 200 } }, { independencia: { tasa: 0.03 } });
    expect(r).toEqual({ mesada: { me: 200 }, independencia: { tasa: 0.03 } });
  });

  it('una clave repetida la pisa lo nuevo', () => {
    const s = cargarServidor(dir);
    const r = s.fusionarAjustes({ independencia: { tasa: 0.04 } }, { independencia: { tasa: 0.03 } });
    expect(r.independencia.tasa).toBe(0.03);
  });

  it('lo que no es un objeto plano no toca nada ni revienta', () => {
    const s = cargarServidor(dir);
    expect(s.fusionarAjustes({ a: 1 }, null)).toEqual({ a: 1 });
    expect(s.fusionarAjustes({ a: 1 }, [1, 2])).toEqual({ a: 1 });
    expect(s.fusionarAjustes(undefined, { b: 2 })).toEqual({ b: 2 });
    expect(s.fusionarAjustes('roto', 'roto')).toEqual({});
  });
});
