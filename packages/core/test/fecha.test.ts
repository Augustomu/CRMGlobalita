import test from 'node:test';
import assert from 'node:assert/strict';
import {
  anioDe,
  cuandoEs,
  ddmm,
  ddmmaa,
  ddmmaaaa,
  diaLocal,
  diasDelMes,
  diasEntre,
  fechaDeDiaMes,
} from '../src/fecha.ts';

// §7.2 (vencidos de la columna 1), §7.6 (la columna de hoy en la agenda) y
// §5.4 (la espera de recontacto): las tres cuentan días, y las tres los contaban
// en UTC.
//
// El bug: a las 21:00 en Buenos Aires ya es mañana en UTC, así que la lista
// marcaba como vencido lo que vence mañana — de noche, que es justo cuando se
// cierra el día de trabajo.
test('hoy es hoy donde está quien mira, no en UTC', () => {
  // 8 de septiembre, 21:30 hora LOCAL: el constructor de tres números no pasa
  // por UTC, así que esto vale en cualquier zona donde se corra el test.
  assert.equal(diaLocal(new Date(2026, 8, 8, 21, 30)), '2026-09-08');
  // Y el mismo instante contado como antes daba otro día en media América.
  const noche = new Date(2026, 8, 8, 23, 45);
  assert.equal(diaLocal(noche).slice(8, 10), '08');

  // Y la madrugada del otro lado: 1 de enero a las 00:30.
  assert.equal(diaLocal(new Date(2026, 0, 1, 0, 30)), '2026-01-01');
  // Un dígito se rellena.
  assert.equal(diaLocal(new Date(2026, 2, 5, 12, 0)), '2026-03-05');
});

test('dd/mm sale del texto, no de parsear la fecha', () => {
  // `new Date('2026-09-08')` es UTC y al oeste vuelve como el 7. El día que se
  // muestra tiene que ser el que dice el dato.
  assert.equal(ddmm('2026-09-08'), '08/09');
  assert.equal(ddmm('2026-09-08 14:12:00.000Z'), '08/09');
  assert.equal(ddmmaaaa('2026-09-08'), '08/09/2026');
});

test('sin fecha no se inventa una', () => {
  assert.equal(ddmm(null), '');
  assert.equal(ddmm(''), '');
  assert.equal(ddmm('2026-09'), '');
  assert.equal(ddmmaaaa(undefined), '');
});

// ---------------------------------------------------------------------------
// §7.6 · Día y mes sin año
//
// «En la parte de nueva y próximo contacto, que solamente sea mes y día, no
// hace falta año» (Augusto, 09/09/2026). El año hay que elegirlo igual, y no
// siempre es el de hoy.
// ---------------------------------------------------------------------------
test('diasDelMes conoce febrero y los bisiestos', () => {
  assert.equal(diasDelMes(2026, 2), 28);
  assert.equal(diasDelMes(2028, 2), 29);
  assert.equal(diasDelMes(2026, 4), 30);
  assert.equal(diasDelMes(2026, 12), 31);
});

test('agendar mira hacia adelante', () => {
  // Dentro del mismo año, lo normal.
  assert.equal(fechaDeDiaMes(20, 9, '2026-09-09', 'futuro'), '2026-09-20');
  // Hoy vale: agendar «para hoy» es de las cosas que más se hacen.
  assert.equal(fechaDeDiaMes(9, 9, '2026-09-09', 'futuro'), '2026-09-09');
  // EL SALTO DE AÑO, que es la razón de que esto exista: en diciembre,
  // «15/01» no es de este año.
  assert.equal(fechaDeDiaMes(15, 1, '2026-12-20', 'futuro'), '2027-01-15');
});

test('corregir un histórico mira hacia atrás', () => {
  assert.equal(fechaDeDiaMes(3, 9, '2026-09-09', 'pasado'), '2026-09-03');
  // En enero, «28/12» es del año pasado.
  assert.equal(fechaDeDiaMes(28, 12, '2026-01-05', 'pasado'), '2025-12-28');
  // Hoy también vale para atrás.
  assert.equal(fechaDeDiaMes(9, 9, '2026-09-09', 'pasado'), '2026-09-09');
});

test('el 29 de febrero salta al año que sí existe', () => {
  // 2027 no es bisiesto: sin esto devolvería «2027-02-29», que Date lee como
  // el 1 de marzo — una fecha que nadie escribió.
  assert.equal(fechaDeDiaMes(29, 2, '2026-03-01', 'futuro'), '2028-02-29');
  // Y hacia atrás, al último que lo tuvo.
  assert.equal(fechaDeDiaMes(29, 2, '2026-03-01', 'pasado'), '2024-02-29');
});

test('un día que no existe en ese mes no devuelve nada', () => {
  // 31 de abril, 30 de febrero: no son errores de nadie, son un número a
  // medio escribir. Por eso devuelve vacío en vez de lanzar.
  assert.equal(fechaDeDiaMes(31, 4, '2026-01-01', 'futuro'), '');
  assert.equal(fechaDeDiaMes(30, 2, '2026-01-01', 'futuro'), '');
  assert.equal(anioDe(31, 4, '2026-01-01'), null);
});

test('lo que no es una fecha se rechaza', () => {
  assert.equal(anioDe(0, 5, '2026-01-01'), null);
  assert.equal(anioDe(12, 13, '2026-01-01'), null);
  assert.equal(anioDe(12, 0, '2026-01-01'), null);
  assert.equal(anioDe(NaN, 5, '2026-01-01'), null);
  assert.equal(anioDe(1.5, 5, '2026-01-01'), null);
});

// §7.2 · La resta de días y cómo se dice.
//
// El bug que cierra este bloque: la misma cuenta estaba escrita cuatro veces y
// dos de las copias ya no coincidían. Para el día de mañana la lista decía
// «mañana» y Vencimientos decía «en 1 días» — sin el caso de ±1 y con el
// plural roto. Las dos pantallas están una al lado de la otra.
test('los días se restan por el día, no por la hora', () => {
  assert.equal(diasEntre('2026-09-10', '2026-09-15'), 5);
  assert.equal(diasEntre('2026-09-15', '2026-09-10'), -5);
  assert.equal(diasEntre('2026-09-10', '2026-09-10'), 0);

  // Con la hora adentro: dos momentos del MISMO día son cero días, no uno.
  // Sin cortar el ISO, 23:00 menos 01:00 da 0,92 y Math.round lo manda a 1.
  assert.equal(diasEntre('2026-09-10T01:00:00Z', '2026-09-10T23:00:00Z'), 0);

  // Y el cambio de mes y el año bisiesto se cuentan solos.
  assert.equal(diasEntre('2026-08-31', '2026-09-01'), 1);
  assert.equal(diasEntre('2024-02-28', '2024-03-01'), 2);
  assert.equal(diasEntre('2026-02-28', '2026-03-01'), 1);
});

test('lo que no es una fecha da cero y no NaN', () => {
  // NaN se propaga callado: `en NaN días` es lo que vería el usuario.
  assert.equal(diasEntre('', '2026-09-10'), 0);
  assert.equal(diasEntre('2026-09-10', ''), 0);
  assert.equal(diasEntre('cualquier cosa', '2026-09-10'), 0);
});

test('un día de diferencia se dice «mañana», nunca «en 1 días»', () => {
  const hoy = '2026-09-10';
  assert.equal(cuandoEs('2026-09-10', hoy), 'hoy');
  assert.equal(cuandoEs('2026-09-11', hoy), 'mañana');
  assert.equal(cuandoEs('2026-09-09', hoy), 'ayer');
  assert.equal(cuandoEs('2026-09-15', hoy), 'en 5 días');
  assert.equal(cuandoEs('2026-09-05', hoy), 'hace 5 días');
});

test('el plural no se rompe en ningún caso', () => {
  // Los ±1 los toman «mañana» y «ayer», pero la regla del plural tiene que
  // valer igual: si alguien saca esos dos casos, esto lo agarra.
  const hoy = '2026-09-10';
  for (const s of [cuandoEs('2026-09-12', hoy), cuandoEs('2026-09-08', hoy)]) {
    assert.ok(s.endsWith(' días'), s);
  }
  // Y la hora no cambia lo que se dice: la fecha viene con hora en varias
  // pantallas y «hoy» tiene que seguir siendo «hoy».
  assert.equal(cuandoEs('2026-09-10T22:00:00Z', hoy), 'hoy');
});

// El año de dos cifras existía dos veces fuera de core, y las dos copias se
// habían saltado el guard de largo que ddmm sí tiene.
test('«dd/mm/aa» no inventa nada con un ISO incompleto', () => {
  assert.equal(ddmmaa('2026-09-08'), '08/09/26');
  assert.equal(ddmmaa('2026-09-08T14:30:00Z'), '08/09/26');
  // Esto es lo que devolvía «undefined/09» en la copia de ProyectosDelLead.
  assert.equal(ddmmaa('2026-09'), '');
  assert.equal(ddmmaa(''), '');
  assert.equal(ddmmaa(null), '');
  assert.equal(ddmmaa(undefined), '');
});
