// La operación compuesta de enviar. Implementa §5.10 del manual (§5.10).
//
// Hoy la mayoría de los R se mandan a mano (D15): el usuario copia el texto, lo
// pega en el chat real, y vuelve a registrar el envío. Esta función calcula lo
// mismo en los dos casos — lo único que cambia es quién aprieta el botón.

import { alEnviar } from './cadencia.ts';
import type { Canal, ConfigCadencia, Idioma, LeadCadencia, Paso, Situacion } from './tipos.ts';

/** La fila que se agrega al historial de envíos (§3.2). Base de la analítica. */
export interface NuevoEnvio {
  lead: string;
  paso: Paso | 'agradecimiento';
  enviado_en: string;
  canal: Canal;
  /** Vacío si el texto se escribió a mano, sin plantilla. */
  plantilla: string;
  idioma: Idioma;
  /** El texto REALMENTE enviado: permite comparar variantes después. */
  texto: string;
  a_mano: boolean;
}

/** Lo que se aplica al lead en el momento. */
export interface CambiosLead {
  situacion: Situacion;
  f_ultimo_contacto: string;
}

export interface PlanDeEnvio {
  envio: NuevoEnvio;
  lead: CambiosLead;
  /** Por nombre, no por id: quien aplica el plan las resuelve contra el catálogo. */
  etiquetas_a_agregar: string[];
  /**
   * §5.10: la próxima fecha **se propone, no se fija**. Va aparte de `lead`
   * justamente para que quien llame no la aplique sin que alguien la acepte.
   * `null` = la cadencia terminó y no hay próximo paso.
   */
  proximo_contacto_propuesto: string | null;
}

export interface DatosEnvio {
  lead_id: string;
  paso: Paso | 'agradecimiento';
  canal: Canal;
  idioma: Idioma;
  texto: string;
  plantilla_id?: string;
  /** true = lo mandó una persona; false = lo mandó el worker. */
  a_mano: boolean;
}

/**
 * Arma todo lo que cambia al registrar un envío, sin escribir nada.
 *
 * Devolver un plan en vez de aplicarlo permite que la ficha lo muestre antes de
 * confirmar, que el worker lo aplique derecho, y que los dos hagan exactamente
 * lo mismo.
 */
export function planDeEnvio(
  config: ConfigCadencia,
  lead: LeadCadencia,
  datos: DatosEnvio,
  hoyIso: string,
): PlanDeEnvio {
  const envio: NuevoEnvio = {
    lead: datos.lead_id,
    paso: datos.paso,
    enviado_en: hoyIso,
    canal: datos.canal,
    plantilla: datos.plantilla_id ?? '',
    idioma: datos.idioma,
    texto: datos.texto,
    a_mano: datos.a_mano,
  };

  // El agradecimiento post reunión no es un paso de la cadencia (§5.11):
  // no mueve la etapa ni propone próximo contacto.
  if (datos.paso === 'agradecimiento') {
    return {
      envio,
      lead: { situacion: lead.situacion, f_ultimo_contacto: hoyIso },
      etiquetas_a_agregar: [],
      proximo_contacto_propuesto: null,
    };
  }

  const efecto = alEnviar(config, { ...lead, etapa: datos.paso }, hoyIso);

  return {
    envio,
    lead: {
      // Un lead que ya contestó sigue en seguimiento manual: registrar un envío
      // no lo devuelve a la cadencia automática (§5.1).
      situacion: lead.situacion === 'contesto' ? 'contesto' : efecto.situacion,
      f_ultimo_contacto: hoyIso,
    },
    etiquetas_a_agregar: efecto.etiquetas_a_agregar,
    proximo_contacto_propuesto: efecto.proximo_contacto_propuesto,
  };
}
