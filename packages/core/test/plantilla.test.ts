import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SIN_ALCANCE,
  conCuenta,
  sinCuenta,
  escribirAlcance,
  estaDestacadaPara,
  leerAlcance,
  nombreDeAlcance,
  plantillasDe,
  primerNombre,
  reordenar,
  resolverParaPaso,
  resolverTexto,
  nombraElPaso,
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

test('agregar una cuenta a un destacado que ya es «todas» no lo achica', () => {
  // Es el error de tocar la estrella desde la ficha sin ver que ya estaba
  // destacado en todas: lo dejaria destacado en una sola.
  assert.deepEqual(conCuenta({ tipo: 'todas' }, 'AL'), { tipo: 'todas' });
  assert.deepEqual(conCuenta(SIN_ALCANCE, 'AL'), { tipo: 'cuentas', cuentas: ['AL'] });
  assert.deepEqual(conCuenta({ tipo: 'cuentas', cuentas: ['AL'] }, 'dl'), {
    tipo: 'cuentas',
    cuentas: ['AL', 'DL'],
  });
  // Agregar la que ya estaba no la duplica.
  assert.deepEqual(conCuenta({ tipo: 'cuentas', cuentas: ['AL'] }, 'AL'), {
    tipo: 'cuentas',
    cuentas: ['AL'],
  });
});

test('sacar la ultima cuenta deja SIN destacar, no con una lista vacia', () => {
  // Una lista vacia y "ninguno" se ven igual en pantalla y se guardan distinto:
  // despues el filtro por alcance no coincide con nada.
  assert.deepEqual(sinCuenta({ tipo: 'cuentas', cuentas: ['AL'] }, 'AL'), SIN_ALCANCE);
  assert.deepEqual(sinCuenta({ tipo: 'cuentas', cuentas: ['AL', 'DL'] }, 'AL'), {
    tipo: 'cuentas',
    cuentas: ['DL'],
  });
});

test('sacar una cuenta de un destacado «todas» no lo apaga para el resto', () => {
  // Quitar el chip de tu cuenta no puede dejar sin chip a todo el equipo.
  assert.deepEqual(sinCuenta({ tipo: 'todas' }, 'AL', ['AL', 'DL', 'ED']), {
    tipo: 'cuentas',
    cuentas: ['DL', 'ED'],
  });
  // Salvo que no haya otras cuentas: ahi si queda sin destacar.
  assert.deepEqual(sinCuenta({ tipo: 'todas' }, 'AL', ['AL']), SIN_ALCANCE);
});

// §3.5 — el alcance por CASA (08/09/2026).
//
// El problema que resuelve: sin él, «los destacados de Globalita» se escribían
// listando sus cinco cuentas, y la cuenta que se sumara después empezaba sin
// ningún destacado. Nadie se entera: no hay error, simplemente le faltan chips.
test('el alcance por casa alcanza a las cuentas de esa casa, incluidas las nuevas', () => {
  const guardado = escribirAlcance({ tipo: 'casa', casa: 'globalita' });
  assert.equal(guardado, 'casa:globalita');
  assert.deepEqual(leerAlcance(guardado), { tipo: 'casa', casa: 'globalita' });
  assert.equal(nombreDeAlcance(leerAlcance(guardado)), 'todo Globalita');

  // Una cuenta de Globalita lo ve; una de Seng no. Y la cuenta nueva de
  // Globalita —que no está escrita en ningún lado— lo hereda igual.
  assert.equal(estaDestacadaPara(guardado, 'DL', 'globalita'), true);
  assert.equal(estaDestacadaPara(guardado, 'NUEVA', 'globalita'), true);
  assert.equal(estaDestacadaPara(guardado, 'AL', 'seng'), false);
});

test('sin saber la casa de la cuenta, un alcance por casa no se muestra', () => {
  // Adivinar seria mostrarle a alguien los chips de la otra empresa.
  assert.equal(estaDestacadaPara('casa:seng', 'AL'), false);
  assert.equal(estaDestacadaPara('casa:seng', 'AL', null), false);
  assert.equal(estaDestacadaPara('casa:seng', 'AL', 'seng'), true);
});

test('el prefijo distingue la casa de una abreviatura de cuenta', () => {
  // Sin el prefijo, «seng» y una cuenta llamada SENG se guardarian igual.
  assert.deepEqual(leerAlcance('SENG'), { tipo: 'cuentas', cuentas: ['SENG'] });
  assert.deepEqual(leerAlcance('casa:seng'), { tipo: 'casa', casa: 'seng' });
  // Y tolera mayusculas y espacios, como el resto.
  assert.deepEqual(leerAlcance('CASA: Globalita'), { tipo: 'casa', casa: 'globalita' });
});

test('tocar la estrella de una cuenta no desarma un alcance por casa', () => {
  const casa = leerAlcance('casa:globalita');
  // Agregar una cuenta no lo hace mas grande: ya las incluye a todas.
  assert.deepEqual(conCuenta(casa, 'DL'), casa);
  // Y sacarla no lo convierte en una lista: perderia lo que lo hace util, que
  // es que las cuentas nuevas lo hereden. Eso se cambia desde el Repositorio.
  assert.deepEqual(sinCuenta(casa, 'DL', ['AL', 'DL', 'ED']), casa);
});

test('§7.9 · el chip del paso se omite cuando el nombre ya lo dice', () => {
  assert.equal(nombraElPaso('R2 · Seguimiento corto', 'R2'), true);
  assert.equal(nombraElPaso('R0 · Invitación con nota', 'R0'), true);
  assert.equal(nombraElPaso('Agradecimiento post reunión', 'agradecimiento'), true);
});

test('§7.9 · el chip aparece cuando el nombre no nombra el paso', () => {
  assert.equal(nombraElPaso('Saludo corto', 'R2'), false);
  // El caso que importa: «R0 · Reinvitación» dice R0, que NO es R0-recontacto.
  assert.equal(nombraElPaso('R0 · Reinvitación', 'R0-recontacto'), false);
  assert.equal(nombraElPaso('', 'R2'), false);
  assert.equal(nombraElPaso('R2 · algo', ''), false);
});
