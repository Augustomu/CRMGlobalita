import { useCallback, useEffect, useState } from 'react';
import { casaSugerida, type Casa, type Proyecto, type ReunionDelProyecto } from '@crm/core/proyecto';
import { etiquetasDeLaCasa, loVeElPartner } from '@crm/core/partner';
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
/**
 * Los leads que ve el partner: los que CONFIRMARON interés en su casa.
 *
 * No es la base entera. Los que no confirmaron no le incumben, y además el
 * partner no tiene por qué ver la prospección (§6.3.1).
 */
/** Una fila de la vista `reunion_control` (migración 1788602000). */
interface ReunionDeControl {
  id: string;
  inicio: string;
  zona: string;
  duracion_min: number;
  estado: string;
  nota: string;
  lead: string;
  nombre: string;
  cargo: string;
  empresa: string;
  pais: string;
  ciudad: string;
  industria: string;
  cuenta: string;
  genero: string;
  linea: string;
}

/** Una fila de la vista `confirmado` (migración 1788601900). */
interface LeadConfirmado {
  id: string;
  nombre: string;
  empresa: string;
  cargo: string;
  pais: string;
  ciudad: string;
  industria: string;
  cuenta: string;
  etapa: string;
  /** Las protegidas, separadas por coma: «PIV, Parceria». */
  etiquetas: string;
  /** Las casas que le corresponden: «globalita,seng». */
  casas: string;
}

export interface LeadDeControl {
  id: string;
  nombre: string;
  empresa: string;
  cargo: string;
  pais: string;
  ciudad: string;
  industria: string;
  cuenta: string;
  etapa: string;
  /** Las etiquetas de SU casa, no todas: el resto no le incumbe. */
  etiquetas: string[];
  casa: Casa;
  reuniones: number;
  ultima: string | null;
  /** Si alguien ya abrió el proyecto. Se puede confirmar interés y no tenerlo. */
  proyecto: string | null;
}

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
  const [leads, setLeads] = useState<LeadDeControl[]>([]);
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
      const [ps, rs, ls] = await Promise.all([
        pb.collection('proyecto').getFullList<ProyectoRecord>({
          expand: 'cuenta,responsable',
          // Sin `fields`, el expand del responsable trae el usuario entero con
          // su email. Acá sólo se usa el nombre.
          fields: [
            '*',
            'expand.cuenta.abrev',
            'expand.cuenta.linea_negocio',
            'expand.responsable.name',
          ].join(','),
          sort: '-updated',
        }),
        // De la vista `reunion_control`, no de `reunion`.
        //
        // Pedirla con `expand=lead.perfil` traía el perfil entero —teléfono,
        // email, links— y el lead entero, que tiene sus propios tres campos de
        // email. La vista trae quién es y de qué cuenta salió, que es lo que
        // Control dibuja, y nada de cómo contactarlo.
        pb.collection('reunion_control').getFullList<ReunionDeControl>({ sort: '-inicio' }),
        // De la vista `confirmado`, no de `lead`.
        //
        // La vista trae SOLO los que confirmaron interés y SOLO las columnas
        // que el partner puede ver. Teléfono, email, links y notas no están en
        // su consulta: no es que se escondan al dibujar, es que no hay pedido
        // que los devuelva. Y su `listRule` ya deja afuera las casas ajenas,
        // así que al partner de Seng los de Globalita no le llegan al
        // navegador.
        pb.collection('confirmado').getFullList<LeadConfirmado>({ sort: 'nombre' }),
      ]);

      // Las reuniones se asocian al proyecto por lead (§6): si el lead tiene
      // proyecto, sus reuniones cuentan en ese proyecto.
      const proyectoDeLead = new Map<string, string>();
      for (const p of ps) if (p.lead) proyectoDeLead.set(p.lead, p.id);

      const medidas: ReunionMedida[] = rs.map((r) => ({
        id: r.id,
        inicio: r.inicio ?? '',
        // D23: la hora y la fecha que valen son las de esta zona, no las de la
        // base, que guarda todo en UTC.
        zona: r.zona || 'America/Mexico_City',
        duracion_min: r.duracion_min ?? 0,
        estado: (r.estado || 'pendiente') as ReunionMedida['estado'],
        nombre: r.nombre,
        cargo: r.cargo,
        empresa: r.empresa,
        pais: r.pais,
        ciudad: r.ciudad,
        industria: r.industria,
        cuenta: r.cuenta,
        genero: r.genero,
        nota: r.nota,
        proyecto: r.lead ? (proyectoDeLead.get(r.lead) ?? '') : '',
        linea: (r.linea || null) as LineaNegocio | null,
      }));

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

      // La lista de leads del partner. Se filtra ACÁ y no al dibujar, por lo
      // mismo que los proyectos: al partner de Seng los leads de Globalita no
      // le tienen que llegar al navegador.
      const proyectoDe = new Map<string, string>();
      for (const pr of ps) if (pr.lead) proyectoDe.set(String(pr.lead), pr.id);

      const reunionesDe = new Map<string, { cuantas: number; ultima: string | null }>();
      for (const r of rs as unknown as Array<Record<string, any>>) {
        const k = String(r.lead ?? '');
        if (!k) continue;
        const previo = reunionesDe.get(k) ?? { cuantas: 0, ultima: null };
        const cuando = String(r.inicio ?? '').slice(0, 10);
        reunionesDe.set(k, {
          cuantas: previo.cuantas + 1,
          ultima: !previo.ultima || cuando > previo.ultima ? cuando : previo.ultima,
        });
      }

      const suyos: LeadDeControl[] = [];
      for (const l of ls) {
        // La vista ya filtró por casa del lado del servidor. Esto vuelve a
        // preguntarlo porque el administrador ve las dos y necesita una fila
        // por casa: un lead con PIV y con Inversión sale dos veces, una en
        // cada panel.
        const nombres = String(l.etiquetas ?? '')
          .split(',')
          .map((x) => x.trim())
          .filter(Boolean);
        for (const casa of ['globalita', 'seng'] as Casa[]) {
          if (!mio(LINEA_DE_CASA[casa])) continue;
          if (!loVeElPartner({ id: l.id, etiquetas: nombres }, casa)) continue;
          const r = reunionesDe.get(l.id) ?? { cuantas: 0, ultima: null };
          suyos.push({
            id: l.id,
            nombre: l.nombre || 'sin nombre',
            empresa: l.empresa,
            cargo: l.cargo,
            pais: l.pais,
            ciudad: l.ciudad,
            industria: l.industria,
            cuenta: l.cuenta,
            etapa: l.etapa,
            etiquetas: etiquetasDeLaCasa({ id: l.id, etiquetas: nombres }, casa),
            casa,
            reuniones: r.cuantas,
            ultima: r.ultima,
            proyecto: proyectoDe.get(l.id) ?? null,
          });
          // Una fila por lead. Si confirmó en las dos casas y el partner ve las
          // dos, se muestra una vez con la primera: son el mismo lead.
          break;
        }
      }
      setLeads(suyos);
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

  return { proyectos, reuniones, leads, lineas, cargando, error, recargar };
}
