// Los filtros de tres estados de la lista (§7.2).
//
// Un filtro que sólo prende y apaga contesta una pregunta: «mostrame los que
// tienen WhatsApp». La otra mitad del trabajo es la contraria —«mostrame los
// que NO tienen, para cargarles el teléfono»— y con dos estados hay que abrir
// el popover de filtros para eso.
//
// Tres estados en el mismo botón: un toque filtra, dos excluyen, tres vuelven a
// todos. Es el mismo patrón que ya usa el check de la agenda (§7.6, «una caja
// sin texto en tres estados») y el de Tareas, así que no es un gesto nuevo que
// haya que aprender.

export type TresEstados = 'todos' | 'con' | 'sin';

/** El orden del ciclo: todos → con → sin → todos. */
export const CICLO: TresEstados[] = ['todos', 'con', 'sin'];

/**
 * El estado que sigue al tocar el botón.
 *
 * «Con» va antes que «sin» porque es lo que se busca nueve de cada diez veces:
 * a quién le puedo escribir por WhatsApp. Excluirlos es el caso de limpieza de
 * datos, y va después.
 */
export function siguienteEstado(actual: TresEstados): TresEstados {
  const i = CICLO.indexOf(actual);
  return CICLO[(i + 1) % CICLO.length]!;
}

/** Si un ítem pasa el filtro. `todos` deja pasar todo. */
export function pasaElFiltro(estado: TresEstados, tiene: boolean): boolean {
  if (estado === 'con') return tiene;
  if (estado === 'sin') return !tiene;
  return true;
}

/** Qué decir en el `title` del botón, para que el próximo toque no sorprenda. */
export function tituloDelFiltro(
  estado: TresEstados,
  que: string,
): string {
  if (estado === 'con') return `Sólo los que tienen ${que} · tocá para ver los que no`;
  if (estado === 'sin') return `Sólo los que NO tienen ${que} · tocá para quitar el filtro`;
  return `Filtrar por ${que}`;
}
