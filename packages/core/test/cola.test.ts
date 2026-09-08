import test from 'node:test';
import assert from 'node:assert/strict';
import {
  GRACIA_MS,
  TAMANO_LOTE,
  UMBRAL_LOTE_MS,
  espaciado,
  reloj,
  vistaDeCola,
  type ItemCola,
} from '../src/cola.ts';

const AHORA = Date.parse('2026-09-08T10:00:00');
const MIN = 60_000;

const item = (x: Partial<ItemCola> & { id: string }): ItemCola => ({
  tipo: 'mensaje',
  cuenta: 'AL',
  quien: 'Quien ' + x.id,
  detalle: 'R2 · LinkedIn',
  cuando: new Date(AHORA + MIN).toISOString(),
  estado: 'pendiente',
  ...x,
});

test('§8.1 · el espaciado cae siempre entre 30 y 40 s, y no es siempre el mismo', () => {
  const s = [0, 1, 2, 3, 4].map(espaciado);
  for (const v of s) assert.ok(v >= 30 && v <= 40, `${v} fuera de 30-40`);
  // Treinta segundos clavados es una firma: tiene que variar.
  assert.ok(new Set(s).size > 1);
});

test('el espaciado es determinístico: el worker y la pantalla calculan el mismo turno', () => {
  assert.deepEqual([1, 2, 3].map(espaciado), [1, 2, 3].map(espaciado));
});

test('el reloj cambia de unidad segun cuanto falta', () => {
  assert.equal(reloj(32_000), '32 s');
  assert.equal(reloj(134_000), '2:14');
  assert.equal(reloj(3 * 3600_000 + 20 * MIN), '3 h 20 m');
  assert.equal(reloj(50 * 3600_000), '2 d 2 h');
  // Nunca negativo: un vencido muestra 0, no «-4 s».
  assert.equal(reloj(-5000), '0 s');
});

test('§7.2 · solo UNO esta en camino, aunque haya cinco en el lote', () => {
  const items = [1, 2, 3, 4, 5].map((n) => item({ id: 'm' + n }));
  const v = vistaDeCola(items, AHORA);
  assert.equal(v.enCamino?.id, 'm1');
  // Los otros cuatro estan esperando su turno, no enviandose.
  assert.equal(v.programados.length, 4);
  assert.equal(v.n, 5);
});

test('el lote se arma POR CUENTA: el cupo es de la cuenta que envia', () => {
  // Todos vencidos, para poder leer el turno en la cuenta regresiva.
  const vencido = new Date(AHORA - 30 * MIN).toISOString();
  const items = [
    ...[1, 2, 3, 4, 5, 6].map((n) => item({ id: 'al' + n, cuenta: 'AL', cuando: vencido })),
    item({ id: 'dl1', cuenta: 'DL', cuando: vencido }),
  ];
  const v = vistaDeCola(items, AHORA);

  // El 6º de AL quedo afuera del lote de su cuenta: no tiene turno, espera.
  assert.equal(v.programados.find((p) => p.id === 'al6')?.countdown, 'demorado');
  // El 1º de DL sí lo tiene, porque su cuenta arranca su propio lote: el
  // limite es de la cuenta, no del sistema.
  assert.equal(v.programados.find((p) => p.id === 'dl1')?.countdown, reloj(GRACIA_MS));
});

test(`del ${TAMANO_LOTE + 1}º en adelante no se promete hora: vuelve a programado`, () => {
  const items = [1, 2, 3, 4, 5, 6, 7].map((n) => item({ id: 'm' + n }));
  const v = vistaDeCola(items, AHORA);
  // Su cuenta regresiva es la de su hora original, no una inventada dentro de
  // un lote que todavia no arranco.
  const sexto = v.programados.find((p) => p.id === 'm6');
  assert.equal(sexto?.countdown, reloj(MIN));
});

test('mas alla de los 15 minutos un mensaje es «programado», no «por salir»', () => {
  const lejos = item({ id: 'lejos', cuando: new Date(AHORA + UMBRAL_LOTE_MS + MIN).toISOString() });
  const v = vistaDeCola([lejos], AHORA);
  assert.equal(v.enCamino, null);
  assert.equal(v.programados.length, 1);
  assert.equal(v.resumen, 'próximo en 16:00');
});

test('el que ya vencio arranca desde ahora + gracia, no de golpe', () => {
  // Cinco que vencieron con la sesion caida: largarlos de una es el patron que
  // hay que evitar.
  const items = [1, 2, 3, 4, 5].map((n) =>
    item({ id: 'v' + n, cuando: new Date(AHORA - 30 * MIN).toISOString() }),
  );
  const v = vistaDeCola(items, AHORA);
  assert.equal(v.enCamino?.countdown, reloj(GRACIA_MS));
  // El segundo espera su espaciado ADEMAS de la gracia.
  assert.equal(v.programados[0].countdown, reloj(GRACIA_MS + espaciado(1) * 1000));
});

test('el recordatorio y el agradecimiento no hacen lote: salen a su hora', () => {
  const items = [
    item({ id: 'msg', cuando: new Date(AHORA + 5 * MIN).toISOString() }),
    item({ id: 'rec', tipo: 'recordatorio', cuando: new Date(AHORA + 2 * MIN).toISOString() }),
  ];
  const v = vistaDeCola(items, AHORA);
  // El mensaje esta «en camino» (tiene turno de lote) y el recordatorio queda
  // como programado a su hora exacta, sin espaciarse contra el mensaje.
  assert.equal(v.enCamino?.id, 'msg');
  assert.equal(v.programados.find((p) => p.id === 'rec')?.countdown, '2:00');
});

test('«enviado» es lo que dice el registro, no lo que dice el reloj', () => {
  const items: ItemCola[] = [
    item({
      id: 'ok',
      estado: 'enviado',
      cuando: new Date(AHORA - MIN).toISOString(),
      enviado_en: new Date(AHORA - MIN).toISOString(),
    }),
    // Le paso la hora pero fallo: no puede contarse como hecho.
    item({ id: 'falla', estado: 'error', tipo: 'gracias', cuando: new Date(AHORA - MIN).toISOString() }),
  ];
  const v = vistaDeCola(items, AHORA);
  assert.deepEqual(v.enviados.map((e) => e.id), ['ok']);
  assert.equal(v.programados.find((p) => p.id === 'falla')?.countdown, 'demorado');
});

test('lo cancelado no aparece en ningun lado', () => {
  const v = vistaDeCola([item({ id: 'x', estado: 'cancelado' })], AHORA);
  assert.equal(v.vacio, true);
  assert.equal(v.n, 0);
  assert.equal(v.resumen, 'sin envíos pendientes');
});

test('la barra de avance empieza a llenarse recien sobre el final', () => {
  const lejos = vistaDeCola([item({ id: 'a', cuando: new Date(AHORA + 10 * MIN).toISOString() })], AHORA);
  assert.equal(lejos.enCamino?.avance, 2);
  const cerca = vistaDeCola(
    [item({ id: 'b', cuando: new Date(AHORA - MIN).toISOString() })],
    AHORA,
  );
  // Con la gracia de 8 s faltando, la barra ya va por arriba de la mitad.
  assert.ok((cerca.enCamino?.avance ?? 0) > 50);
});
