import test from 'node:test';
import assert from 'node:assert/strict';
import {
  cruzar,
  cuantosCandidatos,
  mejorNombre,
  nombreDelEmail,
  nombreDelSlug,
  palabrasDe,
  parecido,
  segurosParaLote,
  type PerfilCruce,
} from '../src/cruce.ts';

/* --------------------------------------------------------------------------
 * El parecido entre dos nombres
 * ----------------------------------------------------------------------- */

test('§3.12 · el mismo nombre en otro orden es la misma persona', () => {
  assert.equal(parecido('Nicolás Valencia García', 'Garcia Valencia Nicolas'), 'exacta');
});

test('§3.12 · los acentos y la puntuación no cuentan', () => {
  assert.equal(parecido('Márcio Anderson', 'Marcio Anderson'), 'exacta');
  assert.equal(parecido('Fernando A. Costa', 'Fernando A Costa'), 'exacta');
});

test('§3.12 · un nombre contenido en otro es confianza alta', () => {
  assert.equal(parecido('Leonardo Titronic', 'Leonardo Titronic Da Silva'), 'alta');
});

test('§3.12 · UNA sola palabra en común nunca alcanza', () => {
  // En esta base hay catorce «Carlos». Aceptar una coincidencia de una palabra
  // mezclaría el historial de reuniones de uno con el teléfono de otro.
  assert.equal(parecido('Carlos', 'Carlos Magno Veras'), null);
  assert.equal(parecido('Rodrigo', 'Rodrigo Vera'), null);
});

test('§3.12 · las palabras de relleno no cuentan como coincidencia', () => {
  // «Llamar a Miguel» viene de un título de Calendar, no es un nombre.
  assert.equal(parecido('Llamar a Miguel', 'Miguel'), null);
  // «de» y «da» tampoco suman.
  assert.equal(parecido('Ana de la Cruz', 'Pedro de la Torre'), null);
});

test('§3.12 · comparten nombre y apellido pero no todo: confianza media', () => {
  assert.equal(parecido('Juan Carlos Perez', 'Juan Perez Lopez'), 'media');
});

test('§3.12 · un nombre vacío no cruza con nada', () => {
  assert.equal(parecido('', 'Leonardo Titronic'), null);
  assert.equal(parecido('Gerente', 'Consultor'), null);
});

test('§3.12 · el cargo pegado al nombre no se toma como parte del nombre', () => {
  assert.deepEqual(palabrasDe('Alexandre Jordão Gerente RJ'), ['alexandre', 'jordao', 'rj']);
});

/* --------------------------------------------------------------------------
 * El cruce entre las dos fuentes
 * ----------------------------------------------------------------------- */

const p = (id: string, nombre: string): PerfilCruce => ({ id, nombre });

test('§3.12 · se devuelven TODOS los candidatos, no el mejor', () => {
  // Cuando hay más de uno es justamente cuando tiene que decidir una persona.
  const cs = cruzar(
    [p('cal1', 'Carlos Magno Veras')],
    [p('wa1', 'Carlos Magno Veras'), p('wa2', 'Carlos Magno Veras Junior')],
  );
  assert.equal(cs.length, 2);
  assert.equal(cs.filter((c) => c.confianza === 'exacta').length, 1);
  assert.equal(cs.filter((c) => c.confianza === 'alta').length, 1);
});

test('§3.12 · cada candidato dice por qué se propone', () => {
  const cs = cruzar([p('cal1', 'Leonardo Titronic')], [p('wa1', 'Leonardo Titronic')]);
  assert.equal(cs[0]!.motivo, 'El nombre completo coincide');
});

test('§3.12 · sin coincidencia no se inventa un cruce', () => {
  assert.deepEqual(cruzar([p('cal1', 'Ana Gomez')], [p('wa1', 'Pedro Souza')]), []);
});

/* --------------------------------------------------------------------------
 * Qué se puede aprobar en lote
 * ----------------------------------------------------------------------- */

test('§3.12 · sólo va al lote lo exacto Y uno a uno', () => {
  const cs = cruzar(
    [p('cal1', 'Leonardo Titronic'), p('cal2', 'Carlos Magno Veras')],
    [p('wa1', 'Leonardo Titronic'), p('wa2', 'Carlos Magno Veras'), p('wa3', 'Carlos Magno Veras Junior')],
  );
  const lote = segurosParaLote(cs);
  // Leonardo sí: exacto y sin competencia.
  assert.equal(lote.length, 1);
  assert.equal(lote[0]!.del_calendar, 'cal1');
  // Carlos no, aunque uno de sus dos candidatos sea exacto: tiene competencia.
});

test('§3.12 · el conteo de candidatos mira los dos lados', () => {
  const cs = cruzar(
    [p('cal1', 'Ana Maria Gomez'), p('cal2', 'Ana Maria Gomez')],
    [p('wa1', 'Ana Maria Gomez')],
  );
  const cuantos = cuantosCandidatos(cs);
  // El del CSV tiene dos pretendientes: no puede ir al lote aunque los dos
  // sean exactos.
  assert.equal(cuantos.get('wa1'), 2);
  assert.equal(segurosParaLote(cs).length, 0);
});

test('§3.12 · dos nombres idénticos de UNA palabra tampoco cruzan', () => {
  // Es el mismo caso que «Llamar a Miguel» / «Miguel»: sacando el relleno les
  // queda una palabra y son idénticas. Un nombre de pila solo no identifica a
  // nadie, por más que coincida entero.
  assert.equal(parecido('Carlos', 'Carlos'), null);
  assert.equal(parecido('Rodrigo', 'Rodrigo'), null);
});

/* --------------------------------------------------------------------------
 * Recuperar el nombre completo de un evento
 * ----------------------------------------------------------------------- */

test('§3.12 · el slug de LinkedIn da nombre y apellido', () => {
  assert.equal(
    nombreDelSlug('https://www.linkedin.com/in/leonardo-zorzaneli-3050a727'),
    'leonardo zorzaneli',
  );
  // El sufijo que agrega LinkedIn cuando el nombre está tomado no es parte del
  // nombre.
  assert.equal(nombreDelSlug('/in/pedro-herrera-1a2b3c4d'), 'pedro herrera');
});

test('§3.12 · sin link no se inventa nada', () => {
  assert.equal(nombreDelSlug(''), '');
  assert.equal(nombreDelSlug('https://empresa.com/equipo'), '');
});

test('§3.12 · el email da el nombre cuando es de una persona', () => {
  assert.equal(nombreDelEmail('josimar.almeida@x.com'), 'josimar almeida');
  assert.equal(nombreDelEmail('bruno_araujo_rocha@x.com'), 'bruno araujo rocha');
});

test('§3.12 · una casilla de empresa NO es un nombre', () => {
  // «contato@masterconsult.br» daría «contato masterconsultbr», que no es de
  // nadie y cruzaría mal con cualquiera.
  assert.equal(nombreDelEmail('contato@masterconsultbr.com'), '');
  assert.equal(nombreDelEmail('ventas.industriales@x.com'), '');
  assert.equal(nombreDelEmail('info@x.com'), '');
  // Una sola palabra tampoco: «leonardo@x.com» no dice el apellido.
  assert.equal(nombreDelEmail('leonardo@x.com'), '');
});

test('§3.12 · el mejor nombre respeta lo que ya viene completo', () => {
  assert.equal(
    mejorNombre({ titulo: 'Wellington Abner Simoes', email: 'otro.nombre@x.com' }),
    'Wellington Abner Simoes',
  );
});

test('§3.12 · con un nombre de pila, el slug gana al email', () => {
  // El slug lo escribió la propia persona en LinkedIn; el email puede ser una
  // casilla compartida.
  assert.equal(
    mejorNombre({
      titulo: 'Miguel',
      link: '/in/miguel-angel-perez-sanchez',
      email: 'compras@empresa.com',
    }),
    'Miguel Angel Perez Sanchez',
  );
});

test('§3.12 · si nada alcanza, se devuelve el título tal cual', () => {
  // Un nombre pobre es mejor que ninguno: sólo que no va a poder cruzarse.
  assert.equal(mejorNombre({ titulo: 'Renato', email: 'info@x.com' }), 'Renato');
});
