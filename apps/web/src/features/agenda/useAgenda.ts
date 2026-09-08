import { useCallback, useEffect, useState } from 'react';
import { enSuZona } from '@crm/core/reunion';
import { pb } from '../../lib/pocketbase';
import type { LeadRecord, UsuarioRecord } from '../../lib/types';

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
  /** §7.6: la tarjeta del evento muestra la ciudad y deja pegar la foto. */
  ciudad: string;
  perfil: string;
  foto: string;
  /**
   * Si la agendó el CRM o vino del calendario.
   *
   * No es lo mismo: la del CRM se puede reagendar y avisar desde acá; la de
   * Google es un bloque que alguien puso en otro lado.
   */
  delCrm: boolean;
  /** De quién es la reunión. Vacío = sin asignar. */
  duenio: string;
  /**
   * Un bloque de otro calendario: se sabe CUÁNDO está tomado y nada más.
   *
   * No es una reunión con los campos vacíos: es otra cosa. Se dibuja gris, no
   * se abre, no se arrastra y no se le cambia el estado. Distinguirlo con un
   * flag y no con «nombre === ''» evita que un evento propio sin nombre
   * cargado se comporte como si fuera ajeno.
   */
  ajeno?: boolean;
}

/** Un calendario que se puede mirar: el propio o el de un administrador. */
export interface Calendario {
  id: string;
  nombre: string;
  /** El propio se ve entero; los demás, solo como bloques ocupados. */
  propio: boolean;
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
        perfil?: {
          id?: string;
          nombre?: string;
          empresa?: string;
          cargo?: string;
          telefono?: string;
          slug?: string;
          ciudad?: string;
          foto?: string;
        };
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
/**
 * §6.3 y §8.6: quién ve qué.
 *
 * Un administrador ve todo con detalle. Un colaborador ve SUS reuniones con
 * detalle y las del administrador que elija como bloques «Ocupado», sin nombre
 * ni empresa — lo justo para no agendar encima.
 *
 * El detalle ajeno no se esconde al dibujar: no se pide. Las reuniones de otro
 * calendario se leen de la colección de vista `ocupado`, que expone solo el
 * horario. Aunque alguien mirara la respuesta de red, el nombre no está.
 */
export function useAgenda(activo: boolean, usuario?: UsuarioRecord | null) {
  const [eventos, setEventos] = useState<EventoAgenda[]>([]);
  const [calendarios, setCalendarios] = useState<Calendario[]>([]);
  /** Cuál se está mirando. `null` = el propio. */
  const [calendario, setCalendario] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const esAdmin = usuario?.rol === 'administrador';

  const recargar = useCallback(async () => {
    if (!activo) return;
    try {
      // Los calendarios que se pueden mirar: el propio y uno por cada
      // administrador. §8.6 es explícito en que no se asuma uno solo — si
      // mañana hay dos admins, aparecen los dos sin tocar código.
      const admins = await pb
        .collection('users')
        .getFullList<{ id: string; name: string }>({
          filter: 'rol = "administrador" && estado = "activo"',
          fields: 'id,name',
          sort: 'name',
        })
        .catch(() => []);

      const propios: Calendario[] = usuario
        ? [{ id: usuario.id, nombre: 'Mi calendario', propio: true }]
        : [];
      const ajenos: Calendario[] = admins
        .filter((a) => a.id !== usuario?.id)
        .map((a) => ({ id: a.id, nombre: `Calendario de ${a.name.split(' ')[0]}`, propio: false }));
      setCalendarios([...propios, ...ajenos]);

      const mirando = calendario ?? usuario?.id ?? null;
      const esPropio = !mirando || mirando === usuario?.id;

      // ------------------------------------------------------ con detalle
      //
      // El administrador ve todo; el colaborador, lo suyo. «Lo suyo» es la
      // reunión que está en su calendario o la de un lead que tiene asignado:
      // agendó él, o la agendó el admin sobre un lead suyo.
      const filtroPropio = esAdmin
        ? ''
        : `calendario = "${usuario?.id ?? ''}" || lead.asignado = "${usuario?.id ?? ''}"`;

      const rs = await pb.collection('reunion').getFullList<ReunionCruda>({
        expand: 'lead.perfil,lead.cuenta,lead.asignado',
        sort: 'inicio',
        ...(filtroPropio ? { filter: filtroPropio } : {}),
      });

      const conDetalle: EventoAgenda[] = rs.map((r) => {
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
          ciudad: p?.ciudad ?? '',
          perfil: p?.id ?? '',
          foto: p?.foto ? pb.files.getURL(p as never, p.foto, { thumb: '96x96' }) : '',
          // Sin `google_event_id` la reunión no llegó a escribirse en el
          // calendario todavía; con él, salió de acá.
          delCrm: true,
          duenio: r.expand?.lead?.expand?.asignado?.name ?? '',
        };
      });

      // ------------------------------------------------------ solo ocupado
      //
      // Cuando se mira el calendario de otro, sus horarios salen de la vista
      // `ocupado`, que expone el horario y nada más. No es que se oculte el
      // nombre: no viene en la respuesta.
      let bloques: EventoAgenda[] = [];
      if (!esPropio && mirando) {
        const ocupados = await pb
          .collection('ocupado')
          .getFullList<{ id: string; inicio: string; zona: string; duracion_min: number }>({
            filter: `calendario = "${mirando}"`,
            sort: 'inicio',
          })
          .catch(() => []);
        const yaLasTengo = new Set(conDetalle.map((e) => e.id));
        bloques = ocupados
          .filter((o) => !yaLasTengo.has(o.id))
          .map((o) => {
            const local = enSuZona(o.inicio, o.zona || ZONA);
            return {
              id: o.id,
              lead: '',
              fecha: local.slice(0, 10),
              hora: local.slice(11, 16),
              duracion: o.duracion_min || 30,
              estado: 'ocupado',
              notas: '',
              nombre: 'Ocupado',
              empresa: '',
              cargo: '',
              cuenta: '',
              telefono: '',
              slug: '',
              ciudad: '',
              perfil: '',
              foto: '',
              delCrm: false,
              duenio: '',
              ajeno: true,
            };
          });
      }

      setEventos([...conDetalle, ...bloques]);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setCargando(false);
    }
  }, [activo, usuario?.id, usuario?.rol, calendario, esAdmin]);

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

  /**
   * §7.6, vista Lista: el próximo contacto se edita ahí mismo.
   *
   * Es la mitad del sentido de esa vista: se recorre el seguimiento y se
   * corrigen fechas sin abrir ficha por ficha.
   */
  const cambiarProximo = useCallback(
    async (leadId: string, fecha: string) => {
      await pb.collection('lead').update(leadId, { proximo_contacto: fecha || null });
    },
    [],
  );

  /** La nota del lead, editada desde la fila. */
  const cambiarNota = useCallback(async (leadId: string, nota: string) => {
    await pb.collection('lead').update(leadId, { nota });
  }, []);

  /**
   * La foto del perfil, pegada del portapapeles (§7.6).
   *
   * Del portapapeles y no de un selector de archivos porque de LinkedIn la
   * foto se copia, no se descarga: bajarla es abrir la imagen en otra pestaña,
   * guardarla y después buscarla. Pegarla es un atajo.
   */
  const pegarFoto = useCallback(
    async (perfilId: string) => {
      const items = await navigator.clipboard.read();
      for (const it of items) {
        const tipo = it.types.find((t) => t.startsWith('image/'));
        if (!tipo) continue;
        const blob = await it.getType(tipo);
        const datos = new FormData();
        datos.append('foto', new File([blob], `foto.${tipo.split('/')[1]}`, { type: tipo }));
        await pb.collection('perfil').update(perfilId, datos);
        await recargar();
        return true;
      }
      return false;
    },
    [recargar],
  );

  /** Una reunión nueva desde la fila, a las 10 del día elegido. */
  const nuevaReunion = useCallback(
    async (leadId: string, fecha: string) => {
      if (!fecha) return;
      await pb.collection('reunion').create({
        lead: leadId,
        inicio: new Date(`${fecha}T10:00:00`).toISOString(),
        zona: ZONA,
        duracion_min: 30,
        estado: 'pendiente',
      });
      await recargar();
    },
    [recargar],
  );

  /** §7.6: estirar el bloque cambia la duración, y eso se guarda. */
  const cambiarDuracion = useCallback(
    async (id: string, duracion: number) => {
      await pb.collection('reunion').update(id, { duracion_min: duracion });
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

  return {
    eventos,
    cargando,
    error,
    recargar,
    mover,
    cambiarEstado,
    cambiarDuracion,
    cambiarProximo,
    cambiarNota,
    pegarFoto,
    nuevaReunion,
    guardarNotas,
    calendarios,
    calendario,
    setCalendario,
  };
}

/** Los leads con seguimiento, para la vista Lista. */
export function leadsConSeguimiento(leads: LeadRecord[]): LeadRecord[] {
  // §7.6: la vista Lista es "una fila por lead con seguimiento". Los
  // descartados y los agotados no se siguen: mostrarlos llenaría la tabla de
  // filas sobre las que no hay nada que hacer.
  return leads.filter((l) => l.situacion !== 'descartado' && l.situacion !== 'agotado');
}
