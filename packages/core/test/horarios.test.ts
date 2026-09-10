import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ALTO_TRAMO,
  DURACION_MAXIMA,
  DURACION_MINIMA,
  duracionAlEstirar,
  enMinutos,
  filasPorHora,
  hhmm,
  mensajeDeHorarios,
  tramoDeLaHora,
  tramosDelDia,
  type EventoDelDia,
} from '../src/reunion.ts';

const ev = (de: string, a: string, titulo = 'Ocupado'): EventoDelDia => ({
  a: enMinutos(de),
  b: enMinutos(a),
  titulo,
});

// §3.2 — el hueco se prueba contra el solapamiento del bloque entero.
//
// Es la diferencia que hacía que el panel ofreciera las 14:30 para una reunión
// de una hora teniendo otra a las 15:00: con coincidencia exacta de arranque,
// 14:30 ≠ 15:00 y parecía libre.
test('un hueco sirve si la reunión entera entra, no si el arranque no coincide', () => {
  const eventos = [ev('15:00', '16:00')];

  const media = tramosDelDia(eventos, 30);
  assert.equal(media.find((t) => t.label === '14:30')?.libre, true);
  assert.equal(media.find((t) => t.label === '15:00')?.libre, false);

  // La misma agenda con una reunión de una hora: 14:30 ya no entra.
  const hora = tramosDelDia(eventos, 60);
  assert.equal(hora.find((t) => t.label === '14:30')?.libre, false);
  assert.equal(hora.find((t) => t.label === '14:00')?.libre, true);
});

test('la duración cambia hasta dónde llega el día', () => {
  // Con 15 min el último arranque es 17:45; con 60, 17:00.
  assert.equal(tramosDelDia([], 15).at(-1)?.label, '17:45');
  assert.equal(tramosDelDia([], 60).at(-1)?.label, '17:00');
  // Y siempre arranca a las 9.
  assert.equal(tramosDelDia([], 60)[0]?.label, '09:00');
});

test('las filas son por hora y traen los eventos de esa hora', () => {
  const eventos = [ev('10:00', '11:00', 'Daily del equipo\nlead de AL'), ev('14:00', '15:30', 'Reunión — Wellington')];
  const filas = filasPorHora(eventos, 30);

  assert.deepEqual(filas.map((f) => f.label).slice(0, 3), ['09:00', '10:00', '11:00']);

  const diez = filas.find((f) => f.hora === 10)!;
  assert.equal(diez.hayLibres, false); // la hora entera está tapada
  assert.deepEqual(diez.eventos, [{ rango: '10:00–11:00', titulo: 'Daily del equipo' }]);

  // Un evento de 14:00 a 15:30 aparece en las dos filas que toca.
  assert.equal(filas.find((f) => f.hora === 14)!.eventos.length, 1);
  assert.equal(filas.find((f) => f.hora === 15)!.eventos.length, 1);
  // Y a las 15 todavía queda lugar: 15:30 entra.
  assert.equal(filas.find((f) => f.hora === 15)!.hayLibres, true);
});

test('las horas donde no arranca ningún tramo no se muestran', () => {
  // Con dos horas de reunión el último arranque es 16:00: las filas de 17 no
  // existen, y una fila vacía no dice nada.
  const filas = filasPorHora([], 120);
  assert.equal(filas.at(-1)?.label, '16:00');
  assert.equal(filas.some((f) => f.hora === 17), false);
});

test('el click en la hora en punto cae en el primer tramo que entre', () => {
  const filas = filasPorHora([ev('10:00', '10:20')], 30);
  const diez = filas.find((f) => f.hora === 10)!;
  // Las 10:00 y las 10:15 chocan; la primera que entra es 10:30.
  assert.equal(tramoDeLaHora(diez, null)?.label, '10:30');

  const once = filas.find((f) => f.hora === 11)!;
  assert.equal(tramoDeLaHora(once, null)?.label, '11:00');

  // Sin ninguno libre no devuelve nada en vez de devolver uno ocupado.
  const tapada = filasPorHora([ev('09:00', '18:00')], 30);
  assert.equal(tramoDeLaHora(tapada[0]!, null), null);
});

// Tres situaciones distintas, tres mensajes. Decir «no hay horarios» en las
// tres esconde qué hay que hacer: elegir un día, elegir otro, o achicar.
test('cada motivo para no ofrecer horarios se dice con sus palabras', () => {
  assert.equal(mensajeDeHorarios(null, false, [], 30), 'Elegí un día en el calendario');
  assert.equal(mensajeDeHorarios('2026-09-10', true, [], 30), 'Sin disponibilidad ese día');
  assert.equal(
    mensajeDeHorarios('2026-09-10', false, tramosDelDia([ev('09:00', '18:00')], 45), 45),
    'Sin huecos de 45 min ese día',
  );
  // Y con lugar, ninguno: el panel muestra los horarios.
  assert.equal(mensajeDeHorarios('2026-09-10', false, tramosDelDia([], 30), 30), null);
});

test('hhmm y enMinutos son inversas', () => {
  assert.equal(hhmm(540), '09:00');
  assert.equal(hhmm(1065), '17:45');
  assert.equal(enMinutos('09:00'), 540);
  assert.equal(enMinutos('17:45'), 1065);
});

// §7.6 — estirar el bloque de la agenda cambia la duración, de a 15 minutos.
test('la duración se estira de a un tramo, no píxel a píxel', () => {
  // 22 px es un tramo. Media reunión estirada 44 px son dos tramos: +30 min.
  // En PASOS y no en píxeles sueltos: lo que la regla promete es que cada
  // tramo de la grilla suma o resta quince minutos. Escrito «44» a mano, el
  // test se rompía al cambiar el alto de la hora aunque la regla siguiera
  // intacta — y eso enseña a tocar el test en vez de mirar la regla.
  assert.equal(duracionAlEstirar(30, ALTO_TRAMO * 2), 60);
  assert.equal(duracionAlEstirar(30, -ALTO_TRAMO), 15);
  // Los movimientos chicos no cambian nada: sin redondear a pasos, la duración
  // termina en 37 minutos, que no es un horario que exista.
  assert.equal(duracionAlEstirar(30, 5), 30);
  assert.equal(duracionAlEstirar(30, -5), 30);
});

test('la duración no baja de 15 ni pasa de 180', () => {
  assert.equal(duracionAlEstirar(30, -9000), DURACION_MINIMA);
  assert.equal(duracionAlEstirar(30, 9000), DURACION_MAXIMA);
  // Una reunión de más de tres horas taparía el día entero con un solo bloque.
  assert.equal(DURACION_MAXIMA, 180);
});
