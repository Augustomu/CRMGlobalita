// Qué ve un partner (§7.11 y la conversación del 08/09).
//
// Un partner es alguien de AFUERA del equipo de prospección que sigue una de
// las dos empresas propias: el socio de IT mira Globalita, el de inversiones
// mira Seng. Entra solo a Control, y ahí ve tres cosas: las reuniones, las
// estadísticas y la lista de leads que confirmaron interés.
//
// LA CONFIRMACIÓN ES UNA ETIQUETA, NO UN ESTADO NI UN PROYECTO.
//
// Se decidió así porque etiquetar es un acto liviano que el equipo ya hace
// todos los días, y abrir un proyecto es un trámite. Un lead puede confirmar
// interés en una llamada del martes y que el proyecto se abra la semana
// siguiente; el partner tiene que verlo el martes.
//
// La contra, y por eso las etiquetas de esta lista van PROTEGIDAS: son de
// catálogo libre, así que renombrar «PIV» a «Piv» vaciaría la vista de un
// partner sin que nadie se entere. No se pueden renombrar ni borrar.

import type { Casa } from './proyecto.ts';

/**
 * Las etiquetas que marcan interés confirmado, por empresa propia.
 *
 * Calzan una a una con los tipos de proyecto (§3.13.1): no son un vocabulario
 * nuevo, son el mismo dicho antes de que el proyecto exista.
 */
export const ETIQUETAS_DE_CASA: Record<Casa, string[]> = {
  globalita: ['PIV', 'Parcería'],
  seng: ['Inversión'],
};

/** Todas, para crearlas y protegerlas de una. */
export const ETIQUETAS_PARTNER: string[] = [
  ...ETIQUETAS_DE_CASA.globalita,
  ...ETIQUETAS_DE_CASA.seng,
];

const MARCAS = new RegExp('[\\u0300-\\u036f]', 'g');

/**
 * Compara sin acentos y sin mayúsculas.
 *
 * Sin esto, «Parcería» y «Parceria» son dos etiquetas distintas y el partner
 * ve la mitad de lo que tendría que ver. Es el mismo problema que ya apareció
 * en el buscador de la base compartida, y acá cuesta más caro: allá el usuario
 * reintenta escribiendo distinto, acá no se entera de que falta algo.
 *
 * OJO: `normalize('NFD')` no funciona en el goja de PocketBase —no falla,
 * devuelve el texto igual—. Si esto se usa desde un hook, hace falta la tabla
 * explícita de `pb_seed/1788600100_demo.js`.
 */
function norm(s: string): string {
  return String(s ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(MARCAS, '');
}

/** A qué casa pertenece una etiqueta, o `null` si no es de las de partner. */
export function casaDeEtiqueta(nombre: string): Casa | null {
  const n = norm(nombre);
  for (const casa of Object.keys(ETIQUETAS_DE_CASA) as Casa[]) {
    if (ETIQUETAS_DE_CASA[casa].some((e) => norm(e) === n)) return casa;
  }
  return null;
}

/** Si esta etiqueta no se puede renombrar ni borrar. */
export function estaProtegida(nombre: string): boolean {
  return casaDeEtiqueta(nombre) !== null;
}

export interface LeadDelPartner {
  id: string;
  /** Los nombres de las etiquetas aplicadas. */
  etiquetas: string[];
}

/**
 * Si un lead entra en la vista de un partner de esa casa.
 *
 * Alcanza con UNA etiqueta de la casa. Un lead con `PIV` y con `Inversión`
 * —pasa: primero les íbamos a vender y después quisieron capital— se le
 * muestra a los dos partners, y está bien: los dos tienen algo que seguir ahí.
 */
export function loVeElPartner(lead: LeadDelPartner, casa: Casa): boolean {
  return lead.etiquetas.some((e) => casaDeEtiqueta(e) === casa);
}

/** Los leads que confirmaron interés en esa casa. */
export function leadsDelPartner<T extends LeadDelPartner>(leads: T[], casa: Casa): T[] {
  return leads.filter((l) => loVeElPartner(l, casa));
}

/**
 * Qué etiqueta de la casa tiene puesta, para mostrarla en la fila.
 *
 * Devuelve todas y no la primera: si un lead es `PIV` y `Parcería` a la vez, el
 * partner tiene que ver las dos — son dos trabajos distintos con la misma
 * persona, no uno.
 */
export function etiquetasDeLaCasa(lead: LeadDelPartner, casa: Casa): string[] {
  return lead.etiquetas.filter((e) => casaDeEtiqueta(e) === casa);
}
