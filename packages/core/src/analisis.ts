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

import { duracionNatural, minutosEntre } from './rendimiento.ts';
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

const promedio = (xs: number[]): number => Math.round(xs.reduce((a, x) => a + x, 0) / xs.length);

function dias(desde: string, hasta: string): number {
  return Math.round((Date.parse(hasta.slice(0, 10)) - Date.parse(desde.slice(0, 10))) / DIA);
}

/**
 * Cuánto tardó el lead en contestar, en minutos.
 *
 * El manual lo define en la p. 6: `demora_respuesta = respuesta − aceptacion`.
 * NO es «desde el último mensaje que le mandamos»: lo que se mide es cuánto
 * tarda alguien en engancharse después de aceptar, y por eso el mostrador de
 * la ficha da «8 h» aunque entremedio hayan salido tres R.
 *
 * Sin aceptación no hay resta que hacer: el referido y el que escribe primero
 * nunca aceptaron nada. Ahí se cae al último envío anterior a la respuesta,
 * que es lo más parecido que hay, y si tampoco hubo envío no hay demora — el
 * lead escribió primero.
 */
export function minutosDeRespuesta(
  lead: Pick<LeadAnalizado, 'f_aceptacion' | 'f_respuesta'>,
  envios: EnvioDelLead[],
): number | null {
  if (!lead.f_respuesta) return null;
  const desdeAceptacion = minutosEntre(lead.f_aceptacion, lead.f_respuesta);
  if (desdeAceptacion !== null) return desdeAceptacion;
  const previo = envioQueRespondio(envios, lead.f_respuesta);
  return previo ? minutosEntre(previo.enviado_en, lead.f_respuesta) : null;
}

/** Lo mismo, redactado: «10 min», «8 h», «18 días». */
export function demoraDeRespuesta(
  lead: Pick<LeadAnalizado, 'f_aceptacion' | 'f_respuesta'>,
  envios: EnvioDelLead[],
): string | null {
  if (!lead.f_respuesta) return null;
  const m = minutosDeRespuesta(lead, envios);
  // Ni aceptó nada ni le habíamos escrito todavía: abrió él la conversación.
  // Que después le hayamos contestado no cambia quién empezó — el referido de
  // WhatsApp tiene un R4 posterior a su mensaje y sigue habiendo escrito
  // primero.
  if (m === null) return 'escribió primero';
  return duracionNatural(m);
}

/**
 * El envío que provocó la respuesta: el último anterior a ella.
 *
 * La comparación es sobre el timestamp completo, no sobre la fecha: desde que
 * los envíos y las respuestas tienen hora, un mensaje mandado a las 18:00 no
 * puede haber provocado una respuesta de las 11:40 del mismo día.
 */
export function envioQueRespondio(
  envios: EnvioDelLead[],
  fRespuesta: string | null | undefined,
): EnvioDelLead | null {
  const r = String(fRespuesta ?? '');
  if (!r) return null;
  const previos = envios
    .filter((e) => e.enviado_en.localeCompare(r) <= 0)
    .sort((a, b) => a.enviado_en.localeCompare(b.enviado_en));
  return previos.length ? previos[previos.length - 1] : null;
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
  return envioQueRespondio(envios, fRespuesta)?.paso ?? null;
}

/** Días entre el envío que la provocó y la respuesta. `null` si no contestó. */
export function tardanzaEnResponder(envios: EnvioDelLead[], fRespuesta: string | null | undefined): number | null {
  const e = envioQueRespondio(envios, fRespuesta);
  return e ? dias(e.enviado_en, String(fRespuesta)) : null;
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
  /** Cuánto tardan en contestar los que contestaron, ya redactado: «32 h». */
  demoraPromedio: string | null;
  /** Lo mismo en minutos, que es con lo que se compara. */
  minutosPromedio: number | null;
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
  // El promedio se saca en minutos y se redacta una sola vez al final: en días
  // enteros, «8 h» y «40 h» valían los dos 0 y el promedio daba siempre cero.
  const demoras = conRespuesta
    .map((l) => minutosDeRespuesta(l, enviosPorLead.get(l.id) ?? []))
    .filter((d): d is number => d !== null);

  return {
    criterio,
    cuantos: grupo.length,
    tasaRespuesta: Math.round((conRespuesta.length / grupo.length) * 100),
    enviosPromedio: Math.round(
      grupo.reduce((a, l) => a + (enviosPorLead.get(l.id)?.length ?? 0), 0) / grupo.length,
    ),
    demoraPromedio: demoras.length ? duracionNatural(promedio(demoras)) : null,
    minutosPromedio: demoras.length ? promedio(demoras) : null,
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
    const mios = minutosDeRespuesta(lead, envios);
    const demora = demoraDeRespuesta(lead, envios);
    // La comparación se hace en minutos y se muestra redactada. Comparar los
    // textos («8 h» contra «32 h») ordenaría alfabéticamente.
    const contra =
      cohorte?.demoraPromedio != null && mios != null && cohorte.minutosPromedio != null
        ? mios <= cohorte.minutosPromedio
          ? ` — más rápido que el promedio de ${cohorte.criterio} (${cohorte.demoraPromedio})`
          : ` — más lento que el promedio de ${cohorte.criterio} (${cohorte.demoraPromedio})`
        : '';
    return {
      texto: `Contestó${paso ? ` después del ${paso}` : ''}${demora ? `, tras ${demora}` : ''}${contra}.`,
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
