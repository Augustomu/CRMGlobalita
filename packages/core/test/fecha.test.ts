import test from 'node:test';
import assert from 'node:assert/strict';
import { ddmm, ddmmaaaa, diaLocal } from '../src/fecha.ts';

// El bug que motiva el módulo: a las 21:00 en Buenos Aires ya es mañana en UTC,
// y con la fecha de UTC la lista marca como vencido lo que vence mañana.
test('hoy es hoy donde está quien mira, no en UTC', () => {
  // 8 de septiembre, 21:30 hora LOCAL: el constructor de tres números no pasa
  // por UTC, así que esto vale en cualquier zona donde se corra el test.
  assert.equal(diaLocal(new Date(2026, 8, 8, 21, 30)), '2026-09-08');
  // Y el mismo instante contado como antes daba otro día en media América.
  const noche = new Date(2026, 8, 8, 23, 45);
  assert.equal(diaLocal(noche).slice(8, 10), '08');

  // Y la madrugada del otro lado: 1 de enero a las 00:30.
  assert.equal(diaLocal(new Date(2026, 0, 1, 0, 30)), '2026-01-01');
  // Un dígito se rellena.
  assert.equal(diaLocal(new Date(2026, 2, 5, 12, 0)), '2026-03-05');
});

test('dd/mm sale del texto, no de parsear la fecha', () => {
  // `new Date('2026-09-08')` es UTC y al oeste vuelve como el 7. El día que se
  // muestra tiene que ser el que dice el dato.
  assert.equal(ddmm('2026-09-08'), '08/09');
  assert.equal(ddmm('2026-09-08 14:12:00.000Z'), '08/09');
  assert.equal(ddmmaaaa('2026-09-08'), '08/09/2026');
});

test('sin fecha no se inventa una', () => {
  assert.equal(ddmm(null), '');
  assert.equal(ddmm(''), '');
  assert.equal(ddmm('2026-09'), '');
  assert.equal(ddmmaaaa(undefined), '');
});
