import test from 'node:test';
import assert from 'node:assert/strict';
import {
  anchoDeTasa,
  colorDeTasa,
  cuandoResponden,
  cuandoRespondenDetallado,
  demoraNatural,
  franjaDe,
  tieneHora,
  industriasQueConvierten,
  lunesDe,
  metricasSemanales,
  perfilesConMasReuniones,
  porcentaje,
  rendimientoPorPaso,
  type EnvioMedido,
  type LeadMedido,
} from '../src/rendimiento.ts';

const HOY = '2026-09-08'; // martes

const lead = (x: Partial<LeadMedido> & { id: string }): LeadMedido => ({
  cuenta: 'c1',
  etapa: 'R1',
  situacion: 'en_curso',
  ...x,
});

test('§7.3 · R0 mide ACEPTACION, no respuesta, y queda marcado', () => {
  const leads = [
    lead({ id: 'a', f_invitacion: '2026-08-01', f_aceptacion: '2026-08-03' }),
    lead({ id: 'b', f_invitacion: '2026-08-01' }),
  ];
  const r0 = rendimientoPorPaso(leads, [], HOY).find((f) => f.paso === 'R0')!;
  assert.equal(r0.enviados, 2);
  assert.equal(r0.respuestas, 1);
  assert.equal(r0.tasa, 50);
  assert.equal(r0.esAceptacion, true);
});

test('una respuesta cuenta para el paso que la provoco, no para los anteriores', () => {
  // El lead contesto el 20; el R1 salio el 10 y el R2 el 25. Solo el R1 puede
  // haberla provocado: darle el merito a los dos infla toda la tabla.
  const leads = [lead({ id: 'x', f_respuesta: '2026-08-20' })];
  const envios: EnvioMedido[] = [
    { lead: 'x', paso: 'R1', enviado_en: '2026-08-10' },
    { lead: 'x', paso: 'R2', enviado_en: '2026-08-25' },
  ];
  const t = rendimientoPorPaso(leads, envios, HOY);
  assert.equal(t.find((f) => f.paso === 'R1')!.respuestas, 1);
  assert.equal(t.find((f) => f.paso === 'R2')!.respuestas, 0);
});

test('«toca» son los parados en ese paso a los que ya les vencio', () => {
  const leads = [
    lead({ id: 'a', etapa: 'R3', proximo_contacto: '2026-09-01' }),
    lead({ id: 'b', etapa: 'R3', proximo_contacto: HOY }),
    lead({ id: 'c', etapa: 'R3', proximo_contacto: '2026-12-01' }),
    lead({ id: 'd', etapa: 'R3', proximo_contacto: HOY, situacion: 'contesto' }),
  ];
  assert.equal(rendimientoPorPaso(leads, [], HOY).find((f) => f.paso === 'R3')!.toca, 2);
});

test('sin denominador la tasa es 0, no NaN', () => {
  assert.equal(porcentaje(0, 0), 0);
  const vacio = rendimientoPorPaso([], [], HOY);
  assert.ok(vacio.every((f) => Number.isFinite(f.tasa)));
});

test('los cortes de color y el ancho de la barra son los del prototipo', () => {
  assert.equal(colorDeTasa(31), 'bien');
  assert.equal(colorDeTasa(30), 'bien');
  assert.equal(colorDeTasa(20), 'normal');
  assert.equal(colorDeTasa(19), 'flojo');
  assert.equal(anchoDeTasa(0), 4);
  assert.equal(anchoDeTasa(40), 100);
  assert.equal(anchoDeTasa(90), 100);
});

test('la semana arranca el lunes, y el domingo cierra la anterior', () => {
  assert.equal(lunesDe('2026-09-08'), '2026-09-07'); // martes
  assert.equal(lunesDe('2026-09-07'), '2026-09-07'); // lunes
  assert.equal(lunesDe('2026-09-13'), '2026-09-07'); // domingo
  assert.equal(lunesDe('2026-09-14'), '2026-09-14'); // lunes siguiente
});

test('«aceptadas» se cuenta por fecha de ACEPTACION, aunque la invitacion sea vieja', () => {
  // Puede superar a enviadas en una semana floja, y no es un error.
  const cuentas = [{ id: 'c1', abrev: 'AL', objetivo_semanal: 200 }];
  const leads = [
    lead({ id: 'a', f_invitacion: '2026-06-01', f_aceptacion: '2026-09-08' }),
    lead({ id: 'b', f_invitacion: '2026-06-02', f_aceptacion: '2026-09-09' }),
    lead({ id: 'c', f_invitacion: '2026-09-08' }),
  ];
  const [m] = metricasSemanales(cuentas, leads, HOY);
  assert.equal(m.enviadas, 1);
  assert.equal(m.aceptadas, 2);
});

test('la conversion que se muestra es la de la semana YA CERRADA', () => {
  // La de la semana en curso daria 0% el lunes y 200% el martes: no sirve para
  // decidir nada.
  const cuentas = [{ id: 'c1', abrev: 'AL', objetivo_semanal: 200 }];
  const leads = [
    lead({ id: 'a', f_invitacion: '2026-09-01', f_aceptacion: '2026-09-02' }),
    lead({ id: 'b', f_invitacion: '2026-09-02' }),
    lead({ id: 'c', f_invitacion: '2026-09-08', f_aceptacion: '2026-09-08' }),
  ];
  const [m] = metricasSemanales(cuentas, leads, HOY);
  assert.equal(m.conversionAnterior, 50);
});

test('los rankings se escalan contra el primero', () => {
  const filas = perfilesConMasReuniones([
    { cargo: 'Gerente de Compras', estado: 'asistio' },
    { cargo: 'Gerente de Compras', estado: 'asistio' },
    { cargo: 'Gerente de Compras', estado: 'pendiente' },
    { cargo: 'Jefe de Planta', estado: 'asistio' },
    { cargo: '', estado: 'asistio' },
    { cargo: 'Cualquiera', estado: 'cancelada' },
  ]);
  assert.deepEqual(filas[0], { que: 'Gerente de Compras', valor: '3', ancho: 100 });
  assert.equal(filas[1].ancho, 33);
  // El vacio no se pierde: se agrupa.
  assert.ok(filas.some((f) => f.que === 'sin cargo'));
  // La cancelada no cuenta.
  assert.ok(!filas.some((f) => f.que === 'Cualquiera'));
});

test('las industrias se miden sobre ACEPTADOS, no sobre invitaciones', () => {
  // Sobre invitaciones se mide el filtro de la lista, no el convencimiento.
  const aceptados = new Map([['Automotriz', 20], ['Textil', 4], ['Vacia', 0]]);
  const conReunion = new Map([['Automotriz', 8], ['Textil', 1], ['Vacia', 3]]);
  const filas = industriasQueConvierten(aceptados, conReunion);
  assert.deepEqual(filas[0], { que: 'Automotriz', valor: '40%', ancho: 100 });
  assert.equal(filas[1].que, 'Textil');
  // Sin aceptados no hay tasa que mostrar, por mas reuniones que haya.
  assert.ok(!filas.some((f) => f.que === 'Vacia'));
});

test('una industria con un solo aceptado no entra: no es una tasa, es una anecdota', () => {
  // Con un caso, una reunion da 100% y ninguna da 0%: las dos ocupan el primer
  // y el ultimo puesto sin decir nada, y tapan a la que si tiene volumen.
  const filas = industriasQueConvierten(
    new Map([['Automotriz', 20], ['Anecdota', 1]]),
    new Map([['Automotriz', 5], ['Anecdota', 1]]),
  );
  assert.deepEqual(filas.map((f) => f.que), ['Automotriz']);
});

test('la tasa por industria no puede pasar de 100%', () => {
  // Contando REUNIONES en vez de leads, quien reagenda contaba dos veces y
  // salia "200% de conversion", que no es un dato optimista sino uno roto.
  const filas = industriasQueConvierten(new Map([['Metalurgia', 5]]), new Map([['Metalurgia', 5]]));
  assert.equal(filas[0].valor, '100%');
});

test('cuando responden sale por dia: la hora no existe en los datos todavia', () => {
  const leads = [
    lead({ id: 'a', f_respuesta: '2026-09-08' }), // martes
    lead({ id: 'b', f_respuesta: '2026-09-15' }), // martes
    lead({ id: 'c', f_respuesta: '2026-09-09' }), // miercoles
    lead({ id: 'd' }),
  ];
  const filas = cuandoResponden(leads);
  assert.deepEqual(filas[0], { que: 'martes', valor: '67%', ancho: 100 });
  assert.equal(filas[1].que, 'miércoles');
});

test('§7.11.2 · las cuatro franjas del manual, y lo de afuera no entra', () => {
  assert.equal(franjaDe('2026-09-08 09:15:00.000Z'), 'mañana');
  assert.equal(franjaDe('2026-09-08 11:00:00.000Z'), 'mediodía');
  assert.equal(franjaDe('2026-09-08 16:59:00.000Z'), 'tarde');
  assert.equal(franjaDe('2026-09-08 19:30:00.000Z'), 'última hora');
  // Fuera del horario de trabajo no hay franja: no se fuerza a la mas cercana.
  assert.equal(franjaDe('2026-09-08 03:00:00.000Z'), null);
  assert.equal(franjaDe('2026-09-08 21:00:00.000Z'), null);
  assert.equal(franjaDe('2026-09-08'), null);
});

test('una fecha con medianoche NO es una hora medida', () => {
  // Los dos se guardan igual. Sin distinguirlos, todo lo importado caeria en
  // la franja de las 00:00 y el grafico diria con seguridad algo que nadie
  // midio.
  assert.equal(tieneHora('2026-09-08 00:00:00.000Z'), false);
  assert.equal(tieneHora('2026-09-08 09:15:00.000Z'), true);
  assert.equal(tieneHora(''), false);
});

test('cuando responden cuenta solo los que tienen hora, y dice cuantos no', () => {
  const conHora = (id: string, f: string) => ({
    id, cuenta: 'c1', etapa: 'R1', situacion: 'en_curso', f_respuesta: f,
  });
  const r = cuandoRespondenDetallado([
    conHora('a', '2026-09-08 09:00:00.000Z'),
    conHora('b', '2026-09-15 10:00:00.000Z'),
    conHora('c', '2026-09-09 15:00:00.000Z'),
    conHora('sin', '2026-09-10 00:00:00.000Z'),
  ]);
  assert.equal(r.sinHora, 1);
  assert.deepEqual(r.filas[0], { que: 'martes mañana', valor: '67%', ancho: 100 });
});

test('la demora cambia de unidad para no decir «0 dias»', () => {
  // Una respuesta de la misma tarde contada en dias da 0, que dice algo falso.
  assert.equal(demoraNatural('2026-09-08 09:00:00Z', '2026-09-08 09:40:00Z'), '40 min');
  assert.equal(demoraNatural('2026-09-08 09:00:00Z', '2026-09-08 17:00:00Z'), '8 h');
  assert.equal(demoraNatural('2026-09-01 09:00:00Z', '2026-09-19 09:00:00Z'), '18 días');
  assert.equal(demoraNatural('2026-01-01 09:00:00Z', '2026-06-01 09:00:00Z'), '5 meses');
  // Sin uno de los dos extremos no hay demora que calcular.
  assert.equal(demoraNatural(null, '2026-09-08'), null);
  assert.equal(demoraNatural('2026-09-08', null), null);
  // Al reves tampoco: seria una demora negativa.
  assert.equal(demoraNatural('2026-09-08', '2026-09-01'), null);
});
