import test from 'node:test';
import assert from 'node:assert/strict';
import { ALTO_FILA, LOTE, hayQueCrecer, scrollHasta, ventanaPara } from '../src/ventana.ts';

// §7.2 — 80 filas, y de a 80.
test('el lote siguiente se pide antes de tocar el fondo', () => {
  // Un contenedor de 600 px de alto sobre 3000 px de contenido: el gatillo
  // está en 3000 − 400 = 2600, o sea con el scroll en 2000.
  assert.equal(hayQueCrecer(2000, 600, 3000), true);
  assert.equal(hayQueCrecer(1900, 600, 3000), false);
  // Y con todo a la vista (nada que scrollear) ya está pedido.
  assert.equal(hayQueCrecer(0, 600, 600), true);
});

test('elegir un lead de más abajo estira la ventana hasta pasarlo', () => {
  // La fila 900 con 80 dibujadas: la ficha se abre pero la fila no existe.
  assert.equal(ventanaPara(900, LOTE), 980);
  // Se estira hasta i + LOTE, no hasta i: dejarla pegada al borde hace que el
  // primer scroll siguiente vuelva a cargar.
  assert.equal(ventanaPara(900, LOTE) > 900, true);
  // Lo que ya está dibujado no se toca.
  assert.equal(ventanaPara(12, LOTE), LOTE);
  assert.equal(ventanaPara(79, LOTE), LOTE);
  // Y un lead que no está en la lista filtrada tampoco.
  assert.equal(ventanaPara(-1, LOTE), LOTE);
});

test('el scroll deja la fila elegida a un tercio, no pegada arriba', () => {
  // Fila 100 en un panel de 600: 100*46 − 200 = 4400.
  assert.equal(scrollHasta(100, 600), 100 * ALTO_FILA - 200);
  // Las primeras filas no empujan el scroll a negativo.
  assert.equal(scrollHasta(0, 600), 0);
  assert.equal(scrollHasta(2, 600), 0);
});
