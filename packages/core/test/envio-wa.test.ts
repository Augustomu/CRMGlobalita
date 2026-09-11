import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CONFIG_ENVIO_WA_INICIAL,
  esperaAntesDeMandar,
  sePuedeEnviarWa,
  type EstadoDelEnvio,
  type QuienRecibe,
} from '../src/envio-wa.ts';

// §8.5b · Cuándo se puede mandar un WhatsApp.
//
// Augusto, 11/09: «resolvelo para mandar mensajes puntuales, no es nada
// masivo». Estas reglas son las que separan «una persona contestando desde otra
// pantalla» de «un programa mandando mensajes», que es la diferencia entre usar
// WhatsApp y perder el número.
//
// Baileys no es una API oficial. Un bloqueo puede ser permanente y no hay a
// quién reclamarle.

const AHORA = new Date('2026-09-11T14:00:00');

const ESCRIBIO: QuienRecibe = { escribio_alguna_vez: true };
const BIEN: EstadoDelEnvio = { salieron_hoy: 0, sesion_viva: true, pausado: false };

// ------------------------------------------------- la regla que más pesa

test('§8.5b · A QUIEN NUNCA ESCRIBIO NO SE LE ESCRIBE', () => {
  // Es la señal más fuerte de todas: contestar es lo que hace una persona todos
  // los días; escribirle primero a un desconocido desde un programa es lo que
  // WhatsApp busca, y lo que hace que el bloqueo sea permanente.
  const r = sePuedeEnviarWa({ escribio_alguna_vez: false }, BIEN, CONFIG_ENVIO_WA_INICIAL, 'hola', AHORA);
  assert.equal(r.puede, false);
  assert.equal(r.motivo, 'nunca_escribio');
  // Y el mensaje tiene que decir qué hacer, no sólo que no se puede.
  assert.ok(r.detalle.includes('WhatsApp'), 'explica por qué');
});

test('§8.5b · esa regla NO se puede apagar con configuración', () => {
  // Una perilla para saltearla existiría justo para el día en que alguien tiene
  // apuro. Con el cupo en mil y la franja abierta, sigue sin poder.
  const todoAbierto = { tope_diario: 1000, espera_min_s: 0, espera_max_s: 0, hora_desde: 0, hora_hasta: 24 };
  const r = sePuedeEnviarWa({ escribio_alguna_vez: false }, BIEN, todoAbierto, 'hola', AHORA);
  assert.equal(r.puede, false);
  assert.equal(r.motivo, 'nunca_escribio');
});

// ------------------------------------------------- el resto de los frenos

test('§8.5b · a quien escribió, se le contesta', () => {
  const r = sePuedeEnviarWa(ESCRIBIO, BIEN, CONFIG_ENVIO_WA_INICIAL, 'dale', AHORA);
  assert.equal(r.puede, true);
  assert.equal(r.detalle, '');
});

test('§8.5b · el cupo del día frena', () => {
  const r = sePuedeEnviarWa(ESCRIBIO, { ...BIEN, salieron_hoy: 30 }, CONFIG_ENVIO_WA_INICIAL, 'dale', AHORA);
  assert.equal(r.motivo, 'cupo_del_dia');
});

test('§8.5b · dos mensajes muy seguidos no salen', () => {
  // Un mensaje cada exactamente N segundos es ritmo de máquina.
  const r = sePuedeEnviarWa(
    ESCRIBIO,
    { ...BIEN, ultimo_envio: '2026-09-11T13:59:57' },
    CONFIG_ENVIO_WA_INICIAL,
    'dale',
    AHORA,
  );
  assert.equal(r.motivo, 'muy_seguido');
});

test('§8.5b · fuera de hora no sale', () => {
  const deMadrugada = new Date('2026-09-11T03:00:00');
  const r = sePuedeEnviarWa(ESCRIBIO, BIEN, CONFIG_ENVIO_WA_INICIAL, 'dale', deMadrugada);
  assert.equal(r.motivo, 'fuera_de_hora');
});

test('§8.5b · el mismo texto a la misma persona no se repite', () => {
  // Repetir es de robot, y casi siempre es un doble clic sin querer.
  const r = sePuedeEnviarWa(
    { escribio_alguna_vez: true, ultimo_texto: 'dale', ultimo_nuestro: '2026-09-11T13:50:00' },
    BIEN,
    CONFIG_ENVIO_WA_INICIAL,
    'dale',
    AHORA,
  );
  assert.equal(r.motivo, 'repetido');

  // Pero una hora después sí: «dale» se dice muchas veces en una conversación.
  const despues = sePuedeEnviarWa(
    { escribio_alguna_vez: true, ultimo_texto: 'dale', ultimo_nuestro: '2026-09-11T10:00:00' },
    BIEN,
    CONFIG_ENVIO_WA_INICIAL,
    'dale',
    AHORA,
  );
  assert.equal(despues.puede, true);
});

test('§8.5b · sin sesión y en pausa no sale, y eso se dice antes que nada', () => {
  assert.equal(sePuedeEnviarWa(ESCRIBIO, { ...BIEN, sesion_viva: false }, CONFIG_ENVIO_WA_INICIAL, 'x', AHORA).motivo, 'sin_sesion');
  assert.equal(sePuedeEnviarWa(ESCRIBIO, { ...BIEN, pausado: true }, CONFIG_ENVIO_WA_INICIAL, 'x', AHORA).motivo, 'pausado');
});

test('§8.5b · el motivo que se muestra es el que hay que resolver', () => {
  // Con la sesión caída Y el cupo cumplido, decir «se cumplió el cupo» manda a
  // esperar hasta mañana un envío que tampoco iba a salir hoy.
  const r = sePuedeEnviarWa(
    ESCRIBIO,
    { salieron_hoy: 999, sesion_viva: false, pausado: false },
    CONFIG_ENVIO_WA_INICIAL,
    'x',
    AHORA,
  );
  assert.equal(r.motivo, 'sin_sesion');
});

// ------------------------------------------------- la espera

test('§8.5b · la espera se sortea: nunca el mismo número', () => {
  const c = CONFIG_ENVIO_WA_INICIAL;
  const corta = esperaAntesDeMandar('ok', c, 0);
  const larga = esperaAntesDeMandar('ok', c, 1);
  assert.ok(larga > corta, 'el sorteo tiene que mover el resultado');
  assert.ok(corta >= c.espera_min_s * 1000);
});

test('§8.5b · un mensaje largo tarda más, como tardaría en escribirse', () => {
  // WhatsApp muestra «escribiendo…». Mandar cuatro renglones un segundo después
  // de recibir es la clase de detalle que separa a una persona de un programa.
  const c = CONFIG_ENVIO_WA_INICIAL;
  const corto = esperaAntesDeMandar('ok', c, 0.5);
  const largo = esperaAntesDeMandar('a'.repeat(300), c, 0.5);
  assert.ok(largo > corto);
  // Pero con techo: un texto de diez mil caracteres no puede esperar una hora.
  assert.ok(esperaAntesDeMandar('a'.repeat(100000), c, 1) <= (c.espera_max_s + 20) * 1000);
});

test('§8.5b · una configuración dada vuelta no rompe la espera', () => {
  // El máximo por debajo del mínimo llega de una configuración mal tipeada.
  const ms = esperaAntesDeMandar('ok', { ...CONFIG_ENVIO_WA_INICIAL, espera_min_s: 20, espera_max_s: 5 }, 0.5);
  assert.ok(ms >= 20000, 'gana el mínimo');
});
