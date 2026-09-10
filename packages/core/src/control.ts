// Control: proyectos, leads y reuniones en una sola pantalla (§7.11).
//
// POR QUE SE UNIFICO. Control tenia tres solapas —Proyectos, Leads,
// Reuniones— y las tres miraban lo mismo desde angulos distintos. Augusto, el
// 10/09/2026: *«definimos la unificacion entre proyectos, leads y reuniones,
// todo en un solo lugar»*.
//
// Tres solapas obligan a llevar el hilo en la cabeza: uno mira «Reuniones 20»,
// pasa a Leads y no sabe cuales de esos leads son los de esas veinte. Con una
// fila por lead, cada renglon trae su proyecto y sus reuniones al lado y no
// hay nada que cruzar mentalmente.
//
// QUE SE MUESTRA, Y POR QUE NO TODO. *«Nos enfoquemos en mostrar solo leads
// que estan avanzados en los proyectos, para eso son leads que pueden tener la
// etiqueta de Control y listo.»*
//
// La etiqueta es una decision de una persona, no una regla del sistema, y esa
// es exactamente la ventaja: «avanzado» no se puede deducir de la etapa ni de
// la cantidad de reuniones —hay leads con cuatro reuniones que no van a ningun
// lado y leads con una que estan por cerrar—. Lo sabe quien los sigue, y lo
// dice poniendo la etiqueta.
//
// LO QUE ESTO NO CAMBIA. Que un lead lleve la etiqueta no le da permiso a
// nadie para verlo: eso lo sigue decidiendo `loVeElPartner` (§6.3.1), que es
// una regla de permisos. Este filtro es de FOCO, no de acceso, y se aplica
// despues. Confundir los dos seria dejar que poner una etiqueta le muestre a
// un partner leads de la otra casa.

/** El nombre exacto de la etiqueta. Creada el 10/09/2026. */
export const ETIQUETA_CONTROL = 'Control';

/**
 * Si un lead esta marcado para Control.
 *
 * Compara sin distinguir mayusculas ni espacios de sobra: la etiqueta la
 * escribe una persona en un campo libre, y «control» y «Control » son la
 * misma intencion. No se sacan acentos porque la palabra no los tiene y
 * hacerlo invitaria a que «Contról» pase, que ya seria otra etiqueta.
 */
export function esDeControl(etiquetas: readonly string[]): boolean {
  const objetivo = ETIQUETA_CONTROL.toLowerCase();
  return etiquetas.some((e) => String(e ?? '').trim().toLowerCase() === objetivo);
}

/** Lo minimo que necesita una fila para armarse. El resto lo pone la pantalla. */
export interface LeadParaControl {
  id: string;
  etiquetas: readonly string[];
  /** Cuantas reuniones tiene, ya contadas. */
  reuniones: number;
  /** La ultima que ocurrio, en ISO corto, o null. */
  ultima: string | null;
  /** El id del proyecto abierto, si alguien lo abrio. */
  proyecto: string | null;
}

/**
 * Los leads que entran en Control: los que llevan la etiqueta.
 *
 * NO ordena ni recorta: eso lo decide la pantalla. Acá solo se contesta
 * «cuales».
 */
export function leadsDeControl<T extends LeadParaControl>(leads: readonly T[]): T[] {
  return leads.filter((l) => esDeControl(l.etiquetas));
}

export interface ResumenDeControl {
  /** Cuantos leads estan marcados. */
  leads: number;
  /** De esos, cuantos tienen un proyecto abierto. */
  conProyecto: number;
  /** De esos, cuantos NO lo tienen. Es el numero que dice que falta hacer. */
  sinProyecto: number;
  /** El total de reuniones de esos leads. */
  reuniones: number;
  /** Cuantos no tuvieron ninguna reunion todavia. */
  sinReuniones: number;
  /** La reunion mas reciente de todo el conjunto, o null. */
  ultima: string | null;
}

/**
 * El resumen de arriba de la pantalla.
 *
 * SE CALCULA SOBRE LOS LEADS MARCADOS, no sobre la base entera, y ese es el
 * cambio que importa. El contador viejo de Control decia «Reuniones 20» y esas
 * veinte eran todas las reuniones de las cuentas de esa linea —incluidas las
 * de leads que nadie sigue y las que nadie confirmo si ocurrieron—, asi que el
 * numero no medía avance comercial: medía cuanto se agendo alguna vez.
 *
 * `sinProyecto` y `sinReuniones` estan a proposito: un resumen que solo cuenta
 * lo que hay se lee como si estuviera todo bien. Lo que falta es la mitad del
 * dato.
 */
export function resumenDeControl(leads: readonly LeadParaControl[]): ResumenDeControl {
  let conProyecto = 0;
  let reuniones = 0;
  let sinReuniones = 0;
  let ultima: string | null = null;

  for (const l of leads) {
    if (l.proyecto) conProyecto++;
    reuniones += l.reuniones;
    if (!l.reuniones) sinReuniones++;
    if (l.ultima && (!ultima || l.ultima > ultima)) ultima = l.ultima;
  }

  return {
    leads: leads.length,
    conProyecto,
    sinProyecto: leads.length - conProyecto,
    reuniones,
    sinReuniones,
    ultima,
  };
}

/**
 * El orden de la pantalla: primero lo que se movio hace mas.
 *
 * Al reves de lo que uno esperaria. En una lista de seguimiento, el que tuvo
 * una reunion ayer no necesita nada; el que no se toca hace dos meses es el
 * que se esta enfriando. Poner arriba lo reciente deja lo urgente al final,
 * que es donde nadie mira.
 *
 * Los que nunca tuvieron reunion van PRIMEROS: son los que estan marcados como
 * avanzados y todavia no arrancaron, o sea la contradiccion mas visible de la
 * pantalla.
 */
export function porAtencion<T extends LeadParaControl>(leads: readonly T[]): T[] {
  return [...leads].sort((a, b) => {
    if (!a.ultima && !b.ultima) return 0;
    if (!a.ultima) return -1;
    if (!b.ultima) return 1;
    return a.ultima.localeCompare(b.ultima);
  });
}
