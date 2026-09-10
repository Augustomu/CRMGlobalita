import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buscable,
  coincide,
  coincideTelefono,
  coincideTermino,
  coincideTodos,
  pareceTelefono,
  sinAcentos,
  soloDigitos,
  terminosDe,
} from '../src/busqueda.ts';

// §7.2 — «Buscador por nombre, empresa, teléfono, ciudad».
//
// La base es latinoamericana: si el buscador exige la tilde, hay que saber cómo
// está escrito el nombre antes de buscarlo.
test('buscar sin tildes encuentra lo que las tiene', () => {
  assert.equal(coincide(['Lucía Gonçalves'], 'Lucia'), true);
  assert.equal(coincide(['María de los Ángeles Fernández Villagrán'], 'Fernandez'), true);
  assert.equal(coincide(['Amílcar Sitoe'], 'amilcar'), true);
  // Y al revés: escribirla de más tampoco puede fallar.
  assert.equal(coincide(['Lucia Goncalves'], 'Lucía'), true);
});

test('busca en todos los campos que le den, no sólo en el nombre', () => {
  const fila = ['Wellington Abner Simões', 'Opus CM', 'São Paulo'];
  assert.equal(coincide(fila, 'opus'), true);
  assert.equal(coincide(fila, 'sao paulo'), true);
  assert.equal(coincide(fila, 'Curitiba'), false);
});

test('la consulta vacía no filtra nada', () => {
  assert.equal(coincide(['Herik Pires'], ''), true);
  assert.equal(coincide(['Herik Pires'], '   '), true);
  // Los campos vacíos no rompen ni generan coincidencias fantasma.
  assert.equal(coincide([null, undefined, ''], 'algo'), false);
});

test('sinAcentos deja el texto comparable', () => {
  assert.equal(sinAcentos('Gonçalves'), 'goncalves');
  assert.equal(sinAcentos('MARÍA'), 'maria');
  assert.equal(sinAcentos(null), '');
});

// ---------------------------------------------------------------------------
// §7.2 · El teléfono se busca por dígitos
//
// «Cuando busco con un teléfono, no me importa que tenga ni espacios ni el
// número de adelante» (Augusto, 09/09/2026). El mismo número está cargado de
// tres formas y el prefijo de país aparece o no según de dónde vino el
// contacto.
// ---------------------------------------------------------------------------
test('soloDigitos saca todo lo que no sea número', () => {
  assert.equal(soloDigitos('+55 31 8477-0178'), '553184770178');
  assert.equal(soloDigitos('(11) 4567.8900'), '1145678900');
  assert.equal(soloDigitos(null), '');
});

test('pareceTelefono distingue un número de una palabra', () => {
  assert.equal(pareceTelefono('+55 31 8477-0178'), true);
  assert.equal(pareceTelefono('8477'), true);
  assert.equal(pareceTelefono('(11) 4567.8900'), true);
  // Menos de cuatro dígitos no alcanza: «311» entraría en media agenda.
  assert.equal(pareceTelefono('311'), false);
  // Una palabra nunca es un teléfono, ni aunque tenga números.
  assert.equal(pareceTelefono('gerente'), false);
  assert.equal(pareceTelefono('R4'), false);
  assert.equal(pareceTelefono('Opus 2024'), false);
  assert.equal(pareceTelefono(''), false);
});

test('el teléfono se encuentra escrito de cualquier forma', () => {
  const guardado = ['553184770178'];
  // Tal cual está.
  assert.equal(coincideTelefono(guardado, '553184770178'), true);
  // Con los signos con los que lo escribe una persona.
  assert.equal(coincideTelefono(guardado, '+55 31 8477-0178'), true);
  assert.equal(coincideTelefono(guardado, '(55) 31 8477.0178'), true);
  // Sin el prefijo de país, que es como uno se lo acuerda.
  assert.equal(coincideTelefono(guardado, '31 8477 0178'), true);
  assert.equal(coincideTelefono(guardado, '8477-0178'), true);
  // Por los últimos cuatro, que es como uno lo reconoce de una lista.
  assert.equal(coincideTelefono(guardado, '0178'), true);
  // Y otro número no aparece.
  assert.equal(coincideTelefono(guardado, '99887766'), false);
});

test('también funciona al revés: se escribe MÁS de lo que está guardado', () => {
  // Este es el caso que rompía: el contacto entró sin el prefijo de país y
  // Augusto lo busca con el prefijo puesto.
  assert.equal(coincideTelefono(['3184770178'], '+55 31 8477-0178'), true);
  assert.equal(coincideTelefono(['84770178'], '553184770178'), true);
});

test('un teléfono guardado demasiado corto no engancha con cualquier cosa', () => {
  // Basura de la importación: tres dígitos sueltos no pueden matchear todo.
  assert.equal(coincideTelefono(['123'], '1234567890'), false);
  assert.equal(coincideTelefono([''], '1234'), false);
});

// ---------------------------------------------------------------------------
// §7.2 · La búsqueda compuesta: los chips se acumulan con «Y»
//
// Decidido por Augusto el 09/09/2026 con la contra a la vista: dos nombres de
// personas distintas dan cero. A cambio se puede afinar.
// ---------------------------------------------------------------------------
const HERIK = buscable(
  ['Herik Marques', 'Gerente', 'Belo Horizonte', 'Brasil', 'herik.marques@hotmail.com',
   'quiere presupuesto para la planta nueva', 'caliente', 'R1'],
  ['553184770178'],
);

test('cada chip achica: hay que cumplirlos todos', () => {
  assert.equal(coincideTodos(HERIK, ['herik']), true);
  assert.equal(coincideTodos(HERIK, ['herik', 'gerente']), true);
  assert.equal(coincideTodos(HERIK, ['herik', 'gerente', 'brasil']), true);
  // Uno solo que no cumpla lo saca.
  assert.equal(coincideTodos(HERIK, ['herik', 'argentina']), false);
});

test('dos nombres de personas distintas dan cero, y está bien', () => {
  // Es la contra conocida de haber elegido «Y». Queda escrita para que nadie
  // la lea después como un bug.
  const josefina = buscable(['Josefina Alvarez']);
  assert.equal(coincideTodos(HERIK, ['martin', 'josefina']), false);
  assert.equal(coincideTodos(josefina, ['martin', 'josefina']), false);
});

test('sin términos, la lista entera pasa', () => {
  assert.equal(coincideTodos(HERIK, []), true);
  assert.equal(coincideTodos(HERIK, ['  ']), true);
});

test('un chip puede ser el teléfono y otro una palabra', () => {
  assert.equal(coincideTodos(HERIK, ['8477-0178', 'gerente']), true);
  assert.equal(coincideTodos(HERIK, ['8477-0178', 'argentina']), false);
});

// ---------------------------------------------------------------------------
// §7.2 · Adentro del lead, como Google Drive
// ---------------------------------------------------------------------------
test('encuentra por lo anotado en las notas', () => {
  assert.equal(coincideTodos(HERIK, ['planta nueva']), true);
  assert.equal(coincideTodos(HERIK, ['presupuesto']), true);
});

test('encuentra por etiqueta, etapa y correo', () => {
  assert.equal(coincideTodos(HERIK, ['caliente']), true);
  assert.equal(coincideTodos(HERIK, ['r1']), true);
  assert.equal(coincideTodos(HERIK, ['hotmail']), true);
});

test('el teléfono no viaja con el texto: sin permiso no se encuentra', () => {
  // §6.2 — quien no puede VER teléfonos tampoco puede confirmarlos buscando.
  // Quien arma el buscable decide, y por eso los teléfonos van aparte.
  const sinPermiso = buscable(['Herik Marques', 'Gerente'], []);
  assert.equal(coincideTermino(sinPermiso, '8477-0178'), false);
  assert.equal(coincideTermino(HERIK, '8477-0178'), true);
  // Y el nombre lo sigue encontrando igual: no se le esconde el lead.
  assert.equal(coincideTermino(sinPermiso, 'herik'), true);
});

// ---------------------------------------------------------------------------
// §7.2 · Lo que se está tecleando cuenta antes del enter
// ---------------------------------------------------------------------------
test('los términos son los chips más lo tecleado', () => {
  assert.deepEqual(terminosDe(['martin'], 'jos'), ['martin', 'jos']);
  assert.deepEqual(terminosDe(['martin'], ''), ['martin']);
  assert.deepEqual(terminosDe([], 'jos'), ['jos']);
  assert.deepEqual(terminosDe([], ''), []);
});

test('los chips vacíos o de puro espacio no cuentan', () => {
  assert.deepEqual(terminosDe(['', '  ', 'vale'], '  '), ['vale']);
});

test('la lista se achica MIENTRAS se escribe, sin apretar enter', () => {
  // Es lo que evita escribir a ciegas: el enter fija lo que ya se veía.
  assert.equal(coincideTodos(HERIK, terminosDe(['gerente'], 'her')), true);
  assert.equal(coincideTodos(HERIK, terminosDe(['gerente'], 'zzz')), false);
});
