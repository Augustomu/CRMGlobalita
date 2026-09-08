import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  AVISOS_POR_DEFECTO, descripcionEvento, finDe, momentosDeAviso, primeraReunion,
  tituloEvento, verBloque,  enSuZona, bloqueDelEvento, horaEnLaColumna, carriles,
} from '../src/reunion.ts';

test('el título del evento es "Lead · Cuenta · Vos", con solo el primer nombre de los dos últimos', () => {
  assert.equal(
    tituloEvento('Marcelo Carneiro', 'Francisco Herrera', 'Augusto Unzaga'),
    'Marcelo Carneiro · Francisco · Augusto',
  );
});

test('el nombre completo del lead se conserva aunque sea largo', () => {
  assert.equal(
    tituloEvento('Maria de los Angeles Fernandez Villagran', 'Edith', 'Augusto'),
    'Maria de los Angeles Fernandez Villagran · Edith · Augusto',
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

/* ---------------------------------------------------------------------------
 * La grilla de la agenda (§7.6)
 * ------------------------------------------------------------------------ */

test('§7.6 · el bloque arranca en su hora y mide lo que dura', () => {
  // Franja de 8 a 20 inclusive: 13 horas dibujadas.
  const b = bloqueDelEvento('11:45', 30, 8, 13);
  assert.equal(b.arriba, ((11 * 60 + 45 - 8 * 60) / (13 * 60)) * 100);
  assert.equal(b.alto, (30 / (13 * 60)) * 100);
});

test('§7.6 · una reunión de dos horas ocupa el doble que una de una', () => {
  const una = bloqueDelEvento('12:00', 60, 8, 13);
  const dos = bloqueDelEvento('12:00', 120, 8, 13);
  assert.equal(dos.alto, una.alto * 2);
  // Y arranca en el mismo lugar: estirar baja el borde de abajo, no mueve el de arriba.
  assert.equal(dos.arriba, una.arriba);
});

test('§7.6 · el bloque que se pasa del final se recorta contra el borde', () => {
  const b = bloqueDelEvento('19:30', 180, 8, 13);
  // Con tolerancia: son divisiones, y 690/780 + 90/780 da 99.99999999999999.
  assert.ok(Math.abs(b.arriba + b.alto - 100) < 1e-9);
});

test('§7.6 · el bloque anterior a la franja no se dibuja arriba de la grilla', () => {
  const b = bloqueDelEvento('06:00', 60, 8, 13);
  assert.equal(b.arriba, 0);
});

test('§7.6 · soltar en cualquier punto cae en el cuarto de hora de arriba', () => {
  // La mitad justa de una franja de 13 horas desde las 8 son las 14:30.
  assert.equal(horaEnLaColumna(0.5, 8, 13), '14:30');
  assert.equal(horaEnLaColumna(0, 8, 13), '08:00');
  // Un pelo antes de las 12: sigue siendo 11:45, no se redondea para arriba.
  assert.equal(horaEnLaColumna((11 * 60 + 59 - 8 * 60) / (13 * 60), 8, 13), '11:45');
});

test('§7.6 · soltar al ras del borde de abajo no cae fuera de la franja', () => {
  assert.equal(horaEnLaColumna(1, 8, 13), '20:45');
  assert.equal(horaEnLaColumna(1.4, 8, 13), '20:45');
});

test('§7.6 · dos reuniones a la misma hora se reparten el ancho', () => {
  const r = carriles([{ a: 660, b: 720 }, { a: 660, b: 720 }]);
  assert.deepEqual(r, [{ carril: 0, carriles: 2 }, { carril: 1, carriles: 2 }]);
});

test('§7.6 · dos reuniones que no se tocan usan cada una todo el ancho', () => {
  const r = carriles([{ a: 660, b: 720 }, { a: 720, b: 780 }]);
  assert.deepEqual(r, [{ carril: 0, carriles: 1 }, { carril: 0, carriles: 1 }]);
});

test('§7.6 · si A pisa a B y B pisa a C, los tres achican el ancho', () => {
  // A 11:00-12:00, B 11:30-12:30, C 12:00-13:00. A y C no se tocan y por eso
  // comparten carril, pero los tres tienen que quedar a media anchura: si a A
  // y C se les calculara el ancho de a pares les tocaría la columna entera y
  // taparían a B.
  const r = carriles([{ a: 660, b: 720 }, { a: 690, b: 750 }, { a: 720, b: 780 }]);
  assert.deepEqual(r, [
    { carril: 0, carriles: 2 },
    { carril: 1, carriles: 2 },
    { carril: 0, carriles: 2 },
  ]);
});

test('§7.6 · el reparto vuelve en el orden en que se pasaron los bloques', () => {
  // Desordenados a propósito: el que va segundo empieza antes.
  const r = carriles([{ a: 720, b: 780 }, { a: 660, b: 700 }]);
  assert.deepEqual(r, [{ carril: 0, carriles: 1 }, { carril: 0, carriles: 1 }]);
});

test('§7.6 · sin bloques no hay reparto', () => {
  assert.deepEqual(carriles([]), []);
});
