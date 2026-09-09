/**
 * Qué evento del calendario es una reunión de prospección (§7.6).
 *
 * EL PROBLEMA. El calendario tiene la vida entera de la persona: el almuerzo,
 * la clase de idiomas, la reunión interna, el cumpleaños de alguien. La vista
 * Lista es el recorrido del seguimiento comercial, así que no puede mostrar
 * todo eso — pero tampoco puede mostrar sólo lo que ya está cruzado con un
 * teléfono de WhatsApp, que era el filtro accidental que tenía: quedaba afuera
 * cualquier reunión con alguien cuyo número no estuviera en el CSV.
 *
 * LAS DOS SEÑALES, que definió Augusto el 09/09/2026:
 *
 *   1. La descripción del evento tiene un link de LinkedIn o de Sales
 *      Navigator. Si está, alguien lo puso ahí a propósito: es un prospecto.
 *   2. El título tiene la forma «Nombre / Cuenta / Augusto», que es como se
 *      nombran las reuniones de prospección desde siempre y lo que escribe el
 *      propio CRM (§5.11).
 *
 * Alcanza con UNA. Son dos caminos al mismo hecho, no dos requisitos: hay
 * reuniones viejas sin descripción y reuniones nuevas con un título distinto.
 */

/** Lo que hace falta mirar de un evento para decidir. */
export interface EventoDelCalendario {
  titulo?: string | null;
  descripcion?: string | null;
}

export interface PorQueEsProspeccion {
  es: boolean;
  /** Cuál de las dos señales lo dijo. Para poder explicarlo en pantalla. */
  senal: 'link' | 'titulo' | 'ninguna';
}

/**
 * Un link de LinkedIn en cualquiera de sus formas.
 *
 * Sales Navigator vive en `/sales/lead/…` y el perfil normal en `/in/…`; los
 * dos cuentan. Se busca el dominio y no la palabra «linkedin» suelta, porque
 * «hablamos de LinkedIn» en una nota no es un link.
 */
const LINK = /https?:\/\/(?:[a-z0-9-]+\.)*linkedin\.com\//i;

/**
 * Quiénes son «los nuestros» en el título.
 *
 * El título de una reunión de prospección termina en alguien de casa: la cuenta
 * desde la que se prospecta, o el propio Augusto. Es lo que distingue
 * «Rodrigues - Augusto» de «Dentista - Belgrano».
 */
export const LOS_NUESTROS = [
  'augusto',
  'alejandro',
  'francisco',
  'edith',
  'bruno',
  'david',
  'alberto',
  'delia',
];

/** Las partes de un título, cortado por barra o por guión. */
export function partesDelTitulo(titulo: string): string[] {
  return String(titulo ?? '')
    // El guión SUELTO, con espacios a los lados. Sin eso, «Jean-Pierre» y
    // «Coca-Cola» se partirían al medio y el nombre quedaria roto.
    .split(/\s+[-–—]\s+|\//)
    .map((x) => x.trim())
    .filter(Boolean);
}

/**
 * El título de una reunión de prospección.
 *
 * DOS FORMAS, y las dos estaban en el calendario de Augusto desde antes del
 * CRM:
 *
 *     Marcelo Carneiro / Francisco / Augusto     tres partes, con barras
 *     Rodrigues - Augusto                        dos partes, con guión
 *
 * La primera version de esto pedia TRES partes separadas por BARRA, y dejaba
 * afuera media agenda: «Julio - Augusto», «Brenno - Augusto», «Rodrigues -
 * Augusto» son reuniones de prospección y no entraban. Augusto lo marco.
 *
 * Lo que hace que un título cuente no es la cantidad de partes: es que la
 * ÚLTIMA sea alguien de casa. «Almuerzo con Juan / martes» tiene dos partes y
 * «martes» no es nadie; «Rodrigues - Augusto» tiene dos y Augusto sí.
 */
export function tieneFormaDeTitulo(titulo: string): boolean {
  const partes = partesDelTitulo(titulo);
  if (partes.length < 2) return false;

  const ultima = partes[partes.length - 1]!
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  // Alcanza con que la ultima parte EMPIECE con uno de los nuestros: «Augusto
  // Unzaga» y «Augusto» son la misma persona.
  return LOS_NUESTROS.some((n) => ultima === n || ultima.startsWith(n + ' '));
}

export function porQueEsProspeccion(ev: EventoDelCalendario): PorQueEsProspeccion {
  if (LINK.test(String(ev.descripcion ?? ''))) return { es: true, senal: 'link' };
  if (tieneFormaDeTitulo(String(ev.titulo ?? ''))) return { es: true, senal: 'titulo' };
  return { es: false, senal: 'ninguna' };
}

/** El atajo, para filtrar. */
export function esProspeccion(ev: EventoDelCalendario): boolean {
  return porQueEsProspeccion(ev).es;
}
