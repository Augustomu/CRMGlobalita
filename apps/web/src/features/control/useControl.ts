import { useCallback, useEffect, useState } from 'react';
import type { Proyecto, ReunionDelProyecto } from '@crm/core/proyecto';
import type { ReunionMedida } from '@crm/core/metricas';
import { pb } from '../../lib/pocketbase';
import type { UsuarioRecord } from '../../lib/types';

interface ProyectoRecord extends Proyecto {
  cuenta: string;
  responsable: string;
  motivo_cierre: string;
  expand?: {
    cuenta?: { abrev?: string };
    responsable?: { name?: string };
    lead?: { id?: string };
  };
}

export interface ProyectoConDatos {
  proyecto: ProyectoRecord;
  reuniones: ReunionDelProyecto[];
  cuenta_abrev: string;
  responsable: string;
}

/**
 * Todo lo que Control necesita, de una vez.
 *
 * La sección es de solo lectura (§4), así que esto solo lee: quién se abre, se
 * edita o se cierra se decide desde la ficha del lead.
 */
export function useControl(usuario: UsuarioRecord | null) {
  const [proyectos, setProyectos] = useState<ProyectoConDatos[]>([]);
  const [reuniones, setReuniones] = useState<ReunionMedida[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const recargar = useCallback(async () => {
    if (!usuario) {
      setProyectos([]);
      setReuniones([]);
      setCargando(false);
      return;
    }
    try {
      const [ps, rs] = await Promise.all([
        pb.collection('proyecto').getFullList<ProyectoRecord>({
          expand: 'cuenta,responsable',
          sort: '-updated',
        }),
        pb.collection('reunion').getFullList({
          expand: 'lead.perfil,lead.cuenta,lead.asignado',
          sort: '-inicio',
        }),
      ]);

      // Las reuniones se asocian al proyecto por lead (§6): si el lead tiene
      // proyecto, sus reuniones cuentan en ese proyecto.
      const proyectoDeLead = new Map<string, string>();
      for (const p of ps) if (p.lead) proyectoDeLead.set(p.lead, p.id);

      const medidas: ReunionMedida[] = (rs as unknown as Array<Record<string, any>>).map((r) => {
        const lead = r.expand?.lead;
        const perfil = lead?.expand?.perfil;
        return {
          id: r.id,
          inicio: r.inicio ?? '',
          // D23: la hora y la fecha que valen son las de esta zona, no las de
          // la base, que guarda todo en UTC.
          zona: r.zona || 'America/Mexico_City',
          duracion_min: r.duracion_min ?? 0,
          estado: r.estado || 'pendiente',
          nombre: perfil?.nombre ?? '',
          cargo: perfil?.cargo ?? '',
          empresa: perfil?.empresa ?? '',
          pais: perfil?.pais ?? '',
          ciudad: perfil?.ciudad ?? '',
          industria: perfil?.industria ?? '',
          cuenta: lead?.expand?.cuenta?.abrev ?? '',
          genero: lead?.expand?.asignado?.name ?? '',
          nota: r.notas ?? '',
          proyecto: lead ? (proyectoDeLead.get(lead.id) ?? '') : '',
        };
      });

      const porProyecto = new Map<string, ReunionDelProyecto[]>();
      for (const m of medidas) {
        if (!m.proyecto) continue;
        porProyecto.set(m.proyecto, [
          ...(porProyecto.get(m.proyecto) ?? []),
          { id: m.id, inicio: m.inicio, zona: m.zona, estado: m.estado },
        ]);
      }

      setProyectos(
        ps.map((p) => ({
          proyecto: p,
          reuniones: porProyecto.get(p.id) ?? [],
          cuenta_abrev: p.expand?.cuenta?.abrev ?? '',
          responsable: p.expand?.responsable?.name ?? '',
        })),
      );
      setReuniones(medidas);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setCargando(false);
    }
  }, [usuario]);

  useEffect(() => {
    void recargar();
  }, [recargar]);

  return { proyectos, reuniones, cargando, error, recargar };
}
