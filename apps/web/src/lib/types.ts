// Tipos que reflejan el esquema de packages/db/pb_migrations/1788600000_crm_etapa1.js.
// Si el esquema cambia, este archivo es el primero que hay que tocar.

export type Etapa =
  | 'R0' | 'R0-recontacto' | 'R1' | 'R2' | 'R3' | 'R4' | 'R5' | 'R6' | 'R7' | 'R8';

export type Situacion =
  | 'en_curso' | 'contesto' | 'pausado' | 'agotado' | 'esperando_recontacto' | 'descartado';

export type Rol = 'administrador' | 'colaborador';
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
}

export interface EtiquetaRecord {
  id: string;
  nombre: string;
  del_sistema: boolean;
}

export interface UsuarioRecord {
  id: string;
  name: string;
  email: string;
  rol: Rol;
  estado: EstadoUsuario;
  permisos: Partial<Record<string, boolean>>;
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
