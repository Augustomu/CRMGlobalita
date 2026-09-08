import test from 'node:test';
import assert from 'node:assert/strict';
import {
  alternarOrden,
  estaVencida,
  venceHoy,
  visibles,
  type ClaveOrden,
  type Tarea,
} from '../src/tarea.ts';

const HOY = '2026-09-08';

const t = (x: Partial<Tarea> & { id: string }): Tarea => ({
  nombre: 'tarea ' + x.id,
  prioridad: 3,
  ...x,
});

test('§3.7 · vencida es: tiene fecha, ya pasó, y no está hecha', () => {
  assert.equal(estaVencida(t({ id: 'a', fin: '2026-09-01' }), HOY), true);
  assert.equal(estaVencida(t({ id: 'b', fin: '2026-09-20' }), HOY), false);
  assert.equal(estaVencida(t({ id: 'c' }), HOY), false);
  // Hecha no vence: ya no hay nada que hacer.
  assert.equal(estaVencida(t({ id: 'd', fin: '2026-09-01', hecha: true }), HOY), false);
});

test('la de hoy no está vencida, pero se cuenta aparte', () => {
  const hoyMismo = t({ id: 'e', fin: HOY });
  assert.equal(estaVencida(hoyMismo, HOY), false);
  assert.equal(venceHoy(hoyMismo, HOY), true);
});

test('«Abiertas» esconde las hechas', () => {
  const lista = [t({ id: 'a' }), t({ id: 'b', hecha: true })];
  assert.deepEqual(visibles(lista, 'Abiertas', ['vencimiento'], HOY).map((x) => x.id), ['a']);
});

test('«Vencidas» incluye las de HOY, no solo las atrasadas', () => {
  // Hoy todavia se pueden hacer: esconderlas hasta manana es la forma mas
  // segura de que no se hagan.
  const lista = [
    t({ id: 'atrasada', fin: '2026-09-01' }),
    t({ id: 'hoy', fin: HOY }),
    t({ id: 'futura', fin: '2026-09-30' }),
    t({ id: 'sinfecha' }),
  ];
  assert.deepEqual(
    visibles(lista, 'Vencidas', ['vencimiento'], HOY).map((x) => x.id),
    ['atrasada', 'hoy'],
  );
});

test('«Todas» muestra todo, incluidas las hechas', () => {
  const lista = [t({ id: 'a' }), t({ id: 'b', hecha: true })];
  assert.equal(visibles(lista, 'Todas', ['vencimiento'], HOY).length, 2);
});

test('las hechas van al fondo aunque vencieran antes', () => {
  // Una tarea terminada no compite por la atencion con una pendiente.
  const lista = [
    t({ id: 'hecha-vieja', fin: '2026-01-01', hecha: true }),
    t({ id: 'abierta-lejana', fin: '2026-12-01' }),
  ];
  assert.deepEqual(
    visibles(lista, 'Todas', ['vencimiento'], HOY).map((x) => x.id),
    ['abierta-lejana', 'hecha-vieja'],
  );
});

test('sin fecha de vencimiento va al final: no tener plazo no es ser urgente', () => {
  const lista = [t({ id: 'sin' }), t({ id: 'con', fin: '2026-12-01' })];
  assert.deepEqual(
    visibles(lista, 'Todas', ['vencimiento'], HOY).map((x) => x.id),
    ['con', 'sin'],
  );
});

test('el orden se COMBINA y respeta con qué clave se tocó primero', () => {
  const lista = [
    t({ id: 'baja-urgente', prioridad: 1, fin: '2026-09-10' }),
    t({ id: 'alta-lejana', prioridad: 5, fin: '2026-12-01' }),
    t({ id: 'alta-urgente', prioridad: 5, fin: '2026-09-09' }),
  ];
  // Prioridad primero, la fecha desempata.
  assert.deepEqual(
    visibles(lista, 'Todas', ['prioridad', 'vencimiento'], HOY).map((x) => x.id),
    ['alta-urgente', 'alta-lejana', 'baja-urgente'],
  );
  // Al revés da otro resultado: por eso es una lista y no un solo criterio.
  assert.deepEqual(
    visibles(lista, 'Todas', ['vencimiento', 'prioridad'], HOY).map((x) => x.id),
    ['alta-urgente', 'baja-urgente', 'alta-lejana'],
  );
});

test('sin ningún orden elegido no se reordena, pero las hechas siguen al fondo', () => {
  const lista = [t({ id: 'a', hecha: true }), t({ id: 'b' }), t({ id: 'c' })];
  assert.deepEqual(
    visibles(lista, 'Todas', [], HOY).map((x) => x.id),
    ['b', 'c', 'a'],
  );
});

test('alternar una clave la agrega al final y la vuelve a sacar', () => {
  let orden: ClaveOrden[] = ['vencimiento'];
  orden = alternarOrden(orden, 'prioridad');
  assert.deepEqual(orden, ['vencimiento', 'prioridad']);
  orden = alternarOrden(orden, 'vencimiento');
  assert.deepEqual(orden, ['prioridad']);
});
