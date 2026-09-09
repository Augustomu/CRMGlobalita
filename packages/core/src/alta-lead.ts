// Dar de alta un lead a mano (§7.2).
//
// Todo lo que hay en la base entró por un import de CSV o por un entrante de
// WhatsApp. Falta el caso más simple y más frecuente: alguien te pasa un
// contacto, lo conocés en una feria, te lo recomienda un cliente. Hoy eso
// obliga a armar un CSV de una fila.
//
// Lo que decide el alta —y por eso el formulario es como es— es la CUENTA. De
// ella cuelga la casa (§3.13): si la cuenta es de la línea `inversiones` el
// lead es de Seng, si es de `ia` es de Globalita. Sin cuenta no hay lead:
// habría un perfil suelto, que es una persona que nadie sigue.

import { idiomaSugerido } from './idioma.ts';
import { identidad, type IdentidadPerfil } from './dedupe.ts';
import { normalizarTelefono } from './telefono.ts';
import { casaDeLinea, type Casa } from './proyecto.ts';
import type { Idioma } from './tipos.ts';

export interface AltaDeLead {
  /** Lo único obligatorio junto con la cuenta. */
  nombre: string;
  /** El id de la cuenta de LinkedIn por la que entra. De acá sale la casa. */
  cuenta: string;
  /** La URL del perfil, si la hay. De ella salen `slug` y `urn` (D02). */
  linkedin?: string;
  telefono?: string;
  email?: string;
  cargo?: string;
  empresa?: string;
  industria?: string;
  pais?: string;
  ciudad?: string;
  nota?: string;
  /** Quién lo sigue. Vacío = el que lo está cargando. */
  asignado?: string;
  /** ISO `YYYY-MM-DD`. Vacío = sin próximo contacto agendado. */
  proximo_contacto?: string;
}

export interface ProblemaDeAlta {
  campo: keyof AltaDeLead;
  motivo: string;
}

/**
 * Qué le falta al alta para poder guardarse.
 *
 * Sólo dos cosas son obligatorias, y las dos por la misma razón: sin ellas el
 * lead no se puede usar para nada. Uno sin nombre no se puede buscar; uno sin
 * cuenta no pertenece a ninguna casa, así que no aparece en Control ni se sabe
 * con qué perfil de LinkedIn escribirle.
 *
 * El resto se completa después —la mitad sale del scan— y exigirlo acá haría
 * que cargar un contacto de una feria cueste más que anotarlo en papel.
 */
export function problemasDelAlta(a: AltaDeLead): ProblemaDeAlta[] {
  const problemas: ProblemaDeAlta[] = [];
  if (!String(a.nombre ?? '').trim()) {
    problemas.push({ campo: 'nombre', motivo: 'Sin nombre no se lo puede buscar después.' });
  }
  if (!String(a.cuenta ?? '').trim()) {
    problemas.push({
      campo: 'cuenta',
      motivo: 'La cuenta decide de qué casa es el lead y con qué perfil se le escribe.',
    });
  }
  const p = String(a.proximo_contacto ?? '').trim();
  if (p && !/^\d{4}-\d{2}-\d{2}$/.test(p)) {
    problemas.push({ campo: 'proximo_contacto', motivo: 'La fecha tiene que ser AAAA-MM-DD.' });
  }
  return problemas;
}

export interface PlanDeAlta {
  /** Los campos de la fila de `perfil`. */
  perfil: Record<string, unknown>;
  /** Los campos de la fila de `lead`, sin `perfil` (lo pone quien guarda). */
  lead: Record<string, unknown>;
  /** slug/urn/huella, para pasarle a `decidirAlta` antes de escribir (D02). */
  identidad: IdentidadPerfil;
  /** El idioma con el que se le va a escribir. No se guarda: se deriva (§5.6). */
  idioma: Idioma;
  /** De qué casa queda el lead, cuando la cuenta lo deja saber (§3.13). */
  casa: Casa | null;
  /** Lo que conviene avisar sin bloquear el alta. */
  avisos: string[];
}

/**
 * Qué se va a escribir, sin escribir nada.
 *
 * Devuelve el perfil y el lead por separado porque son dos tablas (D01), la
 * identidad aparte porque antes de guardar hay que preguntarle a `decidirAlta`
 * si esa persona ya está, y los avisos aparte porque cosas como «el teléfono
 * no dio un número válido» no impiden guardar —el lead entra igual con
 * `telefono_valido: false` (D29)— pero hay que decirlas, o el botón de
 * WhatsApp aparece apagado sin explicación.
 *
 * @param linea  `cuenta.linea_negocio` de la cuenta elegida, si se conoce.
 */
export function planDeAlta(a: AltaDeLead, linea?: string | null): PlanDeAlta {
  const avisos: string[] = [];

  const nombre = String(a.nombre ?? '').trim();
  const pais = String(a.pais ?? '').trim();
  const empresa = String(a.empresa ?? '').trim();

  const ident = identidad({ url: String(a.linkedin ?? '').trim(), nombre, empresa });
  if (a.linkedin && !ident.slug && !ident.urn) {
    avisos.push('Ese link no tiene un perfil de LinkedIn reconocible: se guarda igual, sin slug.');
  }

  let telefono = '';
  let valido = false;
  if (String(a.telefono ?? '').trim()) {
    const t = normalizarTelefono(a.telefono ?? '', pais);
    telefono = t.valor;
    valido = t.valido;
    if (!valido) {
      avisos.push(
        pais
          ? 'El teléfono no da un número válido para ese país: el lead se crea igual y WhatsApp queda deshabilitado hasta corregirlo.'
          : 'Sin el país no se puede completar el código del teléfono. Cargá el país, o escribí el número con +.',
      );
    }
  }

  if (!String(a.proximo_contacto ?? '').trim()) {
    avisos.push('Sin próximo contacto no va a aparecer en Vencimientos.');
  }

  return {
    perfil: {
      nombre,
      slug: ident.slug,
      urn: ident.urn,
      huella: ident.huella,
      cargo: String(a.cargo ?? '').trim(),
      empresa,
      industria: String(a.industria ?? '').trim(),
      pais,
      ciudad: String(a.ciudad ?? '').trim(),
      telefono,
      telefono_raw: String(a.telefono ?? '').trim(),
      telefono_valido: valido,
    },
    lead: {
      cuenta: String(a.cuenta ?? '').trim(),
      asignado: String(a.asignado ?? '').trim(),
      // R0 y `en_curso`: se lo acaba de cargar, todavía no se le escribió (D17).
      etapa: 'R0',
      situacion: 'en_curso',
      lista: LISTA_MANUAL,
      email: String(a.email ?? '').trim(),
      nota: String(a.nota ?? '').trim(),
      proximo_contacto: String(a.proximo_contacto ?? '').trim() || null,
    },
    identidad: ident,
    idioma: idiomaSugerido(pais),
    casa: casaDeLinea(linea),
    avisos,
  };
}

/**
 * De dónde dice que vino un lead cargado a mano.
 *
 * Es el mismo campo `lista` que usan los CSV, y por eso importa que diga algo
 * cierto: en las métricas por lista, «Carga manual» tiene que poder separarse
 * de una tanda de Sales Navigator.
 */
export const LISTA_MANUAL = 'Carga manual';

/**
 * Una fecha de próximo contacto sugerida.
 *
 * Cargar a alguien y dejarlo sin fecha es cargarlo para no volver a verlo: no
 * aparece en Vencimientos y la lista lo ordena al final. Se propone mañana —no
 * hoy— porque el alta suele hacerse justo después de haber hablado.
 */
export function proximoSugerido(hoy: string): string {
  const d = new Date(`${hoy}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}
