// Etiquetas: cuáles se ofrecen a mano y cuáles se pueden sacar.
//
// Cambios 8 y 9 del documento de diseño: mostrar las seis usadas más
// recientemente, clickeables para aplicar rápido, y una × en cada aplicada.
//
// POR QUE SEIS Y NO EL CATALOGO ENTERO. El catálogo crece sin techo —es libre
// (D04)— y con veinte etiquetas la fila ocupa media pantalla y deja de ser un
// atajo. Seis entran en un renglón y cubren el uso real: en una tanda de
// prospección se repiten las mismas tres o cuatro.

export interface Etiqueta {
  id: string;
  nombre: string;
  /** Las pone el sistema (D04): no se ofrecen para aplicar a mano. */
  del_sistema?: boolean;
  /** Cuándo se aplicó por última vez a algún lead. Vacío = nunca. */
  usada_en?: string | null;
}

/** Cuántas se ofrecen. Es del documento de diseño, no una elección técnica. */
export const CUANTAS_RECIENTES = 6;

/**
 * Las que se ofrecen para aplicar de un clic.
 *
 * Se excluyen tres grupos, cada uno por una razón distinta:
 *
 *   · las YA APLICADAS, porque el atajo es para poner, no para repetir;
 *   · las DEL SISTEMA, porque las pone la cadencia y ponerlas a mano deja el
 *     lead diciendo algo que no pasó (D04);
 *   · las NUNCA USADAS, porque sin fecha no hay forma de ordenarlas y
 *     llenarían la fila con lo que nadie eligió.
 *
 * El orden es por uso más reciente; a igualdad de fecha, alfabético, para que
 * la fila no baile entre renders.
 */
export function recientes(
  catalogo: Etiqueta[],
  aplicadas: string[],
  cuantas: number = CUANTAS_RECIENTES,
): Etiqueta[] {
  const puestas = new Set(aplicadas);
  return catalogo
    .filter((e) => !puestas.has(e.id) && !e.del_sistema && Boolean(e.usada_en))
    .sort((a, b) => {
      const fecha = String(b.usada_en).localeCompare(String(a.usada_en));
      return fecha !== 0 ? fecha : a.nombre.localeCompare(b.nombre);
    })
    .slice(0, cuantas);
}

/**
 * Si esta etiqueta se puede sacar a mano.
 *
 * Las del sistema no: las pone la cadencia y las vuelve a poner en el próximo
 * envío, así que la × sería un botón que no hace nada. La ×, entonces, no se
 * dibuja — es la única forma de que el botón no mienta.
 */
export function sePuedeSacar(etiqueta: Etiqueta): boolean {
  return !etiqueta.del_sistema;
}

/**
 * Si se puede renombrar o borrar del catálogo.
 *
 * Las del sistema no: su nombre está escrito en el código que las aplica
 * («Recordatorio», «Fase 2»). Renombrarlas dejaría la cadencia buscando una
 * etiqueta que ya no existe y creando una nueva con el nombre viejo en el
 * próximo envío.
 */
export function sePuedeRenombrar(etiqueta: Etiqueta): boolean {
  return !etiqueta.del_sistema;
}

/**
 * Si el nombre está libre en el catálogo.
 *
 * Compara sin distinguir mayúsculas ni espacios de sobra: «caliente»,
 * «Caliente» y «Caliente » son la misma etiqueta para quien la lee, y tener
 * las tres convierte el filtro por etiqueta en tres filtros que no se cruzan.
 */
export function nombreDisponible(catalogo: Etiqueta[], nombre: string, exceptoId?: string): boolean {
  const n = nombre.trim().toLowerCase();
  if (!n) return false;
  return !catalogo.some((e) => e.id !== exceptoId && e.nombre.trim().toLowerCase() === n);
}

/** El catálogo ordenado por uso más reciente, que es como se lee el panel. */
export function porUltimoUso(catalogo: Etiqueta[]): Etiqueta[] {
  return catalogo.slice().sort((a, b) => {
    const fecha = String(b.usada_en ?? '').localeCompare(String(a.usada_en ?? ''));
    return fecha !== 0 ? fecha : a.nombre.localeCompare(b.nombre);
  });
}

/** Cuántas etiquetas entran en una fila de la lista antes de tapar el nombre. */
export const ETIQUETAS_EN_LA_FILA = 2;

export interface EtiquetasDeLaFila {
  /** Las que se dibujan, en orden. */
  visibles: string[];
  /** Las que no entraron: van en el hover, no se pierden. */
  ocultas: string[];
}

/**
 * Qué etiquetas se ven en la fila de la lista (§7.2).
 *
 * Augusto pidió dos cosas juntas: que lo que no entra se vea al pasar por
 * encima, y **poder elegir cuáles se muestran y en qué orden**. Sin lo segundo,
 * el criterio lo decide el orden en que alguien las cargó, que no tiene nada
 * que ver con cuál importa: en una fila con `Frío`, `Recordatorio` y
 * `Caliente`, la que hay que ver es la última.
 *
 * `preferidas` es la lista ordenada que eligió el usuario. Las que están en
 * ella van primero y en ese orden; el resto conserva el orden del lead. Una
 * preferida que este lead no tiene, simplemente no aparece — no deja un hueco.
 */
export function etiquetasDeLaFila(
  delLead: string[],
  preferidas: string[] = [],
  cuantas: number = ETIQUETAS_EN_LA_FILA,
): EtiquetasDeLaFila {
  const tiene = delLead.filter(Boolean);
  const primero = preferidas.filter((p) => tiene.includes(p));
  const resto = tiene.filter((t) => !primero.includes(t));
  const orden = [...primero, ...resto];
  return { visibles: orden.slice(0, cuantas), ocultas: orden.slice(cuantas) };
}
