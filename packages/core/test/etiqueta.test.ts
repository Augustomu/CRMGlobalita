import test from 'node:test';
import assert from 'node:assert/strict';
import { etiquetasDeLaFila,
  CUANTAS_RECIENTES,
  nombreDisponible,
  porUltimoUso,
  recientes,
  sePuedeRenombrar,
  sePuedeSacar,
  type Etiqueta,
} from '../src/etiqueta.ts';

const catalogo: Etiqueta[] = [
  { id: 'a', nombre: 'Caliente', usada_en: '2026-09-06' },
  { id: 'b', nombre: 'Tibio', usada_en: '2026-09-01' },
  { id: 'c', nombre: 'Frio', usada_en: '2026-08-20' },
  { id: 'd', nombre: 'Decisor', usada_en: '2026-09-05' },
  { id: 'e', nombre: 'Contacto', usada_en: '2026-09-04' },
  { id: 'f', nombre: 'Periodico', usada_en: '2026-09-03' },
  { id: 'g', nombre: 'Reagendar', usada_en: '2026-09-02' },
  { id: 'h', nombre: 'No target', usada_en: null },
  { id: 'i', nombre: 'Recordatorio', del_sistema: true, usada_en: '2026-09-07' },
];

test('cambio 8 · ofrece las seis usadas más recientemente', () => {
  const r = recientes(catalogo, []);
  assert.equal(r.length, CUANTAS_RECIENTES);
  assert.deepEqual(
    r.map((e) => e.nombre),
    ['Caliente', 'Decisor', 'Contacto', 'Periodico', 'Reagendar', 'Tibio'],
  );
});

test('las que el lead ya tiene no se vuelven a ofrecer: el atajo es para poner', () => {
  const r = recientes(catalogo, ['a', 'd']);
  assert.ok(!r.some((e) => e.id === 'a' || e.id === 'd'));
  // Del catálogo quedan cinco candidatas, no seis: se ofrecen las que hay.
  assert.deepEqual(
    r.map((e) => e.nombre),
    ['Contacto', 'Periodico', 'Reagendar', 'Tibio', 'Frio'],
  );
});

test('D04 · las del sistema no se ofrecen aunque sean las más recientes', () => {
  // "Recordatorio" es del sistema y tiene la fecha más nueva de todas.
  assert.ok(!recientes(catalogo, []).some((e) => e.nombre === 'Recordatorio'));
});

test('una etiqueta que nunca se usó no entra: sin fecha no hay con qué ordenarla', () => {
  assert.ok(!recientes(catalogo, []).some((e) => e.nombre === 'No target'));
});

test('a igual fecha ordena alfabético, para que la fila no baile entre renders', () => {
  const empatadas: Etiqueta[] = [
    { id: '1', nombre: 'Zeta', usada_en: '2026-09-06' },
    { id: '2', nombre: 'Alfa', usada_en: '2026-09-06' },
  ];
  assert.deepEqual(
    recientes(empatadas, []).map((e) => e.nombre),
    ['Alfa', 'Zeta'],
  );
});

test('con menos de seis usadas devuelve las que hay, sin rellenar', () => {
  assert.equal(recientes(catalogo.slice(0, 2), []).length, 2);
});

test('cambio 9 · la × solo aparece en las que se pueden sacar', () => {
  assert.equal(sePuedeSacar({ id: 'a', nombre: 'Caliente' }), true);
  // La cadencia la vuelve a poner en el próximo envío: el botón no haría nada.
  assert.equal(sePuedeSacar({ id: 'i', nombre: 'Recordatorio', del_sistema: true }), false);
});

test('D04 · una etiqueta del sistema no se renombra', () => {
  // Su nombre esta escrito en el codigo que la aplica: renombrarla dejaria la
  // cadencia buscando una etiqueta que ya no existe.
  assert.equal(sePuedeRenombrar({ id: 'a', nombre: 'Recordatorio', del_sistema: true }), false);
  assert.equal(sePuedeRenombrar({ id: 'b', nombre: 'Caliente' }), true);
});

test('el nombre repetido no entra, sin importar mayusculas ni espacios', () => {
  // Tener "caliente", "Caliente" y "Caliente " convierte el filtro por
  // etiqueta en tres filtros que no se cruzan.
  const catalogo = [{ id: 'a', nombre: 'Caliente' }];
  assert.equal(nombreDisponible(catalogo, 'caliente'), false);
  assert.equal(nombreDisponible(catalogo, '  Caliente  '), false);
  assert.equal(nombreDisponible(catalogo, 'Tibio'), true);
  assert.equal(nombreDisponible(catalogo, '   '), false);
  // Renombrar una a si misma no choca consigo misma.
  assert.equal(nombreDisponible(catalogo, 'Caliente', 'a'), true);
});

test('el catalogo se ordena por ultimo uso, y las nunca usadas van al fondo', () => {
  const orden = porUltimoUso([
    { id: 'nunca', nombre: 'Nunca' },
    { id: 'vieja', nombre: 'Vieja', usada_en: '2026-01-01' },
    { id: 'nueva', nombre: 'Nueva', usada_en: '2026-09-01' },
  ]).map((e) => e.id);
  assert.deepEqual(orden, ['nueva', 'vieja', 'nunca']);
});

/* --------------------------------------------------------------------------
 * Las etiquetas de la fila (§7.2)
 * ----------------------------------------------------------------------- */

test('§7.2 · entran dos y el resto queda para el hover', () => {
  const r = etiquetasDeLaFila(['Frío', 'Recordatorio', 'Caliente']);
  assert.deepEqual(r.visibles, ['Frío', 'Recordatorio']);
  assert.deepEqual(r.ocultas, ['Caliente']);
});

test('§7.2 · las preferidas van primero y en el orden elegido', () => {
  // Sin preferencias mandaría el orden de carga, que no dice cuál importa.
  const r = etiquetasDeLaFila(['Frío', 'Recordatorio', 'Caliente'], ['Caliente', 'Frío']);
  assert.deepEqual(r.visibles, ['Caliente', 'Frío']);
  assert.deepEqual(r.ocultas, ['Recordatorio']);
});

test('§7.2 · una preferida que el lead no tiene no deja un hueco', () => {
  const r = etiquetasDeLaFila(['Frío'], ['Decisor', 'Frío']);
  assert.deepEqual(r.visibles, ['Frío']);
  assert.deepEqual(r.ocultas, []);
});

test('§7.2 · sin etiquetas no hay ni visibles ni ocultas', () => {
  const r = etiquetasDeLaFila([], ['Caliente']);
  assert.deepEqual(r, { visibles: [], ocultas: [] });
});
