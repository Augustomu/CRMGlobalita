import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MAXIMO_CORRIMIENTO,
  cargaPorDia,
  estadoDelDia,
  fechaConCupo,
} from '../src/carga.ts';

const HOY = '2026-09-07';
const TOPE = 40;

test('la carga cuenta un lead por día de próximo contacto', () => {
  const carga = cargaPorDia([
    { proximo_contacto: '2026-09-08' },
    { proximo_contacto: '2026-09-08' },
    { proximo_contacto: '2026-09-09' },
  ]);
  assert.deepEqual(carga, { '2026-09-08': 2, '2026-09-09': 1 });
});

test('los leads sin fecha no cuentan: no son trabajo agendado para ningún día', () => {
  const carga = cargaPorDia([
    { proximo_contacto: null },
    { proximo_contacto: '' },
    {},
    { proximo_contacto: '2026-09-08' },
  ]);
  assert.deepEqual(carga, { '2026-09-08': 1 });
});

test('la fecha se corta a diez caracteres: la base guarda con hora', () => {
  assert.deepEqual(cargaPorDia([{ proximo_contacto: '2026-09-08 00:00:00.000Z' }]), {
    '2026-09-08': 1,
  });
});

// --------------------------------------------------------- cómo se pinta

test('un día vacío está libre y uno en el tope está lleno', () => {
  assert.equal(estadoDelDia(0, TOPE), 'libre');
  assert.equal(estadoDelDia(40, TOPE), 'lleno');
  assert.equal(estadoDelDia(41, TOPE), 'lleno');
});

test('el ámbar avisa al 60% del tope, no cuando ya no entra nada', () => {
  // Avisar recién en 40 llega tarde: la decisión de repartir ya se tomó mal.
  assert.equal(estadoDelDia(23, TOPE), 'libre');
  assert.equal(estadoDelDia(24, TOPE), 'cargado');
  assert.equal(estadoDelDia(39, TOPE), 'cargado');
});

test('sin tope configurado ningún día se pinta: no hay contra qué medir', () => {
  assert.equal(estadoDelDia(500, 0), 'libre');
});

// ------------------------------------------------------------- los atajos

test('con el día libre, el atajo cae exacto a las N semanas', () => {
  const r = fechaConCupo(HOY, 2, {}, TOPE);
  assert.equal(r.fecha, '2026-09-21');
  assert.equal(r.corrimiento, 0);
  assert.equal(r.sinLugar, false);
});

test('si el día ideal está lleno, corre hacia adelante hasta encontrar lugar', () => {
  const carga = { '2026-09-14': TOPE, '2026-09-15': TOPE };
  const r = fechaConCupo(HOY, 1, carga, TOPE);
  assert.equal(r.fecha, '2026-09-16');
  assert.equal(r.corrimiento, 2);
  assert.equal(r.sinLugar, false);
});

test('nunca corre hacia atrás: adelantar contra la cadencia es peor que demorar', () => {
  // El 13 está libre, pero es ANTES del ideal: no se elige.
  const carga = { '2026-09-14': TOPE };
  assert.equal(fechaConCupo(HOY, 1, carga, TOPE).fecha, '2026-09-15');
});

test('un día cargado pero no lleno no corre nada: todavía entra', () => {
  const r = fechaConCupo(HOY, 1, { '2026-09-14': TOPE - 1 }, TOPE);
  assert.equal(r.corrimiento, 0);
});

test('con todo lleno devuelve la última fecha probada y lo marca', () => {
  // Que un mes entero esté lleno es un problema de carga, no algo que se
  // arregle moviendo una fila: mejor una fecha visible que ninguna.
  const carga: Record<string, number> = {};
  for (let i = 0; i <= 40; i++) {
    const d = new Date(`2026-09-07T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + i);
    carga[d.toISOString().slice(0, 10)] = TOPE;
  }
  const r = fechaConCupo(HOY, 1, carga, TOPE);
  assert.equal(r.corrimiento, MAXIMO_CORRIMIENTO);
  assert.equal(r.sinLugar, true);
});

test('cruza el fin de mes sin romperse', () => {
  assert.equal(fechaConCupo('2026-09-28', 1, {}, TOPE).fecha, '2026-10-05');
});
