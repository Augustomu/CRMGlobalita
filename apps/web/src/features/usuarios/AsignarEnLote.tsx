import { useMemo, useState } from 'react';
import {
  FILTRO_VACIO,
  TOPE_VISIBLE,
  coinciden,
  hayFiltros,
  opcionesDe,
  resumenDeLote,
  seleccionValida,
  todosLosQueCoinciden,
  type FiltroLote,
  type LeadAsignable,
} from '@crm/core/asignacion';

interface Props {
  leads: LeadAsignable[];
  usuarioId: string;
  usuarioNombre: string;
  /** Nombre del dueño actual de cada lead, para la columna. */
  nombreDe: (usuarioId: string) => string;
  onAsignar: (ids: string[]) => Promise<void> | void;
  onCerrar: () => void;
}

/** Un desplegable de valores donde se marcan varios. */
function Multi({
  label,
  opciones,
  elegidos,
  onCambio,
}: {
  label: string;
  opciones: string[];
  elegidos: string[];
  onCambio: (v: string[]) => void;
}) {
  const [abierto, setAbierto] = useState(false);
  return (
    <div className="relativo">
      <button
        type="button"
        className={`chip ${elegidos.length ? 'chip-on' : ''}`}
        onClick={() => setAbierto((a) => !a)}
      >
        {elegidos.length ? `${label} (${elegidos.length})` : label}
      </button>
      {abierto && (
        <>
          <div className="popover-fondo" onClick={() => setAbierto(false)} />
          <div className="popover popover-anclado lot-multi">
            {opciones.map((o) => {
              const on = elegidos.includes(o);
              return (
                <button
                  key={o}
                  type="button"
                  className={`lot-opcion ${on ? 'lot-opcion-on' : ''}`}
                  onClick={() => onCambio(on ? elegidos.filter((x) => x !== o) : [...elegidos, o])}
                >
                  <span className="lot-tick">{on ? '✓' : ''}</span>
                  {o}
                </button>
              );
            })}
            {!opciones.length && <span className="campo-ayuda">Sin valores en la base.</span>}
          </div>
        </>
      )}
    </div>
  );
}

/**
 * Asignar en lote (§7.8). Portada de `docs/prototipo/AdminUsuarios.dc.html`.
 *
 * Existe porque repartir mil leads de a uno no es trabajo, es una tarde
 * perdida. Filtra, muestra una tanda, y asigna todo lo que coincide de una.
 */
export function AsignarEnLote({ leads, usuarioId, usuarioNombre, nombreDe, onAsignar, onCerrar }: Props) {
  const [filtro, setFiltro] = useState<FiltroLote>(FILTRO_VACIO);
  const [seleccion, setSeleccion] = useState<string[]>([]);
  const [asignando, setAsignando] = useState(false);

  const match = useMemo(() => coinciden(leads, filtro), [leads, filtro]);
  // La selección se limpia contra el filtro EN CADA RENDER, no al cambiarlo:
  // así no queda un id colgado por un camino que nadie previó.
  const elegidos = seleccionValida(seleccion, leads, filtro);
  const cuentas = useMemo(
    () => ['todas', ...new Set(leads.map((l) => l.cuenta).filter(Boolean))].sort(),
    [leads],
  );
  const primerNombre = usuarioNombre.split(' ')[0] || 'este usuario';

  const set = (parche: Partial<FiltroLote>) => setFiltro((f) => ({ ...f, ...parche }));

  return (
    <div className="overlay-fondo" onClick={onCerrar}>
      <div className="overlay-caja lot" onClick={(e) => e.stopPropagation()}>
        <div className="overlay-header">
          <span className="overlay-titulo">Asignar en lote a {primerNombre}</span>
          <span className="campo-ayuda tabular">{resumenDeLote(leads, filtro, usuarioId, usuarioNombre)}</span>
          <button type="button" className="boton-icono-28 al-final" title="Cerrar" onClick={onCerrar}>
            ×
          </button>
        </div>

        <div className="lot-filtros">
          <span className="auto-th">Cuenta</span>
          {cuentas.map((c) => (
            <button
              key={c}
              type="button"
              className={`chip ${filtro.cuenta === c ? 'chip-on' : ''}`}
              onClick={() => set({ cuenta: c })}
            >
              {c === 'todas' ? `todas ${leads.length}` : `${c} ${leads.filter((l) => l.cuenta === c).length}`}
            </button>
          ))}
          <span className="bc-sep" />
          <Multi label="País" opciones={opcionesDe(leads, 'pais')} elegidos={filtro.pais} onCambio={(v) => set({ pais: v })} />
          <Multi label="Ciudad" opciones={opcionesDe(leads, 'ciudad')} elegidos={filtro.ciudad} onCambio={(v) => set({ ciudad: v })} />
          <Multi
            label="Industria"
            opciones={opcionesDe(leads, 'industria')}
            elegidos={filtro.industria}
            onCambio={(v) => set({ industria: v })}
          />
          <input
            className="bc-buscar"
            value={filtro.busqueda}
            placeholder="Nombre, empresa o cargo…"
            onChange={(e) => set({ busqueda: e.target.value })}
          />
          {hayFiltros(filtro) && (
            <button type="button" className="boton-mini" onClick={() => setFiltro(FILTRO_VACIO)}>
              Limpiar
            </button>
          )}
        </div>

        <div className="lot-barra">
          <button
            type="button"
            className="boton-mini"
            disabled={!match.length}
            onClick={() => setSeleccion(todosLosQueCoinciden(leads, filtro))}
          >
            Seleccionar los {match.length} que coinciden
          </button>
          {elegidos.length > 0 && (
            <button type="button" className="boton-mini" onClick={() => setSeleccion([])}>
              Limpiar selección
            </button>
          )}
          <span className="campo-ayuda tabular al-final">
            {elegidos.length ? `${elegidos.length} seleccionados` : 'sin selección'}
          </span>
        </div>

        <div className="lot-scroll">
          {match.slice(0, TOPE_VISIBLE).map((l) => {
            const on = elegidos.includes(l.id);
            const mio = l.asignado === usuarioId;
            return (
              <div
                key={l.id}
                className={`lot-fila ${on ? 'lot-fila-on' : ''}`}
                onClick={() =>
                  setSeleccion((s) => (s.includes(l.id) ? s.filter((x) => x !== l.id) : [...s, l.id]))
                }
              >
                <span className={`lot-marco ${on ? 'lot-marco-on' : ''}`}>{on ? '✓' : ''}</span>
                <div className="lot-quien">
                  <span className="imp-nombre">{l.nombre}</span>
                  <span className="campo-ayuda">{l.empresa || '—'}</span>
                </div>
                <span className="bc-texto">{l.cargo || '—'}</span>
                <span className="bc-texto">{[l.ciudad, l.pais].filter(Boolean).join(', ') || '—'}</span>
                <span className="bc-chip-cuenta">{l.cuenta || '—'}</span>
                <span className={mio ? 'lot-mio' : 'campo-ayuda'}>
                  {mio ? 'ya es suyo' : nombreDe(l.asignado).split(' ')[0] || 'sin asignar'}
                </span>
              </div>
            );
          })}

          {!match.length && <p className="vacio">Ningún lead coincide con esos filtros.</p>}

          {/* El tope es del DIBUJO, no de la selección: hay que decirlo o el
              botón de arriba parece que miente. */}
          {match.length > TOPE_VISIBLE && (
            <span className="campo-ayuda lot-nota">
              Se muestran los primeros {TOPE_VISIBLE} de {match.length}. «Seleccionar los{' '}
              {match.length}» alcanza a todos, no solo a los visibles.
            </span>
          )}
        </div>

        <div className="lot-pie">
          <span className="campo-ayuda">
            Asignar no saca al lead de su cuenta: cambia quién lo trabaja, no desde dónde se manda.
          </span>
          <button
            type="button"
            className="boton-principal al-final"
            disabled={!elegidos.length || asignando}
            onClick={async () => {
              setAsignando(true);
              await onAsignar(elegidos);
              setSeleccion([]);
              setAsignando(false);
            }}
          >
            {asignando
              ? 'Asignando…'
              : elegidos.length
                ? `Asignar ${elegidos.length} a ${primerNombre}`
                : 'Elegí al menos un lead'}
          </button>
        </div>
      </div>
    </div>
  );
}
