// Tareas (§3.7). Independientes del lead: una tarea puede no tener ninguno.
//
// Es la lista de pendientes del equipo, no un pipeline. Por eso no hay estados
// ni flujo: una tarea está hecha o no lo está, tiene una prioridad y puede
// vencer.

export interface Tarea {
  id: string;
  nombre: string;
  /** 1 a 5. Se muestra con estrellas. */
  prioridad: number;
  inicio?: string | null;
  fin?: string | null;
  notas?: string;
  notificar?: boolean;
  hecha?: boolean;
}

export type FiltroTarea = 'Abiertas' | 'Vencidas' | 'Todas';
export type ClaveOrden = 'vencimiento' | 'prioridad' | 'inicio';

export const FILTROS: FiltroTarea[] = ['Abiertas', 'Vencidas', 'Todas'];
export const ESTRELLAS = [1, 2, 3, 4, 5];

/** El valor de arranque de una tarea nueva: el medio de la escala. */
export const PRIORIDAD_POR_DEFECTO = 3;

function soloFecha(v: string | null | undefined): string {
  return String(v ?? '').slice(0, 10);
}

/** Venció si tiene fecha, ya pasó, y no está hecha. */
export function estaVencida(t: Tarea, hoy: string): boolean {
  const fin = soloFecha(t.fin);
  return Boolean(!t.hecha && fin && fin < soloFecha(hoy));
}

/** Vence hoy: es lo que se cuenta aparte en la cabecera. */
export function venceHoy(t: Tarea, hoy: string): boolean {
  return Boolean(!t.hecha && soloFecha(t.fin) === soloFecha(hoy));
}

/**
 * Las tareas que se ven, filtradas y ordenadas.
 *
 * DOS COSAS QUE NO SON OBVIAS:
 *
 * 1. Las hechas van SIEMPRE al fondo, sin importar el orden elegido. Una tarea
 *    terminada no compite por la atención con una pendiente, aunque venciera
 *    antes.
 *
 * 2. El orden es COMBINABLE y respeta el orden en que se eligieron las claves:
 *    tocar «prioridad» y después «vencimiento» ordena por prioridad y desempata
 *    por fecha. Es una lista, no un solo criterio, porque «lo más urgente de lo
 *    más importante» necesita los dos y elegir uno solo obliga a mirar la
 *    lista entera igual.
 *
 * El filtro «Vencidas» incluye las que vencen HOY (`<=`), no solo las
 * atrasadas: hoy todavía se pueden hacer, y esconderlas hasta mañana es la
 * forma más segura de que no se hagan.
 */
export function visibles(
  tareas: Tarea[],
  filtro: FiltroTarea,
  orden: ClaveOrden[],
  hoy: string,
): Tarea[] {
  let lista = tareas.slice();
  if (filtro === 'Abiertas') lista = lista.filter((t) => !t.hecha);
  if (filtro === 'Vencidas') {
    lista = lista.filter((t) => !t.hecha && soloFecha(t.fin) && soloFecha(t.fin) <= soloFecha(hoy));
  }

  return lista.sort((a, b) => {
    if (Boolean(a.hecha) !== Boolean(b.hecha)) return a.hecha ? 1 : -1;

    for (const clave of orden) {
      if (clave === 'vencimiento') {
        // Sin fecha va al final: no tener plazo no es lo mismo que ser urgente.
        const x = soloFecha(a.fin) || '9999';
        const y = soloFecha(b.fin) || '9999';
        if (x !== y) return x.localeCompare(y);
      }
      if (clave === 'prioridad' && a.prioridad !== b.prioridad) {
        return (b.prioridad ?? 0) - (a.prioridad ?? 0);
      }
      if (clave === 'inicio') {
        const x = soloFecha(a.inicio) || '9999';
        const y = soloFecha(b.inicio) || '9999';
        if (x !== y) return x.localeCompare(y);
      }
    }
    return 0;
  });
}

/** Prender y apagar una clave, conservando el orden en que se eligieron. */
export function alternarOrden(orden: ClaveOrden[], clave: ClaveOrden): ClaveOrden[] {
  return orden.includes(clave) ? orden.filter((o) => o !== clave) : [...orden, clave];
}
