import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { coincide } from '@crm/core/busqueda';
import { COLUMNA_LISTA } from '@crm/core/anchos';
import { LOTE, hayQueCrecer, scrollHasta, ventanaPara } from '@crm/core/ventana';
import { useAncho } from '../../lib/useAncho';
import { tocaHoy } from '@crm/core/cadencia';
import { diaLocal } from '@crm/core/fecha';
import type { LeadRecord, UsuarioRecord } from '../../lib/types';
import { BurbujaWhatsApp } from './IconosCanal';
import { pb } from '../../lib/pocketbase';
import { ColaEnvios } from './ColaEnvios';

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
function etiquetaContacto(fecha: string | null): string {
  if (!fecha) return 'sin próximo contacto';
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
}

export function ListaContactos({
  leads,
  conversacion = null,
  onCerrarConversacion,
  seleccionado,
  onSeleccionar,
  usuario,
  verColaboradores,
  veTelefono,
  veCola,
  onImportar,
}: Props) {
  const [busqueda, setBusqueda] = useState('');
  /**
   * Cuántas filas se dibujan (§7.2, §11 «transversal desde el día uno»).
   *
   * La base tiene miles de leads. Dibujarlos todos hacía que cada tecla del
   * buscador remontara miles de filas, y el cursor iba atrás de lo que se
   * escribía.
   */
  const [cuantas, setCuantas] = useState(LOTE);
  // 9.4: 260-520, doble clic alterna compacto/normal, persistido.
  const anchoCol = useAncho(COLUMNA_LISTA);
  const refLista = useRef<HTMLDivElement>(null);
  const [cuenta, setCuenta] = useState('todas');
  const [colaborador, setColaborador] = useState('todos');
  const [soloVencidos, setSoloVencidos] = useState(false);
  // Los ocho filtros de §7.2. Los cuatro de abajo son listas que salen de los
  // datos, no opciones fijas: el catálogo de roles y ciudades lo define la base.
  const [wa, setWa] = useState<'todos' | 'con' | 'sin'>('todos');
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

  const visibles = useMemo(() => {
    const q = busqueda.trim();
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
        if (wa === 'con' && !tieneWa) return false;
        if (wa === 'sin' && tieneWa) return false;

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

        // §7.2: nombre, empresa, teléfono y ciudad. Sin tildes: la base está
        // llena de «Gonçalves» y «Villagrán», y nadie los escribe con acento
        // cuando los está buscando.
        return coincide([p?.nombre, p?.empresa, p?.telefono, p?.ciudad], q);
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
  }, [leads, busqueda, cuenta, colaborador, soloVencidos, wa, reunion, rol, pais, ciudad, etiqueta, orden, reunionDe]);

  // Cambiar el filtro o la búsqueda vuelve la ventana a 80: mantenerla estirada
  // después de pasar de 3000 leads a 12 sigue costando lo mismo y no muestra
  // nada más.
  useEffect(() => {
    setCuantas(LOTE);
    if (refLista.current) refLista.current.scrollTop = 0;
  }, [busqueda, cuenta, colaborador, soloVencidos, wa, reunion, rol, pais, ciudad, etiqueta, orden]);

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

  // §7.2: los últimos leads editados, como accesos rápidos.
  const ultimos = useMemo(
    () => [...leads].sort((a, b) => b.updated.localeCompare(a.updated)).slice(0, 3),
    [leads],
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
        {abierto && (
          <>
          <div className="conv-cabecera">
            <span className="colapsable-flecha">▾</span>
            <span className="colapsable-titulo">Conversación</span>
            <span
              className={`pastilla ${conversacion === 'whatsapp' ? 'pastilla-wa' : 'pastilla-li'}`}
            >
              {conversacion === 'whatsapp' ? 'WhatsApp' : 'LinkedIn'}
            </span>
            <span className="conv-fecha al-final tabular">
              {abierto.f_ultimo_contacto ? String(abierto.f_ultimo_contacto).slice(0, 10) : 'sin contacto'}
            </span>
            <button type="button" className="boton-icono-22" title="Cerrar" onClick={onCerrarConversacion}>×</button>
          </div>
          {/* Honesto: el hilo todavía no se guarda en el CRM. Leerlo requiere
              la sesión de la cuenta, que llega con el worker. Lo que sí hay es
              el acceso directo al chat real, que es el atajo H. */}
          <div className="conv-vacio">
            <span>El hilo todavía no se guarda en el CRM: se lee en el chat real.</span>
            <a
              className="boton-mini"
              href={
                conversacion === 'whatsapp'
                  ? `https://wa.me/${(abierto.expand?.perfil?.telefono ?? '').replace(/\D/g, '')}`
                  : abierto.link_chat ||
                    (abierto.expand?.perfil?.slug
                      ? `https://www.linkedin.com/in/${abierto.expand.perfil.slug}`
                      : '#')
              }
              target="_blank"
              rel="noreferrer"
            >
              Abrir el chat
            </a>
          </div>
          </>
        )}
      </div>

      {/* fila 2 del grid: buscador de 52px */}
      <div className="lista-buscador">
        <input
          type="text"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar nombre, empresa, teléfono…"
        />
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
        {/* §7.2: importar CSV vive acá, al lado del buscador, y solo con
            permiso. Es donde entra la base. */}
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
          return (
            <div
              key={l.id}
              onClick={() => onSeleccionar(l.id)}
              className={['fila', activo ? 'fila-on' : '', sinLeer ? 'fila-sin-leer' : ''].join(' ')}
            >
              <div className="fila-arriba">
                <div className="fila-nombre">{p?.nombre ?? '(sin perfil)'}</div>
                {veTelefono && (
                  <BurbujaWhatsApp
                    activa={Boolean(p?.telefono_valido)}
                    motivo={p?.telefono ? 'Teléfono a revisar' : 'Sin teléfono cargado'}
                  />
                )}
                {sinLeer && <span className="fila-duenio fila-nuevo">nuevo</span>}
                {l.expand?.asignado && (
                  <span className="fila-duenio" title={l.expand.asignado.name}>
                    {iniciales(l.expand.asignado.name)}
                  </span>
                )}
              </div>
              <div className="fila-abajo">
                <span className="fila-cuenta">{l.expand?.cuenta?.abrev}</span>
                <span className="fila-etapa">{l.etapa}</span>
                <span className={`fila-contacto ${vence ? 'fila-contacto-vencido' : ''}`}>
                  {etiquetaContacto(l.proximo_contacto || null)}
                </span>
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
