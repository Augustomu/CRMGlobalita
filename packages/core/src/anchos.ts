// Los anchos de los paneles arrastrables (§9.4, también transversal §11).
//
// No es una comodidad: la pantalla objetivo es una laptop de 14" y las tres
// columnas no entran cómodas al mismo tiempo. Quien está importando un CSV
// quiere la lista ancha; quien está agendando quiere la agenda ancha. Sin poder
// correr el divisor, siempre hay una de las dos tareas incómoda.

export interface Panel {
  /** Dónde se guarda. La clave viene del prototipo, para no perder lo elegido. */
  clave: string;
  min: number;
  max: number;
  /** A qué ancho lleva el doble clic. */
  normal: number;
  /**
   * Hacia dónde crece al arrastrar. El divisor de la columna 1 está a su
   * derecha, así que mover el mouse a la derecha la ensancha; los de las
   * sidebars están a su izquierda y es al revés.
   */
  signo: 1 | -1;
}

export const COLUMNA_LISTA: Panel = { clave: 'om.anchoCol1', min: 260, max: 520, normal: 340, signo: 1 };
export const PANEL_AGENDA: Panel = { clave: 'om.anchoAgenda', min: 340, max: 900, normal: 560, signo: -1 };
export const PANEL_REPOSITORIO: Panel = { clave: 'om.anchoRepo', min: 300, max: 620, normal: 400, signo: -1 };

/** El ancho que resulta de arrastrar, ya recortado a los límites del panel. */
export function anchoArrastrado(panel: Panel, anchoInicial: number, deltaX: number): number {
  return Math.round(Math.max(panel.min, Math.min(panel.max, anchoInicial + panel.signo * deltaX)));
}

/**
 * A qué ancho lleva el doble clic.
 *
 * La columna 1 ALTERNA entre compacto (260) y normal (340) — es la que se usa
 * de las dos maneras a lo largo del día. Las sidebars simplemente vuelven a su
 * ancho normal: no tienen un modo compacto que valga la pena.
 */
export function anchoDeDobleClic(panel: Panel, actual: number): number {
  if (panel !== COLUMNA_LISTA) return panel.normal;
  return actual > 300 ? panel.min : panel.normal;
}

/** Lo guardado, si es un número y está dentro de los límites. */
export function anchoGuardado(panel: Panel, crudo: string | null): number | null {
  const n = parseInt(String(crudo ?? ''), 10);
  return Number.isFinite(n) && n >= panel.min && n <= panel.max ? n : null;
}
