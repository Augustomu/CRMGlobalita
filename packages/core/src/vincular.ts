/**
 * Conectar un evento del calendario con un lead (§7.6).
 *
 * EL PROBLEMA, contado como se ve en pantalla. La agenda dibuja dos cosas
 * distintas con el mismo aspecto de bloque: las 288 reuniones del CRM, que
 * tienen un lead detrás, y los 1769 eventos que vinieron del Google Calendar,
 * que no tienen nada. Augusto miró la semana y dijo que sus eventos «se ven
 * pálidos». El color estaba diciendo la verdad —no son reuniones del CRM— pero
 * la verdad estaba mal: «Brenno - Augusto» SÍ es una reunión de prospección,
 * lo que falta es el vínculo.
 *
 * POR QUÉ POR PERSONA Y NO POR EVENTO. De los 278 eventos de prospección del
 * calendario, 220 no tienen perfil. Si se conectaran de a uno serían 220
 * decisiones. Pero no son 220 personas: son 114, y las dos primeras se llevan
 * 83 eventos —«FabriPT Catchup Herik» aparece 45 veces y «Brenno» 38—. Son
 * reuniones recurrentes con la misma persona. Conectar por persona convierte
 * 220 clics en 114, y los dos primeros resuelven más de un tercio.
 *
 * DE DÓNDE SALE EL NOMBRE. Del título, que en el calendario de Augusto tiene
 * la forma «Nombre - Alguien de casa» o «Nombre / Cuenta / Augusto» desde antes
 * de que existiera el CRM. `prospeccion.ts` ya sabe leer esa forma; acá se usa
 * la primera parte, que es la persona con la que uno se reunió.
 *
 * LO QUE ESTE MÓDULO NO HACE. No decide QUIÉN es esa persona en la base. Junta
 * los eventos que hablan de la misma y los deja listos para que alguien diga
 * «este es el lead». Adivinar el lead por parecido de nombre es exactamente el
 * error que en Duplicados junta a dos personas distintas, y ahí es caro.
 */

import { esProspeccion, partesDelTitulo } from './prospeccion.ts';

/** Lo que hace falta de un evento del calendario para poder agruparlo. */
export interface EventoParaVincular {
  id: string;
  titulo?: string | null;
  /** El id del lead, si ya se conectó. Vacío o ausente = todavía suelto. */
  lead?: string | null;
  /** Para poder decir «la última fue en marzo». Formato de la base. */
  inicio?: string | null;
}

/** Una persona del calendario, con todos sus eventos juntos. */
export interface PersonaDelCalendario {
  /** El nombre normalizado. Es la clave con la que se agrupa. */
  clave: string;
  /** Cómo se muestra: la variante más completa que apareció en los títulos. */
  nombre: string;
  /** Los ids de todos sus eventos, para conectarlos de una. */
  eventos: string[];
  cuantos: number;
  /** El primero y el último, tal como los guarda la base. */
  desde: string;
  hasta: string;
}

/** Minúsculas, sin tildes y con los espacios colapsados. */
export function comoSeCompara(nombre: string): string {
  return String(nombre ?? '')
    .toLowerCase()
    .normalize('NFD')
    // Los signos que NFD separa de la letra: la tilde de «Ferrán», la ç, la ñ.
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Con quién fue la reunión, leído del título.
 *
 * «Marcelo Carneiro / Francisco / Augusto» → «Marcelo Carneiro»
 * «Rodrigues - Augusto»                    → «Rodrigues»
 * «Brenno»                                 → «Brenno»
 *
 * La última parte es siempre alguien de casa —es lo que hace que el título
 * cuente como prospección— así que la persona de afuera es la primera.
 */
export function quienEsDelTitulo(titulo: string): string {
  const partes = partesDelTitulo(titulo);
  return partes.length ? partes[0]! : '';
}

/**
 * Las personas del calendario que todavía no tienen lead.
 *
 * Devuelve una fila por persona, con sus eventos adentro, ordenadas por
 * cuántos eventos tiene cada una: la que más veces aparece es la que más
 * rinde conectar, y con dos clics se resuelve un tercio del trabajo.
 *
 * Los eventos que ya tienen lead no salen: la pantalla es de lo que falta.
 */
export function personasSinLead(eventos: EventoParaVincular[]): PersonaDelCalendario[] {
  const porClave = new Map<string, PersonaDelCalendario>();

  for (const ev of eventos) {
    if (ev.lead) continue;
    const titulo = String(ev.titulo ?? '');
    if (!esProspeccion({ titulo })) continue;

    const nombre = quienEsDelTitulo(titulo);
    const clave = comoSeCompara(nombre);
    if (!clave) continue;

    const inicio = String(ev.inicio ?? '');
    const ya = porClave.get(clave);
    if (!ya) {
      porClave.set(clave, {
        clave,
        nombre,
        eventos: [ev.id],
        cuantos: 1,
        desde: inicio,
        hasta: inicio,
      });
      continue;
    }

    ya.eventos.push(ev.id);
    ya.cuantos++;
    // El nombre que se muestra es el más largo que se vio: entre «Herik» y
    // «Herik Pires», el segundo dice más y es el mismo título de siempre
    // escrito completo.
    if (nombre.length > ya.nombre.length) ya.nombre = nombre;
    if (inicio && (!ya.desde || inicio < ya.desde)) ya.desde = inicio;
    if (inicio && inicio > ya.hasta) ya.hasta = inicio;
  }

  return [...porClave.values()].sort(
    (a, b) => b.cuantos - a.cuantos || a.nombre.localeCompare(b.nombre, 'es'),
  );
}

/**
 * Los leads que más se parecen a un nombre del calendario, primero.
 *
 * NO elige: ordena. Compara por palabras enteras y no por parecido de letras,
 * porque «Marcelo» y «Marcela» comparten seis letras y son dos personas. Un
 * lead que no comparte ninguna palabra queda igual en la lista, más abajo: el
 * nombre del calendario suele ser apenas un pedazo del nombre real.
 */
export function leadsParecidos<T>(
  nombreDelCalendario: string,
  leads: T[],
  nombreDe: (l: T) => string,
): T[] {
  const palabras = new Set(
    comoSeCompara(nombreDelCalendario)
      .split(' ')
      .filter((x) => x.length > 2),
  );
  if (!palabras.size) return [...leads];

  const puntos = (l: T) =>
    comoSeCompara(nombreDe(l))
      .split(' ')
      .filter((x) => palabras.has(x)).length;

  // Estable: entre dos que empatan queda el orden con el que vinieron.
  return [...leads]
    .map((l, i) => ({ l, i, p: puntos(l) }))
    .sort((a, b) => b.p - a.p || a.i - b.i)
    .map((x) => x.l);
}
