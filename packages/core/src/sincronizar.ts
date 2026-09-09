import type { EstadoReunion } from './reunion.ts';

/**
 * La vuelta: qué le pasa a una reunión cuando su evento cambió en Google (§8.3).
 *
 * Hasta el 09/09/2026 la sincronización era de una sola dirección. El CRM
 * escribía en Google y ahí terminaba: si alguien movía la reunión desde el
 * celular —que es donde uno la mueve cuando el cliente pide correrla— el CRM
 * seguía mostrando el horario viejo, y la agenda quedaba diciendo algo falso
 * sin que nadie pudiera notarlo desde adentro.
 *
 * ESTO ES UNA REGLA, NO PLOMERÍA. Decidir que un evento borrado en Google
 * significa «cancelada», que un evento sin hora no toca nada, y sobre todo
 * CUÁNDO NO HAY CAMBIO, es política: si se equivoca hacia el lado de «cambió»,
 * el hook reescribe el evento en Google y **le manda un mail al lead cada cinco
 * minutos**. Por eso vive acá, con sus tests, y no adentro del hook.
 */

/** Lo que el CRM tiene guardado de la reunión. */
export interface ReunionGuardada {
  /** Como lo guarda PocketBase: `2026-09-15 16:00:00.000Z`. */
  inicio: string;
  duracion_min: number;
  estado: EstadoReunion;
}

/** Lo que vuelve de Google, ya desarmado. */
export interface EventoDeGoogle {
  /** `status: "cancelled"`, o el evento ya no está. */
  cancelado?: boolean;
  /** `start.dateTime`. Vacío en los eventos de día entero. */
  inicio?: string | null;
  /** `end.dateTime`. */
  fin?: string | null;
}

export interface CambioDeGoogle {
  hay: boolean;
  /** Sólo los campos que de verdad cambiaron. */
  campos: { inicio?: string; duracion_min?: number; estado?: EstadoReunion };
  /** Para dejar escrito en `sync_detalle` por qué se tocó, o por qué no. */
  motivo: string;
}

const SIN_CAMBIO = (motivo: string): CambioDeGoogle => ({ hay: false, campos: {}, motivo });

/** El instante, en milisegundos. Acepta el formato de PocketBase y el de Google. */
function instante(x: string): number {
  return new Date(String(x).replace(' ', 'T')).getTime();
}

/** De vuelta al formato en que PocketBase guarda las fechas. */
function comoLoGuardaPocketBase(ms: number): string {
  return new Date(ms).toISOString().replace('T', ' ');
}

/**
 * Qué hay que escribir en la reunión, si es que hay algo.
 *
 * Devuelve `hay: false` en cuanto puede. Eso no es una optimización: cada
 * escritura vuelve a disparar el envío hacia Google, y Google le avisa al
 * invitado. Un falso positivo acá es un mail de más en la casilla de un lead.
 */
export function cambioDeGoogle(crm: ReunionGuardada, evento: EventoDeGoogle): CambioDeGoogle {
  if (evento.cancelado) {
    // Ya está cancelada: no hay nada que hacer, y volver a escribirla la
    // marcaría como modificada cada vez que pasa el reloj.
    if (crm.estado === 'cancelada') return SIN_CAMBIO('ya estaba cancelada');
    return { hay: true, campos: { estado: 'cancelada' }, motivo: 'cancelada en Google Calendar' };
  }

  // Día entero: no es una reunión con horario. Google los devuelve con `date`
  // en vez de `dateTime`, y tomarlos como reunión pondría todas a medianoche.
  if (!evento.inicio || !evento.fin) return SIN_CAMBIO('el evento no tiene horario');

  const desde = instante(evento.inicio);
  const hasta = instante(evento.fin);
  if (!Number.isFinite(desde) || !Number.isFinite(hasta)) {
    return SIN_CAMBIO('el evento vino con una fecha ilegible');
  }

  const duracion = Math.round((hasta - desde) / 60000);
  // Un evento que termina antes de empezar es dato roto. Antes que escribir una
  // duración negativa —que en la agenda se dibuja como un bloque invertido— se
  // deja como está y queda anotado.
  if (duracion <= 0) return SIN_CAMBIO('el evento termina antes de empezar');

  const campos: CambioDeGoogle['campos'] = {};
  if (instante(crm.inicio) !== desde) campos.inicio = comoLoGuardaPocketBase(desde);
  if (crm.duracion_min !== duracion) campos.duracion_min = duracion;

  // La comparación es por INSTANTE, no por texto. La misma hora escrita como
  // `2026-09-15 16:00:00.000Z` y como `2026-09-15T10:00:00-06:00` es la misma
  // hora, y compararlas como strings las haría distintas siempre: cada vuelta
  // del reloj reescribiría la reunión y le mandaría un aviso al lead.
  if (!campos.inicio && campos.duracion_min === undefined) {
    return SIN_CAMBIO('sin cambios');
  }

  const partes: string[] = [];
  if (campos.inicio) partes.push('movida');
  if (campos.duracion_min !== undefined) partes.push(`${campos.duracion_min} min`);
  return { hay: true, campos, motivo: `${partes.join(', ')} desde Google Calendar` };
}

/**
 * Una reunión cancelada en el CRM NO se resucita porque el evento siga vivo en
 * Google.
 *
 * Cancelar es una decisión que se toma en el CRM y que hoy, a propósito, no
 * borra el evento de Google (el hook de salida no mira `estado`). Así que el
 * evento sigue ahí y cada vuelta del reloj lo va a encontrar vivo. Si eso
 * reactivara la reunión, cancelar sería imposible: se descancelaría sola a los
 * cinco minutos.
 */
export function seRespetaLaCancelacionDelCrm(crm: ReunionGuardada, cambio: CambioDeGoogle): boolean {
  return !(crm.estado === 'cancelada' && cambio.hay);
}
