import { describe, it, expect } from 'vitest';
import { parseVoiceTransaction } from '../voiceParser';

const HOY = new Date(2026, 8, 6); // 6 set 2026

describe('parseVoiceTransaction', () => {
  it('frase tipica de gasto', () => {
    const r = parseVoiceTransaction('gasté 50 soles en almuerzo', HOY);
    expect(r.type).toBe('expense');
    expect(r.amount).toBe(50);
    expect(r.currency).toBe('PEN');
    expect(r.categoryId).toBe('food');
    expect(r.description).toBe('Almuerzo');
  });

  it('frase tipica de ingreso', () => {
    const r = parseVoiceTransaction('cobré 3000 de sueldo', HOY);
    expect(r.type).toBe('income');
    expect(r.amount).toBe(3000);
    expect(r.categoryId).toBe('salary');
  });

  it('entiende "ayer" y "anteayer"', () => {
    expect(parseVoiceTransaction('pagué 120 de luz ayer', HOY).date).toBe('2026-09-05');
    expect(parseVoiceTransaction('gasté 30 en taxi anteayer', HOY).date).toBe('2026-09-04');
    expect(parseVoiceTransaction('gasté 30 en taxi hoy', HOY).date).toBe('2026-09-06');
  });

  it('sin referencia temporal no inventa fecha', () => {
    expect(parseVoiceTransaction('gasté 30 en taxi', HOY).date).toBeNull();
  });

  it('detecta moneda extranjera', () => {
    expect(parseVoiceTransaction('pagué 25 dólares de Netflix', HOY).currency).toBe('USD');
    expect(parseVoiceTransaction('gasté 40 euros en libros', HOY).currency).toBe('EUR');
  });

  it('suscripciones gana sobre ocio para Netflix', () => {
    expect(parseVoiceTransaction('pagué 25 de Netflix', HOY).categoryId).toBe('subscriptions');
  });

  it('miles y decimales', () => {
    expect(parseVoiceTransaction('gasté 1,200.50 en muebles', HOY).amount).toBe(1200.5);
    expect(parseVoiceTransaction('gasté 1.200,50 en muebles', HOY).amount).toBe(1200.5);
    expect(parseVoiceTransaction('gasté 1200 en muebles', HOY).amount).toBe(1200);
    expect(parseVoiceTransaction('gasté 12,50 en pan', HOY).amount).toBe(12.5);
    expect(parseVoiceTransaction('gasté 1,200 en ropa', HOY).amount).toBe(1200);
  });

  it('funciona sin tildes, como suele transcribir el dictado', () => {
    const r = parseVoiceTransaction('gaste 80 soles en farmacia', HOY);
    expect(r.type).toBe('expense');
    expect(r.categoryId).toBe('health');
  });

  it('sin monto lo reporta y baja la confianza', () => {
    const r = parseVoiceTransaction('gasté en almuerzo', HOY);
    expect(r.amount).toBeNull();
    expect(r.confidence).toBeLessThan(0.6);
  });

  it('una frase completa llega a confianza alta', () => {
    expect(parseVoiceTransaction('gasté 50 soles en almuerzo', HOY).confidence).toBe(1);
  });

  it('cae a "otros" cuando no reconoce el rubro', () => {
    expect(parseVoiceTransaction('gasté 20 en zzzz', HOY).categoryId).toBe('other-expense');
    expect(parseVoiceTransaction('recibí 20 por zzzz', HOY).categoryId).toBe('other-income');
  });

  it('si hay dos verbos manda el que aparece primero', () => {
    expect(parseVoiceTransaction('cobré 100 y gasté 50', HOY).type).toBe('income');
    expect(parseVoiceTransaction('gasté 50 y cobré 100', HOY).type).toBe('expense');
  });

  it('no deja la descripcion vacia', () => {
    expect(parseVoiceTransaction('gasté 50 soles', HOY).description.length).toBeGreaterThan(0);
  });
});
