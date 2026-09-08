import test from 'node:test';
import assert from 'node:assert/strict';
import {
  COLUMNA_LISTA,
  PANEL_AGENDA,
  PANEL_REPOSITORIO,
  anchoArrastrado,
  anchoDeDobleClic,
  anchoGuardado,
} from '../src/anchos.ts';

// §9.4 — columna 1 260–520, agenda 340–900, repositorio 300–620.
test('el arrastre no se sale de los límites de cada panel', () => {
  assert.equal(anchoArrastrado(COLUMNA_LISTA, 340, 60), 400);
  assert.equal(anchoArrastrado(COLUMNA_LISTA, 340, 5000), 520);
  assert.equal(anchoArrastrado(COLUMNA_LISTA, 340, -5000), 260);
  assert.equal(anchoArrastrado(PANEL_AGENDA, 560, 5000), 340);
  assert.equal(anchoArrastrado(PANEL_REPOSITORIO, 400, -5000), 620);
});

// El divisor de la columna 1 está a su derecha; los de las sidebars, a su
// izquierda. Sin el signo, arrastrar la agenda la achica cuando querés
// agrandarla.
test('las sidebars crecen para el lado contrario que la columna 1', () => {
  assert.equal(anchoArrastrado(COLUMNA_LISTA, 300, 40), 340);
  assert.equal(anchoArrastrado(PANEL_AGENDA, 500, 40), 460);
  assert.equal(anchoArrastrado(PANEL_REPOSITORIO, 400, 40), 360);
});

test('el doble clic alterna en la columna 1 y devuelve el ancho normal en las sidebars', () => {
  // §7.2 dice «alterna 260/340» para la columna 1: se usa de las dos maneras.
  assert.equal(anchoDeDobleClic(COLUMNA_LISTA, 340), 260);
  assert.equal(anchoDeDobleClic(COLUMNA_LISTA, 520), 260);
  assert.equal(anchoDeDobleClic(COLUMNA_LISTA, 260), 340);
  assert.equal(anchoDeDobleClic(COLUMNA_LISTA, 300), 340);
  // Las sidebars simplemente vuelven.
  assert.equal(anchoDeDobleClic(PANEL_AGENDA, 900), 560);
  assert.equal(anchoDeDobleClic(PANEL_REPOSITORIO, 620), 400);
});

test('lo guardado se usa sólo si es un ancho posible', () => {
  assert.equal(anchoGuardado(COLUMNA_LISTA, '400'), 400);
  // Fuera de rango, basura y vacío se ignoran: el panel arranca en su normal.
  assert.equal(anchoGuardado(COLUMNA_LISTA, '9000'), null);
  assert.equal(anchoGuardado(COLUMNA_LISTA, '100'), null);
  assert.equal(anchoGuardado(COLUMNA_LISTA, 'ancho'), null);
  assert.equal(anchoGuardado(COLUMNA_LISTA, null), null);
  // Un ancho de la columna 1 no es válido para el repositorio.
  assert.equal(anchoGuardado(PANEL_REPOSITORIO, '260'), null);
});
