import { useCallback, useEffect, useRef, useState } from 'react';
import { puede, puedeEditarLead, type Clave, type Rol } from '@crm/core/permisos';
import { pb } from '../../lib/pocketbase';
import type { LeadRecord, UsuarioRecord } from '../../lib/types';

/** El permiso se resuelve con la misma función que usará la API (§6.2). */
export function puedeUsuario(usuario: UsuarioRecord | null, clave: Clave): boolean {
  if (!usuario) return false;
  return puede({ rol: usuario.rol as Rol, permisos: usuario.permisos ?? {} }, clave);
}

/**
 * Si este usuario puede EDITAR este lead. Es un eje distinto de la visibilidad:
 * el nivel de la asignación dice si puede tocarlo; los permisos verTelefono,
 * verEmails y verLinks dicen qué campos ve.
 */
export function puedeEditar(usuario: UsuarioRecord | null, lead: LeadRecord | null): boolean {
  if (!usuario || !lead) return false;
  return puedeEditarLead(
    { rol: usuario.rol as Rol, permisos: usuario.permisos ?? {} },
    { asignado: lead.asignado, nivel_asignacion: lead.nivel_asignacion },
    usuario.id,
  );
}

export function useLeads(usuario: UsuarioRecord | null) {
  const [leads, setLeads] = useState<LeadRecord[]>([]);
  // Para saber si ya hubo una carga sin meter  en las dependencias de
  // recargar (que lo haria recrearse en cada cambio y disparar un bucle).
  const leadsRef = useRef<LeadRecord[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const recargar = useCallback(async () => {
    if (!usuario) return;
    // `cargando` solo en la PRIMERA carga. Si se prendiera en cada refresco, la
    // sección se desmontaría y volvería a montar con cada guardado: se pierde
    // el estado interno (qué usuario estabas mirando, qué bloque abierto) y la
    // pantalla parpadea. Un refresco no es una carga.
    setCargando((c) => (leadsRef.current.length === 0 ? true : c));
    setError(null);
    try {
      // Sin verTodosLeads, el colaborador ve solo los asignados (§6.3).
      // El filtro va en la consulta, no en el render: si se filtrara en el
      // cliente, los leads ajenos igual habrían viajado por la red.
      const filtro = puedeUsuario(usuario, 'verTodosLeads')
        ? ''
        : `asignado = "${usuario.id}"`;

      // TODO(escala): §7.2 pide renderizar de a 80 y sumar al hacer scroll.
      // Con los datos de demo entran todos; con 1.500+ leads hay que paginar.
      const registros = await pb.collection('lead').getFullList<LeadRecord>({
        expand: 'perfil,cuenta,asignado,etiquetas',
        filter: filtro,
        sort: 'proximo_contacto',
      });
      setLeads(registros);
      leadsRef.current = registros;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setCargando(false);
    }
  }, [usuario]);

  useEffect(() => {
    void recargar();
  }, [recargar]);

  return { leads, cargando, error, recargar };
}
