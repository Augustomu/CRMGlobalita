import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ETIQUETA_CONTROL,
  esDeControl,
  leadsDeControl,
  porAtencion,
  resumenDeControl,
  type LeadParaControl,
} from '../src/control.ts';

// §7.11 — Control unificado: proyectos, leads y reuniones en un solo lugar.
//
// «Nos enfoquemos en mostrar solo leads que están avanzados en los proyectos,
// para eso son leads que pueden tener la etiqueta de Control y listo»
// (Augusto, 10/09/2026).

const lead = (p: Partial<LeadParaControl> & { id: string }): LeadParaControl => ({
  etiquetas: [],
  reuniones: 0,
  ultima: null,
  proyecto: null,
  ...p,
});

test('la etiqueta se llama Control', () => {
  assert.equal(ETIQUETA_CONTROL, 'Control');
});

test('la etiqueta se reconoce aunque esté escrita distinto', () => {
  // La escribe una persona en un campo libre.
  assert.equal(esDeControl(['Control']), true);
  assert.equal(esDeControl(['control']), true);
  assert.equal(esDeControl(['  Control  ']), true);
  assert.equal(esDeControl(['CONTROL']), true);
  // Y con otras al lado.
  assert.equal(esDeControl(['Caliente', 'Control', 'PIV']), true);
});

test('no se confunde con otra etiqueta parecida', () => {
  assert.equal(esDeControl([]), false);
  assert.equal(esDeControl(['Contacto']), false);
  assert.equal(esDeControl(['Controlado']), false);
  assert.equal(esDeControl(['sin control']), false);
  // Los acentos NO se ignoran: «Contról» es otra etiqueta, no un error de tipeo
  // que haya que perdonar.
  assert.equal(esDeControl(['Contról']), false);
});

test('entran los marcados y nada más', () => {
  const todos = [
    lead({ id: 'a', etiquetas: ['Control'] }),
    lead({ id: 'b', etiquetas: ['Caliente'] }),
    lead({ id: 'c', etiquetas: ['PIV', 'control'] }),
    lead({ id: 'd' }),
  ];
  assert.deepEqual(leadsDeControl(todos).map((l) => l.id), ['a', 'c']);
});

// ---------------------------------------------------------------------------
// El resumen se calcula sobre LOS MARCADOS, no sobre la base
// ---------------------------------------------------------------------------
test('el resumen cuenta lo que hay y lo que falta', () => {
  const r = resumenDeControl([
    lead({ id: 'a', reuniones: 3, ultima: '2026-09-01', proyecto: 'p1' }),
    lead({ id: 'b', reuniones: 1, ultima: '2026-08-15' }),
    lead({ id: 'c' }),
  ]);
  assert.equal(r.leads, 3);
  assert.equal(r.conProyecto, 1);
  // Lo que FALTA es la mitad del dato: un resumen que sólo cuenta lo que hay
  // se lee como si estuviera todo bien.
  assert.equal(r.sinProyecto, 2);
  assert.equal(r.reuniones, 4);
  assert.equal(r.sinReuniones, 1);
  assert.equal(r.ultima, '2026-09-01');
});

test('sin leads marcados el resumen es todo en cero, no un error', () => {
  const r = resumenDeControl([]);
  assert.deepEqual(r, {
    leads: 0,
    conProyecto: 0,
    sinProyecto: 0,
    reuniones: 0,
    sinReuniones: 0,
    ultima: null,
  });
});

test('la última es la más reciente de todo el conjunto', () => {
  const r = resumenDeControl([
    lead({ id: 'a', ultima: '2026-03-10' }),
    lead({ id: 'b', ultima: '2026-09-09' }),
    lead({ id: 'c', ultima: '2026-07-01' }),
  ]);
  assert.equal(r.ultima, '2026-09-09');
});

// ---------------------------------------------------------------------------
// El orden: primero lo que se está enfriando
// ---------------------------------------------------------------------------
test('arriba va lo que hace más que no se toca', () => {
  const orden = porAtencion([
    lead({ id: 'ayer', ultima: '2026-09-09' }),
    lead({ id: 'viejo', ultima: '2026-06-01' }),
    lead({ id: 'medio', ultima: '2026-08-01' }),
  ]).map((l) => l.id);
  // Al revés de lo que uno esperaría: el que tuvo reunión ayer no necesita
  // nada; el que no se toca hace tres meses se está enfriando.
  assert.deepEqual(orden, ['viejo', 'medio', 'ayer']);
});

test('los que nunca tuvieron reunión van primeros', () => {
  const orden = porAtencion([
    lead({ id: 'con', ultima: '2026-06-01' }),
    lead({ id: 'sin' }),
    lead({ id: 'otro', ultima: '2026-09-01' }),
  ]).map((l) => l.id);
  // Están marcados como avanzados y no arrancaron: es la contradicción más
  // visible de la pantalla y tiene que verse sin scrollear.
  assert.deepEqual(orden, ['sin', 'con', 'otro']);
});

test('ordenar no toca la lista original', () => {
  const original = [lead({ id: 'a', ultima: '2026-09-09' }), lead({ id: 'b', ultima: '2026-01-01' })];
  const copia = [...original];
  porAtencion(original);
  assert.deepEqual(original.map((l) => l.id), copia.map((l) => l.id));
});
