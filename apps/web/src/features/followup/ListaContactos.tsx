import { useMemo, useRef, useState } from 'react';
import { tocaHoy } from '@crm/core/cadencia';
import type { LeadRecord, UsuarioRecord } from '../../lib/types';

const HOY = new Date().toISOString().slice(0, 10);

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
}

export function ListaContactos({
  leads,
  seleccionado,
  onSeleccionar,
  usuario,
  verColaboradores,
}: Props) {
  const [busqueda, setBusqueda] = useState('');
  const [cuenta, setCuenta] = useState('todas');
  const [colaborador, setColaborador] = useState('todos');
  const [soloVencidos, setSoloVencidos] = useState(false);
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
    const q = busqueda.trim().toLowerCase();
    return leads.filter((l) => {
      const p = l.expand?.perfil;
      if (cuenta !== 'todas' && l.expand?.cuenta?.abrev !== cuenta) return false;
      if (colaborador !== 'todos' && l.asignado !== colaborador) return false;
      if (
        soloVencidos &&
        !tocaHoy({ situacion: l.situacion, proximo_contacto: l.proximo_contacto || null }, HOY)
      ) {
        return false;
      }
      if (!q) return true;
      // §7.2: nombre, empresa, teléfono y ciudad.
      return [p?.nombre, p?.empresa, p?.telefono, p?.ciudad]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
  }, [leads, busqueda, cuenta, colaborador, soloVencidos]);

  // §7.2: los últimos leads editados, como accesos rápidos.
  const ultimos = useMemo(
    () => [...leads].sort((a, b) => b.updated.localeCompare(a.updated)).slice(0, 3),
    [leads],
  );

  const nFiltros = (cuenta !== 'todas' ? 1 : 0) + (colaborador !== 'todos' ? 1 : 0) + (soloVencidos ? 1 : 0);

  // §9.5: el popover se posiciona con coordenadas calculadas desde el botón,
  // para que no lo recorte el scroll de la columna.
  function abrirFiltros() {
    const r = botonFiltros.current?.getBoundingClientRect();
    if (r) setPos({ left: Math.min(r.left, window.innerWidth - 340), top: r.bottom + 6 });
    setFiltrosAbierto((a) => !a);
  }

  return (
    <aside className="columna-lista">
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
              <button
                type="button"
                className="boton-mini"
                onClick={() => {
                  setCuenta('todas');
                  setColaborador('todos');
                  setSoloVencidos(false);
                }}
              >
                Limpiar
              </button>
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
      <div className="lista-filas">
        {visibles.map((l) => {
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

      {/* fila 7: pie con el conteo */}
      <div className="lista-pie">
        {visibles.length} de {leads.length}
        {usuario && !verColaboradores && ' · solo tus leads'}
      </div>
    </aside>
  );
}
