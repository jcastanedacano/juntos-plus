import { describe, it, expect } from 'vitest';
import { limpiarNota, LIMITE_NOTA } from '../budgetNotes';

describe('limpiar la nota de un presupuesto', () => {
  it('quita los espacios de los extremos', () => {
    expect(limpiarNota('  terapias y medicinas  ')).toBe('terapias y medicinas');
  });

  it('una nota vacia o solo de espacios no es nota', () => {
    expect(limpiarNota('')).toBe('');
    expect(limpiarNota('   \n  \n ')).toBe('');
  });

  it('conserva los saltos de linea: una lista, un concepto por linea', () => {
    expect(limpiarNota('Terapias\nMedicinas')).toBe('Terapias\nMedicinas');
  });

  it('normaliza los saltos de Windows', () => {
    expect(limpiarNota('Terapias\r\nMedicinas')).toBe('Terapias\nMedicinas');
  });

  it('no deja mas de una linea en blanco seguida', () => {
    expect(limpiarNota('A\n\n\n\nB')).toBe('A\n\nB');
  });

  it('recorta los espacios de cada linea', () => {
    expect(limpiarNota('  A  \n   B ')).toBe('A\nB');
  });

  it('respeta el limite y no deja espacios colgando al cortar', () => {
    const larga = 'a'.repeat(LIMITE_NOTA - 1) + ' ' + 'b'.repeat(50);
    const r = limpiarNota(larga);
    expect(r.length).toBeLessThanOrEqual(LIMITE_NOTA);
    expect(r.endsWith(' ')).toBe(false);
  });

  it('lo que no es texto no revienta', () => {
    for (const raro of [undefined, null, 42, {}, [], true]) {
      expect(limpiarNota(raro)).toBe('');
    }
  });

  it('conserva tildes, enies y simbolos', () => {
    expect(limpiarNota('Psicología · niños (S/ 80)')).toBe('Psicología · niños (S/ 80)');
  });
});
