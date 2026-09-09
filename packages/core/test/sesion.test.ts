import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  estadoDeSesion,
  porQueNingunaSesion,
  MINUTOS_SIN_SENAL,
} from '../src/sesion.ts';

const AHORA = new Date('2026-09-09T18:00:00.000Z');
const haceMinutos = (m: number) => new Date(AHORA.getTime() - m * 60000).toISOString();

// ------------------------------------------------ §8.1: el estado se deduce

test('sin señal nunca hubo sesión: sin vincular', () => {
  assert.equal(estadoDeSesion('', AHORA), 'sin_vincular');
  assert.equal(estadoDeSesion(null, AHORA), 'sin_vincular');
  assert.equal(estadoDeSesion(undefined, AHORA), 'sin_vincular');
});

test('una señal reciente es una sesión activa', () => {
  assert.equal(estadoDeSesion(haceMinutos(1), AHORA), 'activa');
  assert.equal(estadoDeSesion(haceMinutos(MINUTOS_SIN_SENAL - 1), AHORA), 'activa');
});

test('justo en el límite todavía cuenta como activa', () => {
  assert.equal(estadoDeSesion(haceMinutos(MINUTOS_SIN_SENAL), AHORA), 'activa');
});

test('pasado el límite, la sesión está caída', () => {
  assert.equal(estadoDeSesion(haceMinutos(MINUTOS_SIN_SENAL + 1), AHORA), 'caida');
  assert.equal(estadoDeSesion(haceMinutos(60 * 8), AHORA), 'caida');
});

test('caída y sin vincular no son lo mismo', () => {
  // Lo que hay que hacer es distinto: una se vincula, la otra se levanta.
  assert.notEqual(estadoDeSesion(haceMinutos(999), AHORA), estadoDeSesion('', AHORA));
});

test('una fecha ilegible no se toma por sesión viva', () => {
  // El error caro es el falso «activa»: se confía en la pantalla justo cuando
  // la cola dejó de salir y hay que saber por qué.
  assert.equal(estadoDeSesion('cualquier cosa', AHORA), 'sin_vincular');
});

test('acepta el formato en que lo guarda PocketBase', () => {
  assert.equal(estadoDeSesion('2026-09-09 17:55:00.000Z', AHORA), 'activa');
});

// ------------------------------------------------ el aviso de la pantalla

test('sin worker y con cuentas, explica la causa una sola vez', () => {
  const aviso = porQueNingunaSesion(false, 7);
  assert.ok(aviso);
  assert.match(aviso, /nunca se levantaron/);
});

test('con worker no hay nada que explicar', () => {
  assert.equal(porQueNingunaSesion(true, 7), null);
});

test('sin cuentas tampoco: no hay siete filas que justificar', () => {
  assert.equal(porQueNingunaSesion(false, 0), null);
});
