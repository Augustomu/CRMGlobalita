// La base compartida (§7.5): un registro por PERFIL invitado, no por lead.
//
// Es la tabla que el script consulta antes de invitar. Su razón de existir es
// que dos cuentas no le escriban a la misma persona sin saberlo: el perfil es
// la identidad (D08/D27) y los leads son las relaciones de trabajo que cuelgan
// de él, una por cuenta.
//
// De ahí sale la marca de compartido: un perfil con leads en más de una cuenta
// ya fue invitado por otro, y eso hay que verlo antes de mandar nada.

import { coincide } from './busqueda.ts';
import { esFase2 } from './cadencia.ts';
import type { Paso } from './tipos.ts';

export type GrupoEtapa = 'En cadencia' | 'Recontacto' | 'Fase 2' | 'Sin aceptar';

export type FiltroEtapa = 'todas' | GrupoEtapa;

export const FILTROS_ETAPA: FiltroEtapa[] = ['todas', 'En cadencia', 'Recontacto', 'Fase 2', 'Sin aceptar'];

export interface FilaCompartida {
  perfil_id: string;
  nombre: string;
  cargo: string;
  empresa: string;
  industria: string;
  pais: string;
  ciudad: string;
  /** Las abreviaturas de las cuentas que lo trabajan. Más de una = compartido. */
  cuentas: string[];
  etapa: string;
  situacion: string;
  f_invitacion: string | null;
  f_aceptacion: string | null;
  f_respuesta: string | null;
  proximo_contacto: string | null;
  /** El último envío: paso y fecha. */
  ultimo_paso: string | null;
  ultimo_en: string | null;
}

/** Un perfil que trabaja más de una cuenta: es lo que la tabla existe para ver. */
export function estaCompartido(f: FilaCompartida): boolean {
  return f.cuentas.length > 1;
}

/**
 * En qué grupo cae un perfil.
 *
 * El orden de las preguntas importa. «Sin aceptar» va PRIMERO porque un lead
 * que nunca aceptó no está realmente en ninguna cadencia, aunque su etapa diga
 * R3: la etapa avanza con los envíos y los envíos no llegan a quien no aceptó.
 * Preguntando por la etapa antes, la mitad de los que nunca contestaron
 * aparecerían como «En cadencia» y el filtro no serviría para nada.
 */
export function grupoDeEtapa(f: FilaCompartida): GrupoEtapa {
  if (f.situacion === 'esperando_recontacto' || f.etapa === 'R0-recontacto') return 'Recontacto';
  if (!f.f_aceptacion) return 'Sin aceptar';
  if (esFase2(f.etapa as Paso)) return 'Fase 2';
  return 'En cadencia';
}

/**
 * OJO: `normalize('NFD')` funciona en el navegador y en Node, pero NO en el
 * goja de PocketBase — ahí no falla, devuelve el texto igual. Si esta función
 * termina usándose desde un hook o una migración, hay que reemplazarla por una
 * tabla de caracteres explícita (hay una en `pb_seed/1788600100_demo.js`).
 */
/**
 * Filtra la tabla.
 *
 * La búsqueda ignora acentos EN LOS DOS LADOS: la base tiene «Gonçalves» y
 * «Núñez», y quien busca escribe «goncalves» y «nunez». Comparar tal cual
 * significa que el buscador falla justo con los nombres que más cuestan de
 * escribir.
 */
export function visibles(
  filas: FilaCompartida[],
  cuenta: string,
  etapa: FiltroEtapa,
  busqueda: string,
): FilaCompartida[] {
  return filas.filter((f) => {
    if (cuenta !== 'todas' && !f.cuentas.includes(cuenta)) return false;
    if (etapa !== 'todas' && grupoDeEtapa(f) !== etapa) return false;
    return coincide([f.nombre, f.empresa, f.cargo, f.ciudad, f.industria, f.pais], busqueda);
  });
}

export interface PasoDelHistorial {
  paso: string;
  fecha: string;
  /** «enviado» o «respondió» cuando la respuesta llegó después de ese envío. */
  estado: string;
}

/**
 * El historial R1→Rn de un perfil.
 *
 * «Respondió» se marca en el ÚLTIMO envío anterior a la respuesta, no en todos
 * los anteriores: la respuesta la provocó uno solo, y repartirla entre todos es
 * lo que hace que después parezca que cualquier paso convierte igual.
 */
export function historial(
  envios: { paso: string; enviado_en: string }[],
  fRespuesta: string | null,
): PasoDelHistorial[] {
  const orden = envios
    .filter((e) => e.paso !== 'R0' && e.paso !== 'agradecimiento')
    .slice()
    .sort((a, b) => a.enviado_en.localeCompare(b.enviado_en));

  const r = String(fRespuesta ?? '').slice(0, 10);
  let iRespuesta = -1;
  if (r) {
    for (let i = 0; i < orden.length; i++) {
      if (orden[i].enviado_en.slice(0, 10) <= r) iRespuesta = i;
    }
  }

  return orden.map((e, i) => ({
    paso: e.paso,
    fecha: e.enviado_en.slice(0, 10),
    estado: i === iRespuesta ? 'respondió' : 'enviado',
  }));
}

/** «respondió en R2» / «sin respuesta» / «sin mensajes aún» / «nunca aceptó». */
export function resumenDeRespuesta(f: FilaCompartida, pasos: PasoDelHistorial[]): string {
  if (!f.f_aceptacion) return 'nunca aceptó';
  if (!pasos.length) return 'sin mensajes aún';
  const conRespuesta = pasos.find((p) => p.estado === 'respondió');
  return conRespuesta ? `respondió en ${conRespuesta.paso}` : 'sin respuesta';
}
