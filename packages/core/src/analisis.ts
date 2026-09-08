// Análisis del perfil (§7.2, bloque de la ficha).
//
// LO QUE EL PROTOTIPO MUESTRA Y ACÁ NO ESTÁ: «el mensaje que logró la
// respuesta», con el texto del último saliente antes del primer entrante. Eso
// necesita el HILO de la conversación, y el CRM todavía no lo guarda — se lee
// en el chat real (LinkedIn/WhatsApp), y traerlo llega con el worker.
//
// Lo que sí hay son los envíos registrados y las fechas del lead, y con eso
// alcanza para contestar las preguntas que el bloque existe para contestar:
// cuánto se le insistió, cuánto tardó en contestar, dónde se cortó, y si va
// mejor o peor que los parecidos.

import type { Paso } from './tipos.ts';

export interface EnvioDelLead {
  paso: string;
  enviado_en: string;
}

export interface LeadAnalizado {
  id: string;
  etapa: string;
  cargo?: string;
  industria?: string;
  f_invitacion?: string | null;
  f_aceptacion?: string | null;
  f_respuesta?: string | null;
}

const DIA = 86_400_000;

function dias(desde: string, hasta: string): number {
  return Math.round((Date.parse(hasta.slice(0, 10)) - Date.parse(desde.slice(0, 10))) / DIA);
}

/**
 * El paso que provocó la respuesta: el último envío ANTES de la fecha de
 * respuesta.
 *
 * Es lo que se puede saber sin el texto del hilo. No es lo mismo que «el
 * mensaje que funcionó» —sin el texto no se sabe qué decía— pero sí contesta
 * cuál de los R la trajo, que es la mitad accionable de la pregunta.
 */
export function pasoQueRespondio(envios: EnvioDelLead[], fRespuesta: string | null | undefined): string | null {
  const r = String(fRespuesta ?? '').slice(0, 10);
  if (!r) return null;
  const previos = envios
    .filter((e) => e.enviado_en.slice(0, 10) <= r)
    .sort((a, b) => a.enviado_en.localeCompare(b.enviado_en));
  return previos.length ? previos[previos.length - 1].paso : null;
}

/** Días entre el envío que la provocó y la respuesta. `null` si no contestó. */
export function tardanzaEnResponder(envios: EnvioDelLead[], fRespuesta: string | null | undefined): number | null {
  const r = String(fRespuesta ?? '').slice(0, 10);
  if (!r) return null;
  const previos = envios
    .filter((e) => e.enviado_en.slice(0, 10) <= r)
    .sort((a, b) => a.enviado_en.localeCompare(b.enviado_en));
  if (!previos.length) return null;
  return dias(previos[previos.length - 1].enviado_en, r);
}

/**
 * Cada cuántos días se le escribió, en promedio.
 *
 * Con un solo envío no hay frecuencia: un intervalo necesita dos puntos.
 * Devolver 0 ahí diría «le escribimos todos los días», que es lo contrario.
 */
export function frecuenciaDeEnvio(envios: EnvioDelLead[]): number | null {
  if (envios.length < 2) return null;
  const orden = envios.map((e) => e.enviado_en.slice(0, 10)).sort();
  return Math.round(dias(orden[0], orden[orden.length - 1]) / (orden.length - 1));
}

/**
 * Dónde se cortó: el último paso enviado sin respuesta después.
 * `null` = contestó, o todavía no se le mandó nada.
 */
export function dondeSeCorto(envios: EnvioDelLead[], fRespuesta: string | null | undefined): string | null {
  if (fRespuesta) return null;
  if (!envios.length) return null;
  const orden = envios.slice().sort((a, b) => a.enviado_en.localeCompare(b.enviado_en));
  return orden[orden.length - 1].paso;
}

export interface Cohorte {
  /** Cómo se armó el grupo, para poder decirlo. */
  criterio: string;
  cuantos: number;
  /** Porcentaje de los del grupo que contestaron. */
  tasaRespuesta: number;
  /** Promedio de envíos por lead del grupo. */
  enviosPromedio: number;
  /** Días promedio en contestar, entre los que contestaron. */
  tardanzaPromedio: number | null;
}

/**
 * Los leads parecidos: misma industria, o mismo cargo si no hay industria.
 *
 * Se compara contra gente parecida y no contra la base entera porque la base
 * entera mezcla un CEO de Argentina con un supervisor de Brasil, y el promedio
 * que sale de ahí no le sirve para decidir nada a nadie.
 */
export function cohorteDe(
  lead: LeadAnalizado,
  todos: LeadAnalizado[],
  enviosPorLead: Map<string, EnvioDelLead[]>,
): Cohorte | null {
  const porIndustria = Boolean(lead.industria?.trim());
  const criterio = porIndustria ? `industria ${lead.industria}` : lead.cargo?.trim() ? `cargo ${lead.cargo}` : '';
  if (!criterio) return null;

  const grupo = todos.filter((l) => {
    if (l.id === lead.id) return false;
    return porIndustria ? l.industria === lead.industria : l.cargo === lead.cargo;
  });
  if (!grupo.length) return null;

  const conRespuesta = grupo.filter((l) => l.f_respuesta);
  const tardanzas = conRespuesta
    .map((l) => tardanzaEnResponder(enviosPorLead.get(l.id) ?? [], l.f_respuesta))
    .filter((d): d is number => d !== null);

  return {
    criterio,
    cuantos: grupo.length,
    tasaRespuesta: Math.round((conRespuesta.length / grupo.length) * 100),
    enviosPromedio: Math.round(
      grupo.reduce((a, l) => a + (enviosPorLead.get(l.id)?.length ?? 0), 0) / grupo.length,
    ),
    tardanzaPromedio: tardanzas.length
      ? Math.round(tardanzas.reduce((a, d) => a + d, 0) / tardanzas.length)
      : null,
  };
}

export interface Conclusion {
  texto: string;
  /** «bien» / «normal» / «flojo», para el color. */
  tono: 'bien' | 'normal' | 'flojo';
}

/**
 * La conclusión en una frase.
 *
 * Dice lo que los números dicen y nada más. Una conclusión que promete
 * («va a cerrar») es peor que ninguna: se la cree una vez, falla, y después no
 * se le cree al panel entero.
 */
export function concluir(
  lead: LeadAnalizado,
  envios: EnvioDelLead[],
  cohorte: Cohorte | null,
  siguiente: Paso | undefined,
): Conclusion {
  if (!lead.f_aceptacion) {
    return { texto: 'Todavía no aceptó la invitación: no hay conversación que analizar.', tono: 'normal' };
  }
  if (lead.f_respuesta) {
    const paso = pasoQueRespondio(envios, lead.f_respuesta);
    const d = tardanzaEnResponder(envios, lead.f_respuesta);
    const contra =
      cohorte?.tardanzaPromedio != null && d != null
        ? d <= cohorte.tardanzaPromedio
          ? ` — más rápido que el promedio de ${cohorte.criterio} (${cohorte.tardanzaPromedio} d)`
          : ` — más lento que el promedio de ${cohorte.criterio} (${cohorte.tardanzaPromedio} d)`
        : '';
    return {
      texto: `Contestó${paso ? ` después del ${paso}` : ''}${d != null ? `, a los ${d} días` : ''}${contra}.`,
      tono: 'bien',
    };
  }
  const corte = dondeSeCorto(envios, lead.f_respuesta);
  if (!envios.length) {
    return {
      texto: `Aceptó y todavía no se le mandó ningún mensaje${siguiente ? `: toca ${siguiente}` : ''}.`,
      tono: 'normal',
    };
  }
  const contra = cohorte
    ? ` El ${cohorte.tasaRespuesta}% de ${cohorte.criterio} contesta, con ${cohorte.enviosPromedio} envíos en promedio.`
    : '';
  return {
    texto: `Sin respuesta después de ${envios.length} ${envios.length === 1 ? 'envío' : 'envíos'}${corte ? `, el último ${corte}` : ''}.${contra}`,
    tono: envios.length >= 4 ? 'flojo' : 'normal',
  };
}
