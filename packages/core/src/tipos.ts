// Tipos compartidos por las reglas de negocio.
// Fuente: §3 del manual y las decisiones cerradas de su §14.

/** Los pasos de la cadencia. R0-recontacto es la reinvitación (D24). */
export type Paso =
  | 'R0' | 'R1' | 'R2' | 'R3' | 'R4' | 'R5' | 'R6' | 'R7' | 'R8'
  | 'R0-recontacto';

/**
 * Qué hay que hacer con el lead (D17). Es el eje que decide comportamiento;
 * `etapa` solo dice dónde está en el recorrido.
 */
export type Situacion =
  | 'en_curso'
  | 'contesto'
  | 'pausado'
  | 'agotado'
  | 'esperando_recontacto'
  | 'descartado';

export type Canal = 'linkedin' | 'whatsapp';
export type Idioma = 'es' | 'pt' | 'en';

/** Un paso de la cadencia, tal como se configura en Automatizaciones -> Seguimiento. */
export interface PasoConfig {
  paso: Paso;
  nombre: string;
  /** Días hasta el paso siguiente, contados desde el envío de este. */
  espera_dias: number;
  /** 'whatsapp_si_hay_telefono' cae a LinkedIn cuando el lead no tiene teléfono. */
  canal: Canal | 'whatsapp_si_hay_telefono';
  /** Un paso pausado no dispara envíos y el lead queda esperando (§5.1). */
  activo: boolean;
}

/**
 * Configuración de la cadencia. Nunca constantes en el código: el usuario edita
 * nombres y esperas desde Automatizaciones (§5.1).
 */
export interface ConfigCadencia {
  pasos: PasoConfig[];
  /** Días que se corre el próximo contacto al pasar a Fase 2 (D15). */
  fase2_dias: number;
  /** Si está apagado, R4 usa su espera normal y no hay salto a Fase 2. */
  fase2_activa: boolean;
}

/** Estado mínimo de un lead para calcular el paso siguiente. */
export interface LeadCadencia {
  etapa: Paso;
  situacion: Situacion;
  tiene_telefono: boolean;
}

