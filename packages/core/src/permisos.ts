// Permisos. Implementa docs/01-negocio/permisos.md (§6.2) y el anexo de
// Control de proyectos (rol Observador y las claves control/followup/waPersonal).

export const CLAVES = [
  // --- secciones ---
  // followup y waPersonal dejaron de ser fijas y pasaron a ser permisos: es lo
  // que permite que un rol se quede sin ellas (anexo Control §5).
  'followup',
  'waPersonal',
  'control',
  'automatizaciones',
  'usuarios',

  // --- herramientas ---
  'colaEnvios',
  'importarLeads',
  'vencimientos',
  'repositorio',
  'baseCompartida',
  'cuentasConectadas',
  'tareas',
  'agenda',

  // --- alcance y acciones ---
  'verTodosLeads',
  'enviarMensajes',

  // --- visibilidad de datos sensibles ---
  // Separadas para que el administrador pueda decidir, por persona, qué ve.
  // Un colaborador puede seguir un lead sin acceder a los datos de contacto.
  'verTelefono',
  'verEmails',
  'verLinks',
  'verConversaciones',
] as const;

export type Clave = (typeof CLAVES)[number];
export type Rol = 'administrador' | 'colaborador' | 'observador';

/** Nivel de la asignación de un lead a un colaborador. */
export type NivelAsignacion = 'lectura' | 'seguimiento';

/**
 * Presets por rol. El rol es un preset, no una jaula: cualquier clave se puede
 * prender o apagar por usuario (§6.2).
 */
const PRESETS: Record<Rol, readonly Clave[]> = {
  // El administrador tiene todo; se resuelve por regla, no por lista.
  administrador: CLAVES,

  colaborador: [
    'followup',
    'waPersonal',
    'tareas',
    'agenda',
    'verTelefono',
    'verEmails',
    'verLinks',
    'verConversaciones',
  ],

  // Solo lectura, y solo Control: no ve prospección ni datos de contacto
  // (anexo Control §5).
  observador: ['control', 'verTodosLeads'],
};

export interface UsuarioPermisos {
  rol: Rol;
  /** Overrides por usuario. Lo que no está acá se resuelve por el rol. */
  permisos: Partial<Record<Clave, boolean>>;
}

/**
 * §6.2:
 *   1. hay override explícito -> ese valor
 *   2. es administrador       -> true
 *   3. está en el preset      -> true
 *   4. si no                  -> false
 */
export function puede(usuario: UsuarioPermisos, clave: Clave): boolean {
  const override = usuario.permisos?.[clave];
  if (typeof override === 'boolean') return override;
  if (usuario.rol === 'administrador') return true;
  return PRESETS[usuario.rol]?.includes(clave) ?? false;
}

/** Para la tabla de la ficha del usuario: si el valor viene del rol o fue editado. */
export function origen(usuario: UsuarioPermisos, clave: Clave): 'por rol' | 'editado' {
  return typeof usuario.permisos?.[clave] === 'boolean' ? 'editado' : 'por rol';
}

/** Volver al preset del rol es borrar los overrides (§6.2). */
export function volverAlPreset(usuario: UsuarioPermisos): UsuarioPermisos {
  return { rol: usuario.rol, permisos: {} };
}

export function permisosEfectivos(usuario: UsuarioPermisos): Record<Clave, boolean> {
  return Object.fromEntries(CLAVES.map((c) => [c, puede(usuario, c)])) as Record<Clave, boolean>;
}

/**
 * Si puede EDITAR un lead puntual.
 *
 * Son dos ejes independientes y conviene no mezclarlos: el nivel de la
 * asignación dice si puede tocar ESE lead; los permisos de visibilidad dicen
 * qué campos ve. Un colaborador puede seguir un lead sin ver el teléfono, y
 * puede ver un lead completo sin poder editarlo.
 */
export function puedeEditarLead(
  usuario: UsuarioPermisos,
  lead: { asignado?: string | null; nivel_asignacion?: NivelAsignacion | null },
  usuarioId: string,
): boolean {
  if (usuario.rol === 'administrador') return true;
  if (usuario.rol === 'observador') return false;
  if (lead.asignado !== usuarioId) return false;
  // Sin nivel cargado se asume seguimiento: es como funcionaba antes de que
  // existieran los dos modos, y no rompe los leads ya asignados.
  return (lead.nivel_asignacion ?? 'seguimiento') === 'seguimiento';
}

/** La primera sección que ve el usuario al entrar (anexo Control §5.2). */
export function seccionInicial(usuario: UsuarioPermisos): 'followup' | 'control' | 'waPersonal' | null {
  for (const s of ['followup', 'control', 'waPersonal'] as const) {
    if (puede(usuario, s)) return s;
  }
  return null;
}

// ------------------------------------------------------- lineas de negocio

/**
 * Las dos lineas. Cada cuenta de invitacion pertenece a una, y el lead la
 * hereda de su cuenta: asi no se puede cargar inconsistente.
 */
export type LineaNegocio = 'ia' | 'inversiones';

export const LINEAS: LineaNegocio[] = ['ia', 'inversiones'];

/** Como se llaman de verdad, que es como las nombra el equipo. */
export const NOMBRE_LINEA: Record<LineaNegocio, string> = {
  ia: 'Globalita',
  inversiones: 'SENG',
};

export const DETALLE_LINEA: Record<LineaNegocio, string> = {
  ia: 'Producto de inteligencia artificial. David, Alejandro, Edith, Francisco y Bruno.',
  inversiones: 'Propuestas de inversion. Hoy, solo la cuenta de Alberto Cordoba.',
};

export interface UsuarioDeControl extends UsuarioPermisos {
  /**
   * A que linea esta limitado su Control. Vacio = ve las dos.
   *
   * No es un permiso de la lista: los permisos son si/no y esto es un alcance.
   * Meterlo entre las claves obligaria a inventar `controlIa` y
   * `controlInversiones`, y con una tercera linea habria que tocar el codigo.
   */
  linea_control?: LineaNegocio | '' | null;
}

/**
 * Que lineas ve este usuario en Control.
 *
 * Control es un permiso especial: se le da a alguien de afuera del equipo de
 * prospeccion — el socio de IT en Globalita, el socio de inversiones en SENG —
 * y cada uno tiene que ver SU negocio, no el del otro. Por eso el alcance va
 * aparte del permiso.
 *
 * Sin `control` no ve ninguna. Con `control` y sin linea, ve las dos.
 */
export function lineasDeControl(usuario: UsuarioDeControl): LineaNegocio[] {
  if (!puede(usuario, 'control')) return [];
  const suya = usuario.linea_control;
  return suya && LINEAS.includes(suya) ? [suya] : [...LINEAS];
}

/**
 * Si un proyecto o una reunion de esta linea le corresponde.
 *
 * Lo que NO tiene linea cargada se muestra a quien ve las dos, y se esconde a
 * quien esta limitado a una. Es la unica opcion segura: mostrarselo igual
 * filtraria mal hacia el lado que expone datos del otro negocio.
 */
export function veLineaEnControl(
  usuario: UsuarioDeControl,
  linea: LineaNegocio | '' | null | undefined,
): boolean {
  const suyas = lineasDeControl(usuario);
  if (!suyas.length) return false;
  if (!linea) return suyas.length === LINEAS.length;
  return suyas.includes(linea);
}
