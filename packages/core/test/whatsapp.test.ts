import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CODIGO_WA,
  ESPERA_TOPE_MS,
  SEGUNDOS_QR_VIGENTE,
  TOPE_DE_REINTENTOS,
  comoSeVeLaSesionWa,
  esElNumeroEsperado,
  esperaDeReintento,
  hayQueDescartarLaCredencial,
  numeroTapado,
  queHacerConLaCaida,
} from '../src/whatsapp.ts';

// §8.2 · La sesión de WhatsApp.
//
// Baileys NO es una API oficial: es un cliente del protocolo de WhatsApp Web.
// Una cuenta que se porta mal se bloquea, y no hay a quién reclamarle. Por eso
// las reglas de acá son puras y con tests: son las que deciden si se reintenta,
// cuánto se espera y cuándo hay que dejar de insistir, y equivocarse en eso es
// justamente lo que hace que WhatsApp mire.

// ---------------------------------------------------------- reintentos

test('§8.2 · la espera se duplica y tiene techo', () => {
  // Reconectar al instante contra un WhatsApp que está rechazando hace que
  // rechace más fuerte.
  assert.equal(esperaDeReintento(1), 2000);
  assert.equal(esperaDeReintento(2), 4000);
  assert.equal(esperaDeReintento(3), 8000);
  assert.equal(esperaDeReintento(4), 16000);
  assert.equal(esperaDeReintento(5), 32000);

  // Y de ahí no pasa, por más intentos que salgan mal. Sin techo, el intento 20
  // esperaría casi tres semanas.
  assert.equal(esperaDeReintento(6), ESPERA_TOPE_MS);
  assert.equal(esperaDeReintento(50), ESPERA_TOPE_MS);
});

test('§8.2 · un intento inválido no rompe la cuenta', () => {
  // El contador viene de afuera. Un 0 o un negativo no pueden dar una espera
  // negativa, que en un setTimeout es «ya», o sea reintentar sin pausa.
  for (const n of [0, -1, -99, 1.7, NaN]) {
    const ms = esperaDeReintento(n);
    assert.ok(ms >= 2000 && ms <= ESPERA_TOPE_MS, `intento ${n} dio ${ms}`);
  }
});

// ------------------------------------------------- qué hacer con la caída

test('§8.2 · desvincular desde el teléfono manda a escanear, no a reintentar', () => {
  // Es el caso que más tiempo hace perder si se confunde: la credencial está
  // muerta y ningún reintento la revive.
  const q = queHacerConLaCaida(CODIGO_WA.desvinculado, 1);
  assert.equal(q.accion, 'volver_a_vincular');
  assert.equal(q.motivo, 'desvinculado');
  assert.equal(q.espera_ms, 0);
  assert.ok(q.detalle.length > 0, 'tiene que decir qué hacer');
});

test('§8.2 · una caída normal se reconecta con la misma credencial', () => {
  for (const codigo of [CODIGO_WA.conexion_cerrada, CODIGO_WA.conexion_perdida]) {
    const q = queHacerConLaCaida(codigo, 1);
    assert.equal(q.accion, 'reconectar', `codigo ${codigo}`);
    assert.ok(q.espera_ms > 0, 'espera antes de volver');
    assert.equal(q.cuenta_como_intento, true);
  }
});

test('§8.2 · «hay que reiniciar» no es un error: pasa justo después del QR', () => {
  // 515 llega SIEMPRE después de escanear. Tratarlo como falla haría que la
  // vinculación recién hecha se vea como rota.
  const q = queHacerConLaCaida(CODIGO_WA.hay_que_reiniciar, 1);
  assert.equal(q.accion, 'reconectar');
  assert.equal(q.cuenta_como_intento, false, 'no gasta reintentos');
});

test('§8.2 · sin código se reconecta: ante la duda, el error barato', () => {
  // Un reintento de más cuesta dos segundos. Mandar a escanear un QR cuando la
  // credencial servía hace que alguien desvincule a mano una sesión sana.
  const q = queHacerConLaCaida(undefined, 1);
  assert.equal(q.accion, 'reconectar');
});

test('§8.2 · WhatsApp bloqueó el número: no se insiste, decide una persona', () => {
  const q = queHacerConLaCaida(CODIGO_WA.prohibida, 1);
  assert.notEqual(q.accion, 'reconectar');
  assert.equal(q.motivo, 'prohibida');
  // Insistir contra un bloqueo es lo que convierte un bloqueo temporal en uno
  // permanente, y no hay soporte al que apelar.
});

test('§8.2 · pasado el tope de reintentos se deja de insistir', () => {
  const q = queHacerConLaCaida(CODIGO_WA.conexion_cerrada, TOPE_DE_REINTENTOS + 1);
  assert.equal(q.accion, 'rendirse');
  assert.equal(q.motivo, 'no_vuelve');
});

test('§8.2 · sólo se tira la credencial cuando de verdad murió', () => {
  // Borrar la carpeta de credenciales obliga a escanear de nuevo con el
  // teléfono en la mano. Hacerlo de más es hacerle perder el tiempo a Augusto.
  assert.equal(hayQueDescartarLaCredencial('desvinculado'), true);
  assert.equal(hayQueDescartarLaCredencial('sesion_rota'), true);

  assert.equal(hayQueDescartarLaCredencial('reconectando'), false);
  assert.equal(hayQueDescartarLaCredencial('servicio_caido'), false);
  assert.equal(hayQueDescartarLaCredencial('nunca_vinculada'), false);
});

// ------------------------------------------------- lo que ve la pantalla

const HACE = (min: number) => new Date(Date.now() - min * 60000).toISOString();

test('§8.2 · sin señal y sin QR: sin vincular, y se dice qué hacer', () => {
  const v = comoSeVeLaSesionWa({});
  assert.equal(v.estado, 'sin_vincular');
  assert.equal(v.qr_vigente, false);
  assert.ok(v.que_hacer.length > 0, 'una pantalla que dice «sin vincular» y nada más no sirve');
});

test('§8.2 · con señal fresca está activa y no hay nada que hacer', () => {
  const v = comoSeVeLaSesionWa({ ultima_senal_wa: HACE(2) });
  assert.equal(v.estado, 'activa');
  assert.equal(v.que_hacer, '');
});

test('§8.2 · el QR caduca: uno viejo no se escanea, se pide otro', () => {
  const ahora = new Date('2026-09-10T12:00:00.000Z');
  const enSegundos = (s: number) => new Date(ahora.getTime() - s * 1000).toISOString();

  const fresco = comoSeVeLaSesionWa({ qr_wa: 'xxx', qr_wa_desde: enSegundos(5) }, ahora);
  assert.equal(fresco.qr_vigente, true);

  // Un QR vencido en pantalla es peor que ninguno: se escanea, no pasa nada, y
  // parece que WhatsApp está roto.
  const viejo = comoSeVeLaSesionWa(
    { qr_wa: 'xxx', qr_wa_desde: enSegundos(SEGUNDOS_QR_VIGENTE + 10) },
    ahora,
  );
  assert.equal(viejo.qr_vigente, false);
});

test('§8.2 · un motivo desconocido no rompe la pantalla', () => {
  // El motivo lo escribe el worker en la base. Un valor que la pantalla no
  // conoce —de una versión vieja, o de un error— no puede dejarla en blanco.
  const v = comoSeVeLaSesionWa({ wa_motivo: 'cualquier_cosa' });
  assert.ok(v.titular.length > 0);
});

// ------------------------------------------------- el número

test('§8.2 · se detecta si se escaneó con el teléfono equivocado', () => {
  // El QR lo escanea una persona y nada le impide usar el teléfono de al lado.
  // Si eso pasa y nadie mira, se descubre el día que sale un mensaje.
  assert.equal(esElNumeroEsperado('5491161902745', '5491161902745'), true);
  assert.equal(esElNumeroEsperado('+54 9 11 6190-2745', '5491161902745'), true);
  // WhatsApp devuelve el número con el 9 de Argentina; el guardado puede no traerlo.
  assert.equal(esElNumeroEsperado('5491161902745', '541161902745'), true);

  assert.equal(esElNumeroEsperado('5491155550000', '5491161902745'), false);
  assert.equal(esElNumeroEsperado('', '5491161902745'), false);
  assert.equal(esElNumeroEsperado('5491161902745', ''), false);
});

test('§8.2 · el número se tapa antes de escribirlo en ningún lado', () => {
  // `CRMGlobalita` es un repositorio PÚBLICO y las salidas de la terminal se
  // pegan en mensajes. Los últimos cuatro alcanzan para reconocerlo.
  const tapado = numeroTapado('5491161902745');
  assert.equal(tapado, '···2745');
  assert.ok(!tapado.includes('549116190'), 'no puede quedar el número entero');

  assert.equal(numeroTapado(''), '');
  assert.equal(numeroTapado('12'), '··');
});
