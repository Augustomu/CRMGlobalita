import test from 'node:test';
import assert from 'node:assert/strict';
import {
  cohorteDe,
  concluir,
  dondeSeCorto,
  frecuenciaDeEnvio,
  pasoQueRespondio,
  tardanzaEnResponder,
  type EnvioDelLead,
  type LeadAnalizado,
} from '../src/analisis.ts';

const envios: EnvioDelLead[] = [
  { paso: 'R1', enviado_en: '2026-08-01' },
  { paso: 'R2', enviado_en: '2026-08-15' },
  { paso: 'R3', enviado_en: '2026-08-29' },
];

const lead = (x: Partial<LeadAnalizado> & { id: string }): LeadAnalizado => ({
  etapa: 'R3',
  industria: 'Metalurgia',
  cargo: 'Jefe de Planta',
  f_invitacion: '2026-07-01',
  f_aceptacion: '2026-07-05',
  ...x,
});

test('§7.2 · el paso que respondio es el ULTIMO envio antes de la respuesta', () => {
  assert.equal(pasoQueRespondio(envios, '2026-08-20'), 'R2');
  assert.equal(pasoQueRespondio(envios, '2026-08-01'), 'R1');
  // Sin respuesta no hay paso que atribuir.
  assert.equal(pasoQueRespondio(envios, null), null);
  // Respuesta anterior a todo envio: no la provoco ninguno.
  assert.equal(pasoQueRespondio(envios, '2026-07-20'), null);
});

test('la tardanza se cuenta desde el envio que la provoco, no desde el primero', () => {
  assert.equal(tardanzaEnResponder(envios, '2026-08-20'), 5);
  assert.equal(tardanzaEnResponder(envios, null), null);
});

test('con un solo envio NO hay frecuencia', () => {
  // Un intervalo necesita dos puntos. Devolver 0 diria "le escribimos todos
  // los dias", que es lo contrario de lo que pasa.
  assert.equal(frecuenciaDeEnvio([envios[0]]), null);
  assert.equal(frecuenciaDeEnvio([]), null);
  assert.equal(frecuenciaDeEnvio(envios), 14);
});

test('donde se corto es el ultimo paso, y solo si no contesto', () => {
  assert.equal(dondeSeCorto(envios, null), 'R3');
  assert.equal(dondeSeCorto(envios, '2026-08-20'), null);
  assert.equal(dondeSeCorto([], null), null);
});

test('la cohorte se arma con los parecidos, no con la base entera', () => {
  // La base entera mezcla un CEO argentino con un supervisor brasileno, y ese
  // promedio no le sirve para decidir nada a nadie.
  const yo = lead({ id: 'yo' });
  const todos = [
    yo,
    lead({ id: 'a', f_respuesta: '2026-08-10' }),
    lead({ id: 'b' }),
    lead({ id: 'c', industria: 'Textil', f_respuesta: '2026-08-10' }),
  ];
  const mapa = new Map<string, EnvioDelLead[]>([
    ['a', [{ paso: 'R1', enviado_en: '2026-08-05' }]],
    ['b', envios],
  ]);
  const c = cohorteDe(yo, todos, mapa)!;
  assert.equal(c.criterio, 'industria Metalurgia');
  // Solo a y b: el de Textil queda afuera, y yo no me cuento a mi mismo.
  assert.equal(c.cuantos, 2);
  assert.equal(c.tasaRespuesta, 50);
  assert.equal(c.tardanzaPromedio, 5);
});

test('sin industria la cohorte cae al cargo, y sin ninguno de los dos no hay', () => {
  const yo = lead({ id: 'yo', industria: '' });
  const otros = [yo, lead({ id: 'a', industria: '' })];
  assert.equal(cohorteDe(yo, otros, new Map())?.criterio, 'cargo Jefe de Planta');
  const anonimo = lead({ id: 'x', industria: '', cargo: '' });
  assert.equal(cohorteDe(anonimo, [anonimo, lead({ id: 'y' })], new Map()), null);
});

test('sin nadie parecido no se inventa una cohorte de uno', () => {
  const yo = lead({ id: 'yo' });
  assert.equal(cohorteDe(yo, [yo], new Map()), null);
});

test('la conclusion dice lo que los numeros dicen y nada mas', () => {
  // Sin aceptar: no hay nada que analizar.
  assert.match(concluir(lead({ id: 'a', f_aceptacion: null }), [], null, 'R1').texto, /Todavía no aceptó/);
  // Acepto y no se le mando nada.
  assert.match(concluir(lead({ id: 'b' }), [], null, 'R1').texto, /toca R1/);
  // Contesto.
  const ok = concluir(lead({ id: 'c', f_respuesta: '2026-08-20' }), envios, null, undefined);
  assert.equal(ok.tono, 'bien');
  assert.match(ok.texto, /Contestó después del R2, a los 5 días/);
  // Sin respuesta tras varios envios: flojo.
  const mal = concluir(lead({ id: 'd' }), [...envios, { paso: 'R4', enviado_en: '2026-09-05' }], null, undefined);
  assert.equal(mal.tono, 'flojo');
  assert.match(mal.texto, /Sin respuesta después de 4 envíos, el último R4/);
});
