import type { EstadoReunion } from '@crm/core/reunion';
// Tipos que reflejan el esquema de packages/db/pb_migrations/1788600000_crm_etapa1.js.
// Si el esquema cambia, este archivo es el primero que hay que tocar.

export type Etapa =
  | 'R0' | 'R0-recontacto' | 'R1' | 'R2' | 'R3' | 'R4' | 'R5' | 'R6' | 'R7' | 'R8';

export type NivelAsignacion = 'lectura' | 'seguimiento';

export type LineaNegocio = 'ia' | 'inversiones';

export type Situacion =
  | 'en_curso' | 'contesto' | 'pausado' | 'agotado' | 'esperando_recontacto' | 'descartado';

export type Rol = 'administrador' | 'colaborador' | 'observador';
export type EstadoUsuario = 'activo' | 'pendiente' | 'suspendido';

export interface PerfilRecord {
  id: string;
  slug: string;
  urn: string;
  huella: string;
  nombre: string;
  cargo: string;
  empresa: string;
  web: string;
  industria: string;
  pais: string;
  ciudad: string;
  resumen: string;
  foto: string;
  telefono: string;
  telefono_raw: string;
  telefono_valido: boolean;
  no_contactar: boolean;
  no_contactar_motivo: string;
  created: string;
  updated: string;
}

export interface CuentaRecord {
  id: string;
  abrev: string;
  nombre_perfil: string;
  slot: number;
  estado_sesion: 'activa' | 'caida' | 'sin_vincular';
  sesion_wa: 'activa' | 'caida' | 'sin_vincular';
  cupo_diario: number;
  objetivo_semanal: number;
  /** Las cuentas estan segmentadas por producto: IA o inversiones. */
  linea_negocio: LineaNegocio;
  /** 7.7 · El perfil de Chrome que tiene la sesion de LinkedIn de esta cuenta. */
  chrome_perfil?: string;
}

export interface EtiquetaRecord {
  id: string;
  nombre: string;
  del_sistema: boolean;
  /** Ultima vez que se aplico a un lead. Ordena las seis que se ofrecen. */
  usada_en: string | null;
}

/** Una entrada del log de ediciones del perfil (cambio 14). */
export interface EdicionRecord {
  id: string;
  perfil: string;
  lead: string;
  usuario: string;
  campo: string;
  antes: string;
  despues: string;
  created: string;
  expand?: { usuario?: { name?: string } };
}

export interface UsuarioRecord {
  id: string;
  name: string;
  email: string;
  rol: Rol;
  estado: EstadoUsuario;
  permisos: Partial<Record<string, boolean>>;
  /**
   * A que linea de negocio esta limitado su Control. Vacio = ve las dos.
   * No es un permiso: los permisos son si/no y esto es un alcance.
   */
  linea_control: LineaNegocio | '';
}

export interface LeadExpand {
  perfil?: PerfilRecord;
  cuenta?: CuentaRecord;
  asignado?: UsuarioRecord;
  etiquetas?: EtiquetaRecord[];
}

export interface LeadRecord {
  id: string;
  perfil: string;
  cuenta: string;
  asignado: string;
  /** lectura = solo ve el estado; seguimiento = edita y escribe. */
  nivel_asignacion: NivelAsignacion | null;
  etapa: Etapa;
  situacion: Situacion;
  motivo_descarte: string;
  proximo_contacto: string;
  lista: string;
  pagina_origen: number | null;
  nota_r0: boolean;
  email: string;
  email2: string;
  email3: string;
  link_chat: string;
  sin_leer_li: boolean;
  sin_leer_wa: boolean;
  /** Cambio 12: marcar asistio o no asistio la archiva. */
  archivada: boolean;
  archivada_motivo: string;
  etiquetas: string[];
  nota: string;
  f_invitacion: string;
  f_aceptacion: string;
  f_respuesta: string;
  f_ultimo_contacto: string;
  f_cancelada: string;
  created: string;
  updated: string;
  expand?: LeadExpand;
}

export interface PlantillaRecord {
  id: string;
  nombre: string;
  paso: string;
  por_defecto: boolean;
  textos: Partial<Record<'es' | 'pt' | 'en', string>>;
  destacado: string;
  /** En que idioma quedo destacado. El chip lo usa al tocarlo (§7.2). */
  destacado_idioma?: 'es' | 'pt' | 'en' | '';
  orden: number;
}

export interface EnvioRecord {
  id: string;
  lead: string;
  paso: string;
  enviado_en: string;
  canal: 'linkedin' | 'whatsapp';
  plantilla: string;
  idioma: 'es' | 'pt' | 'en';
  texto: string;
  a_mano: boolean;
  created: string;
}

export interface ReunionRecord {
  id: string;
  lead: string;
  /** Instante con zona (D23). */
  inicio: string;
  zona: string;
  duracion_min: number;
  estado: EstadoReunion;
  calendario: string;
  notas: string;
  /** D10: para actualizar el evento en vez de duplicarlo. */
  google_event_id: string;
  google_calendar_id: string;
  reagendada_de: string;
}
