import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SIN_ALCANCE,
  escribirAlcance,
  estaDestacadaPara,
  leerAlcance,
  plantillasDe,
  primerNombre,
  reordenar,
  resolverParaPaso,
  resolverTexto,
  type Plantilla,
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

test('§7.2 · el alcance del destacado sobrevive a como este escrito', () => {
  // Un dato de configuracion que se rompe porque alguien puso una mayuscula
  // es un dato que va a estar roto.
  assert.deepEqual(leerAlcance('todas las cuentas'), { tipo: 'todas' });
  assert.deepEqual(leerAlcance('TODAS'), { tipo: 'todas' });
  assert.deepEqual(leerAlcance('AL, dl'), { tipo: 'cuentas', cuentas: ['AL', 'DL'] });
  assert.deepEqual(leerAlcance('AL,DL'), { tipo: 'cuentas', cuentas: ['AL', 'DL'] });
  assert.deepEqual(leerAlcance(''), { tipo: 'ninguno' });
  assert.deepEqual(leerAlcance(null), { tipo: 'ninguno' });
});

test('un destacado de una cuenta NO aparece en otra', () => {
  // AL trabaja directores financieros y ED maquinaria: un chip que aparece en
  // la cuenta equivocada se usa una vez, sale mal, y despues nadie usa los chips.
  assert.equal(estaDestacadaPara('DL', 'DL'), true);
  assert.equal(estaDestacadaPara('DL', 'AL'), false);
  assert.equal(estaDestacadaPara('AL,DL', 'dl'), true);
  assert.equal(estaDestacadaPara('todas', 'AL'), true);
  assert.equal(estaDestacadaPara('', 'AL'), false);
  // Sin cuenta activa, solo las de "todas": mostrar las de una cuenta
  // cualquiera seria mostrar el chip de otro.
  assert.equal(estaDestacadaPara('todas', ''), true);
  assert.equal(estaDestacadaPara('DL', ''), false);
});

test('escribir y leer el alcance es ida y vuelta', () => {
  for (const a of [SIN_ALCANCE, { tipo: 'todas' }, { tipo: 'cuentas', cuentas: ['AL', 'ED'] }] as const) {
    assert.deepEqual(leerAlcance(escribirAlcance(a)), a);
  }
});

test('reordenar renumera TODOS, no solo el par que se cruza', () => {
  const lista = [
    { id: 'a', orden: 1 },
    { id: 'b', orden: 2 },
    { id: 'c', orden: 3 },
  ];
  assert.deepEqual(reordenar(lista, 'c', 'a'), [
    { id: 'c', orden: 1 },
    { id: 'a', orden: 2 },
    { id: 'b', orden: 3 },
  ]);
  // Soltar sobre si mismo no toca nada.
  assert.deepEqual(reordenar(lista, 'a', 'a'), []);
  assert.deepEqual(reordenar(lista, 'a', 'z'), []);
});
