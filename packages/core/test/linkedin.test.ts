import test from 'node:test';
import assert from 'node:assert/strict';
import { pareceHiloDeChat, slugDeLinkedIn, urlDePerfil } from '../src/linkedin.ts';

test('D08 · el slug es la identidad; la URL es una de las formas de escribirlo', () => {
  // Guardando la URL entera, la misma persona entra dos veces.
  const esperado = 'alexandre-jordao';
  for (const entrada of [
    'https://www.linkedin.com/in/alexandre-jordao',
    'https://www.linkedin.com/in/alexandre-jordao/',
    'http://linkedin.com/in/alexandre-jordao',
    'www.linkedin.com/in/alexandre-jordao/',
    'linkedin.com/in/alexandre-jordao',
    'alexandre-jordao',
  ]) {
    assert.equal(slugDeLinkedIn(entrada), esperado, entrada);
  }
});

test('la query y el fragmento no son parte de la identidad', () => {
  // `?originalSubdomain=br` y los utm_* los pega quien comparte el link.
  assert.equal(
    slugDeLinkedIn('https://www.linkedin.com/in/lucia-goncalves/?originalSubdomain=br'),
    'lucia-goncalves',
  );
  assert.equal(slugDeLinkedIn('https://www.linkedin.com/in/herik-pires#main'), 'herik-pires');
  assert.equal(
    slugDeLinkedIn('https://www.linkedin.com/in/maria-villagran?utm_source=share&utm_medium=x'),
    'maria-villagran',
  );
});

test('los acentos escapados vuelven a su forma legible', () => {
  assert.equal(slugDeLinkedIn('https://www.linkedin.com/in/jos%C3%A9-p%C3%A9rez'), 'josé-pérez');
});

test('lo que no es reconocible devuelve vacio, no un slug inventado', () => {
  assert.equal(slugDeLinkedIn(''), '');
  assert.equal(slugDeLinkedIn('   '), '');
  assert.equal(slugDeLinkedIn('https://ejemplo.com/gente/juan'), '');
  assert.equal(slugDeLinkedIn('esto es una frase con espacios/y barra'), '');
});

test('sin slug no hay URL: mejor nada que un link roto', () => {
  assert.equal(urlDePerfil('alexandre-jordao'), 'https://www.linkedin.com/in/alexandre-jordao');
  assert.equal(urlDePerfil(''), '');
  assert.equal(urlDePerfil('   '), '');
});

test('el link del chat se avisa cuando claramente no es un hilo', () => {
  // Vacio es valido: todavia no lo cargaron.
  assert.equal(pareceHiloDeChat(''), true);
  assert.equal(pareceHiloDeChat('https://www.linkedin.com/messaging/thread/2-abc/'), true);
  assert.equal(pareceHiloDeChat('https://wa.me/5493415550192'), true);
  // Pegar el perfil en el campo del chat es el error tipico.
  assert.equal(pareceHiloDeChat('https://www.linkedin.com/in/alexandre-jordao'), false);
});
