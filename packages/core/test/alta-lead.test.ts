import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  LISTA_MANUAL,
  planDeAlta,
  problemasDelAlta,
  proximoSugerido,
  type AltaDeLead,
} from '../src/alta-lead.ts';
import { decidirAlta } from '../src/dedupe.ts';

const minimo: AltaDeLead = { nombre: 'Ana Pereira', cuenta: 'cnt1' };

test('§7.2 · sólo el nombre y la cuenta son obligatorios', () => {
  assert.deepEqual(problemasDelAlta(minimo), []);

  const campos = problemasDelAlta({ nombre: '  ', cuenta: '' }).map((p) => p.campo);
  assert.deepEqual(campos, ['nombre', 'cuenta']);
});

test('§7.2 · el resto del formulario no bloquea: se completa después', () => {
  // Un contacto de feria: nombre, cuenta y nada más. Tiene que poder entrar.
  const plan = planDeAlta(minimo);
  assert.equal(plan.perfil.nombre, 'Ana Pereira');
  assert.equal(plan.lead.etapa, 'R0');
  assert.equal(plan.lead.situacion, 'en_curso');
  assert.equal(plan.lead.lista, LISTA_MANUAL);
});

test('D02 · el link de LinkedIn se convierte en slug para poder deduplicar', () => {
  const plan = planDeAlta({ ...minimo, linkedin: 'https://www.linkedin.com/in/ana-pereira-123/' });
  assert.equal(plan.perfil.slug, 'ana-pereira-123');
  assert.equal(plan.avisos.some((a) => a.includes('LinkedIn')), false);

  // Y la identidad sale lista para preguntarle a decidirAlta si ya existe.
  const v = decidirAlta(plan.identidad, [
    { id: 'p9', slug: 'ana-pereira-123', urn: '', huella: '' },
  ]);
  assert.deepEqual(v, { accion: 'mismo', perfil_id: 'p9', completar: {} });
});

test('D02 · un link que no es un perfil avisa pero no impide guardar', () => {
  const plan = planDeAlta({ ...minimo, linkedin: 'https://globalita.tech' });
  assert.equal(plan.perfil.slug, '');
  assert.equal(plan.avisos.some((a) => a.includes('reconocible')), true);
});

test('D29 · el teléfono se normaliza con el país, y si no da se guarda igual', () => {
  const bueno = planDeAlta({ ...minimo, telefono: '11 4321-5678', pais: 'Argentina' });
  assert.equal(bueno.perfil.telefono, '541143215678');
  assert.equal(bueno.perfil.telefono_valido, true);

  const malo = planDeAlta({ ...minimo, telefono: '1234', pais: 'Argentina' });
  assert.equal(malo.perfil.telefono_valido, false);
  assert.equal(malo.perfil.telefono_raw, '1234', 'el crudo nunca se pierde');
  assert.equal(malo.avisos.some((a) => a.includes('WhatsApp')), true);
});

test('D29 · sin país el teléfono no se puede completar, y el aviso lo dice', () => {
  const plan = planDeAlta({ ...minimo, telefono: '11 4321-5678' });
  assert.equal(plan.perfil.telefono_valido, false);
  assert.equal(plan.avisos.some((a) => a.includes('país')), true);
});

test('§5.6 · el idioma sale del país y no se guarda en el lead', () => {
  assert.equal(planDeAlta({ ...minimo, pais: 'Brasil' }).idioma, 'pt');
  assert.equal(planDeAlta({ ...minimo, pais: 'Uruguay' }).idioma, 'es');
  assert.equal('idioma' in planDeAlta(minimo).lead, false);
});

test('§3.13 · la casa sale de la línea de la cuenta elegida', () => {
  assert.equal(planDeAlta(minimo, 'inversiones').casa, 'seng');
  assert.equal(planDeAlta(minimo, 'ia').casa, 'globalita');
  assert.equal(planDeAlta(minimo).casa, null);
});

test('§7.2 · la fecha tiene que ser AAAA-MM-DD, y vacía se guarda como null', () => {
  assert.deepEqual(
    problemasDelAlta({ ...minimo, proximo_contacto: '15/09/2026' }).map((p) => p.campo),
    ['proximo_contacto'],
  );
  assert.deepEqual(problemasDelAlta({ ...minimo, proximo_contacto: '2026-09-15' }), []);
  assert.equal(planDeAlta(minimo).lead.proximo_contacto, null);
});

test('§7.2 · un lead sin próximo contacto avisa que no va a aparecer en Vencimientos', () => {
  assert.equal(
    planDeAlta(minimo).avisos.some((a) => a.includes('Vencimientos')),
    true,
  );
  assert.equal(
    planDeAlta({ ...minimo, proximo_contacto: '2026-09-15' }).avisos.length,
    0,
  );
});

test('§7.2 · el próximo contacto se propone para mañana, y cruza fin de mes', () => {
  assert.equal(proximoSugerido('2026-09-09'), '2026-09-10');
  assert.equal(proximoSugerido('2026-09-30'), '2026-10-01');
  assert.equal(proximoSugerido('2026-12-31'), '2027-01-01');
});
