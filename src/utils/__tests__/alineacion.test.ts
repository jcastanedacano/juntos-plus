import { describe, it, expect } from 'vitest';
import {
  sumar, restantes, ajustar, vacio, repartirParejo, solapamiento, nivelDeAlineacion,
  diferencias, paraConversar, cambios, evolucion, TOTAL_PUNTOS,
} from '../alineacion';

const IDS = ['a', 'b', 'c', 'd'];

describe('repartir 100 puntos', () => {
  it('suma y resta lo que queda', () => {
    const p = { a: 30, b: 20 };
    expect(sumar(p)).toBe(50);
    expect(restantes(p)).toBe(50);
  });

  it('un valor que no es numero no suma', () => {
    expect(sumar({ a: NaN, b: 10 })).toBe(10);
  });

  it('ajustar no deja pasar de 100: el tope es lo que ya tenia mas lo que queda', () => {
    const p = { a: 60, b: 30 };            // quedan 10
    expect(ajustar(p, 'a', 100).a).toBe(70);
    expect(ajustar(p, 'c', 50).c).toBe(10);
  });

  it('bajar siempre se puede, y libera puntos', () => {
    const p = { a: 60, b: 40 };            // 0 restantes
    const q = ajustar(p, 'a', 10);
    expect(q.a).toBe(10);
    expect(restantes(q)).toBe(50);
  });

  it('con 0 restantes, subir otra area no hace nada', () => {
    const p = { a: 60, b: 40 };
    expect(ajustar(p, 'a', 80).a).toBe(60);
  });

  it('nunca negativo ni decimal ni basura', () => {
    expect(ajustar({ a: 10 }, 'a', -5).a).toBe(0);
    expect(ajustar({ a: 10 }, 'a', 12.6).a).toBe(13);
    expect(ajustar({ a: 10 }, 'a', NaN).a).toBe(0);
    expect(ajustar({ a: 10 }, 'a', Infinity).a).toBe(0);
  });

  it('no modifica el original', () => {
    const p = { a: 10 };
    ajustar(p, 'a', 20);
    expect(p.a).toBe(10);
  });

  it('vacio pone todas las areas a cero', () => {
    expect(vacio(IDS)).toEqual({ a: 0, b: 0, c: 0, d: 0 });
  });
});

describe('repartir parejo', () => {
  it('suma siempre 100, con enteros', () => {
    for (const n of [1, 2, 3, 7, 8, 9]) {
      const ids = Array.from({ length: n }, (_, i) => 'k' + i);
      const r = repartirParejo(ids);
      expect(sumar(r)).toBe(TOTAL_PUNTOS);
      expect(Object.values(r).every(Number.isInteger)).toBe(true);
    }
  });

  it('lo que sobra va a las primeras areas, de uno en uno', () => {
    const ids = Array.from({ length: 8 }, (_, i) => 'k' + i);
    const r = repartirParejo(ids);
    expect(r.k0).toBe(13);
    expect(r.k3).toBe(13);
    expect(r.k4).toBe(12);
    expect(r.k7).toBe(12);
  });

  it('sin areas no hay nada que repartir', () => {
    expect(repartirParejo([])).toEqual({});
  });
});

describe('cuanto coinciden dos repartos', () => {
  it('iguales dan 100', () => {
    const p = { a: 40, b: 30, c: 20, d: 10 };
    expect(solapamiento(p, p, IDS)).toBe(100);
  });

  it('sin un solo punto en comun dan 0', () => {
    expect(solapamiento({ a: 100 }, { b: 100 }, IDS)).toBe(0);
  });

  it('es la suma de lo menor: 100 menos la mitad de las distancias', () => {
    const x = { a: 50, b: 30, c: 20, d: 0 };
    const y = { a: 20, b: 30, c: 20, d: 30 };
    expect(solapamiento(x, y, IDS)).toBe(70);
    const distancias = diferencias(x, y, IDS).reduce((s, d) => s + d.distancia, 0);
    expect(100 - distancias / 2).toBe(70);
  });

  it('es simetrico', () => {
    const x = { a: 70, b: 30 };
    const y = { a: 10, b: 20, c: 70 };
    expect(solapamiento(x, y, IDS)).toBe(solapamiento(y, x, IDS));
  });

  it('un area que falta vale cero', () => {
    expect(solapamiento({ a: 100 }, { a: 60, b: 40 }, IDS)).toBe(60);
  });
});

describe('nivel de alineacion', () => {
  it('alta desde 75, media desde 50, baja por debajo', () => {
    expect(nivelDeAlineacion(100)).toBe('alta');
    expect(nivelDeAlineacion(75)).toBe('alta');
    expect(nivelDeAlineacion(74)).toBe('media');
    expect(nivelDeAlineacion(50)).toBe('media');
    expect(nivelDeAlineacion(49)).toBe('baja');
    expect(nivelDeAlineacion(0)).toBe('baja');
  });
});

describe('diferencias', () => {
  const yo = { a: 50, b: 30, c: 20, d: 0 };
  const ella = { a: 10, b: 30, c: 20, d: 40 };

  it('de la que mas separa a la que menos', () => {
    const d = diferencias(yo, ella, IDS);
    expect(d.map(x => x.id)).toEqual(['a', 'd', 'b', 'c']);
    expect(d[0]).toEqual({ id: 'a', yo: 50, pareja: 10, distancia: 40 });
  });

  it('los empates conservan el orden de las areas', () => {
    const d = diferencias({ a: 10, b: 10, c: 80 }, { a: 0, b: 20, c: 80 }, IDS);
    expect(d.map(x => x.id).slice(0, 2)).toEqual(['a', 'b']);
  });

  it('para conversar: solo de 10 puntos para arriba, y hasta tres', () => {
    const d = diferencias(yo, ella, IDS);
    expect(paraConversar(d).map(x => x.id)).toEqual(['a', 'd']);
    expect(paraConversar(d, 1).map(x => x.id)).toEqual(['a']);
  });

  it('dos repartos casi iguales no traen nada que conversar', () => {
    const d = diferencias({ a: 50, b: 50 }, { a: 46, b: 54 }, IDS);
    expect(paraConversar(d)).toEqual([]);
  });
});

describe('como cambio una persona', () => {
  it('solo lo que se movio, de lo mas grande a lo mas chico', () => {
    const antes = { a: 40, b: 30, c: 20, d: 10 };
    const ahora = { a: 25, b: 30, c: 25, d: 20 };
    const c = cambios(antes, ahora, IDS);
    expect(c.map(x => x.id)).toEqual(['a', 'd', 'c']);
    expect(c[0]).toEqual({ id: 'a', antes: 40, ahora: 25, delta: -15 });
  });

  it('sin cambios, lista vacia', () => {
    const p = { a: 50, b: 50 };
    expect(cambios(p, p, IDS)).toEqual([]);
  });

  it('la evolucion de la alineacion es la diferencia entre rondas', () => {
    const previa = { yo: { a: 100 }, pareja: { a: 60, b: 40 } };   // 60 entonces
    expect(evolucion(previa, 75, IDS)).toBe(15);
    expect(evolucion(previa, 45, IDS)).toBe(-15);
  });
});
