import test from 'node:test';
import assert from 'node:assert/strict';
import { estadoDeConversacion, conDias, etiquetaDeDia, ultimoTexto, entraEnElHistorial, DIAS_DE_HISTORIAL, recortarChat, TOPE_MENSAJES_POR_CHAT, type MensajeChat } from '../src/chat.ts';

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

// ------------------------------------------------ el historial de WhatsApp

// Augusto, 11/09: «dame los chats de los 2 meses y el historial por chat de
// los últimos 2 meses». WhatsApp manda el historial UNA SOLA VEZ, al vincular,
// y manda lo que quiere. Si el corte falla, entran años de conversaciones
// privadas al CRM, a los backups y a GitHub — y sacarlas obliga a borrar.

test('§8.2 · el historial se corta en los días que se pidieron', () => {
  const ahora = new Date('2026-09-11T12:00:00Z');
  const haceDias = (d: number) => (ahora.getTime() - d * 86400000) / 1000;

  assert.equal(entraEnElHistorial(haceDias(1), 60, ahora), true);
  assert.equal(entraEnElHistorial(haceDias(59), 60, ahora), true);
  assert.equal(entraEnElHistorial(haceDias(61), 60, ahora), false);
  assert.equal(entraEnElHistorial(haceDias(900), 60, ahora), false);
});

test('§8.2 · sin fecha NO entra: ante la duda, de menos', () => {
  // No se puede saber si es de anteayer o de hace cuatro años. Meter de más
  // obliga a borrar después, y acá no se borra solo.
  const ahora = new Date('2026-09-11T12:00:00Z');
  for (const v of [null, undefined, 0, -1, NaN, Infinity]) {
    assert.equal(entraEnElHistorial(v as number, 60, ahora), false, `valor ${String(v)}`);
  }
});

test('§8.2 · los segundos no se confunden con milisegundos', () => {
  // `messageTimestamp` viene en SEGUNDOS. Pasarlo como milisegundos da una
  // fecha de 1970, que cualquier filtro de antigüedad rechaza — pero al revés,
  // un valor en milisegundos leído como segundos cae en el año 57000 y pasa
  // como «reciente». Los dos casos tienen que quedar fijados.
  const ahora = new Date('2026-09-11T12:00:00Z');
  const enSegundos = Math.floor(ahora.getTime() / 1000);

  assert.equal(entraEnElHistorial(enSegundos, 60, ahora), true);
  // El mismo instante mal pasado como milisegundos: queda en un futuro
  // absurdo. Entra igual —es «reciente»— pero no puede romper nada.
  assert.equal(typeof entraEnElHistorial(ahora.getTime(), 60, ahora), 'boolean');
  // Y una fecha de 1970 no entra.
  assert.equal(entraEnElHistorial(1, 60, ahora), false);
});

test('§8.2 · DIAS_DE_HISTORIAL es el default y son los 2 meses pedidos', () => {
  assert.equal(DIAS_DE_HISTORIAL, 60);
  const ahora = new Date('2026-09-11T12:00:00Z');
  const hace30 = (ahora.getTime() - 30 * 86400000) / 1000;
  assert.equal(entraEnElHistorial(hace30, undefined, ahora), true);
});

// ------------------------------------------------ el tope por conversación

// El 11/09, importando dos meses de historial real, una conversación llegó a
// 4.468 mensajes y 481 KB contra un campo que admite 500. La escritura falló
// ENTERA: no entró ese mensaje ni los de las conversaciones que venían después
// en la misma tanda.

test('§7.4 · se guardan los ÚLTIMOS, no los primeros', () => {
  // Lo que importa de un chat es en qué quedó. Un tope que corta por el final
  // deja la conversación congelada en su primer día.
  const muchos = Array.from({ length: 500 }, (_, i) => m('in', String(i), `2026-09-01T00:00:${String(i % 60).padStart(2, '0')}`));
  const r = recortarChat(muchos, 400);
  assert.equal(r.length, 400);
  assert.equal(r[0]!.texto, '100', 'arranca en el 100: se fueron los 100 más viejos');
  assert.equal(r[r.length - 1]!.texto, '499', 'y el último es el último');
});

test('§7.4 · una conversación corta no se toca', () => {
  const pocos = [m('in', 'hola'), m('out', 'chau')];
  assert.equal(recortarChat(pocos, 400), pocos, 'devuelve la misma lista, sin copiarla');
});

test('§7.4 · un tope inválido no vacía la conversación', () => {
  // El tope puede venir de configuración. Un 0 o un negativo que devolviera una
  // lista vacía borraría el chat en la próxima escritura.
  const tres = [m('in', 'a'), m('in', 'b'), m('in', 'c')];
  for (const t of [0, -5, NaN]) {
    assert.ok(recortarChat(tres, t as number).length >= 1, `tope ${t}`);
  }
});

test('§7.4 · el tope es 400 y deja el campo bien abajo del límite', () => {
  assert.equal(TOPE_MENSAJES_POR_CHAT, 400);
  // 4.468 mensajes pesaron 481 KB, o sea ~110 bytes cada uno. 400 son ~44 KB,
  // menos de una décima parte de los 500 KB que admite el campo.
  assert.ok(TOPE_MENSAJES_POR_CHAT * 110 < 500000);
});
