import { describe, it, expect } from 'vitest';
import {
  tasaMensual, cuotasParaSaldar, cuotasRestantesDe, ordenDePago, simularPago,
  compararEstrategias, totalesDeuda, normalizarExtra, normalizarEstrategia, ESTRATEGIA_POR_DEFECTO,
} from '../deudas';
import { Debt } from '../../types';

const deuda = (over: Partial<Debt>): Debt => ({
  id: 'd', name: 'Deuda', balance: 1000, tea: 0, monthlyPayment: 100, ...over,
});

// Una TEA cuya tasa mensual es exactamente 1 %.
const TEA_1_MENSUAL = Math.pow(1.01, 12) - 1;

describe('tasa mensual', () => {
  it('es la equivalente compuesta, no la TEA entre 12', () => {
    expect(tasaMensual(TEA_1_MENSUAL)).toBeCloseTo(0.01, 12);
    // Dividir entre 12 daria 1,0569 %: sobrestima el interes.
    expect(tasaMensual(TEA_1_MENSUAL)).toBeLessThan(TEA_1_MENSUAL / 12);
  });

  it('sin interes o con un dato roto, cero', () => {
    expect(tasaMensual(0)).toBe(0);
    expect(tasaMensual(-0.2)).toBe(0);
    expect(tasaMensual(NaN)).toBe(0);
  });
});

describe('cuotas para saldar', () => {
  it('sin interes es saldo entre cuota, redondeado hacia arriba', () => {
    expect(cuotasParaSaldar(1000, 0, 100)).toBe(10);
    expect(cuotasParaSaldar(1050, 0, 100)).toBe(11);
  });

  it('con interes hacen falta mas cuotas', () => {
    // 1000 al 1 % mensual pagando 100: 10,59 cuotas, o sea 11.
    expect(cuotasParaSaldar(1000, TEA_1_MENSUAL, 100)).toBe(11);
  });

  it('si la cuota no cubre el interes del mes, nunca se salda', () => {
    expect(cuotasParaSaldar(10000, 0.5, 50)).toBe(Infinity);
    expect(cuotasParaSaldar(1000, 0, 0)).toBe(Infinity);
  });

  it('sin saldo no hay cuotas', () => {
    expect(cuotasParaSaldar(0, 0.3, 100)).toBe(0);
  });

  it('las cuotas restantes que da el usuario mandan sobre la cuenta', () => {
    expect(cuotasRestantesDe(deuda({ remainingInstallments: 7 }))).toBe(7);
    expect(cuotasRestantesDe(deuda({ remainingInstallments: 0 }))).toBe(10);      // no vale: se calcula
    expect(cuotasRestantesDe(deuda({ remainingInstallments: undefined }))).toBe(10);
  });
});

describe('simular el pago de una deuda', () => {
  it('sin interes: tantos meses como cuotas y ningun interes', () => {
    const r = simularPago([deuda({})], 0, 'avalancha');
    expect(r.meses).toBe(10);
    expect(r.interesTotal).toBe(0);
    expect(r.totalPagado).toBe(1000);
  });

  it('con interes coincide con la cuenta cerrada y con lo pagado', () => {
    const r = simularPago([deuda({ tea: TEA_1_MENSUAL })], 0, 'avalancha');
    expect(r.meses).toBe(11);
    // Lo pagado es siempre el capital mas el interes: si no cuadra, se pierde dinero.
    expect(r.totalPagado).toBeCloseTo(1000 + r.interesTotal, 1);
    expect(r.interesTotal).toBeGreaterThan(50);
    expect(r.interesTotal).toBeLessThan(60);
  });

  it('pagar de mas acorta el plazo y baja el interes', () => {
    const base = simularPago([deuda({ tea: TEA_1_MENSUAL })], 0, 'avalancha');
    const conExtra = simularPago([deuda({ tea: TEA_1_MENSUAL })], 100, 'avalancha');
    expect(conExtra.meses!).toBeLessThan(base.meses!);
    expect(conExtra.interesTotal).toBeLessThan(base.interesTotal);
  });

  it('un extra mayor que toda la deuda la salda el primer mes', () => {
    const r = simularPago([deuda({})], 5000, 'avalancha');
    expect(r.meses).toBe(1);
  });

  it('si la cuota no cubre el interes, no se salda y lo dice', () => {
    const r = simularPago([deuda({ id: 'x', balance: 10000, tea: 0.5, monthlyPayment: 50 })], 0, 'avalancha');
    expect(r.meses).toBeNull();
    expect(r.sinFin).toEqual(['x']);
  });

  it('un extra puede rescatar una deuda que sola no se salda', () => {
    const r = simularPago([deuda({ balance: 10000, tea: 0.5, monthlyPayment: 50 })], 1000, 'avalancha');
    expect(r.meses).not.toBeNull();
  });

  it('las inactivas y las de saldo cero no cuentan', () => {
    const r = simularPago([deuda({ id: 'a', isActive: false }), deuda({ id: 'b', balance: 0 })], 0, 'avalancha');
    expect(r.meses).toBe(0);
    expect(r.orden).toEqual([]);
  });

  it('sin deudas, nada que simular', () => {
    expect(simularPago([], 0, 'avalancha').meses).toBe(0);
  });
});

describe('orden de pago', () => {
  const corta = deuda({ id: 'corta', balance: 500, tea: 0.05, monthlyPayment: 100 });   // 5 cuotas
  const cara = deuda({ id: 'cara', balance: 5000, tea: 0.6, monthlyPayment: 400 });     // ~16 cuotas

  it('bola de nieve: la que termina antes, aunque sea barata', () => {
    expect(ordenDePago([cara, corta], 'bola_de_nieve').map(d => d.id)).toEqual(['corta', 'cara']);
  });

  it('avalancha: la de mayor tasa, aunque tarde mas', () => {
    expect(ordenDePago([corta, cara], 'avalancha').map(d => d.id)).toEqual(['cara', 'corta']);
  });

  it('respeta las cuotas restantes que dio el usuario', () => {
    const a = deuda({ id: 'a', remainingInstallments: 30 });
    const b = deuda({ id: 'b', remainingInstallments: 3 });
    expect(ordenDePago([a, b], 'bola_de_nieve')[0].id).toBe('b');
  });

  it('un empate se rompe por el saldo menor', () => {
    const a = deuda({ id: 'a', balance: 900, tea: 0.2 });
    const b = deuda({ id: 'b', balance: 300, tea: 0.2 });
    expect(ordenDePago([a, b], 'avalancha')[0].id).toBe('b');
  });

  it('dos deudas que nunca terminan no rompen el orden', () => {
    const a = deuda({ id: 'a', balance: 9000, tea: 0.9, monthlyPayment: 10 });
    const b = deuda({ id: 'b', balance: 4000, tea: 0.9, monthlyPayment: 10 });
    expect(ordenDePago([a, b], 'bola_de_nieve').map(d => d.id)).toEqual(['b', 'a']);
  });

  it('no modifica la lista que recibe', () => {
    const lista = [cara, corta];
    ordenDePago(lista, 'bola_de_nieve');
    expect(lista.map(d => d.id)).toEqual(['cara', 'corta']);
  });
});

describe('bola de nieve contra avalancha', () => {
  const corta = deuda({ id: 'corta', name: 'Celular', balance: 500, tea: 0.05, monthlyPayment: 100 });
  const cara = deuda({ id: 'cara', name: 'Prestamo', balance: 5000, tea: 0.6, monthlyPayment: 400 });

  it('la avalancha paga menos intereses cuando la deuda cara no es la corta', () => {
    const c = compararEstrategias([corta, cara], 300);
    expect(c.masBarata).toBe('avalancha');
    expect(c.interesAhorrado).toBeGreaterThan(0);
    expect(c.avalancha.interesTotal).toBeLessThan(c.bolaDeNieve.interesTotal);
  });

  it('las dos saldan todo, y lo pagado es capital mas interes en ambas', () => {
    const c = compararEstrategias([corta, cara], 300);
    for (const r of [c.avalancha, c.bolaDeNieve]) {
      expect(r.meses).not.toBeNull();
      expect(r.totalPagado).toBeCloseTo(5500 + r.interesTotal, 0);
    }
  });

  it('la cuota de la saldada pasa a la siguiente: con extra termina antes que sin el', () => {
    const sin = simularPago([corta, cara], 0, 'bola_de_nieve');
    const con = simularPago([corta, cara], 300, 'bola_de_nieve');
    expect(con.meses!).toBeLessThan(sin.meses!);
  });

  it('anota en que mes cae cada deuda, en orden', () => {
    const r = simularPago([corta, cara], 300, 'bola_de_nieve');
    expect(r.saldadas.map(s => s.id)).toEqual(['corta', 'cara']);
    expect(r.saldadas[0].mes).toBeLessThan(r.saldadas[1].mes);
    expect(r.saldadas[1].mes).toBe(r.meses);
    expect(r.saldadas[0].nombre).toBe('Celular');
  });

  it('con una sola deuda las dos estrategias son lo mismo', () => {
    const c = compararEstrategias([cara], 200);
    expect(c.masBarata).toBe('igual');
    expect(c.interesAhorrado).toBe(0);
    expect(c.mesesDeDiferencia).toBe(0);
  });

  it('el presupuesto mensual es la suma de las cuotas mas el extra', () => {
    expect(simularPago([corta, cara], 300, 'avalancha').presupuestoMensual).toBe(800);
  });

  it('si alguna no se salda, la diferencia de meses es null', () => {
    const rota = deuda({ id: 'r', balance: 10000, tea: 0.5, monthlyPayment: 50 });
    expect(compararEstrategias([rota], 0).mesesDeDiferencia).toBeNull();
  });
});

describe('totales', () => {
  it('suma saldos y cuotas, y pondera la tasa por saldo', () => {
    const t = totalesDeuda([
      deuda({ id: 'a', balance: 1000, tea: 0.10, monthlyPayment: 100 }),
      deuda({ id: 'b', balance: 3000, tea: 0.30, monthlyPayment: 250 }),
    ]);
    expect(t.saldo).toBe(4000);
    expect(t.cuotasMensuales).toBe(350);
    expect(t.teaMedia).toBeCloseTo(0.25, 10);
  });

  it('sin deudas, ceros y sin dividir entre cero', () => {
    expect(totalesDeuda([])).toEqual({ saldo: 0, cuotasMensuales: 0, teaMedia: 0 });
  });

  it('las inactivas no entran', () => {
    expect(totalesDeuda([deuda({ isActive: false })]).saldo).toBe(0);
  });
});

describe('normalizar lo que llega de la pantalla', () => {
  it('el extra malo es cero', () => {
    for (const malo of [-5, NaN, Infinity, undefined, null, '', 'abc']) {
      expect(normalizarExtra(malo)).toBe(0);
    }
    expect(normalizarExtra('150.5')).toBe(150.5);
  });

  it('una estrategia desconocida vuelve a la de por defecto', () => {
    expect(normalizarEstrategia('loquesea')).toBe(ESTRATEGIA_POR_DEFECTO);
    expect(normalizarEstrategia('bola_de_nieve')).toBe('bola_de_nieve');
  });
});
