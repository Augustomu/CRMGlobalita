import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  AVISOS_POR_DEFECTO, descripcionEvento, finDe, momentosDeAviso, primeraReunion,
  tituloEvento, verBloque,  enSuZona,
} from '../src/reunion.ts';

test('el título del evento es "Lead / Cuenta / Vos", con solo el primer nombre de los dos últimos', () => {
  assert.equal(
    tituloEvento('Marcelo Carneiro', 'Francisco Herrera', 'Augusto Unzaga'),
    'Marcelo Carneiro / Francisco / Augusto',
  );
});

test('el nombre completo del lead se conserva aunque sea largo', () => {
  assert.equal(
    tituloEvento('Maria de los Angeles Fernandez Villagran', 'Edith', 'Augusto'),
    'Maria de los Angeles Fernandez Villagran / Edith / Augusto',
  );
});

test('la descripción lleva el perfil de LinkedIn, NO el de Sales Navigator', () => {
  const d = descripcionEvento('marcelomcarneiro', 'r8w2vd3ithxi7qb');
  assert.match(d, /linkedin\.com\/in\/marcelomcarneiro/);
  assert.doesNotMatch(d, /sales\/lead/);
  // El id del lead permite cruzar con el histórico, como el PB_ID que
  // apareció en los eventos viejos.
  assert.match(d, /PB_ID: r8w2vd3ithxi7qb/);
});

test('sin perfil de LinkedIn, la descripción igual lleva el id del lead', () => {
  const d = descripcionEvento('', 'abc123');
  assert.equal(d, 'PB_ID: abc123');
});

test('el fin sale del inicio más la duración', () => {
  assert.equal(finDe('2026-09-08T14:00:00.000Z', 30), '2026-09-08T14:30:00.000Z');
  assert.equal(finDe('2026-09-08T14:00:00.000Z', 45), '2026-09-08T14:45:00.000Z');
});

test('D11 · la demora se mide contra la PRIMERA reunión, no la última', () => {
  const r = [
    { inicio: '2026-08-27T11:00:00Z' },
    { inicio: '2026-09-01T09:00:00Z' },
  ];
  assert.equal(primeraReunion(r), '2026-08-27T11:00:00Z');
  assert.equal(primeraReunion([]), null);
});

test('D18 · en el calendario propio se ve el nombre', () => {
  const b = verBloque(
    { inicio: '2026-09-08T14:00:00Z', duracion_min: 30, lead: 'l1', calendario: 'u1' },
    'Marcelo Carneiro',
    'u1',
  );
  assert.equal(b.titulo, 'Marcelo Carneiro');
  assert.equal(b.propio, true);
  assert.equal(b.lead_id, 'l1');
});

test('D18 · en el calendario de otro solo se ve "Ocupado", sin nombre ni lead', () => {
  const b = verBloque(
    { inicio: '2026-09-08T14:00:00Z', duracion_min: 30, lead: 'l1', calendario: 'admin' },
    'Marcelo Carneiro',
    'u1',
  );
  assert.equal(b.titulo, 'Ocupado');
  assert.equal(b.propio, false);
  // Ni siquiera viaja el id: sería una forma indirecta de saber con quién se reunió.
  assert.equal(b.lead_id, undefined);
});

test('§5.11 · los avisos salen antes de la reunión, en orden', () => {
  const m = momentosDeAviso('2026-09-08T14:00:00.000Z', AVISOS_POR_DEFECTO);
  assert.deepEqual(m.map((x) => x.que), ['confirmacion', 'recordatorio', 'aviso']);
  assert.equal(m[0]!.cuando, '2026-09-07T14:00:00.000Z'); // 24 h antes
  assert.equal(m[1]!.cuando, '2026-09-08T12:00:00.000Z'); // 2 h antes
  assert.equal(m[2]!.cuando, '2026-09-08T12:30:00.000Z'); // 1 h 30 antes
});

test('§5.11 · sin recordatorio configurado, ese aviso no se programa', () => {
  const m = momentosDeAviso('2026-09-08T14:00:00.000Z', {
    ...AVISOS_POR_DEFECTO,
    recordatorio_horas: 0,
  });
  assert.deepEqual(m.map((x) => x.que), ['confirmacion', 'aviso']);
});

test('D23 · la hora se lee en la zona de la reunión, no en UTC', () => {
  // La base guarda en UTC. Una reunión de las 17:00 en México vuelve como
  // 23:00Z: leer el texto crudo la manda a la franja equivocada.
  assert.equal(enSuZona('2026-04-24 23:00:00.000Z', 'America/Mexico_City'), '2026-04-24T17:00');
});

test('D23 · sin esto la fecha se corre un día', () => {
  // 00:00Z del 15 es todavía el 14 a las 18:00 en México.
  assert.equal(enSuZona('2026-05-15 00:00:00.000Z', 'America/Mexico_City'), '2026-05-14T18:00');
});

test('una zona inválida no rompe la pantalla', () => {
  assert.equal(enSuZona('2026-05-15 00:00:00.000Z', 'No/Existe').slice(0, 10), '2026-05-15');
});
