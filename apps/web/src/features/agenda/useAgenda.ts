import { useCallback, useEffect, useState } from 'react';
import { nombreDePersona } from '@crm/core/linkedin';
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
  /** El correo de la otra persona del evento de Google, si Google lo trajo. */
  invitado?: string;
  /** El id del evento en Google. Hace falta para no dibujarlo dos veces. */
  googleId?: string;
  /**
   * Por qué el último movimiento NO llegó a Google, si es que no llegó.
   *
   * Vacío es lo normal. Mover el bloque en la agenda es instantáneo —se
   * escribe en la base y listo— pero el viaje a Google puede fallar: el
   * permiso vencido, Google caído, el evento borrado del otro lado. Sin esto
   * la pantalla diría «movido» y el calendario de verdad seguiría igual, sin
   * que nadie se entere hasta la reunión.
   */
  syncFallo?: string;
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
  /**
   * De dónde salió el bloque.
   *
   * «crm» es una reunión con un lead; «calendario» es cualquier otra cosa del
   * Google Calendar propio —el almuerzo, la clase, la reunión interna— que se
   * dibuja para que la agenda no muestre huecos que no existen, pero que no se
   * puede mover ni editar desde acá.
   */
  origen?: 'crm' | 'calendario';
  /**
   * Si alguien ya dijo «no me acuerdo» y dejamos de preguntar (§7.6).
   *
   * La reunión sigue en «sin dato» —ocurrió y el resultado no se registró, que
   * es cierto— pero la fila deja de pedir un dato que nadie va a poder dar.
   */
  confirmacionArchivada?: boolean;
  /**
   * Un evento de Google que YA se conectó con un lead (§7.6).
   *
   * Deja de ser un bloque anónimo: se pinta como reunión y se abre la ficha.
   * Sigue sin poder moverse —el dueño de ese evento es Google, no el CRM— así
   * que no es lo mismo que `delCrm`.
   */
  vinculado?: boolean;
}


/** Un evento del Google Calendar, como lo guarda la base. */
export interface EventoExternoCrudo {
  id: string;
  titulo: string;
  inicio: string;
  /** El lead con el que se conectó, si alguien ya lo conectó. */
  lead?: string;
}

interface ReunionCruda {
  id: string;
  lead: string;
  inicio: string;
  zona: string;
  duracion_min: number;
  estado: string;
  google_event_id?: string;
  confirmacion_archivada?: boolean;
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
  /**
   * Los eventos del calendario tal como vinieron, sin convertir.
   *
   * La pantalla de conectar necesita AGRUPARLOS por persona, y para eso hace
   * falta el título entero de todos —no sólo los de la semana que se está
   * mirando—: «Brenno» aparece 38 veces repartido en un año, y conectarlo
   * tiene que enganchar los 38, no los 2 que se ven hoy.
   */
  const [externos, setExternos] = useState<EventoExternoCrudo[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const esAdmin = usuario?.rol === 'administrador';

  const recargar = useCallback(async () => {
    if (!activo) return;
    try {
      // Un solo calendario, integrado.
      //
      // Antes había un chip por administrador y se miraba uno a la vez. Para
      // agendar no sirve: la pregunta no es «¿cómo está mi semana?» sino «¿en
      // qué hueco entramos los dos?», y con chips eso obliga a mirar dos veces
      // y recordar la primera. Ahora las reuniones propias van con detalle y
      // los horarios de los demás administradores van en la misma grilla como
      // bloques ocupados, que es todo lo que hace falta para no pisar a nadie.
      const admins = await pb
        .collection('users')
        .getFullList<{ id: string; name: string }>({
          filter: 'rol = "administrador" && estado = "activo"',
          fields: 'id,name',
          sort: 'name',
        })
        .catch(() => []);

      const otros = admins.filter((a) => a.id !== usuario?.id);
      const nombreDe = new Map(otros.map((a) => [a.id, a.name.split(' ')[0]]));

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
          // Para no dibujar dos veces el mismo evento de Google. Ver el
          // dedupe de mas abajo.
          googleId: r.google_event_id ?? '',
          // Sólo el nombre de la persona: el titular de LinkedIn trae el cargo
          // pegado y en un bloque de agenda tapa todo lo demás. El cargo se
          // muestra aparte, en la tarjeta.
          nombre: nombreDePersona(p?.nombre ?? ''),
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
          confirmacionArchivada: Boolean(r.confirmacion_archivada),
          duenio: r.expand?.lead?.expand?.asignado?.name ?? '',
        };
      });

      // ------------------------------------- lo demás del calendario propio
      //
      // 7.3 · La agenda dibujaba sólo las reuniones con leads, así que el
      // jueves parecía libre a las 12 cuando en realidad había un almuerzo. La
      // regla de `evento_externo` ya filtra por dueño: sólo vuelven los
      // propios, con título; los de los demás llegan por `ocupado`, sin él.
      const propiosDelCalendario = await pb
        .collection('evento_externo')
        .getFullList<{
          id: string;
          titulo: string;
          inicio: string;
          duracion_min: number;
          zona: string;
          dia_entero: boolean;
          lead?: string;
          sync_estado?: string;
          sync_detalle?: string;
          invitado_email?: string;
          google_event_id?: string;
        }>({ filter: 'dia_entero = false', sort: 'inicio' })
        .catch(() => []);

      const delCalendario: EventoAgenda[] = propiosDelCalendario.map((x) => {
        const local = enSuZona(x.inicio, x.zona || ZONA);
        return {
          id: x.id,
          // Conectado, el evento pasa a tener lead y la agenda lo trata como
          // lo que es: una reunión con alguien, no un bloque de horario.
          lead: x.lead ?? '',
          vinculado: Boolean(x.lead),
          fecha: local.slice(0, 10),
          hora: local.slice(11, 16),
          duracion: x.duracion_min || 30,
          estado: 'calendario',
          notas: '',
          nombre: x.titulo || '(sin título)',
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
          origen: 'calendario',
          invitado: x.invitado_email ?? '',
          googleId: x.google_event_id ?? '',
          // Sólo se guarda el fallo. «ok» y «omitida» no son noticia: lo que
          // hay que contar es cuando el calendario de verdad quedó distinto.
          syncFallo:
            x.sync_estado === 'error' || x.sync_estado === 'sin_conexion'
              ? x.sync_detalle || 'no se pudo actualizar en Google'
              : '',
        };
      });

      // ------------------------------------------------------ solo ocupado
      //
      // Cuando se mira el calendario de otro, sus horarios salen de la vista
      // `ocupado`, que expone el horario y nada más. No es que se oculte el
      // nombre: no viene en la respuesta.
      let bloques: EventoAgenda[] = [];
      if (otros.length) {
        const ocupados = await pb
          .collection('ocupado')
          .getFullList<{ id: string; calendario: string; inicio: string; zona: string; duracion_min: number }>({
            filter: otros.map((a) => `calendario = "${a.id}"`).join(' || '),
            sort: 'inicio',
          })
          .catch(() => []);
        // Los eventos del propio calendario ya están arriba con su título: no
      // hay que volver a dibujarlos como bloques anónimos.
      const yaLasTengo = new Set([
        ...conDetalle.map((e) => e.id),
        ...delCalendario.map((e) => e.id),
      ]);
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
              // De quién es el hueco SÍ se dice: sin eso, en una grilla con
              // varios calendarios encima no se puede agendar para nadie. Lo
              // que sigue sin decirse es con quién y de qué (§6.3).
              nombre: nombreDe.get(o.calendario) ?? 'Ocupado',
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

      setExternos(
        propiosDelCalendario.map((x) => ({
          id: x.id,
          titulo: x.titulo || '',
          inicio: x.inicio || '',
          lead: x.lead ?? '',
        })),
      );
      // EL MISMO EVENTO DE GOOGLE NO SE DIBUJA DOS VECES.
      //
      // Hoy no se solapan —el reloj busca primero una reunion con ese mismo
      // id de Google y solo si no la encuentra guarda el evento
      // externo— pero en cuanto uno se PROMUEVE a reunión existen los dos: la
      // reunión nueva y la fila vieja, que queda como rastro.
      //
      // Gana la reunión: tiene lead, estado y notas. El externo es el mismo
      // horario con menos datos, así que dibujarlo al lado sería la misma
      // reunión pintada dos veces, una de ellas mintiendo que no tiene estado.
      const idsDeGoogleConReunion = new Set(
        conDetalle.map((r) => r.googleId).filter(Boolean),
      );
      setEventos([
        ...conDetalle,
        ...delCalendario.filter((x) => !x.googleId || !idsDeGoogleConReunion.has(x.googleId)),
        ...bloques,
      ]);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setCargando(false);
    }
  }, [activo, usuario?.id, usuario?.rol, esAdmin]);

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
    async (id: string, fecha: string, hora: string, origen: EventoAgenda['origen'] = 'crm') => {
      const inicio = new Date(`${fecha}T${hora}:00`).toISOString();
      // §7.6 · Los eventos de Google también se mueven, desde el 09/09. Van a
      // OTRA colección: `evento_externo`, no `reunion`. El hook de salida los
      // empuja a Google y avisa al invitado si todavía no pasaron.
      if (origen === 'calendario') {
        await pb.collection('evento_externo').update(id, {
          // PocketBase guarda en UTC con espacio en vez de T.
          inicio: inicio.replace('T', ' '),
          zona: ZONA,
        });
      } else {
        await pb.collection('reunion').update(id, { inicio, zona: ZONA });
      }
      await recargar();
    },
    [recargar],
  );

  /** «No me acuerdo»: se archiva la confirmación, no la reunión (§7.6). */
  const archivarConfirmacion = useCallback(
    async (id: string) => {
      await pb.collection('reunion').update(id, { confirmacion_archivada: true });
      await recargar();
    },
    [recargar],
  );

  /**
   * Conectar todos los eventos de una persona con un lead (§7.6).
   *
   * En serie y no en paralelo: son hasta 45 pedidos para una sola persona, y
   * cuarenta y cinco a la vez contra el servidor de desarrollo devuelven
   * errores de conexión. Un vínculo a medias es peor que ninguno.
   */
  const vincularEventos = useCallback(
    async (ids: string[], leadId: string) => {
      for (const id of ids) {
        await pb.collection('evento_externo').update(id, { lead: leadId });
      }
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

  /**
   * §7.6 · Un evento de Google conectado con un lead pasa a ser una reunión.
   *
   * POR QUÉ ESTO EXISTE. Augusto pidió poder marcar «asistió / no asistió» en
   * el hover de un evento conectado. Pero asistir es un estado de una REUNIÓN
   * del CRM —es lo que alimenta la cadencia y las métricas— y un
   * `evento_externo` no tiene ninguno.
   *
   * Había dos caminos. Sumarle un `estado` a `evento_externo` habría dejado
   * la misma idea escrita en dos tablas, con dos formas de contar cuántas
   * reuniones se hicieron: es la familia 7 del registro. El otro es éste:
   * **marcar la asistencia PROMUEVE el evento a reunión**, una sola vez y
   * porque una persona lo dijo.
   *
   * NO CONTRADICE la migración del vínculo, que decidió no convertirlos en
   * masa: aquello eran 278 eventos de golpe, que habrían duplicado reuniones
   * ya ocurridas y ensuciado las métricas. Esto es uno, a mano, cuando alguien
   * afirma que esa reunión pasó.
   *
   * NO SE BORRA NADA. La fila de `evento_externo` queda como rastro, igual
   * que un perfil fusionado. La sincronización deja de tocarla sola: el reloj
   * busca primero una `reunion` con ese `google_event_id` y, al encontrarla,
   * ya no escribe el evento externo. Y la agenda no la dibuja dos veces
   * porque descarta los externos cuyo id ya tiene una reunión.
   */
  const promoverAReunion = useCallback(
    async (e: EventoAgenda, estado: string) => {
      if (!e.lead) return;
      await pb.collection('reunion').create({
        lead: e.lead,
        inicio: new Date(`${e.fecha}T${e.hora}:00`).toISOString(),
        zona: ZONA,
        duracion_min: e.duracion,
        estado,
        // El id de Google viaja con ella: es lo que evita que el reloj la
        // vuelva a traer como evento externo y lo que la deja seguir
        // sincronizando contra el mismo evento.
        google_event_id: e.googleId ?? '',
        titulo_evento: e.nombre,
        invitado_email: e.invitado ?? '',
      });
      await recargar();
    },
    [recargar],
  );

  /** §7.6: estirar el bloque cambia la duración, y eso se guarda. */
  const cambiarDuracion = useCallback(
    async (id: string, duracion: number, origen: EventoAgenda['origen'] = 'crm') => {
      // Igual que `mover`: el bloque de Google vive en otra colección.
      const coleccion = origen === 'calendario' ? 'evento_externo' : 'reunion';
      await pb.collection(coleccion).update(id, { duracion_min: duracion });
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
    archivarConfirmacion,
    externos,
    vincularEventos,
    cambiarDuracion,
    cambiarProximo,
    cambiarNota,
    pegarFoto,
    nuevaReunion,
    guardarNotas,
    promoverAReunion,
  };
}

/** Los leads con seguimiento, para la vista Lista. */
export function leadsConSeguimiento(leads: LeadRecord[]): LeadRecord[] {
  // §7.6: la vista Lista es "una fila por lead con seguimiento". Los
  // descartados y los agotados no se siguen: mostrarlos llenaría la tabla de
  // filas sobre las que no hay nada que hacer.
  return leads.filter((l) => l.situacion !== 'descartado' && l.situacion !== 'agotado');
}
