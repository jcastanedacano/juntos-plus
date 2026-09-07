import { describe, it, expect } from 'vitest';
import { toStableDateISO, toDateInputValue, parseDateOnly } from '../stableDate';
import { startOfMonth, format } from 'date-fns';

// El día calendario LOCAL es el que el usuario ve en el calendario, porque
// la app etiqueta con date-fns `format`, que es local.
const localDay = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

describe('toStableDateISO', () => {
  it('un valor de <input type="date"> se guarda en SU día, no el anterior', () => {
    // El bug original: new Date("2026-09-06") es medianoche UTC, que en
    // UTC-5 cae el 5. El usuario elegía 6 y la app mostraba 5.
    expect(localDay(toStableDateISO('2026-09-06'))).toBe('2026-09-06');
  });

  it('el día 1 no se cae al mes anterior', () => {
    // El caso más dañino: 2026-09-01 a medianoche UTC se muestra como
    // 31 de agosto, o sea un cobro de septiembre apareciendo en agosto.
    expect(localDay(toStableDateISO('2026-09-01'))).toBe('2026-09-01');
  });

  it('conserva el día calendario local de un Date', () => {
    const d = new Date(2026, 8, 29, 23, 30); // 29 sept, casi medianoche local
    expect(localDay(toStableDateISO(d))).toBe('2026-09-29');
  });

  it('normaliza una fecha heredada de medianoche UTC a su día original', () => {
    // Los datos viejos se guardaron como T00:00:00.000Z. Reanclarlos debe
    // dejarlos en el día que se pretendía, no correrlos otra vez.
    expect(localDay(toStableDateISO('2026-09-06T12:00:00.000Z'))).toBe('2026-09-06');
  });

  it('es idempotente', () => {
    const once = toStableDateISO('2026-09-06');
    expect(toStableDateISO(once)).toBe(once);
  });

  it('devuelve cadena vacía ante entradas inválidas', () => {
    expect(toStableDateISO('no-es-fecha')).toBe('');
    expect(toStableDateISO(new Date('x'))).toBe('');
  });
});

describe('toDateInputValue', () => {
  it('precarga el input con el día guardado', () => {
    expect(toDateInputValue('2026-09-06T12:00:00.000Z')).toBe('2026-09-06');
  });

  it('no corre el día en fechas heredadas de medianoche UTC', () => {
    expect(toDateInputValue('2026-09-06T00:00:00.000Z')).toBe('2026-09-06');
  });

  it('tolera vacío', () => {
    expect(toDateInputValue('')).toBe('');
  });
});

describe('parseDateOnly', () => {
  const ymd = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  it('una fecha sin hora conserva su día', () => {
    // El bug reportado: se guardó 2026-09-01 y la fila mostraba "31 ago".
    expect(ymd(parseDateOnly('2026-09-01'))).toBe('2026-09-01');
  });

  it('cae en el mes correcto al agrupar', () => {
    // Con new Date() nativo, el 1 de septiembre caía en agosto y
    // contaminaba los totales del mes.
    const d = parseDateOnly('2026-09-01');
    expect(d.getMonth()).toBe(8);   // 8 = septiembre
    expect(d.getFullYear()).toBe(2026);
  });

  it('el último día del mes tampoco se corre', () => {
    expect(ymd(parseDateOnly('2026-08-31'))).toBe('2026-08-31');
  });

  it('respeta las cadenas que sí traen hora', () => {
    const iso = '2026-09-01T15:30:00.000Z';
    expect(parseDateOnly(iso).getTime()).toBe(new Date(iso).getTime());
  });

  it('deja pasar un Date tal cual', () => {
    const d = new Date(2026, 8, 1);
    expect(parseDateOnly(d)).toBe(d);
  });
});

describe('mes inicial del calendario de Transacciones', () => {
  // Reportado: al entrar a Transacciones el calendario abría en "Agosto 2026"
  // y vacío, mientras la lista de abajo mostraba bien las transacciones del
  // 1 sep. El calendario elegía el mes con new Date(sorted[0].date), que en
  // UTC-5 retrocede al 31 de agosto y startOfMonth lo lleva a agosto.
  const mesInicial = (fechas: string[]) => {
    const sorted = [...fechas].sort(
      (a, b) => parseDateOnly(b).getTime() - parseDateOnly(a).getTime()
    );
    return startOfMonth(parseDateOnly(sorted[0]));
  };

  it('una transacción del 1 de setiembre abre el calendario en setiembre', () => {
    expect(format(mesInicial(['2026-09-01']), 'yyyy-MM')).toBe('2026-09');
  });

  it('usa la transacción más reciente, no la primera del arreglo', () => {
    expect(format(mesInicial(['2026-07-15', '2026-09-01', '2026-08-20']), 'yyyy-MM')).toBe('2026-09');
  });

  it('el día 1 de cualquier mes no cae en el mes anterior', () => {
    for (const [fecha, esperado] of [
      ['2026-01-01', '2026-01'],
      ['2026-03-01', '2026-03'],
      ['2026-12-01', '2026-12'],
    ]) {
      expect(format(mesInicial([fecha]), 'yyyy-MM')).toBe(esperado);
    }
  });
});
