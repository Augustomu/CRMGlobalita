import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  plantillasDe, primerNombre, resolverParaPaso, resolverTexto, type Plantilla,
} from '../src/plantilla.ts';

const plantillas: Plantilla[] = [
  {
    id: 'p-r1-a',
    nombre: 'R1 · Presentación corta',
    paso: 'R1',
    por_defecto: true,
    orden: 1,
    textos: {
      es: 'Hola {nombre}, vi que trabajás en {empresa}. ¿Cómo manejan {tema} hoy?',
      pt: 'Olá {nombre}, vi que você trabalha na {empresa}. Como tratam {tema} hoje?',
    },
  },
  {
    id: 'p-r1-b',
    nombre: 'R1 · Variante industria',
    paso: 'R1',
    por_defecto: false,
    orden: 2,
    textos: { es: 'Hola {nombre}, trabajamos mucho con {industria} en {ciudad}.' },
  },
  {
    id: 'p-r3',
    nombre: 'R3 · Caso concreto',
    paso: 'R3',
    por_defecto: true,
    orden: 3,
    textos: { es: 'Te dejo un caso de {industria}.' },
  },
];

test('§3.5 · {nombre} usa el primer nombre, no el nombre completo', () => {
  assert.equal(primerNombre('Wellington Abner Simoes'), 'Wellington');
  assert.equal(primerNombre('Lucia'), 'Lucia');
  assert.equal(primerNombre(''), '');
});

test('§3.2 · un nombre de LinkedIn con el cargo adentro no ensucia el saludo', () => {
  // El caso real de los datos de demo: el nombre trae el cargo pegado.
  assert.equal(
    primerNombre('Maria de los Angeles Fernandez - Gerente de Compras y Abastecimiento'),
    'Maria',
  );
});

test('§3.5 · reemplaza todas las variables con los datos del lead', () => {
  const texto = resolverTexto(
    'Hola {nombre}, en {empresa} ({industria}, {ciudad}) ¿cómo va {tema}?',
    { nombre: 'Lucia Goncalves', empresa: 'Vale', industria: 'Minería', ciudad: 'Belo Horizonte', tema: 'el mantenimiento' },
    'es',
  );
  assert.equal(texto, 'Hola Lucia, en Vale (Minería, Belo Horizonte) ¿cómo va el mantenimiento?');
});

test('§3.5 · un campo vacío usa el genérico del idioma (su planta / sua planta)', () => {
  assert.equal(resolverTexto('Vi {empresa}.', { nombre: 'Ana' }, 'es'), 'Vi su planta.');
  assert.equal(resolverTexto('Vi {empresa}.', { nombre: 'Ana' }, 'pt'), 'Vi sua planta.');
  assert.equal(resolverTexto('Vi {empresa}.', { nombre: 'Ana' }, 'en'), 'Vi your plant.');
});

test('sin nombre, el saludo no queda con una coma colgada', () => {
  assert.equal(resolverTexto('Hola {nombre}, ¿cómo va?', {}, 'es'), 'Hola, ¿cómo va?');
});

test('D16 · las plantillas de un paso salen con la de por defecto primero', () => {
  const r1 = plantillasDe(plantillas, 'R1');
  assert.equal(r1.length, 2);
  assert.equal(r1[0]!.id, 'p-r1-a');
});

test('D16 · sin elegir nada, se resuelve la plantilla por defecto del paso', () => {
  const r = resolverParaPaso(plantillas, 'R1', 'es', { nombre: 'Lucia', empresa: 'Vale', tema: 'la parada' });
  assert.equal(r.hay, true);
  assert.equal(r.hay && r.plantilla.id, 'p-r1-a');
  assert.equal(r.hay && r.texto, 'Hola Lucia, vi que trabajás en Vale. ¿Cómo manejan la parada hoy?');
});

test('D16 · se puede pedir una variante puntual del mismo paso', () => {
  const r = resolverParaPaso(plantillas, 'R1', 'es', { nombre: 'Lucia' }, 'p-r1-b');
  assert.equal(r.hay && r.plantilla.id, 'p-r1-b');
});

test('§5.2 · un paso sin plantilla avisa, no inventa texto', () => {
  const r = resolverParaPaso(plantillas, 'R8', 'es', { nombre: 'Lucia' });
  assert.equal(r.hay, false);
  assert.equal(r.hay === false && r.motivo, 'sin_plantilla');
});

test('§5.2 · una plantilla sin ese idioma avisa, no cae a otro idioma en silencio', () => {
  // p-r3 solo tiene español; pedirla en portugués tiene que avisar.
  const r = resolverParaPaso(plantillas, 'R3', 'pt', { nombre: 'Lucia' });
  assert.equal(r.hay, false);
  assert.equal(r.hay === false && r.motivo, 'sin_idioma');
  assert.equal(r.hay === false && r.plantilla?.id, 'p-r3');
});
