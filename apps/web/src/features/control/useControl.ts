import { useCallback, useEffect, useState } from 'react';
import { casaSugerida, type Casa, type Proyecto, type ReunionDelProyecto } from '@crm/core/proyecto';
import type { ReunionMedida } from '@crm/core/metricas';
import { lineasDeControl, veLineaEnControl, type LineaNegocio } from '@crm/core/permisos';
import { pb } from '../../lib/pocketbase';
import type { UsuarioRecord } from '../../lib/types';

interface ProyectoRecord extends Proyecto {
  cuenta: string;
  responsable: string;
  motivo_cierre: string;
  expand?: {
    cuenta?: { abrev?: string; linea_negocio?: string };
    responsable?: { name?: string };
    lead?: { id?: string };
  };
}

/**
 * Las dos formas de nombrar los mismos dos negocios.
 *
 * El PERMISO usa `ia | inversiones` (`users.linea_control`), porque así se
 * cargó y así está en la base. El PROYECTO usa `globalita | seng`, que es como
 * los nombra el equipo y como los nombra el prototipo. En vez de migrar el
 * campo de permisos —tocar datos de usuarios para renombrar dos palabras— se
 * traducen acá, en el único lugar donde los dos vocabularios se cruzan.
 */
const LINEA_DE_CASA: Record<Casa, LineaNegocio> = {
  globalita: 'ia',
  seng: 'inversiones',
};

export interface ProyectoConDatos {
  proyecto: ProyectoRecord;
  reuniones: ReunionDelProyecto[];
  cuenta_abrev: string;
  responsable: string;
  /** De qué negocio es. Vive en el proyecto (campo `casa`). */
  casa: Casa;
  linea: LineaNegocio | null;
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
          linea: (lead?.expand?.cuenta?.linea_negocio ?? null) as LineaNegocio | null,
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

      // El alcance se aplica ACA, no al dibujar: al observador de SENG los
      // proyectos de Globalita no le tienen que llegar al navegador, aunque
      // ninguna pantalla se los muestre.
      const suyo = {
        rol: usuario.rol as never,
        permisos: usuario.permisos ?? {},
        linea_control: usuario.linea_control,
      };
      const mio = (linea: LineaNegocio | null) => veLineaEnControl(suyo, linea);

      setProyectos(
        ps
          .map((p) => {
            // La casa la guarda el proyecto. Si una fila vieja todavía no la
            // tiene, se deduce como al abrirla: así un proyecto sin migrar no
            // desaparece de la pantalla.
            const casa =
              (p.casa as Casa) ||
              casaSugerida(p.tipo, p.expand?.cuenta?.linea_negocio ?? null);
            return {
              proyecto: p,
              reuniones: porProyecto.get(p.id) ?? [],
              cuenta_abrev: p.expand?.cuenta?.abrev ?? '',
              casa,
              linea: LINEA_DE_CASA[casa],
              responsable: p.expand?.responsable?.name ?? '',
            };
          })
          .filter((p) => mio(p.linea)),
      );
      setReuniones(medidas.filter((r) => mio(r.linea)));
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

  const lineas = usuario
    ? lineasDeControl({
        rol: usuario.rol as never,
        permisos: usuario.permisos ?? {},
        linea_control: usuario.linea_control,
      })
    : [];

  return { proyectos, reuniones, lineas, cargando, error, recargar };
}
