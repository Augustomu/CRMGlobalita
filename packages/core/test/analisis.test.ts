import test from 'node:test';
import assert from 'node:assert/strict';
import {
  cohorteDe,
  concluir,
  demoraDeRespuesta,
  dondeSeCorto,
  envioQueRespondio,
  frecuenciaDeEnvio,
  minutosDeRespuesta,
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
  // El promedio es la demora del manual (respuesta − aceptación) redactada:
  // 'a' aceptó el 05/07 y contestó el 10/08, o sea 36 días. 'b' no contestó y
  // no promedia.
  assert.equal(c.demoraPromedio, '36 días');
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
  // 46 días: del 05/07 (aceptación) al 20/08 (respuesta). NO 5, que era la
  // distancia al R2 — esa es otra pregunta y el manual no la muestra.
  assert.match(ok.texto, /Contestó después del R2, tras 46 días/);
  // Sin respuesta tras varios envios: flojo.
  const mal = concluir(lead({ id: 'd' }), [...envios, { paso: 'R4', enviado_en: '2026-09-05' }], null, undefined);
  assert.equal(mal.tono, 'flojo');
  assert.match(mal.texto, /Sin respuesta después de 4 envíos, el último R4/);
});

// §7.2 — el envío que trajo la respuesta.
//
// El caso que motiva la función: al lead se le sigue escribiendo DESPUÉS de que
// contestó. El último envío del array no es el que provocó la respuesta, y
// restarle la fecha de respuesta da un número negativo.
test('envioQueRespondio ignora lo que se mandó después de la respuesta', () => {
  const conPosteriores: EnvioDelLead[] = [
    { paso: 'R1', enviado_en: '2026-05-21 09:30:00.000Z' },
    { paso: 'R2', enviado_en: '2026-06-08 10:15:00.000Z' },
    { paso: 'R3', enviado_en: '2026-08-14 08:50:00.000Z' },
  ];
  assert.equal(envioQueRespondio(conPosteriores, '2026-06-09 11:40:00.000Z')?.paso, 'R2');
  assert.equal(pasoQueRespondio(conPosteriores, '2026-06-09 11:40:00.000Z'), 'R2');
});

// Mismo día, distinta hora: el de las 18:00 no puede haber provocado la
// respuesta de las 11:40. Con la comparación por fecha sola, sí lo hacía.
test('envioQueRespondio compara la hora, no sólo el día', () => {
  const mismoDia: EnvioDelLead[] = [
    { paso: 'R1', enviado_en: '2026-05-20 09:12:00.000Z' },
    { paso: 'R2', enviado_en: '2026-05-20 18:00:00.000Z' },
  ];
  assert.equal(envioQueRespondio(mismoDia, '2026-05-20 11:40:00.000Z')?.paso, 'R1');
});

test('envioQueRespondio sin respuesta o sin envíos previos da null', () => {
  assert.equal(envioQueRespondio(envios, null), null);
  assert.equal(envioQueRespondio(envios, '2026-07-01'), null);
});

// Manual p. 6: `demora_respuesta = respuesta − aceptacion`, en lenguaje
// natural. Los cuatro escalones salen del prototipo, que los trae escritos:
// «10 min» (María), «5 h» (Wellington), «8 h» (Alexandre), «18 días» (Lucía).
test('la demora se mide desde que aceptó, no desde el último mensaje', () => {
  const conAceptacion = {
    f_aceptacion: '2026-08-21 09:12:00.000Z',
    f_respuesta: '2026-08-21 14:12:00.000Z',
  };
  // Entre medio salió un R que no cambia la cuenta.
  const entremedio: EnvioDelLead[] = [{ paso: 'R1', enviado_en: '2026-08-21 09:30:00.000Z' }];
  assert.equal(demoraDeRespuesta(conAceptacion, entremedio), '5 h');
  assert.equal(demoraDeRespuesta(conAceptacion, []), '5 h');

  assert.equal(
    demoraDeRespuesta({ f_aceptacion: '2026-09-01 08:05:00.000Z', f_respuesta: '2026-09-01 08:15:00.000Z' }, []),
    '10 min',
  );
  assert.equal(
    demoraDeRespuesta({ f_aceptacion: '2026-08-09 12:30:00.000Z', f_respuesta: '2026-08-27 09:10:00.000Z' }, []),
    '18 días',
  );
  // 8 h 38 se dice «8 h», no «9 h»: las horas se truncan. El prototipo lo trae
  // escrito así para Alexandre.
  assert.equal(
    demoraDeRespuesta({ f_aceptacion: '2026-08-12 10:02:00.000Z', f_respuesta: '2026-08-12 18:40:00.000Z' }, []),
    '8 h',
  );
});

// El referido y el que escribe primero nunca aceptaron nada: no hay resta.
test('sin aceptación la demora cae al último envío, y sin envíos se dice', () => {
  const referido = { f_aceptacion: null, f_respuesta: '2026-08-28 19:20:00.000Z' };
  assert.equal(
    demoraDeRespuesta(referido, [{ paso: 'R1', enviado_en: '2026-08-28 10:20:00.000Z' }]),
    '9 h',
  );
  assert.equal(demoraDeRespuesta(referido, []), 'escribió primero');
  // Y lo mismo si le contestamos DESPUÉS: el R4 de las 19:35 no vuelve suya la
  // iniciativa del mensaje de las 19:20.
  assert.equal(
    demoraDeRespuesta(referido, [{ paso: 'R4', enviado_en: '2026-08-28 19:35:00.000Z' }]),
    'escribió primero',
  );
  // Sin respuesta no hay nada que decir.
  assert.equal(demoraDeRespuesta({ f_aceptacion: null, f_respuesta: null }, []), null);
  assert.equal(minutosDeRespuesta({ f_aceptacion: null, f_respuesta: null }, []), null);
});
