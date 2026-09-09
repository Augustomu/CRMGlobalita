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
 * El título de una reunión de prospección: tres partes separadas por barras.
 *
 * No alcanza con que haya una barra: «Almuerzo con Juan / martes» tiene una y
 * no es una reunión. Se piden las TRES partes con texto, que es la forma que
 * el equipo usa y la que escribe el CRM.
 */
export function tieneFormaDeTitulo(titulo: string): boolean {
  const partes = String(titulo ?? '')
    .split('/')
    .map((x) => x.trim())
    .filter(Boolean);
  return partes.length >= 3;
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
