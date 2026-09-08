import { useCallback, useEffect, useState } from 'react';
import { enSuZona } from '@crm/core/reunion';
import { pb } from '../../lib/pocketbase';
import type { LeadRecord } from '../../lib/types';

/** La zona en que se mira la agenda. D23: la base guarda UTC. */
const ZONA = Intl.DateTimeFormat().resolvedOptions().timeZone;

export interface EventoAgenda {
  id: string;
  lead: string;
  /** Día y hora YA en la zona de quien mira, no en UTC. */
  fecha: string;
  hora: string;
  duracion: number;
  estado: string;
  notas: string;
  nombre: string;
  empresa: string;
  cargo: string;
  cuenta: string;
  telefono: string;
  slug: string;
  /** De quién es la reunión. Vacío = sin asignar. */
  duenio: string;
}

interface ReunionCruda {
  id: string;
  lead: string;
  inicio: string;
  zona: string;
  duracion_min: number;
  estado: string;
  notas: string;
  expand?: {
    lead?: {
      id: string;
      asignado?: string;
      expand?: {
        perfil?: { nombre?: string; empresa?: string; cargo?: string; telefono?: string; slug?: string };
        cuenta?: { abrev?: string };
        asignado?: { name?: string };
      };
    };
  };
}

/**
 * Las reuniones para la agenda, ya convertidas a la zona de quien mira.
 *
 * La conversión se hace ACÁ y no al dibujar: si cada celda de la grilla llamara
 * a `enSuZona` serían cientos de conversiones por render, y peor, un evento
 * podría quedar en dos casillas distintas según por dónde se lo mire.
 */
export function useAgenda(activo: boolean) {
  const [eventos, setEventos] = useState<EventoAgenda[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const recargar = useCallback(async () => {
    if (!activo) return;
    try {
      const rs = await pb.collection('reunion').getFullList<ReunionCruda>({
        expand: 'lead.perfil,lead.cuenta,lead.asignado',
        sort: 'inicio',
      });
      setEventos(
        rs.map((r) => {
          const local = enSuZona(r.inicio, r.zona || ZONA);
          const p = r.expand?.lead?.expand?.perfil;
          return {
            id: r.id,
            lead: r.expand?.lead?.id ?? r.lead,
            fecha: local.slice(0, 10),
            hora: local.slice(11, 16),
            duracion: r.duracion_min || 30,
            estado: r.estado || 'pendiente',
            notas: r.notas ?? '',
            nombre: p?.nombre ?? '',
            empresa: p?.empresa ?? '',
            cargo: p?.cargo ?? '',
            cuenta: r.expand?.lead?.expand?.cuenta?.abrev ?? '',
            telefono: p?.telefono ?? '',
            slug: p?.slug ?? '',
            duenio: r.expand?.lead?.expand?.asignado?.name ?? '',
          };
        }),
      );
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setCargando(false);
    }
  }, [activo]);

  useEffect(() => {
    void recargar();
  }, [recargar]);

  /**
   * Mueve una reunión a otro día y hora.
   *
   * Se reconstruye el instante desde la fecha y hora LOCALES: `new Date(...)`
   * sin zona los interpreta en la del navegador, que es justo la que se está
   * mirando. Guardar el string tal cual dejaría la reunión corrida por el huso.
   */
  const mover = useCallback(
    async (id: string, fecha: string, hora: string) => {
      const inicio = new Date(`${fecha}T${hora}:00`).toISOString();
      await pb.collection('reunion').update(id, { inicio, zona: ZONA });
      await recargar();
    },
    [recargar],
  );

  const cambiarEstado = useCallback(
    async (id: string, estado: string) => {
      await pb.collection('reunion').update(id, { estado });
      await recargar();
    },
    [recargar],
  );

  const guardarNotas = useCallback(
    async (id: string, notas: string) => {
      await pb.collection('reunion').update(id, { notas });
      await recargar();
    },
    [recargar],
  );

  return { eventos, cargando, error, recargar, mover, cambiarEstado, guardarNotas };
}

/** Los leads con seguimiento, para la vista Lista. */
export function leadsConSeguimiento(leads: LeadRecord[]): LeadRecord[] {
  // §7.6: la vista Lista es "una fila por lead con seguimiento". Los
  // descartados y los agotados no se siguen: mostrarlos llenaría la tabla de
  // filas sobre las que no hay nada que hacer.
  return leads.filter((l) => l.situacion !== 'descartado' && l.situacion !== 'agotado');
}
