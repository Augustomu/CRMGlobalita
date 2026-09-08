import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ETIQUETAS_DE_CASA,
  ETIQUETAS_PARTNER,
  casaDeEtiqueta,
  estaProtegida,
  etiquetasDeLaCasa,
  leadsDelPartner,
  loVeElPartner,
} from '../src/partner.ts';

const lead = (id: string, etiquetas: string[]) => ({ id, etiquetas });

test('§7.11 · las etiquetas de partner calzan con los tipos de proyecto', () => {
  // No son un vocabulario nuevo: son lo mismo dicho antes de que el proyecto
  // exista. Globalita tiene dos tipos, Seng uno.
  assert.deepEqual(ETIQUETAS_DE_CASA.globalita, ['PIV', 'Parcería']);
  assert.deepEqual(ETIQUETAS_DE_CASA.seng, ['Inversión']);
  assert.equal(ETIQUETAS_PARTNER.length, 3);
});

test('cada etiqueta pertenece a una sola casa', () => {
  assert.equal(casaDeEtiqueta('PIV'), 'globalita');
  assert.equal(casaDeEtiqueta('Parcería'), 'globalita');
  assert.equal(casaDeEtiqueta('Inversión'), 'seng');
  assert.equal(casaDeEtiqueta('Caliente'), null);
  assert.equal(casaDeEtiqueta(''), null);
});

test('el nombre se compara sin distinguir mayusculas ni espacios', () => {
  // Es lo que hace que renombrar sea peligroso y por eso van protegidas: si
  // "piv" y "PIV" fueran distintas, media vista se caeria en silencio.
  assert.equal(casaDeEtiqueta('piv'), 'globalita');
  assert.equal(casaDeEtiqueta('  PIV  '), 'globalita');
  assert.equal(casaDeEtiqueta('INVERSIÓN'), 'seng');
});

test('las tres estan protegidas y el resto del catalogo no', () => {
  for (const e of ETIQUETAS_PARTNER) assert.equal(estaProtegida(e), true, e);
  assert.equal(estaProtegida('Caliente'), false);
  assert.equal(estaProtegida('MX Norte'), false);
});

test('alcanza con UNA etiqueta de la casa', () => {
  assert.equal(loVeElPartner(lead('a', ['Caliente', 'PIV']), 'globalita'), true);
  assert.equal(loVeElPartner(lead('b', ['Caliente']), 'globalita'), false);
  // Sin etiquetas no lo ve nadie: es el caso de "no confirmaron".
  assert.equal(loVeElPartner(lead('c', []), 'globalita'), false);
});

test('un lead de una casa NO se le muestra al partner de la otra', () => {
  assert.equal(loVeElPartner(lead('a', ['PIV']), 'seng'), false);
  assert.equal(loVeElPartner(lead('b', ['Inversión']), 'globalita'), false);
});

test('un lead con etiquetas de las dos casas lo ven los dos partners', () => {
  // Pasa de verdad: primero les ibamos a vender y despues quisieron capital.
  // Los dos tienen algo que seguir ahi.
  const l = lead('x', ['PIV', 'Inversión']);
  assert.equal(loVeElPartner(l, 'globalita'), true);
  assert.equal(loVeElPartner(l, 'seng'), true);
});

test('la lista del partner deja afuera a los que no confirmaron', () => {
  const leads = [
    lead('confirmado', ['PIV']),
    lead('parceria', ['Parcería']),
    lead('otra-casa', ['Inversión']),
    lead('sin-confirmar', ['Caliente', 'Decisor']),
    lead('pelado', []),
  ];
  assert.deepEqual(
    leadsDelPartner(leads, 'globalita').map((l) => l.id),
    ['confirmado', 'parceria'],
  );
  assert.deepEqual(leadsDelPartner(leads, 'seng').map((l) => l.id), ['otra-casa']);
});

test('se muestran TODAS las etiquetas de la casa, no la primera', () => {
  // PIV y Parceria a la vez son dos trabajos distintos con la misma persona.
  const l = lead('x', ['Caliente', 'PIV', 'Parcería', 'Inversión']);
  assert.deepEqual(etiquetasDeLaCasa(l, 'globalita'), ['PIV', 'Parcería']);
  assert.deepEqual(etiquetasDeLaCasa(l, 'seng'), ['Inversión']);
});

test('los acentos no parten la etiqueta en dos', () => {
  // «Parceria» sin tilde y «Parcería» con tilde tienen que ser la misma. Sin
  // esto el partner ve la mitad de lo que tendria que ver, y a diferencia de un
  // buscador no se entera de que le falta algo.
  assert.equal(casaDeEtiqueta('Parceria'), 'globalita');
  assert.equal(casaDeEtiqueta('parcería'), 'globalita');
  assert.equal(casaDeEtiqueta('Inversion'), 'seng');
  assert.equal(casaDeEtiqueta('inversión'), 'seng');
  assert.equal(loVeElPartner({ id: 'x', etiquetas: ['Parceria'] }, 'globalita'), true);
});
