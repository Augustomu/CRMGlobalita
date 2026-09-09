import { test } from 'node:test';
import assert from 'node:assert/strict';
import { comoSeDiceElHueco, huecosDelDia, HUECO_MINIMO } from '../src/huecos.ts';

/** La franja que dibuja la grilla: 8 a 20. */
const DESDE = 8 * 60;
const HASTA = 20 * 60;
const h = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3));
const rato = (a: string, b: string) => ({ desde: h(a), hasta: h(b) });

test('§7.6 · un día vacío es un solo hueco de punta a punta', () => {
  const r = huecosDelDia([], DESDE, HASTA);
  assert.equal(r.length, 1);
  assert.equal(r[0]!.minutos, 12 * 60);
});

test('§7.6 · una reunión al medio parte el día en dos huecos', () => {
  const r = huecosDelDia([rato('11:00', '12:00')], DESDE, HASTA);
  assert.deepEqual(
    r.map((x) => x.minutos),
    [3 * 60, 8 * 60],
  );
});

test('§7.6 · una reunión pegada al borde no deja hueco de ese lado', () => {
  const r = huecosDelDia([rato('08:00', '09:00')], DESDE, HASTA);
  assert.equal(r.length, 1);
  assert.equal(r[0]!.desde, h('09:00'));
});

test('§7.6 · dos reuniones encimadas tapan un solo rato, no dos', () => {
  // 10:00–11:00 y 10:30–12:00 son un bloque de 10:00 a 12:00.
  const r = huecosDelDia([rato('10:00', '11:00'), rato('10:30', '12:00')], DESDE, HASTA);
  assert.equal(r.length, 2);
  assert.equal(r[0]!.hasta, h('10:00'));
  assert.equal(r[1]!.desde, h('12:00'));
});

test('§7.6 · una adentro de otra no inventa un hueco', () => {
  const r = huecosDelDia([rato('10:00', '13:00'), rato('11:00', '11:30')], DESDE, HASTA);
  assert.equal(r.length, 2);
  assert.equal(r[1]!.desde, h('13:00'));
});

test('§7.6 · llegan desordenadas y da lo mismo', () => {
  const a = huecosDelDia([rato('15:00', '16:00'), rato('10:00', '11:00')], DESDE, HASTA);
  const b = huecosDelDia([rato('10:00', '11:00'), rato('15:00', '16:00')], DESDE, HASTA);
  assert.deepEqual(a, b);
});

test('§7.6 · lo que asoma antes de las 8 se recorta, no corre la ventana', () => {
  // Una reunión de 7:30 a 8:30 tapa media hora de la franja, no una hora.
  const r = huecosDelDia([rato('07:30', '08:30')], DESDE, HASTA);
  assert.equal(r.length, 1);
  assert.equal(r[0]!.desde, h('08:30'));
  assert.equal(r[0]!.minutos, 11 * 60 + 30);
});

test('§7.6 · lo que está enteramente fuera de la franja no cuenta', () => {
  const r = huecosDelDia([rato('06:00', '07:00'), rato('21:00', '22:00')], DESDE, HASTA);
  assert.equal(r.length, 1);
  assert.equal(r[0]!.minutos, 12 * 60);
});

test('§7.6 · un hueco por debajo del mínimo no se anuncia', () => {
  // De 10:00 a 10:15 hay quince minutos: existen, pero no son un hueco.
  const r = huecosDelDia([rato('09:00', '10:00'), rato('10:15', '11:00')], DESDE, HASTA);
  assert.equal(r.length, 2);
  assert.equal(r[0]!.hasta, h('09:00'));
  assert.equal(r[1]!.desde, h('11:00'));
});

test('§7.6 · justo el mínimo sí se anuncia', () => {
  const r = huecosDelDia([rato('09:00', '10:00'), rato('10:30', '11:00')], DESDE, HASTA);
  assert.equal(r.length, 3);
  assert.equal(r[1]!.minutos, HUECO_MINIMO);
});

test('§7.6 · el día tapado de punta a punta no tiene huecos', () => {
  assert.deepEqual(huecosDelDia([rato('08:00', '20:00')], DESDE, HASTA), []);
});

test('§7.6 · una ventana al revés no devuelve nada', () => {
  assert.deepEqual(huecosDelDia([], HASTA, DESDE), []);
});

test('§7.6 · un rato de duración cero no tapa nada', () => {
  const r = huecosDelDia([rato('10:00', '10:00')], DESDE, HASTA);
  assert.equal(r.length, 1);
  assert.equal(r[0]!.minutos, 12 * 60);
});

test('§7.6 · el original no se toca', () => {
  const ocupados = [rato('10:00', '11:00')];
  const copia = ocupados.map((o) => ({ ...o }));
  huecosDelDia(ocupados, DESDE, HASTA);
  assert.deepEqual(ocupados, copia);
});

// -------------------------------------------------- cómo se lee

test('§7.6 · menos de una hora se dice en minutos', () => {
  assert.equal(comoSeDiceElHueco(30), '30 min libre');
  assert.equal(comoSeDiceElHueco(45), '45 min libre');
});

test('§7.6 · las horas redondas no arrastran minutos', () => {
  assert.equal(comoSeDiceElHueco(60), '1 h libre');
  assert.equal(comoSeDiceElHueco(180), '3 h libre');
});

test('§7.6 · horas y minutos juntos', () => {
  assert.equal(comoSeDiceElHueco(90), '1 h 30 libre');
  assert.equal(comoSeDiceElHueco(150), '2 h 30 libre');
});
