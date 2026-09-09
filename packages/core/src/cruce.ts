// Unir la misma persona partida entre dos fuentes (D02).
//
// El histórico dejó a cada persona en dos mitades que no se tocan:
//
//   Google Calendar  →  nombre, email, link de LinkedIn, la cuenta, las reuniones
//   CSV de WhatsApp  →  nombre, cargo, país, ciudad, TELÉFONO
//
// Ninguna de las dos trae un identificador que la otra también tenga. Lo único
// compartido es el nombre, y Augusto lo confirmó: los contactos de WhatsApp
// están guardados con el mismo nombre completo con el que figuran en LinkedIn.
//
// LA REGLA QUE NO SE ROMPE: acá no se fusiona nada. Se PROPONE, con un motivo
// escrito, y una persona aprueba. Dos personas pueden llamarse igual —en esta
// base hay 45 grupos con el mismo nombre normalizado— y una fusión equivocada
// mezcla el historial de reuniones de alguien con el teléfono de otro.

/** Sin acentos, sin puntuación, en minúsculas. */
export function normalizar(texto: string | null | undefined): string {
  return String(texto ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Las palabras del nombre, sin las que no distinguen a nadie. */
const RUIDO = new Set([
  'de', 'del', 'da', 'do', 'dos', 'das', 'la', 'las', 'los', 'y', 'e',
  'gerente', 'consultor', 'director', 'jefe', 'ing', 'lic', 'sr', 'sra',
  'online', 'llamar', 'a', 'con',
]);

export function palabrasDe(nombre: string | null | undefined): string[] {
  return normalizar(nombre)
    .split(' ')
    .filter((p) => p.length > 1 && !RUIDO.has(p));
}

export type Confianza = 'exacta' | 'alta' | 'media';

export interface Candidato {
  /** El id del perfil que viene del Calendar. */
  del_calendar: string;
  /** El id del perfil que viene del CSV. */
  del_csv: string;
  confianza: Confianza;
  /** Por qué se propone, en castellano, para que se pueda decidir sin abrir el código. */
  motivo: string;
}

export interface PerfilCruce {
  id: string;
  nombre: string;
  /** Sólo del CSV. */
  pais?: string | null;
  cargo?: string | null;
}

/**
 * Qué tan parecidos son dos nombres.
 *
 * - `exacta`: las mismas palabras, en cualquier orden. «Nicolás Valencia
 *   García» y «García Valencia Nicolas» son la misma persona escrita distinto.
 * - `alta`: uno contiene al otro entero y el más corto tiene dos palabras o
 *   más. «Leonardo Titronic» dentro de «Leonardo Titronic Da Silva».
 * - `media`: comparten dos palabras, pero cada uno tiene alguna propia.
 * - `null`: no alcanza. **Menos de dos palabras en común nunca alcanza**, ni
 *   siquiera si los dos nombres son idénticos: «Carlos» y «Carlos» son dos
 *   personas distintas hasta que se demuestre lo contrario, y en esta base hay
 *   catorce.
 */
export function parecido(a: string, b: string): Confianza | null {
  const pa = palabrasDe(a);
  const pb = palabrasDe(b);
  if (!pa.length || !pb.length) return null;

  const sa = new Set(pa);
  const sb = new Set(pb);
  const comunes = [...sa].filter((x) => sb.has(x));

  /*
   * Dos palabras es el piso, incluso para «exacta».
   *
   * Sin este corte, «Llamar a Miguel» —que es el título de un evento, no un
   * nombre— cruzaba «exacta» con «Miguel»: sacando el relleno a los dos les
   * queda una sola palabra y son idénticas. Lo mismo pasaría con los catorce
   * «Carlos» de la base.
   *
   * Un nombre de pila solo no identifica a nadie, por más que coincida entero.
   */
  if (comunes.length < 2) return null;

  if (comunes.length === sa.size && comunes.length === sb.size) return 'exacta';
  // Uno contenido en el otro: el corto tiene que aportar al menos dos palabras.
  if (comunes.length >= 2 && (comunes.length === sa.size || comunes.length === sb.size)) return 'alta';
  if (comunes.length >= 2) return 'media';
  return null;
}

/**
 * Los cruces posibles entre las dos fuentes.
 *
 * Un perfil del Calendar puede tener varios candidatos del CSV y al revés. NO
 * se elige el mejor: se devuelven todos, porque justamente cuando hay más de
 * uno es cuando hace falta que decida una persona.
 */
export function cruzar(delCalendar: PerfilCruce[], delCsv: PerfilCruce[]): Candidato[] {
  const salida: Candidato[] = [];

  for (const c of delCalendar) {
    for (const w of delCsv) {
      const conf = parecido(c.nombre, w.nombre);
      if (!conf) continue;
      salida.push({
        del_calendar: c.id,
        del_csv: w.id,
        confianza: conf,
        motivo:
          conf === 'exacta'
            ? 'El nombre completo coincide'
            : conf === 'alta'
              ? 'Un nombre está contenido en el otro'
              : 'Comparten nombre y apellido, pero no todo',
      });
    }
  }

  return salida;
}

/**
 * Cuántos candidatos tiene cada lado.
 *
 * Sirve para lo que importa al aprobar: un cruce uno a uno se mira un segundo;
 * uno donde la misma persona del Calendar tiene tres candidatos del CSV hay que
 * leerlo con cuidado, y la pantalla tiene que decirlo antes.
 */
export function cuantosCandidatos(cs: Candidato[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const c of cs) {
    m.set(c.del_calendar, (m.get(c.del_calendar) ?? 0) + 1);
    m.set(c.del_csv, (m.get(c.del_csv) ?? 0) + 1);
  }
  return m;
}

/**
 * Los que se pueden aprobar de a muchos sin mirarlos uno por uno.
 *
 * Sólo los `exacta` que además son **uno a uno**: ese perfil del Calendar no
 * tiene otro candidato y ese del CSV tampoco. Con eso, aprobar en lote deja de
 * ser un acto de fe.
 */
export function segurosParaLote(cs: Candidato[]): Candidato[] {
  const cuantos = cuantosCandidatos(cs);
  return cs.filter(
    (c) =>
      c.confianza === 'exacta' &&
      cuantos.get(c.del_calendar) === 1 &&
      cuantos.get(c.del_csv) === 1,
  );
}

/* ---------------------------------------------------------------------------
 * Recuperar el nombre completo de un evento de Calendar
 * ------------------------------------------------------------------------ */

/**
 * El título de un evento trae el nombre de pila y nada más.
 *
 * «Leonardo / Bruno / Augusto» → «Leonardo». De los 298 eventos, sólo 34 dan un
 * nombre de dos palabras, y con un nombre de pila no se puede cruzar contra
 * nada: en esta base hay catorce Carlos.
 *
 * Pero el evento trae dos cosas más que sí lo tienen: el link de LinkedIn
 * —`/in/leonardo-zorzaneli-3050a727`— y el email. Entre los dos recuperan 132.
 */

/** «/in/leonardo-zorzaneli-3050a727» → «leonardo zorzaneli». */
export function nombreDelSlug(link: string | null | undefined): string {
  const m = /\/in\/([^/?#]+)/.exec(String(link ?? ''));
  if (!m) return '';
  return decodeURIComponent(m[1]!)
    .split('-')
    // El sufijo que agrega LinkedIn cuando el nombre está tomado no es parte
    // del nombre: `3050a727`, `1a2b3c`.
    .filter((t) => t && !/^[0-9a-f]{6,}$/i.test(t) && !/^\d+$/.test(t))
    .join(' ');
}

/**
 * Las casillas que no son de una persona.
 *
 * `contato@masterconsult.br` daría «contato masterconsultbr», que no es el
 * nombre de nadie y cruzaría mal con cualquiera. Es preferible quedarse sin
 * nombre que inventar uno.
 */
const CASILLAS_GENERICAS = new Set([
  'contato', 'contacto', 'contact', 'info', 'ventas', 'vendas', 'sales',
  'admin', 'comercial', 'atendimento', 'compras', 'financeiro', 'rh',
  'diretoria', 'gerencia', 'marketing', 'suporte', 'soporte', 'no', 'noreply',
]);

/** «leonardo.zorzaneli@empresa.com» → «leonardo zorzaneli». */
export function nombreDelEmail(email: string | null | undefined): string {
  const antes = String(email ?? '').split('@')[0] ?? '';
  if (!antes) return '';
  const partes = antes
    .split(/[._-]+/)
    .filter((t) => t.length > 1 && !/^\d+$/.test(t));
  if (partes.length < 2) return '';
  // Con una sola parte genérica ya no es el correo de una persona.
  if (partes.some((t) => CASILLAS_GENERICAS.has(t.toLowerCase()))) return '';
  return partes.join(' ');
}

/**
 * El mejor nombre disponible para una persona de un evento.
 *
 * El orden es por confiabilidad: lo que ya viene con nombre y apellido se
 * respeta; después el slug, que lo escribió la propia persona en LinkedIn;
 * después el email, que a veces es una casilla de empresa. Si ninguno da dos
 * palabras, se devuelve el del título tal cual — un nombre pobre es mejor que
 * ninguno, sólo que no va a poder cruzarse.
 */
export function mejorNombre(opciones: {
  titulo?: string | null;
  link?: string | null;
  email?: string | null;
}): string {
  const { titulo, link, email } = opciones;
  const t = String(titulo ?? '').trim();
  if (palabrasDe(t).length >= 2) return t;

  const s = nombreDelSlug(link);
  if (palabrasDe(s).length >= 2) return conMayusculas(s);

  const e = nombreDelEmail(email);
  if (palabrasDe(e).length >= 2) return conMayusculas(e);

  return t;
}

/** «leonardo zorzaneli» → «Leonardo Zorzaneli». */
export function conMayusculas(texto: string): string {
  return texto
    .split(' ')
    .filter(Boolean)
    .map((p) => p[0]!.toUpperCase() + p.slice(1))
    .join(' ');
}
