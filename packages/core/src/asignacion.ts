// Asignar leads en lote (§7.8, panel «Asignar en lote»).
//
// Existe porque repartir una base de mil leads de a uno no es trabajo, es una
// tarde perdida. El panel filtra, muestra una tanda, y asigna todo lo que
// coincide de una.

export interface LeadAsignable {
  id: string;
  nombre: string;
  empresa: string;
  cargo: string;
  ciudad: string;
  pais: string;
  industria: string;
  cuenta: string;
  asignado: string;
}

export interface FiltroLote {
  cuenta: string;
  pais: string[];
  ciudad: string[];
  industria: string[];
  busqueda: string;
}

export const FILTRO_VACIO: FiltroLote = {
  cuenta: 'todas',
  pais: [],
  ciudad: [],
  industria: [],
  busqueda: '',
};

/**
 * Cuántas filas se dibujan.
 *
 * No es un límite de la selección: es un límite del DIBUJO. Con 1.500 leads
 * coincidiendo, pintar mil quinientas filas para que alguien apriete
 * «seleccionar todos» es trabajo que el navegador hace para nada.
 */
export const TOPE_VISIBLE = 40;

export function hayFiltros(f: FiltroLote): boolean {
  return (
    f.cuenta !== 'todas' ||
    f.pais.length > 0 ||
    f.ciudad.length > 0 ||
    f.industria.length > 0 ||
    f.busqueda.trim().length > 0
  );
}

function texto(l: LeadAsignable): string {
  return `${l.nombre} ${l.empresa} ${l.cargo}`.toLowerCase();
}

/**
 * Los que pasan el filtro.
 *
 * Una lista de valores vacía significa «todos», no «ninguno». Es lo contrario
 * de lo intuitivo al escribirlo, pero es lo intuitivo al usarlo: no elegir
 * ningún país es no filtrar por país.
 */
export function coinciden(leads: LeadAsignable[], f: FiltroLote): LeadAsignable[] {
  const q = f.busqueda.trim().toLowerCase();
  return leads.filter((l) => {
    if (f.cuenta !== 'todas' && l.cuenta !== f.cuenta) return false;
    if (f.pais.length && !f.pais.includes(l.pais)) return false;
    if (f.ciudad.length && !f.ciudad.includes(l.ciudad)) return false;
    if (f.industria.length && !f.industria.includes(l.industria)) return false;
    if (q && !texto(l).includes(q)) return false;
    return true;
  });
}

/**
 * Los ids que «seleccionar todos» tiene que marcar.
 *
 * TODOS LOS QUE COINCIDEN, no los que se están viendo. Si marcara solo los 40
 * visibles, el botón que dice «seleccionar los 380» estaría asignando 40 —y
 * nadie se daría cuenta hasta contar los que quedaron sin repartir.
 */
export function todosLosQueCoinciden(leads: LeadAsignable[], f: FiltroLote): string[] {
  return coinciden(leads, f).map((l) => l.id);
}

/** Las opciones de un filtro, sacadas de los datos y sin repetir. */
export function opcionesDe(leads: LeadAsignable[], campo: 'pais' | 'ciudad' | 'industria'): string[] {
  return [...new Set(leads.map((l) => (l[campo] ?? '').trim()).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b),
  );
}

/**
 * La selección, limpiada de lo que ya no coincide.
 *
 * Cambiar un filtro con cosas seleccionadas deja ids que ya no están en
 * pantalla. Asignarlos igual es asignar a ciegas: el usuario ve 12
 * seleccionados, la lista muestra otros, y se reparte lo que nadie miró.
 */
export function seleccionValida(seleccion: string[], leads: LeadAsignable[], f: FiltroLote): string[] {
  const validos = new Set(todosLosQueCoinciden(leads, f));
  return seleccion.filter((id) => validos.has(id));
}

/** «180 leads en la base · 12 ya son de Sofía» */
export function resumenDeLote(leads: LeadAsignable[], f: FiltroLote, usuarioId: string, nombre: string): string {
  const yaSuyos = coinciden(leads, f).filter((l) => l.asignado === usuarioId).length;
  const primerNombre = nombre.split(' ')[0] || 'este usuario';
  return `${leads.length} leads en la base · ${yaSuyos} ya ${yaSuyos === 1 ? 'es' : 'son'} de ${primerNombre}`;
}

export interface FilaReparto {
  cuenta: string;
  cuantos: number;
}

/**
 * Cuántos leads de cada cuenta tiene un usuario (§7.8).
 *
 * Importa porque el reparto no debería dejar a alguien con los leads de una
 * sola cuenta: si esa sesión se cae, esa persona se queda sin trabajo.
 */
export function repartoPorCuenta(leads: LeadAsignable[], usuarioId: string): FilaReparto[] {
  const cuenta = new Map<string, number>();
  for (const l of leads) {
    if (l.asignado !== usuarioId) continue;
    const c = l.cuenta || '—';
    cuenta.set(c, (cuenta.get(c) ?? 0) + 1);
  }
  return [...cuenta.entries()]
    .map(([c, n]) => ({ cuenta: c, cuantos: n }))
    .sort((a, b) => b.cuantos - a.cuantos || a.cuenta.localeCompare(b.cuenta));
}
