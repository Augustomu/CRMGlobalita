import test from 'node:test';
import assert from 'node:assert/strict';
import {
  estaCompartido,
  grupoDeEtapa,
  historial,
  resumenDeRespuesta,
  visibles,
  type FilaCompartida,
} from '../src/compartida.ts';

const fila = (x: Partial<FilaCompartida> & { perfil_id: string }): FilaCompartida => ({
  nombre: 'Nombre ' + x.perfil_id,
  cargo: 'Jefe de Planta',
  empresa: 'Empresa',
  industria: 'Metalurgia',
  pais: 'Argentina',
  ciudad: 'Rosario',
  cuentas: ['AL'],
  etapa: 'R2',
  situacion: 'en_curso',
  f_invitacion: '2026-08-01',
  f_aceptacion: '2026-08-05',
  f_respuesta: null,
  proximo_contacto: '2026-09-20',
  ultimo_paso: null,
  ultimo_en: null,
  ...x,
});

test('§7.5 · compartido es tener leads en mas de una cuenta', () => {
  // Es la razon de ser de la tabla: que dos cuentas no le escriban a la misma
  // persona sin saberlo.
  assert.equal(estaCompartido(fila({ perfil_id: 'a', cuentas: ['AL'] })), false);
  assert.equal(estaCompartido(fila({ perfil_id: 'b', cuentas: ['AL', 'ED'] })), true);
});

test('«Sin aceptar» gana sobre la etapa: la etapa avanza con envios que nunca llegaron', () => {
  const nunca = fila({ perfil_id: 'x', etapa: 'R3', f_aceptacion: null });
  assert.equal(grupoDeEtapa(nunca), 'Sin aceptar');
});

test('los cuatro grupos', () => {
  assert.equal(grupoDeEtapa(fila({ perfil_id: 'a', etapa: 'R2' })), 'En cadencia');
  assert.equal(grupoDeEtapa(fila({ perfil_id: 'b', etapa: 'R6' })), 'Fase 2');
  assert.equal(
    grupoDeEtapa(fila({ perfil_id: 'c', situacion: 'esperando_recontacto' })),
    'Recontacto',
  );
  assert.equal(grupoDeEtapa(fila({ perfil_id: 'd', f_aceptacion: null })), 'Sin aceptar');
});

test('el buscador ignora acentos de los DOS lados', () => {
  // La base tiene «Gonçalves» y «Núñez»; quien busca escribe «goncalves».
  const filas = [
    fila({ perfil_id: '1', nombre: 'Lucía Gonçalves' }),
    fila({ perfil_id: '2', nombre: 'Gonzalo Adrián Núñez' }),
    fila({ perfil_id: '3', nombre: 'Otro' }),
  ];
  assert.deepEqual(visibles(filas, 'todas', 'todas', 'goncalves').map((f) => f.perfil_id), ['1']);
  assert.deepEqual(visibles(filas, 'todas', 'todas', 'nunez').map((f) => f.perfil_id), ['2']);
  // Y al reves: escribir con acento tiene que encontrar lo escrito sin el.
  assert.deepEqual(visibles([fila({ perfil_id: '4', nombre: 'Nunez' })], 'todas', 'todas', 'núñez').map((f) => f.perfil_id), ['4']);
});

test('el filtro de cuenta mira TODAS las cuentas del perfil', () => {
  const filas = [fila({ perfil_id: 'a', cuentas: ['AL', 'ED'] }), fila({ perfil_id: 'b', cuentas: ['FR'] })];
  assert.deepEqual(visibles(filas, 'ED', 'todas', '').map((f) => f.perfil_id), ['a']);
});

test('«respondio» se marca en el ULTIMO envio anterior a la respuesta', () => {
  // Repartirla entre todos los anteriores es lo que hace parecer despues que
  // cualquier paso convierte igual.
  const pasos = historial(
    [
      { paso: 'R1', enviado_en: '2026-08-01' },
      { paso: 'R2', enviado_en: '2026-08-10' },
      { paso: 'R3', enviado_en: '2026-08-25' },
    ],
    '2026-08-12',
  );
  assert.deepEqual(pasos.map((p) => p.estado), ['enviado', 'respondió', 'enviado']);
});

test('R0 no entra al historial: no es un mensaje, es la invitacion', () => {
  const pasos = historial(
    [
      { paso: 'R0', enviado_en: '2026-07-01' },
      { paso: 'R1', enviado_en: '2026-08-01' },
      { paso: 'agradecimiento', enviado_en: '2026-08-30' },
    ],
    null,
  );
  assert.deepEqual(pasos.map((p) => p.paso), ['R1']);
});

test('el resumen distingue los cuatro casos', () => {
  const f = fila({ perfil_id: 'a' });
  assert.equal(resumenDeRespuesta({ ...f, f_aceptacion: null }, []), 'nunca aceptó');
  assert.equal(resumenDeRespuesta(f, []), 'sin mensajes aún');
  assert.equal(
    resumenDeRespuesta(f, [{ paso: 'R1', fecha: '2026-08-01', estado: 'enviado' }]),
    'sin respuesta',
  );
  assert.equal(
    resumenDeRespuesta(f, [{ paso: 'R2', fecha: '2026-08-01', estado: 'respondió' }]),
    'respondió en R2',
  );
});

test('§3.12 · un perfil que ninguna cuenta trabajó no es «sin aceptar»', () => {
  // Los 175 contactos del CSV de WhatsApp: están en la base, nadie los invitó.
  // Contarlos como «sin aceptar» diría que les escribimos y nos ignoraron —
  // material quemado — cuando en realidad son material nuevo.
  const f = fila({ perfil_id: 'p1', cuentas: [], etapa: '', situacion: '', f_aceptacion: null });
  assert.equal(grupoDeEtapa(f), 'Sin trabajar');
});

test('§3.12 · con una cuenta y sin aceptación, sí es «sin aceptar»', () => {
  const f = fila({ perfil_id: 'p2', cuentas: ['AL'], etapa: 'R0', situacion: 'en_curso', f_aceptacion: null });
  assert.equal(grupoDeEtapa(f), 'Sin aceptar');
});

test('§3.12 · «sin invitar» y «nunca aceptó» no son lo mismo', () => {
  // Opuestos: uno es material nuevo, el otro es material quemado.
  assert.equal(
    resumenDeRespuesta(fila({ perfil_id: 'p3', cuentas: [], f_aceptacion: null }), []),
    'sin invitar',
  );
  assert.equal(
    resumenDeRespuesta(fila({ perfil_id: 'p4', cuentas: ['AL'], f_aceptacion: null }), []),
    'nunca aceptó',
  );
});
