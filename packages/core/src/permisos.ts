// Permisos. Implementa docs/01-negocio/permisos.md (§6.2).

export const CLAVES = [
  'verTodosLeads',
  'enviarMensajes',
  'colaEnvios',
  'importarLeads',
  'automatizaciones',
  'vencimientos',
  'repositorio',
  'baseCompartida',
  'cuentasConectadas',
  'usuarios',
  'tareas',
  'agenda',
] as const;

export type Clave = (typeof CLAVES)[number];
export type Rol = 'administrador' | 'colaborador';

/** Preset del colaborador: lo único que tiene prendido por defecto (§6.3). */
const PRESET_COLABORADOR: Clave[] = ['tareas', 'agenda'];

export interface UsuarioPermisos {
  rol: Rol;
  /** Overrides por usuario. Lo que no está acá se resuelve por el rol. */
  permisos: Partial<Record<Clave, boolean>>;
}

/**
 * El rol es un preset, no una jaula (§6.2).
 *
 *   1. hay override explícito -> ese valor
 *   2. es administrador       -> true
 *   3. está en el preset      -> true
 *   4. si no                  -> false
 */
export function puede(usuario: UsuarioPermisos, clave: Clave): boolean {
  const override = usuario.permisos?.[clave];
  if (typeof override === 'boolean') return override;
  if (usuario.rol === 'administrador') return true;
  return PRESET_COLABORADOR.includes(clave);
}

/** Para la tabla de la ficha del usuario: dice si el valor viene del rol o fue editado. */
export function origen(usuario: UsuarioPermisos, clave: Clave): 'por rol' | 'editado' {
  return typeof usuario.permisos?.[clave] === 'boolean' ? 'editado' : 'por rol';
}

/** Volver al preset del rol es simplemente borrar los overrides (§6.2). */
export function volverAlPreset(usuario: UsuarioPermisos): UsuarioPermisos {
  return { rol: usuario.rol, permisos: {} };
}

export function permisosEfectivos(usuario: UsuarioPermisos): Record<Clave, boolean> {
  return Object.fromEntries(CLAVES.map((c) => [c, puede(usuario, c)])) as Record<Clave, boolean>;
}
