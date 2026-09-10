import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { buscable, coincideTodos, terminosDe, type Buscable } from '@crm/core/busqueda';
import { etiquetaDeUltimoEnvio } from '@crm/core/envio';
import { pasaElFiltro, siguienteEstado, tituloDelFiltro, type TresEstados } from '@crm/core/filtro';
import { ETIQUETAS_EN_LA_FILA, etiquetasDeLaFila } from '@crm/core/etiqueta';
import { nombreDePersona } from '@crm/core/linkedin';
import { COLUMNA_LISTA } from '@crm/core/anchos';
import { LOTE, hayQueCrecer, scrollHasta, ventanaPara } from '@crm/core/ventana';
import { useAncho } from '../../lib/useAncho';
import { tocaHoy } from '@crm/core/cadencia';
import { diaLocal } from '@crm/core/fecha';
import type { LeadRecord, UsuarioRecord } from '../../lib/types';
import { BurbujaWhatsApp } from './IconosCanal';
import { tonoDeUltimaReunion } from '@crm/core/reunion';
import { IconoWhatsApp } from '../../ui/iconos';
import { pb } from '../../lib/pocketbase';
import { ColaEnvios } from './ColaEnvios';
import { Conversacion } from './Conversacion';

const HOY = diaLocal();

/** Etiquetas legibles de las seis situaciones de D17. */
export const NOMBRE_SITUACION: Record<string, string> = {
  en_curso: 'En curso',
  contesto: 'Contestó',
  pausado: 'Pausado',
  agotado: 'Agotado',
  esperando_recontacto: 'Esperando recontacto',
  descartado: 'Descartado',
};

/** Iniciales para el avatar del chip de colaborador (prototipo: círculo de 14px). */
export function iniciales(nombre: string): string {
  return (nombre || '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('');
}

/**
 * "hace 3 días" / "en 5 días", como el `contactoLabel` del prototipo.
 * El manual pide lenguaje natural sobre timestamps crudos (§3.2).
 */
/**
 * 3.2 · Sin próximo contacto no se escribe nada.
 *
 * Antes decía «sin próximo contacto», que en una columna de doscientas filas
 * son doscientas repeticiones de una ausencia. El vacío ya dice eso, y deja
 * que el ojo encuentre las filas que SÍ tienen fecha.
 */
function etiquetaContacto(fecha: string | null): string {
  if (!fecha) return '';
  const dias = Math.round(
    (Date.parse(fecha.slice(0, 10)) - Date.parse(HOY)) / 86_400_000,
  );
  if (dias === 0) return 'hoy';
  if (dias === 1) return 'mañana';
  if (dias === -1) return 'ayer';
  if (dias < 0) return `hace ${-dias} días`;
  return `en ${dias} días`;
}

interface Props {
  leads: LeadRecord[];
  seleccionado: string | null;
  onSeleccionar: (id: string) => void;
  usuario: UsuarioRecord | null;
  verColaboradores: boolean;
  /** Sin permiso de ver el teléfono tampoco se muestra la burbuja: el icono
   *  revelaría que el dato existe. */
  veTelefono: boolean;
  /**
   * Qué conversación está abierta, o ninguna. Las dos —LinkedIn y WhatsApp—
   * se abren en el MISMO lugar, arriba de la lista: el switch del header elige
   * el canal. Es la convención del prototipo y evita dos paneles compitiendo
   * por el mismo espacio.
   */
  conversacion?: 'linkedin' | 'whatsapp' | null;
  onCerrarConversacion?: () => void;
  /** §7.2: la cola va al pie, y solo con el permiso `colaEnvios`. */
  veCola: boolean;
  /** Sin permiso de importar no se pasa la función y el botón no existe. */
  onImportar?: () => void;
  /** Cargar un lead a mano. Mismo permiso que importar: es meter gente a la base. */
  onNuevo?: () => void;
  /**
   * Los usuarios a los que se puede asignar, para el chip de agente.
   *
   * Vacío = no se puede reasignar desde acá y el chip queda como una marca.
   */
  usuarios?: UsuarioRecord[];
  puedeAsignar?: boolean;
  onAsignar?: (leadId: string, usuarioId: string | null) => void;
  /**
   * Qué etiquetas mostrar primero en la fila, en orden.
   *
   * Es una preferencia de quien mira, no un dato del lead: con `Frío`,
   * `Recordatorio` y `Caliente` en la misma fila, cuál importa depende de para
   * qué se esté usando la lista ese día.
   */
  preferidas?: string[];
  onPreferidas?: (v: string[]) => void;
}

/** Lo mínimo del último envío de un lead, para la fila. */
export interface UltimoEnvio {
  paso: string;
  enviado_en: string;
}

/**
 * El chip del agente asignado, en la fila (§7.2).
 *
 * Tocarlo abre la lista de gente. Reasignar es una operación de la LISTA —se
 * mira el reparto y se corrige— y hasta ahora obligaba a abrir la ficha de cada
 * lead, que es el gesto contrario al que uno está haciendo.
 *
 * §6.5: hay un responsable y puede haber acompañantes. En la fila entra un
 * chip; cuando son varios, el chip muestra cuántos y el detalle va en el
 * `title`, que es la misma regla que siguen las etiquetas de al lado.
 */
function ChipAgente({
  lead,
  usuarios,
  puedeAsignar,
  onAsignar,
}: {
  lead: LeadRecord;
  usuarios: UsuarioRecord[];
  puedeAsignar: boolean;
  onAsignar?: (leadId: string, usuarioId: string | null) => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const asignado = lead.expand?.asignado;

  if (!puedeAsignar || !onAsignar) {
    if (!asignado) return null;
    return (
      <span className="fila-duenio" title={asignado.name}>
        {iniciales(asignado.name)}
      </span>
    );
  }

  return (
    <span className="fila-agente">
      <button
        type="button"
        className={`fila-duenio fila-duenio-boton ${asignado ? '' : 'fila-duenio-vacio'}`}
        title={asignado ? `${asignado.name} · tocá para reasignar` : 'Sin asignar · tocá para asignar'}
        onClick={(e) => {
          // Sin esto el clic también selecciona el lead y la lista salta.
          e.stopPropagation();
          setAbierto((a) => !a);
        }}
      >
        {asignado ? iniciales(asignado.name) : '+'}
      </button>

      {abierto && (
        <>
          <span
            className="popover-fondo"
            onClick={(e) => {
              e.stopPropagation();
              setAbierto(false);
            }}
          />
          <span className="fila-agentes" onClick={(e) => e.stopPropagation()}>
            {usuarios.map((u) => (
              <button
                key={u.id}
                type="button"
                className={`fila-agente-op ${u.id === lead.asignado ? 'fila-agente-op-on' : ''}`}
                onClick={() => {
                  onAsignar(lead.id, u.id);
                  setAbierto(false);
                }}
              >
                <span className="fila-duenio">{iniciales(u.name)}</span>
                <span>{u.name}</span>
              </button>
            ))}
            {/* §3.6: sin asignación explícita el lead es del administrador. Por
                eso «sin asignar» es una opción y no un estado prohibido. */}
            <button
              type="button"
              className={`fila-agente-op ${lead.asignado ? '' : 'fila-agente-op-on'}`}
              onClick={() => {
                onAsignar(lead.id, null);
                setAbierto(false);
              }}
            >
              <span className="fila-duenio fila-duenio-vacio">—</span>
              <span>Sin asignar</span>
            </button>
          </span>
        </>
      )}
    </span>
  );
}

export function ListaContactos({
  leads,
  conversacion = null,
  onCerrarConversacion,
  usuarios = [],
  puedeAsignar = false,
  onAsignar,
  preferidas = [],
  onPreferidas,
  seleccionado,
  onSeleccionar,
  usuario,
  verColaboradores,
  veTelefono,
  veCola,
  onImportar,
  onNuevo,
}: Props) {
  const [busqueda, setBusqueda] = useState('');
  /**
   * §7.2 · Los chips del buscador. Cada uno achica la lista.
   *
   * Se acumulan con «Y» y no con «o»: lo decidió Augusto el 09/09 sabiendo la
   * contra —«Martín» y «Josefina» juntos dan cero, porque nadie se llama las
   * dos cosas— y a cambio se puede afinar: «Martín» + «Vale» + «gerente».
   */
  const [chips, setChips] = useState<string[]>([]);

  /** Fija lo tecleado como chip. Sin repetidos: dos veces la misma palabra no achica más. */
  const fijarChip = useCallback(() => {
    const t = busqueda.trim();
    if (!t) return;
    setChips((c) => (c.some((x) => x.toLowerCase() === t.toLowerCase()) ? c : [...c, t]));
    setBusqueda('');
  }, [busqueda]);
  /**
   * Cuántas filas se dibujan (§7.2, §11 «transversal desde el día uno»).
   *
   * La base tiene miles de leads. Dibujarlos todos hacía que cada tecla del
   * buscador remontara miles de filas, y el cursor iba atrás de lo que se
   * escribía.
   */
  const [cuantas, setCuantas] = useState(LOTE);
  /**
   * El último envío de cada lead.
   *
   * Una sola consulta para toda la lista, no una por fila: con 189 leads
   * serían 189 pedidos para escribir dos letras en cada una. Se traen sólo
   * `lead`, `paso` y la fecha, ordenados, y se guarda el primero de cada lead.
   */
  const [ultimosEnvios, setUltimosEnvios] = useState<Record<string, UltimoEnvio>>({});
  // 9.4: 260-520, doble clic alterna compacto/normal, persistido.
  const anchoCol = useAncho(COLUMNA_LISTA);
  const refLista = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let vivo = true;
    pb.collection('envio')
      .getFullList<{ lead: string; paso: string; enviado_en: string }>({
        fields: 'lead,paso,enviado_en',
        sort: '-enviado_en',
      })
      .then((es) => {
        if (!vivo) return;
        const m: Record<string, UltimoEnvio> = {};
        // Vienen del más nuevo al más viejo: el primero de cada lead es el suyo.
        for (const e of es) if (!m[e.lead]) m[e.lead] = { paso: e.paso, enviado_en: e.enviado_en };
        setUltimosEnvios(m);
      })
      .catch(() => setUltimosEnvios({}));
    return () => {
      vivo = false;
    };
  }, [leads.length]);
  const [cuenta, setCuenta] = useState('todas');
  const [colaborador, setColaborador] = useState('todos');
  const [soloVencidos, setSoloVencidos] = useState(false);
  // Los ocho filtros de §7.2. Los cuatro de abajo son listas que salen de los
  // datos, no opciones fijas: el catálogo de roles y ciudades lo define la base.
  const [wa, setWa] = useState<TresEstados>('todos');
  const [reunion, setReunion] = useState<'todas' | 'con' | 'sin' | 'asistio' | 'no-asistio'>('todas');
  const [orden, setOrden] = useState<'nuevo' | 'viejo'>('nuevo');
  const [rol, setRol] = useState<string | null>(null);
  const [pais, setPais] = useState<string | null>(null);
  const [ciudad, setCiudad] = useState<string | null>(null);
  const [etiqueta, setEtiqueta] = useState<string | null>(null);

  /**
   * La reunión de cada lead. Hace falta para dos cosas: el filtro por reunión y
   * la fecha con color en la fila (§7.2, verde asistió / rojo no asistió).
   *
   * Se traen todas de una y se indexan, en vez de una consulta por lead: son
   * pocas comparadas con los leads y así la lista no dispara N pedidos.
   */
  const [reuniones, setReuniones] = useState<Map<string, { inicio: string; zona: string; estado: string }>>(
    new Map(),
  );
  useEffect(() => {
    let vivo = true;
    pb.collection('reunion')
      .getFullList<{ lead: string; inicio: string; zona: string; estado: string }>({ sort: '-inicio' })
      .then((rs) => {
        if (!vivo) return;
        const m = new Map<string, { inicio: string; zona: string; estado: string }>();
        // Ordenadas de más nueva a más vieja: la primera de cada lead gana.
        for (const r of rs) if (!m.has(r.lead)) m.set(r.lead, r);
        setReuniones(m);
      })
      .catch(() => vivo && setReuniones(new Map()));
    return () => {
      vivo = false;
    };
  }, [leads]);

  const reunionDe = useCallback((leadId: string) => reuniones.get(leadId) ?? null, [reuniones]);

  /** Las opciones de rol, país, ciudad y etiqueta salen de los datos. */
  const grupos = useMemo(() => {
    const unicos = (vals: (string | undefined)[], vacio: string) =>
      [...new Set(vals.map((v) => v || vacio))].sort((a, b) => a.localeCompare(b));
    return [
      { label: 'Rol', valor: rol, set: setRol, opciones: unicos(leads.map((l) => l.expand?.perfil?.cargo), 'sin cargo') },
      { label: 'País', valor: pais, set: setPais, opciones: unicos(leads.map((l) => l.expand?.perfil?.pais), '—') },
      { label: 'Ciudad', valor: ciudad, set: setCiudad, opciones: unicos(leads.map((l) => l.expand?.perfil?.ciudad), '—') },
      {
        label: 'Etiquetas',
        valor: etiqueta,
        set: setEtiqueta,
        opciones: [...new Set(leads.flatMap((l) => (l.expand?.etiquetas ?? []).map((e) => e.nombre)))].sort(),
      },
    ];
  }, [leads, rol, pais, ciudad, etiqueta]);
  const [filtrosAbierto, setFiltrosAbierto] = useState(false);
  const [pos, setPos] = useState({ left: 0, top: 0 });
  const botonFiltros = useRef<HTMLButtonElement>(null);
  const refBuscar = useRef<HTMLInputElement>(null);

  const cuentas = useMemo(() => {
    const s = new Set<string>();
    for (const l of leads) if (l.expand?.cuenta) s.add(l.expand.cuenta.abrev);
    return [...s].sort();
  }, [leads]);

  const colaboradores = useMemo(() => {
    const m = new Map<string, string>();
    for (const l of leads) if (l.expand?.asignado) m.set(l.expand.asignado.id, l.expand.asignado.name);
    return [...m].map(([id, name]) => ({ id, name }));
  }, [leads]);

  /**
   * §7.2 · TODO lo que de cada lead se puede buscar, armado una sola vez.
   *
   * Augusto lo pidió «como Google Drive, que buscás una frase y te encuentra
   * el archivo que la tiene adentro». Así que va todo: los datos del perfil,
   * los tres correos, LAS NOTAS —que es donde uno escribe lo que después no
   * sabe cómo buscar—, las etiquetas, la etapa, la situación, la lista de
   * origen y la cuenta.
   *
   * EL TELÉFONO VA APARTE Y SÓLO SI SE PUEDE VER (§6.2). Si viajara con el
   * resto, buscar un número y ver aparecer un lead sería una forma de
   * confirmar teléfonos sin tener permiso de verlos.
   *
   * Se memoriza por lead: normalizar el texto entero en cada tecla y por cada
   * chip es el camino corto a que el cursor vaya atrás de lo que uno escribe.
   */
  const buscables = useMemo(() => {
    const m = new Map<string, Buscable>();
    for (const l of leads) {
      const p = l.expand?.perfil;
      m.set(
        l.id,
        buscable(
          [
            p?.nombre, p?.empresa, p?.cargo, p?.industria, p?.ciudad, p?.pais, p?.web, p?.resumen,
            l.email, l.email2, l.email3,
            l.nota, l.archivada_motivo,
            l.etapa, l.situacion, l.lista, l.motivo_descarte,
            l.expand?.cuenta?.abrev,
            l.expand?.asignado?.name,
            ...(l.expand?.etiquetas ?? []).map((e) => e.nombre),
          ],
          veTelefono ? [p?.telefono, p?.telefono_raw] : [],
        ),
      );
    }
    return m;
  }, [leads, veTelefono]);

  const visibles = useMemo(() => {
    const terminos = terminosDe(chips, busqueda);
    return leads
      .filter((l) => {
        const p = l.expand?.perfil;
        if (cuenta !== 'todas' && l.expand?.cuenta?.abrev !== cuenta) return false;
        if (colaborador !== 'todos' && l.asignado !== colaborador) return false;
        if (
          soloVencidos &&
          !tocaHoy({ situacion: l.situacion, proximo_contacto: l.proximo_contacto || null }, HOY)
        ) {
          return false;
        }
        // El teléfono decide, no el permiso: si el filtro dependiera de
        // `veTelefono` daría resultados distintos según quién mira.
        const tieneWa = Boolean(p?.telefono_valido);
        if (!pasaElFiltro(wa, tieneWa)) return false;

        const r = reunionDe(l.id);
        if (reunion === 'con' && !r) return false;
        if (reunion === 'sin' && r) return false;
        if (reunion === 'asistio' && r?.estado !== 'asistio') return false;
        if (reunion === 'no-asistio' && r?.estado !== 'no-asistio') return false;

        // Los cuatro por valor. El vacío tiene su propia opción —«sin cargo»,
        // «—»— para poder buscar justamente lo que falta, que en esta base es
        // la mayoría.
        if (rol && (p?.cargo || 'sin cargo') !== rol) return false;
        if (pais && (p?.pais || '—') !== pais) return false;
        if (ciudad && (p?.ciudad || '—') !== ciudad) return false;
        if (etiqueta && !(l.expand?.etiquetas ?? []).some((e) => e.nombre === etiqueta)) return false;

        // §7.2: todos los chips, contra todo el lead. Sin tildes: la base está
        // llena de «Gonçalves» y «Villagrán», y nadie los escribe con acento
        // cuando los está buscando.
        const b = buscables.get(l.id);
        return b ? coincideTodos(b, terminos) : false;
      })
      // Los vencidos primero SIEMPRE; dentro de cada grupo manda el orden
      // elegido. Es del prototipo: lo que ya venció no puede quedar sepultado
      // abajo porque alguien cambió el orden.
      .sort((a, b) => {
        const x = a.proximo_contacto || '9999';
        const y = b.proximo_contacto || '9999';
        const venA = x < HOY ? 0 : 1;
        const venB = y < HOY ? 0 : 1;
        if (venA !== venB) return venA - venB;
        return orden === 'nuevo' ? y.localeCompare(x) : x.localeCompare(y);
      });
  }, [leads, busqueda, chips, buscables, cuenta, colaborador, soloVencidos, wa, reunion, rol, pais, ciudad, etiqueta, orden, reunionDe]);

  // Cambiar el filtro o la búsqueda vuelve la ventana a 80: mantenerla estirada
  // después de pasar de 3000 leads a 12 sigue costando lo mismo y no muestra
  // nada más.
  useEffect(() => {
    setCuantas(LOTE);
    if (refLista.current) refLista.current.scrollTop = 0;
  }, [busqueda, chips, cuenta, colaborador, soloVencidos, wa, reunion, rol, pais, ciudad, etiqueta, orden]);

  const dibujadas = useMemo(() => visibles.slice(0, cuantas), [visibles, cuantas]);

  /**
   * Traer a la vista el lead elegido desde afuera de la lista.
   *
   * Un atajo o el panel de últimos pueden elegir el lead 900. Si la ventana no
   * se estira, la ficha se abre pero la fila no existe y el scroll no tiene a
   * dónde ir: parece que no pasó nada.
   */
  useEffect(() => {
    if (!seleccionado) return;
    const i = visibles.findIndex((l) => l.id === seleccionado);
    if (i < 0) return;
    const necesaria = ventanaPara(i, cuantas);
    if (necesaria !== cuantas) {
      setCuantas(necesaria);
      return; // se hace scroll en el render siguiente, cuando la fila existe
    }
    const el = refLista.current;
    if (el) el.scrollTop = scrollHasta(i, el.clientHeight);
  }, [seleccionado]);

  /**
   * §7.2 · Los últimos leads que EDITÓ UNA PERSONA, como accesos rápidos.
   *
   * ACÁ HABÍA UN BUG, y es exactamente el mismo de los chats: `lead.updated`
   * NO es «cuándo lo editaste», es «cuándo se tocó la fila». La toca
   * cualquier cosa —una importación, la sincronización de Google, un script
   * de mantenimiento— así que esto mostraba lo último que escribió una
   * máquina. El 09/09 quedaron clavados «Jorge, Marcelo y Fabio» a las 20:09,
   * 16:54 y 16:53: son las tres filas que tocó el importador, no los tres
   * leads que abrió Augusto.
   *
   * Es la familia 6 del registro por séptima vez, y la MISMA trampa de la
   * cuarta: ordenar por `updated` creyendo que dice algo de la persona.
   *
   * La edición humana sí tiene su propio registro —la colección `edicion`,
   * que escribe la ficha— y de ahí sale ahora. Si nadie editó nada todavía la
   * fila no se dibuja: es la verdad, y es mejor que tres nombres que uno no
   * tocó.
   */
  const [ultimosIds, setUltimosIds] = useState<string[]>([]);
  useEffect(() => {
    let vivo = true;
    pb.collection('edicion')
      .getList<{ lead: string }>(1, 40, { fields: 'lead', sort: '-created' })
      .then((r) => {
        if (!vivo) return;
        const vistos: string[] = [];
        for (const e of r.items) {
          if (e.lead && !vistos.includes(e.lead)) vistos.push(e.lead);
          if (vistos.length === 3) break;
        }
        setUltimosIds(vistos);
      })
      .catch(() => {
        // Sin permiso o sin red la fila no aparece. No se inventa.
      });
    return () => {
      vivo = false;
    };
  }, [leads.length]);

  const ultimos = useMemo(
    () => ultimosIds.map((id) => leads.find((l) => l.id === id)).filter(Boolean) as LeadRecord[],
    [ultimosIds, leads],
  );

  // Cuántos filtros hay puestos, para el número del botón (§7.2). El ORDEN no
  // cuenta: siempre hay uno elegido, así que sumarlo daría "1 filtro" con la
  // lista entera a la vista.
  const nFiltros =
    (cuenta !== 'todas' ? 1 : 0) +
    (colaborador !== 'todos' ? 1 : 0) +
    (soloVencidos ? 1 : 0) +
    (wa !== 'todos' ? 1 : 0) +
    (reunion !== 'todas' ? 1 : 0) +
    [rol, pais, ciudad, etiqueta].filter(Boolean).length;

  /** Deja todo como al entrar. */
  function limpiarFiltros() {
    setCuenta('todas');
    setColaborador('todos');
    setSoloVencidos(false);
    setWa('todos');
    setReunion('todas');
    setRol(null);
    setPais(null);
    setCiudad(null);
    setEtiqueta(null);
  }

  // §9.5: el popover se posiciona con coordenadas calculadas desde el botón,
  // para que no lo recorte el scroll de la columna.
  function abrirFiltros() {
    const r = botonFiltros.current?.getBoundingClientRect();
    if (r) setPos({ left: Math.min(r.left, window.innerWidth - 340), top: r.bottom + 6 });
    setFiltrosAbierto((a) => !a);
  }

  const abierto = conversacion ? (leads.find((l) => l.id === seleccionado) ?? null) : null;

  return (
    <aside className="columna-lista" style={anchoCol.estilo}>
      {/* 9.4. El divisor va pegado al borde que da a la ficha. Es de 5px y el
          arrastre se escucha en document: si dependiera del divisor, el panel
          dejaria de seguir al mouse apenas se sale de esos 5px. */}
      <div
        className="divisor divisor-der"
        title="Arrastra para cambiar el ancho de la lista - doble clic para modo compacto"
        {...anchoCol.divisor}
      />
      {/* Se dibuja siempre: vacío ocupa 0 y así el resto de las filas del grid
          no se corren cuando la conversación se abre o se cierra. */}
      <div className={abierto ? 'conv-panel' : ''}>
        {abierto && conversacion && (
          <Conversacion
            lead={abierto}
            canal={conversacion}
            onCerrar={() => onCerrarConversacion?.()}
          />
        )}
      </div>

      {/* fila 2 del grid: buscador de 52px */}
      <div className="lista-buscador">
        {/*
          §7.2 · EL CAMPO ES UNO SOLO aunque tenga chips adentro.

          Los chips van DENTRO del recuadro y no arriba ni al costado: son
          parte de lo que se está buscando, y sacarlos afuera los convierte en
          otro control que hay que aprender aparte. El input crece con lo que
          se escribe y se achica cuando no; el ancho mínimo es para que
          siempre se vea dónde escribir.
        */}
        <div
          className="lista-buscar"
          onClick={(e) => {
            // Tocar cualquier parte del recuadro pone el cursor a escribir.
            // Sin esto, el espacio entre chips es un agujero muerto.
            if (e.target === e.currentTarget) refBuscar.current?.focus();
          }}
        >
          {chips.map((c) => (
            <span key={c} className="lista-chip-buscar">
              {c}
              <button
                type="button"
                title={`Sacar «${c}»`}
                onClick={() => setChips((v) => v.filter((x) => x !== c))}
              >
                ×
              </button>
            </span>
          ))}
          <input
            ref={refBuscar}
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                fijarChip();
                return;
              }
              // Borrar con el campo vacío saca el último chip, que es como se
              // deshace sin tener que apuntarle a una × de 9px.
              if (e.key === 'Backspace' && !busqueda && chips.length) {
                setChips((v) => v.slice(0, -1));
              }
            }}
            placeholder={chips.length ? 'y…' : 'Buscar cualquier dato del lead…'}
            title="Enter agrega una palabra más. Todas tienen que cumplirse."
          />
        </div>
        <button
          ref={botonFiltros}
          type="button"
          title="Filtros"
          className={`boton-icono ${nFiltros > 0 ? 'boton-icono-on' : ''}`}
          onClick={abrirFiltros}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
            <path d="M4 6h16M7 12h10M10 18h4" />
          </svg>
        </button>
        {/* Acceso rápido a WhatsApp: un toque filtra los que lo tienen, dos
            los excluye, tres vuelve a todos.

            El mismo estado que el filtro del popover —no son dos filtros que
            puedan contradecirse—, sólo que acá se llega en un toque. Es la
            pregunta que más se hace sobre esta lista, y abrir el popover para
            responderla eran tres clics.

            Sin permiso de ver el teléfono no aparece: el botón revelaría que el
            dato existe. */}
        {veTelefono && (
          <button
            type="button"
            title={tituloDelFiltro(wa, 'WhatsApp')}
            className={`boton-icono boton-wa-filtro ${wa === 'con' ? 'boton-wa-si' : ''} ${wa === 'sin' ? 'boton-wa-no' : ''}`}
            onClick={() => setWa(siguienteEstado(wa))}
          >
            <IconoWhatsApp />
            {/* La barra sobre el icono es lo que hace legible el tercer
                estado: sin ella, «con» y «sin» se distinguen sólo por el
                color, que es justo lo que no se ve de reojo. */}
            {wa === 'sin' && <span className="boton-wa-barra" />}
          </button>
        )}

        {/* §7.2: las dos formas de meter gente a la base viven acá, al lado
            del buscador. El «+» primero porque es el de todos los días: el
            import es de una tanda, el alta a mano es de un contacto suelto. */}
        {onNuevo && (
          <button type="button" title="Cargar un lead a mano" className="boton-icono" onClick={onNuevo}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>
        )}

        {onImportar && (
          <button type="button" title="Importar leads desde CSV" className="boton-icono" onClick={onImportar}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d="M12 15V4M8 8l4-4 4 4" />
              <path d="M4 15v3a2 2 0 002 2h12a2 2 0 002-2v-3" />
            </svg>
          </button>
        )}
      </div>

      {filtrosAbierto && (
        <>
          <div className="popover-fondo" onClick={() => setFiltrosAbierto(false)} />
          <div className="popover" style={{ left: pos.left, top: pos.top }}>
            <div className="popover-cabecera">
              <span className="popover-titulo">Filtros</span>
              <span className="popover-conteo">
                {nFiltros} activos · {visibles.length} leads
              </span>
              {nFiltros > 0 && (
                <button type="button" className="boton-mini" onClick={limpiarFiltros}>
                  Limpiar
                </button>
              )}
            </div>
            {/* Qué etiquetas se ven en la fila, y en qué orden.
                No es un filtro —no saca leads de la lista— pero vive acá
                porque es la misma pregunta: qué de todo esto quiero ver.
                El orden es el de selección: se tocan en el orden en que se
                las quiere leer. */}
            {onPreferidas && (
              <div className="popover-grupo">
                <span className="campo-label">Etiquetas en la fila</span>
                <div className="chips">
                  {[...new Set(leads.flatMap((l) => (l.expand?.etiquetas ?? []).map((e) => e.nombre)))]
                    .sort()
                    .map((e) => {
                      const i = preferidas.indexOf(e);
                      return (
                        <button
                          key={e}
                          type="button"
                          className={`chip ${i >= 0 ? 'chip-on' : ''}`}
                          title={i >= 0 ? `${i + 1}ª en la fila · tocá para sacarla` : 'Mostrarla primero'}
                          onClick={() =>
                            onPreferidas(
                              i >= 0 ? preferidas.filter((x) => x !== e) : [...preferidas, e],
                            )
                          }
                        >
                          {e}
                          {i >= 0 && <span className="tarea-orden-n tabular">{i + 1}</span>}
                        </button>
                      );
                    })}
                </div>
                <span className="campo-ayuda">
                  Entran {ETIQUETAS_EN_LA_FILA}. El resto se ve al pasar por encima.
                </span>
              </div>
            )}

            <div className="popover-grupo">
              <span className="campo-label">Próximo contacto</span>
              <div className="chips">
                <button
                  type="button"
                  className={`chip ${!soloVencidos ? 'chip-on' : ''}`}
                  onClick={() => setSoloVencidos(false)}
                >
                  todos
                </button>
                <button
                  type="button"
                  className={`chip ${soloVencidos ? 'chip-on' : ''}`}
                  onClick={() => setSoloVencidos(true)}
                >
                  solo vencidos
                </button>
              </div>
            </div>
            <div className="popover-grupo">
              <span className="campo-label">Orden</span>
              <div className="chips">
                {(
                  [
                    ['nuevo', 'más nuevo'],
                    ['viejo', 'más viejo'],
                  ] as const
                ).map(([v, texto]) => (
                  <button
                    key={v}
                    type="button"
                    className={`chip ${orden === v ? 'chip-on' : ''}`}
                    onClick={() => setOrden(v)}
                  >
                    {texto}
                  </button>
                ))}
              </div>
            </div>

            <div className="popover-grupo">
              <span className="campo-label">WhatsApp</span>
              <div className="chips">
                {(
                  [
                    ['todos', 'Todos'],
                    ['con', 'Con WhatsApp'],
                    ['sin', 'Sin WhatsApp'],
                  ] as const
                ).map(([v, texto]) => (
                  <button
                    key={v}
                    type="button"
                    className={`chip ${wa === v ? 'chip-on' : ''}`}
                    onClick={() => setWa(v)}
                  >
                    {texto}
                  </button>
                ))}
              </div>
            </div>

            <div className="popover-grupo">
              <span className="campo-label">Reunión</span>
              <div className="chips">
                {(
                  [
                    ['todas', 'Todas'],
                    ['con', 'Con reunión'],
                    ['sin', 'Sin reunión'],
                    ['asistio', 'Asistió'],
                    ['no-asistio', 'No asistió'],
                  ] as const
                ).map(([v, texto]) => (
                  <button
                    key={v}
                    type="button"
                    className={`chip ${reunion === v ? 'chip-on' : ''}`}
                    onClick={() => setReunion(v)}
                  >
                    {texto}
                  </button>
                ))}
              </div>
            </div>

            {/* Rol, país, ciudad y etiquetas: las opciones salen de los datos.
                Tocar la que ya está puesta la saca, que es como se limpia sin
                tener que ir al botón de arriba. */}
            {grupos.map((g) =>
              g.opciones.length === 0 ? null : (
                <div key={g.label} className="popover-grupo">
                  <span className="campo-label">{g.label}</span>
                  <div className="chips">
                    {g.opciones.map((o) => (
                      <button
                        key={o}
                        type="button"
                        className={`chip ${g.valor === o ? 'chip-on' : ''}`}
                        onClick={() => g.set(g.valor === o ? null : o)}
                      >
                        {o}
                      </button>
                    ))}
                  </div>
                </div>
              ),
            )}
          </div>
        </>
      )}

      {/* fila 3: chips de cuenta */}
      <div className="lista-chips">
        <button
          type="button"
          className={`chip-pastilla ${cuenta === 'todas' ? 'chip-pastilla-on' : ''}`}
          onClick={() => setCuenta('todas')}
        >
          todas
        </button>
        {cuentas.map((a) => (
          <button
            key={a}
            type="button"
            className={`chip-pastilla ${cuenta === a ? 'chip-pastilla-on' : ''}`}
            onClick={() => setCuenta(a)}
          >
            {a}
          </button>
        ))}
      </div>

      {/* fila 4: chips de colaborador, solo para quien ve todos los leads (§7.2) */}
      {verColaboradores && colaboradores.length > 0 && (
        <div className="lista-chips lista-chips-colab">
          <span className="campo-label">Colaborador</span>
          <button
            type="button"
            className={`chip-avatar ${colaborador === 'todos' ? 'chip-avatar-on' : ''}`}
            onClick={() => setColaborador('todos')}
          >
            <span className="avatar avatar-todos" />
            todos
          </button>
          {colaboradores.map((c) => (
            <button
              key={c.id}
              type="button"
              className={`chip-avatar ${colaborador === c.id ? 'chip-avatar-on' : ''}`}
              onClick={() => setColaborador(c.id)}
            >
              <span className="avatar">{iniciales(c.name)}</span>
              {c.name.split(' ')[0]}
            </button>
          ))}
        </div>
      )}

      {/* fila 5: últimos editados */}
      {ultimos.length > 0 && (
        <div className="lista-ultimos">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
            <path d="M4 10a8 8 0 1114 5" />
            <path d="M4 4v6h6" />
          </svg>
          {ultimos.map((l, i) => (
            <button
              key={l.id}
              type="button"
              className={`ultimo ${i === 0 ? 'ultimo-reciente' : ''}`}
              title={l.expand?.perfil?.nombre}
              onClick={() => onSeleccionar(l.id)}
            >
              {(l.expand?.perfil?.nombre ?? '').split(' ')[0]}
            </button>
          ))}
        </div>
      )}

      {/* fila 6: la lista */}
      <div
        className="lista-filas"
        ref={refLista}
        onScroll={(e) => {
          const el = e.currentTarget;
          if (cuantas < visibles.length && hayQueCrecer(el.scrollTop, el.clientHeight, el.scrollHeight)) {
            setCuantas((c) => c + LOTE);
          }
        }}
      >
        {dibujadas.map((l) => {
          const p = l.expand?.perfil;
          const activo = seleccionado === l.id;
          const vence = tocaHoy(
            { situacion: l.situacion, proximo_contacto: l.proximo_contacto || null },
            HOY,
          );
          const sinLeer = l.sin_leer_li || l.sin_leer_wa;
          const env = ultimosEnvios[l.id];
          const ultimo = env
            ? { ...env, etiqueta: etiquetaDeUltimoEnvio(env.paso) }
            : null;
          const etiquetas = etiquetasDeLaFila(
            (l.expand?.etiquetas ?? []).map((e) => e.nombre),
            preferidas,
          );

          // La última reunión de este lead, si la hubo. Día y mes: el año en
          // una columna de 200 px es ruido, y la fecha completa está en el
          // título.
          const r = reunionDe(l.id);
          const ultimaReunion = r
            ? {
                tono: tonoDeUltimaReunion(r.estado),
                texto: `${r.inicio.slice(8, 10)}/${r.inicio.slice(5, 7)}`,
                detalle:
                  r.estado === 'asistio'
                    ? `Última reunión ${r.inicio.slice(0, 10)}: asistió`
                    : r.estado === 'no-asistio'
                      ? `Última reunión ${r.inicio.slice(0, 10)}: no asistió`
                      : r.inicio.slice(0, 10) > HOY
                        ? `Reunión el ${r.inicio.slice(0, 10)}: todavía no pasó`
                        : `Última reunión ${r.inicio.slice(0, 10)}: sin confirmar si asistió`,
              }
            : null;
          return (
            <div
              key={l.id}
              onClick={() => onSeleccionar(l.id)}
              className={['fila', activo ? 'fila-on' : '', sinLeer ? 'fila-sin-leer' : ''].join(' ')}
            >
              <div className="fila-arriba">
                <div className="fila-nombre" title={p?.nombre}>
                  {p?.nombre ? nombreDePersona(p.nombre) : '(sin perfil)'}
                </div>
                {/* 3.1 · El icono SÓLO si hay número. Antes se dibujaba
                    siempre, apagado, y una columna llena de iconos grises no
                    informa de nada: lo que se busca es quién tiene WhatsApp. */}
                {veTelefono && p?.telefono && (
                  <BurbujaWhatsApp
                    activa={Boolean(p.telefono_valido)}
                    motivo="Teléfono a revisar"
                  />
                )}
                {sinLeer && <span className="fila-duenio fila-nuevo">nuevo</span>}

                {/* El agente. Tocarlo abre la lista para reasignar sin salir de
                    la columna: reasignar es una operación de la lista, no de la
                    ficha, y hasta ahora obligaba a abrir el lead. */}
                <ChipAgente
                  lead={l}
                  usuarios={usuarios}
                  puedeAsignar={puedeAsignar}
                  onAsignar={onAsignar}
                />
              </div>
              <div className="fila-abajo">
                <span className="fila-cuenta">{l.expand?.cuenta?.abrev}</span>
                <span className="fila-etapa">{l.etapa}</span>

                {/* El último mensaje: el R si fue de la cadencia, FU si fue
                    suelto. Es lo que explica por qué el próximo contacto no
                    cuadra con la etapa. */}
                {ultimo && (
                  <span
                    className={`fila-ultimo ${ultimo.etiqueta === 'FU' ? 'fila-ultimo-fu' : ''}`}
                    title={`Último mensaje: ${ultimo.paso || 'suelto'} · ${ultimo.enviado_en.slice(0, 10)}`}
                  >
                    {ultimo.etiqueta}
                  </span>
                )}

                {/* 3.3 · La última reunión, con color: verde si asistió, rojo
                    si no, gris si todavía no pasó o nadie registró qué pasó. */}
                {ultimaReunion && (
                  <span
                    className={`fila-reunion fila-reunion-${ultimaReunion.tono}`}
                    title={ultimaReunion.detalle}
                  >
                    {ultimaReunion.texto}
                  </span>
                )}

                {l.proximo_contacto && (
                  <span className={`fila-contacto ${vence ? 'fila-contacto-vencido' : ''}`}>
                    {etiquetaContacto(l.proximo_contacto)}
                  </span>
                )}

                {/* Las etiquetas. Entran dos; el resto se ve al pasar por
                    encima. Cuáles y en qué orden lo elige el usuario. */}
                {etiquetas.visibles.length > 0 && (
                  <span
                    className="fila-etiquetas"
                    title={
                      etiquetas.ocultas.length
                        ? [...etiquetas.visibles, ...etiquetas.ocultas].join(' · ')
                        : undefined
                    }
                  >
                    {etiquetas.visibles.map((e) => (
                      <span key={e} className="fila-etiqueta">
                        {e}
                      </span>
                    ))}
                    {etiquetas.ocultas.length > 0 && (
                      <span className="fila-etiqueta fila-etiqueta-mas">
                        +{etiquetas.ocultas.length}
                      </span>
                    )}
                  </span>
                )}
              </div>
            </div>
          );
        })}

        {visibles.length === 0 && <p className="vacio">Ningún lead con esos filtros.</p>}
      </div>

      {/* fila 7: la cola de envíos, pegada al pie (§7.2) */}
      {veCola && <ColaEnvios onIrAlLead={onSeleccionar} />}

      {/* fila 8: pie con el conteo */}
      <div className="lista-pie">
        {visibles.length} de {leads.length}
        {usuario && !verColaboradores && ' · solo tus leads'}
      </div>
    </aside>
  );
}
