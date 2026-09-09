// Cadencia R0-R8. Implementa §5.1 del manual.
// Decisiones aplicadas: D15 (Fase 2 = 90 días desde R4), D17 (etapa + situación).

import type {
  Canal, ConfigCadencia, LeadCadencia, Paso, PasoConfig, Situacion,
} from './tipos.ts';

/**
 * Valores por defecto de la cadencia (§5.1). Son la semilla de la configuración,
 * NO constantes de comportamiento: el usuario los edita y se guardan en la base.
 */
export const CADENCIA_POR_DEFECTO: ConfigCadencia = {
  fase2_dias: 90,
  fase2_activa: true,
  pasos: [
    { paso: 'R0', nombre: 'Invitación', espera_dias: 0, canal: 'linkedin', activo: true },
    { paso: 'R1', nombre: 'Primer contacto', espera_dias: 15, canal: 'linkedin', activo: true },
    { paso: 'R2', nombre: 'Seguimiento corto', espera_dias: 15, canal: 'linkedin', activo: true },
    { paso: 'R3', nombre: 'Caso concreto', espera_dias: 21, canal: 'linkedin', activo: true },
    { paso: 'R4', nombre: 'Pedir el decisor', espera_dias: 28, canal: 'whatsapp_si_hay_telefono', activo: true },
    { paso: 'R5', nombre: 'Reapertura fase 2', espera_dias: 15, canal: 'linkedin', activo: true },
    { paso: 'R6', nombre: 'Seguimiento fase 2', espera_dias: 15, canal: 'linkedin', activo: true },
    { paso: 'R7', nombre: 'Caso concreto fase 2', espera_dias: 21, canal: 'linkedin', activo: true },
    { paso: 'R8', nombre: 'Último intento fase 2', espera_dias: 28, canal: 'whatsapp_si_hay_telefono', activo: true },
  ],
};

const ORDEN: Paso[] = ['R0', 'R1', 'R2', 'R3', 'R4', 'R5', 'R6', 'R7', 'R8'];

/** Los pasos de Fase 2: R5 a R8 (D04). Fase 2 no es un estado, es estar acá. */
export function esFase2(etapa: Paso): boolean {
  return ['R5', 'R6', 'R7', 'R8'].includes(etapa);
}

export function configDe(config: ConfigCadencia, paso: Paso): PasoConfig | undefined {
  return config.pasos.find((p) => p.paso === paso);
}

/**
 * El paso que sigue a uno dado. `undefined` cuando la cadencia terminó (después de R8).
 * Los pasos pausados se saltean: el lead sigue de largo al siguiente activo (§5.1).
 */
export function siguientePaso(config: ConfigCadencia, etapa: Paso): Paso | undefined {
  if (etapa === 'R0-recontacto') return 'R1';
  const i = ORDEN.indexOf(etapa);
  if (i === -1) return undefined;
  for (let j = i + 1; j < ORDEN.length; j++) {
    const siguiente = ORDEN[j]!;
    if (configDe(config, siguiente)?.activo !== false) return siguiente;
  }
  return undefined;
}

/**
 * Cuántos días esperar después de enviar `etapa`.
 *
 * D15: si el paso empuja a Fase 2 (es R4 y Fase 2 está activa), son los 90 días
 * de Fase 2 y NO los 28 de la fila R4. Los 90 reemplazan, no se suman.
 */
export function esperaDespuesDe(config: ConfigCadencia, etapa: Paso): number {
  if (empujaAFase2(config, etapa)) return config.fase2_dias;
  return configDe(config, etapa)?.espera_dias ?? 0;
}

/** R4 con Fase 2 activa es el único paso que empuja a Fase 2 (§5.1). */
export function empujaAFase2(config: ConfigCadencia, etapa: Paso): boolean {
  return etapa === 'R4' && config.fase2_activa;
}

/** Suma días a una fecha ISO (YYYY-MM-DD) sin arrastrar husos horarios. */
export function sumarDias(fechaIso: string, dias: number): string {
  const [a, m, d] = fechaIso.split('-').map(Number) as [number, number, number];
  const t = Date.UTC(a, m - 1, d) + dias * 86_400_000;
  return new Date(t).toISOString().slice(0, 10);
}

/** El canal por el que sale un paso. WhatsApp cae a LinkedIn si no hay teléfono (§5.1). */
export function canalDe(config: ConfigCadencia, etapa: Paso, tieneTelefono: boolean): Canal {
  const canal = configDe(config, etapa)?.canal ?? 'linkedin';
  if (canal === 'whatsapp_si_hay_telefono') return tieneTelefono ? 'whatsapp' : 'linkedin';
  return canal;
}

/** Lo que cambia en el lead al enviar un paso. La fecha se PROPONE, no se fija (§5.10). */
export interface ResultadoEnvio {
  etapa: Paso;
  situacion: Situacion;
  /** Fecha propuesta para el próximo contacto. `null` si la cadencia terminó. */
  proximo_contacto_propuesto: string | null;
  /** Etiquetas que el sistema agrega solo. */
  etiquetas_a_agregar: string[];
  canal: Canal;
}

/**
 * Calcula el efecto de enviar el paso `etapa` un día dado.
 *
 * No escribe nada: devuelve lo que habría que aplicar. Quien llama decide si lo
 * aplica solo (worker) o se lo propone al usuario (ficha). Es la misma cuenta en
 * los dos casos: lo único que cambia es quién aprieta el botón.
 */
export function alEnviar(
  config: ConfigCadencia,
  lead: LeadCadencia,
  hoyIso: string,
): ResultadoEnvio {
  const etapa = lead.etapa;
  const etiquetas = ['Recordatorio'];
  if (empujaAFase2(config, etapa)) etiquetas.push('Fase 2');

  const siguiente = siguientePaso(config, etapa);
  const espera = esperaDespuesDe(config, etapa);

  return {
    etapa,
    situacion: siguiente ? 'en_curso' : 'agotado',
    proximo_contacto_propuesto: siguiente ? sumarDias(hoyIso, espera) : null,
    etiquetas_a_agregar: etiquetas,
    canal: canalDe(config, etapa, lead.tiene_telefono),
  };
}

/**
 * ¿A este lead le toca hoy?
 *
 * Con D17 la pregunta es una sola condición: solo los `en_curso` con la fecha
 * cumplida. Un lead que contestó, uno pausado, uno agotado y uno descartado
 * quedan afuera sin necesidad de mirar la etapa.
 */
export function tocaHoy(
  lead: { situacion: Situacion; proximo_contacto: string | null },
  hoyIso: string,
): boolean {
  if (lead.situacion !== 'en_curso') return false;
  if (!lead.proximo_contacto) return false;
  return lead.proximo_contacto <= hoyIso;
}

/** El lead respondió: la cadencia automática se detiene y el seguimiento pasa a manual (§5.1). */
export function alResponder(situacion: Situacion): Situacion {
  return situacion === 'descartado' ? 'descartado' : 'contesto';
}


/* ---------------------------------------------------------------------------
 * La secuencia de la ficha (§7.2)
 * ------------------------------------------------------------------------ */

/** Los nueve pasos, en orden. La reinvitación no entra: es otra vuelta. */
export const SECUENCIA: Paso[] = ['R0', 'R1', 'R2', 'R3', 'R4', 'R5', 'R6', 'R7', 'R8'];

export interface PasoDeLaSecuencia {
  paso: Paso;
  /** Ya se mandó. */
  enviado: boolean;
  /** El idioma en que salió, si se mandó. */
  idioma?: string;
  /** Es el que toca ahora: el primero sin enviar. */
  toca: boolean;
}

/**
 * La secuencia `R0 ✓ · R1 ✓ · R2 · R3 …` de Enviar mensaje.
 *
 * Reemplaza al desplegable «Paso: R2 (toca)». La diferencia no es de estilo: el
 * desplegable dice cuál toca pero esconde el resto, así que para saber si el R1
 * salió —y en qué idioma— había que abrir el historial. La secuencia muestra
 * las dos cosas de un vistazo, que es lo que uno mira antes de escribir.
 *
 * El que TOCA es el primero sin enviar, no el siguiente al último enviado: si
 * alguien mandó el R3 salteándose el R2, el que falta sigue siendo el R2 y la
 * fila tiene que decirlo.
 */
export function secuenciaDe(
  envios: { paso: string; idioma?: string; enviado_en?: string }[],
): PasoDeLaSecuencia[] {
  const porPaso = new Map<string, { idioma?: string; enviado_en?: string }>();
  for (const e of envios) {
    const previo = porPaso.get(e.paso);
    // Si el mismo paso salió dos veces, manda el más reciente: es el idioma
    // con el que la conversación quedó.
    if (!previo || String(e.enviado_en ?? '') >= String(previo.enviado_en ?? '')) {
      porPaso.set(e.paso, { idioma: e.idioma, enviado_en: e.enviado_en });
    }
  }

  let yaTocó = false;
  return SECUENCIA.map((paso) => {
    const e = porPaso.get(paso);
    const enviado = Boolean(e);
    const toca = !enviado && !yaTocó;
    if (toca) yaTocó = true;
    return { paso, enviado, idioma: e?.idioma, toca };
  });
}
