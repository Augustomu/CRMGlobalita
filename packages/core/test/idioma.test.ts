import { test } from 'node:test';
import assert from 'node:assert/strict';
import { idiomaEfectivo, idiomaSugerido } from '../src/idioma.ts';

test('§5.6 · pt para Brasil y Mozambique', () => {
  assert.equal(idiomaSugerido('Brasil'), 'pt');
  assert.equal(idiomaSugerido('Mozambique'), 'pt');
});

test('D28 · Portugal también sugiere pt (el manual original lo dejaba en inglés)', () => {
  assert.equal(idiomaSugerido('Portugal'), 'pt');
});

test('§5.6 · es para la lista original de LATAM hispanohablante y España', () => {
  for (const pais of ['Argentina', 'Mexico', 'Uruguay', 'Chile', 'Colombia', 'Peru', 'Paraguay', 'Bolivia', 'España']) {
    assert.equal(idiomaSugerido(pais), 'es', pais);
  }
});

test('D28 · los países que faltaban ahora sugieren es, no en', () => {
  for (const pais of ['Ecuador', 'Venezuela', 'Costa Rica', 'Panama', 'Guatemala', 'Honduras']) {
    assert.equal(idiomaSugerido(pais), 'es', pais);
  }
});

test('§5.6 · en solo fuera de la región', () => {
  assert.equal(idiomaSugerido('Estados Unidos'), 'en');
  assert.equal(idiomaSugerido('Alemania'), 'en');
});

test('§5.6 · acepta ISO-2 y nombre completo, sin distinguir mayúsculas', () => {
  assert.equal(idiomaSugerido('BR'), 'pt');
  assert.equal(idiomaSugerido('br'), 'pt');
  assert.equal(idiomaSugerido('méxico'), 'es');
});

test('D09 · sin override, se infiere del país', () => {
  assert.equal(idiomaEfectivo({ pais: 'Brasil' }), 'pt');
});

test('D09 · con override guardado, ese manda aunque el país diga otra cosa', () => {
  // El brasileño radicado en México: el país sigue siendo Brasil, pero eligió es.
  assert.equal(idiomaEfectivo({ pais: 'Brasil', idioma: 'es' }), 'es');
});
