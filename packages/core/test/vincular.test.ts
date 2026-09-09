import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  comoSeCompara,
  leadsParecidos,
  personasSinLead,
  quienEsDelTitulo,
} from '../src/vincular.ts';

// --------------------------------------- §7.6: con quién fue la reunión

test('§7.6 · de un título de tres partes sale la primera', () => {
  assert.equal(quienEsDelTitulo('Marcelo Carneiro / Francisco / Augusto'), 'Marcelo Carneiro');
});

test('§7.6 · de un título con guión también sale la primera', () => {
  assert.equal(quienEsDelTitulo('Rodrigues - Augusto'), 'Rodrigues');
});

test('§7.6 · un título de una sola palabra es esa palabra', () => {
  assert.equal(quienEsDelTitulo('Brenno'), 'Brenno');
});

test('§7.6 · un título vacío no da nombre', () => {
  assert.equal(quienEsDelTitulo(''), '');
});

test('§7.6 · el guión de un apellido compuesto no parte el nombre', () => {
  // «Jean-Pierre» sin espacios no es un separador: es el apellido.
  assert.equal(quienEsDelTitulo('Jean-Pierre Dubois - Augusto'), 'Jean-Pierre Dubois');
});

// ------------------------------------------ §7.6: agrupar por persona

const ev = (id: string, titulo: string, inicio = '2026-03-01 10:00:00.000Z', lead = '') => ({
  id,
  titulo,
  inicio,
  lead,
});

test('§7.6 · los eventos de la misma persona se juntan en una fila', () => {
  const r = personasSinLead([
    ev('a', 'Brenno - Augusto', '2026-01-10 10:00:00.000Z'),
    ev('b', 'Brenno - Augusto', '2026-02-10 10:00:00.000Z'),
    ev('c', 'Brenno - Augusto', '2026-03-10 10:00:00.000Z'),
  ]);
  assert.equal(r.length, 1);
  assert.equal(r[0]!.cuantos, 3);
  assert.deepEqual(r[0]!.eventos, ['a', 'b', 'c']);
  assert.equal(r[0]!.desde, '2026-01-10 10:00:00.000Z');
  assert.equal(r[0]!.hasta, '2026-03-10 10:00:00.000Z');
});

test('§7.6 · la tilde y las mayúsculas no separan a la misma persona', () => {
  const r = personasSinLead([
    ev('a', 'Julio Ferrán - Augusto'),
    ev('b', 'JULIO FERRAN / BR / Augusto'),
  ]);
  assert.equal(r.length, 1);
  assert.equal(r[0]!.cuantos, 2);
});

test('§7.6 · se muestra la variante más completa del nombre', () => {
  // Grupo por clave: «herik» y «herik pires» son claves distintas, así que
  // para que sea el MISMO grupo el nombre tiene que normalizar igual.
  const r = personasSinLead([
    ev('a', 'Herik  Pires - Augusto'),
    ev('b', 'Herik Pires - Augusto'),
  ]);
  assert.equal(r.length, 1);
  assert.equal(r[0]!.nombre, 'Herik  Pires');
});

test('§7.6 · el que más veces aparece va primero', () => {
  const r = personasSinLead([
    ev('a', 'Ana - Augusto'),
    ev('b', 'Brenno - Augusto'),
    ev('c', 'Brenno - Augusto'),
  ]);
  assert.equal(r[0]!.nombre, 'Brenno');
  assert.equal(r[1]!.nombre, 'Ana');
});

test('§7.6 · el que ya tiene lead no aparece: la pantalla es de lo que falta', () => {
  const r = personasSinLead([
    ev('a', 'Brenno - Augusto', '2026-03-01 10:00:00.000Z', 'lead123'),
    ev('b', 'Ana - Augusto'),
  ]);
  assert.equal(r.length, 1);
  assert.equal(r[0]!.nombre, 'Ana');
});

test('§7.6 · el almuerzo y la clase no entran: no son prospección', () => {
  const r = personasSinLead([
    ev('a', 'Almuerzo'),
    ev('b', 'Focus time'),
    ev('c', 'Clase de inglés - martes'),
    ev('d', 'Brenno - Augusto'),
  ]);
  assert.equal(r.length, 1);
  assert.equal(r[0]!.nombre, 'Brenno');
});

test('§7.6 · una persona con un solo evento igual aparece', () => {
  const r = personasSinLead([ev('a', 'Rodrigues - Augusto')]);
  assert.equal(r.length, 1);
  assert.equal(r[0]!.cuantos, 1);
  assert.equal(r[0]!.desde, r[0]!.hasta);
});

test('§7.6 · sin eventos no hay filas', () => {
  assert.deepEqual(personasSinLead([]), []);
});

test('§7.6 · un evento sin fecha no rompe el rango', () => {
  const r = personasSinLead([
    { id: 'a', titulo: 'Brenno - Augusto', inicio: null },
    ev('b', 'Brenno - Augusto', '2026-05-01 10:00:00.000Z'),
  ]);
  assert.equal(r[0]!.cuantos, 2);
  assert.equal(r[0]!.hasta, '2026-05-01 10:00:00.000Z');
});

// --------------------------------- §7.6: ordenar los leads candidatos

const leads = [
  { id: '1', nombre: 'Ana Gómez' },
  { id: '2', nombre: 'Brenno Silva' },
  { id: '3', nombre: 'Carlos Brenno' },
];
const nom = (l: { nombre: string }) => l.nombre;

test('§7.6 · los que comparten una palabra del nombre van primero', () => {
  const r = leadsParecidos('Brenno', leads, nom);
  assert.deepEqual(r.map((l) => l.id), ['2', '3', '1']);
});

test('§7.6 · ordena, no filtra: no se pierde ningún lead', () => {
  assert.equal(leadsParecidos('Brenno', leads, nom).length, leads.length);
  assert.equal(leadsParecidos('Zzz', leads, nom).length, leads.length);
});

test('§7.6 · sin nada que comparar, queda el orden original', () => {
  assert.deepEqual(
    leadsParecidos('', leads, nom).map((l) => l.id),
    ['1', '2', '3'],
  );
});

test('§7.6 · las palabras de dos letras no cuentan: «de» no es un parecido', () => {
  const conDe = [
    { id: '1', nombre: 'María de Souza' },
    { id: '2', nombre: 'Pedro Ferreira' },
  ];
  // «de» aparece en el primero pero no debería empujarlo: es una preposición.
  assert.deepEqual(
    leadsParecidos('de Ferreira', conDe, nom).map((l) => l.id),
    ['2', '1'],
  );
});

test('§7.6 · el original no se toca', () => {
  const copia = [...leads];
  leadsParecidos('Brenno', leads, nom);
  assert.deepEqual(leads, copia);
});

// ------------------------------------------------- la normalización

test('§7.6 · comparar ignora tildes, mayúsculas y espacios de más', () => {
  assert.equal(comoSeCompara('  Julio   FERRÁN '), 'julio ferran');
});
