import test from 'node:test';
import assert from 'node:assert/strict';
import { estadoDeConversacion, conDias, etiquetaDeDia, ultimoTexto, type MensajeChat } from '../src/chat.ts';

const HOY = '2026-09-08';

const m = (quien: 'in' | 'out', texto: string, en?: string): MensajeChat => ({ quien, texto, en });

test('§7.4 · el separador aparece cuando CAMBIA el dia, no cada tanto', () => {
  const hilo = conDias(
    [
      m('in', 'a', '2026-09-07T10:00:00'),
      m('out', 'b', '2026-09-07T10:05:00'),
      m('in', 'c', '2026-09-08T09:00:00'),
    ],
    HOY,
  );
  assert.deepEqual(
    hilo.map((i) => (i.tipo === 'dia' ? `[${i.etiqueta}]` : i.texto)),
    ['[ayer]', 'a', 'b', '[hoy]', 'c'],
  );
});

test('un chat de un solo dia no lleva ningun separador de mas', () => {
  const hilo = conDias([m('in', 'a', '2026-09-08T09:00:00'), m('out', 'b', '2026-09-08T09:01:00')], HOY);
  assert.equal(hilo.filter((i) => i.tipo === 'dia').length, 1);
});

test('los mensajes sin fecha no parten el hilo', () => {
  // Un WhatsApp importado trae huecos: meterlos bajo un separador "sin fecha"
  // parte la conversacion por un problema de importacion.
  const hilo = conDias(
    [m('in', 'con fecha', '2026-09-08T09:00:00'), m('out', 'sin fecha'), m('in', 'otro', '2026-09-08T09:30:00')],
    HOY,
  );
  assert.equal(hilo.filter((i) => i.tipo === 'dia').length, 1);
  assert.deepEqual(
    hilo.filter((i) => i.tipo === 'mensaje').map((i) => (i as { hora: string }).hora),
    ['09:00', '', '09:30'],
  );
});

test('no se reordena: el orden en que llegaron ES la conversacion', () => {
  const hilo = conDias([m('in', 'segundo', '2026-09-08T10:00:00'), m('out', 'primero', '2026-09-07T10:00:00')], HOY);
  assert.deepEqual(
    hilo.filter((i) => i.tipo === 'mensaje').map((i) => (i as { texto: string }).texto),
    ['segundo', 'primero'],
  );
});

test('hoy y ayer se nombran; mas atras va la fecha', () => {
  assert.equal(etiquetaDeDia('2026-09-08T00:00:00', HOY), 'hoy');
  assert.equal(etiquetaDeDia('2026-09-07T00:00:00', HOY), 'ayer');
  assert.equal(etiquetaDeDia('2026-09-01T00:00:00', HOY), '01/09');
  // Una fecha futura no es "hoy": se muestra tal cual.
  assert.equal(etiquetaDeDia('2026-09-10T00:00:00', HOY), '10/09');
});

test('el ultimo mensaje dice de que lado quedo la pelota', () => {
  assert.equal(ultimoTexto([m('in', 'hola'), m('out', 'chau')]), 'vos: chau');
  assert.equal(ultimoTexto([m('out', 'hola'), m('in', 'chau')]), 'chau');
  assert.equal(ultimoTexto([]), '');
});

// §3.2 — el ack es sólo de WhatsApp, y su ausencia no es un estado.
test('el ack viaja con el mensaje, y vacío significa «no se sabe»', () => {
  const hilo = conDias(
    [
      { quien: 'out', texto: 'por LinkedIn', en: '2026-09-02 11:40:00.000Z' },
      { quien: 'out', texto: 'por WhatsApp', en: '2026-09-02 11:41:00.000Z', ack: 'leido' },
      { quien: 'in', texto: 'listo', en: '2026-09-02 12:05:00.000Z' },
    ],
    '2026-09-08',
  );
  const mensajes = hilo.filter((x) => x.tipo === 'mensaje');
  // El de LinkedIn no trae ack: la pantalla no dibuja nada ahí. Un tilde gris
  // sería decir «no llegó», que es otra cosa.
  assert.equal(mensajes[0]?.tipo === 'mensaje' && mensajes[0].ack, null);
  assert.equal(mensajes[1]?.tipo === 'mensaje' && mensajes[1].ack, 'leido');
  // Los entrantes nunca tienen: el ack es de lo que mandamos nosotros.
  assert.equal(mensajes[2]?.tipo === 'mensaje' && mensajes[2].ack, null);
});

/* --------------------------------------------------------------------------
 * El estado de la conversación (§7.10)
 * ----------------------------------------------------------------------- */

test('§7.10 · con un entrante sin abrir, el estado es sin leer', () => {
  assert.equal(
    estadoDeConversacion(true, [{ quien: 'out', en: '2026-09-08T10:00:00Z' }]),
    'sin_leer',
  );
});

test('§7.10 · leído y con el último mensaje del lead: falta contestar', () => {
  assert.equal(
    estadoDeConversacion(false, [
      { quien: 'out', en: '2026-09-07T10:00:00Z' },
      { quien: 'in', en: '2026-09-08T10:00:00Z' },
    ]),
    'sin_responder',
  );
});

test('§7.10 · leído y con el último mensaje nuestro: respondido', () => {
  assert.equal(
    estadoDeConversacion(false, [
      { quien: 'in', en: '2026-09-07T10:00:00Z' },
      { quien: 'out', en: '2026-09-08T10:00:00Z' },
    ]),
    'respondido',
  );
});

test('§7.10 · el orden del array no manda: manda la fecha', () => {
  // Llegan desordenados porque vienen de dos fuentes (lo registrado y lo leído
  // del chat real). Si mandara la posición, este hilo diría «respondido».
  assert.equal(
    estadoDeConversacion(false, [
      { quien: 'out', en: '2026-09-01T10:00:00Z' },
      { quien: 'in', en: '2026-09-08T10:00:00Z' },
      { quien: 'out', en: '2026-09-02T10:00:00Z' },
    ]),
    'sin_responder',
  );
});

test('§7.10 · sin mensajes no es ni respondido ni pendiente', () => {
  assert.equal(estadoDeConversacion(false, []), 'sin_mensajes');
});
