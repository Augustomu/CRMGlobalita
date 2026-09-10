// Cómo buscan los buscadores del CRM (§7.2, §7.5, panel de partner).
//
// La base es latinoamericana y está llena de tildes y cedillas: Lucía Gonçalves,
// María Fernández Villagrán, Amílcar Sitoe, Fábio Menezes. Escribir el acento
// obliga a saber de antemano cómo está cargado el nombre, que es justo lo que
// uno va a buscar porque no lo sabe. Buscar «Lucia» tiene que traer a «Lucía».
//
// La regla estaba escrita una vez —en la Base compartida— y las otras dos
// pantallas comparaban en crudo, así que el mismo texto encontraba cosas
// distintas según en qué columna se lo escribiera.
//
// 09/09/2026 · LA BÚSQUEDA COMPUESTA. Augusto la pidió así: *«pongo Martín,
// enter, me crea el chip; pongo Josefina, me crea el chip, y así va haciendo
// filtros con muchas palabras»*, *«cuando busco con un teléfono no me importa
// que tenga espacios ni el número de adelante»*, y *«cualquier información
// dentro de ese lead, si le pongo algo que anoté en las notas o una etiqueta,
// me busca los leads que tienen esa información adentro — como Google Drive»*.
//
// Tres decisiones, y las tres están acá y no en la pantalla:
//
//   1. LOS CHIPS SE ACUMULAN CON «Y», no con «o». Cada uno achica. Es lo que
//      significa «filtro» y es lo que hace Drive. Decidido por Augusto el
//      09/09 sabiendo la contra: dos nombres de personas distintas dan cero.
//   2. EL TELÉFONO SE COMPARA POR DÍGITOS, en los dos sentidos. Ver
//      `coincideTelefono`.
//   3. EL TELÉFONO RESPETA EL PERMISO. Quien no puede ver teléfonos tampoco
//      los encuentra: si buscar un número trajera un lead, el buscador sería
//      una forma de confirmar teléfonos sin verlos. Por eso los teléfonos
//      viajan aparte del resto del texto y quien arma el buscable decide si
//      los incluye.

const MARCAS = new RegExp('[\\u0300-\\u036f]', 'g');

/**
 * Cuántos dígitos hacen falta para tratar algo como teléfono.
 *
 * Cuatro. Con tres, «311» encontraría cualquier número que lo contenga y
 * media agenda entra en eso. Con cinco se pierde buscar por los últimos
 * cuatro, que es como uno se acuerda de un número que acaba de ver.
 */
export const MIN_DIGITOS = 4;

/**
 * Minúsculas y sin tildes.
 *
 * Los acentos se sacan descomponiendo (NFD) y tirando las marcas. Ojo: el motor
 * JS de PocketBase no implementa `normalize('NFD')` —no falla, devuelve el
 * texto igual—, así que esto sirve en el navegador y en Node, pero un hook del
 * servidor necesita la tabla explícita.
 */
export function sinAcentos(s: string | null | undefined): string {
  return String(s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(MARCAS, '');
}

/** Sólo los dígitos. `+55 31 8477-0178` → `553184770178`. */
export function soloDigitos(s: string | null | undefined): string {
  return String(s ?? '').replace(/\D/g, '');
}

/**
 * Si lo escrito parece un teléfono y no una palabra.
 *
 * Se le sacan los signos con los que se escribe un número —`+`, espacios,
 * guiones, paréntesis, puntos— y lo que queda tiene que ser todo dígitos. Una
 * palabra con letras nunca es un teléfono, y «R4» tampoco.
 */
export function pareceTelefono(termino: string | null | undefined): boolean {
  const limpio = String(termino ?? '').replace(/[\s()+.\-]/g, '');
  return limpio.length >= MIN_DIGITOS && /^\d+$/.test(limpio);
}

/**
 * Si alguno de los teléfonos es el que se está buscando.
 *
 * LA COMPARACIÓN VA EN LOS DOS SENTIDOS, y es lo que resuelve el pedido de
 * «que no me importe el número de adelante»:
 *
 *   guardado `553184770178`, se escribe `8477-0178`  → el guardado lo CONTIENE
 *   guardado `3184770178`,   se escribe `+55 31 8477 0178` → lo escrito CONTIENE al guardado
 *
 * El mismo número está cargado de tres formas —con `+55`, con `55`, con
 * espacios— y el prefijo de país aparece o no según de dónde vino el contacto.
 * Comparar entero no encuentra nada; comparar en un solo sentido encuentra la
 * mitad.
 */
export function coincideTelefono(
  telefonos: (string | null | undefined)[],
  termino: string,
): boolean {
  const q = soloDigitos(termino);
  if (q.length < MIN_DIGITOS) return false;
  return telefonos.some((t) => {
    const d = soloDigitos(t);
    if (d.length < MIN_DIGITOS) return false;
    return d.includes(q) || q.includes(d);
  });
}

/**
 * Todo lo que de un lead se puede buscar, ya normalizado.
 *
 * Se arma UNA vez por lead y se usa para todos los términos: normalizar el
 * texto entero en cada tecla y por cada chip es el camino corto a que el
 * cursor vaya atrás de lo que uno escribe.
 */
export interface Buscable {
  /** Todos los campos de texto pegados, en minúscula y sin tildes. */
  texto: string;
  /** Los teléfonos, ya en dígitos. Vacío si quien busca no puede verlos. */
  telefonos: string[];
}

/**
 * Arma el buscable de un lead.
 *
 * `telefonos` va aparte del resto A PROPÓSITO: es el único dato con permiso
 * propio (§6.2), y quien llama decide si lo pasa. Pasarlo siempre y filtrar
 * después sería exactamente el agujero que se quiso evitar.
 */
export function buscable(
  campos: (string | null | undefined)[],
  telefonos: (string | null | undefined)[] = [],
): Buscable {
  return {
    texto: sinAcentos(campos.filter(Boolean).join(' ')),
    telefonos: telefonos.map(soloDigitos).filter((d) => d.length >= MIN_DIGITOS),
  };
}

/**
 * Si un lead cumple UN término.
 *
 * Primero el texto, que es el caso normal. Si no está y lo escrito parece un
 * teléfono, se prueba por dígitos: el número guardado tiene un formato y el
 * que uno escribe tiene otro, así que buscarlo como texto casi nunca da.
 */
export function coincideTermino(b: Buscable, termino: string): boolean {
  const q = sinAcentos(termino).trim();
  if (!q) return true;
  if (b.texto.includes(q)) return true;
  return pareceTelefono(termino) && coincideTelefono(b.telefonos, termino);
}

/**
 * Si un lead cumple TODOS los términos (§7.2).
 *
 * «Y», no «o»: cada chip achica. Lo decidió Augusto el 09/09 con la contra a
 * la vista —«Martín» y «Josefina» juntos dan cero, porque nadie se llama las
 * dos cosas— y a cambio se puede afinar: «Martín» + «Vale» + «gerente».
 *
 * Sin términos devuelve true: la lista sin buscar nada es la lista entera.
 */
export function coincideTodos(b: Buscable, terminos: string[]): boolean {
  return terminos.every((t) => coincideTermino(b, t));
}

/**
 * Los términos que hay que cumplir: los chips más lo que se está tecleando.
 *
 * Lo tecleado cuenta ANTES de apretar enter, así que la lista se achica
 * mientras uno escribe y el enter sólo fija lo que ya se estaba viendo. Si
 * hubiera que confirmar cada palabra para ver algo, escribir a ciegas sería
 * el modo normal de usarlo.
 */
export function terminosDe(chips: string[], escribiendo: string): string[] {
  const t = [...chips.map((c) => c.trim()).filter(Boolean)];
  const suelto = escribiendo.trim();
  if (suelto) t.push(suelto);
  return t;
}

/**
 * Si alguno de los campos contiene lo buscado.
 *
 * Es la forma corta, para las pantallas de un solo término —la Base compartida
 * y el panel del partner—. Va por encima de `coincideTermino` y no aparte: dos
 * implementaciones de «coincide» encuentran cosas distintas, que es el error
 * que hizo falta venir a arreglar la primera vez.
 */
export function coincide(campos: (string | null | undefined)[], consulta: string): boolean {
  return coincideTermino(buscable(campos), consulta);
}
