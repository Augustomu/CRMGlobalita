import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cambioDeGoogle, seRespetaLaCancelacionDelCrm } from '../src/sincronizar.ts';

/** Una reunión del CRM: 15/09/2026 16:00 UTC, media hora, pendiente. */
const guardada = {
  inicio: '2026-09-15 16:00:00.000Z',
  duracion_min: 30,
  estado: 'pendiente' as const,
};

// -------------------------------------------------- §8.3: no hay cambio

test('el mismo horario escrito con offset NO es un cambio', () => {
  // Éste es el test que importa. Google devuelve `2026-09-15T10:00:00-06:00`,
  // que es exactamente la misma hora que `2026-09-15 16:00:00.000Z`. Si se
  // compararan como texto, cada vuelta del reloj reescribiría la reunión, y
  // cada reescritura le manda un mail al lead.
  const r = cambioDeGoogle(guardada, {
    inicio: '2026-09-15T10:00:00-06:00',
    fin: '2026-09-15T10:30:00-06:00',
  });
  assert.equal(r.hay, false);
  assert.equal(r.motivo, 'sin cambios');
});

test('un evento de día entero no toca nada', () => {
  // Google los manda con `date` en vez de `dateTime`: sin hora. Tomarlos como
  // reunión pondría todas a medianoche.
  const r = cambioDeGoogle(guardada, { inicio: null, fin: null });
  assert.equal(r.hay, false);
  assert.equal(r.motivo, 'el evento no tiene horario');
});

test('un evento que termina antes de empezar se deja como está', () => {
  const r = cambioDeGoogle(guardada, {
    inicio: '2026-09-15T10:00:00-06:00',
    fin: '2026-09-15T09:00:00-06:00',
  });
  assert.equal(r.hay, false);
  assert.equal(r.motivo, 'el evento termina antes de empezar');
});

// -------------------------------------------------- §8.3: sí hay cambio

test('mover el evento en Google mueve la reunión en el CRM', () => {
  const r = cambioDeGoogle(guardada, {
    inicio: '2026-09-16T10:00:00-06:00',
    fin: '2026-09-16T10:30:00-06:00',
  });
  assert.equal(r.hay, true);
  assert.equal(r.campos.inicio, '2026-09-16 16:00:00.000Z');
  assert.equal(r.campos.duracion_min, undefined);
  assert.match(r.motivo, /movida/);
});

test('estirar el evento en Google cambia sólo la duración', () => {
  const r = cambioDeGoogle(guardada, {
    inicio: '2026-09-15T10:00:00-06:00',
    fin: '2026-09-15T11:00:00-06:00',
  });
  assert.equal(r.hay, true);
  assert.equal(r.campos.inicio, undefined);
  assert.equal(r.campos.duracion_min, 60);
});

test('borrar el evento en Google cancela la reunión', () => {
  const r = cambioDeGoogle(guardada, { cancelado: true });
  assert.equal(r.hay, true);
  assert.equal(r.campos.estado, 'cancelada');
});

test('un evento ya cancelado no se vuelve a escribir', () => {
  const r = cambioDeGoogle({ ...guardada, estado: 'cancelada' }, { cancelado: true });
  assert.equal(r.hay, false);
  assert.equal(r.motivo, 'ya estaba cancelada');
});

// -------------------------------------------------- la cancelación del CRM

test('una reunión cancelada en el CRM no se resucita porque el evento siga vivo', () => {
  // Cancelar en el CRM no borra el evento de Google, así que el reloj lo va a
  // encontrar vivo cada vez. Si eso reactivara la reunión, cancelar sería
  // imposible: se descancelaría sola a los cinco minutos.
  const cancelada = { ...guardada, estado: 'cancelada' as const };
  const cambio = cambioDeGoogle(cancelada, {
    inicio: '2026-09-16T10:00:00-06:00',
    fin: '2026-09-16T10:30:00-06:00',
  });
  assert.equal(cambio.hay, true);
  assert.equal(seRespetaLaCancelacionDelCrm(cancelada, cambio), false);
});

test('una reunión pendiente sí acepta el cambio', () => {
  const cambio = cambioDeGoogle(guardada, {
    inicio: '2026-09-16T10:00:00-06:00',
    fin: '2026-09-16T10:30:00-06:00',
  });
  assert.equal(seRespetaLaCancelacionDelCrm(guardada, cambio), true);
});
