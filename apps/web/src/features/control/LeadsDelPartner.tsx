import { useMemo, useState } from 'react';
import { coincide } from '@crm/core/busqueda';
import { NOMBRE_CASA, type Casa } from '@crm/core/proyecto';
import type { LeadDeControl } from './useControl';

interface Props {
  leads: LeadDeControl[];
}

function ddmm(iso: string | null): string {
  const f = String(iso ?? '').slice(0, 10);
  return f ? `${f.slice(8, 10)}/${f.slice(5, 7)}` : '—';
}

/**
 * Los leads que confirmaron interés (§7.11, decisión del 08/09).
 *
 * Es la tercera cosa que el partner mira, además de las reuniones y las
 * estadísticas: quiénes dijeron que sí, aunque todavía no haya un proyecto
 * abierto.
 *
 * ES DE SOLO LECTURA, como toda la sección, y **no muestra datos de contacto**:
 * ni teléfono, ni email, ni links. El manual es explícito (§6.3.1): del lado del
 * partner se ve quién es y de qué empresa, no cómo llegarle. Esos campos ni
 * siquiera se piden en la consulta.
 */
export function LeadsDelPartner({ leads }: Props) {
  const [etiqueta, setEtiqueta] = useState<string | null>(null);
  const [q, setQ] = useState('');

  // Las etiquetas que de verdad hay, no las tres del catálogo: un filtro con
  // una opción que siempre da cero es ruido.
  const etiquetas = useMemo(
    () => [...new Set(leads.flatMap((l) => l.etiquetas))].sort(),
    [leads],
  );

  const vistos = useMemo(() => {
    return leads.filter((l) => {
      if (etiqueta && !l.etiquetas.includes(etiqueta)) return false;
      return coincide([l.nombre, l.empresa, l.cargo, l.industria, l.ciudad, l.pais], q);
    });
  }, [leads, etiqueta, q]);

  const conProyecto = vistos.filter((l) => l.proyecto).length;
  const conReunion = vistos.filter((l) => l.reuniones > 0).length;

  return (
    <div className="ctrl-leads">
      <div className="ctrl-tarjetas">
        <Tarjeta n={vistos.length} label="confirmaron interés" />
        <Tarjeta n={conReunion} label="con reunión" />
        <Tarjeta n={conProyecto} label="con proyecto abierto" />
        {/* El que confirmó y todavía no tiene proyecto es el que hay que
            empujar: es la única cifra accionable de las cuatro. */}
        <Tarjeta n={vistos.length - conProyecto} label="sin proyecto todavía" alerta />
      </div>

      <div className="ctrl-leads-filtros">
        <span className="ctrl-filtro-label">Interés</span>
        <button
          type="button"
          className={etiqueta === null ? 'chip chip-on' : 'chip'}
          onClick={() => setEtiqueta(null)}
        >
          Todos · {leads.length}
        </button>
        {etiquetas.map((e) => (
          <button
            key={e}
            type="button"
            className={etiqueta === e ? 'chip chip-on' : 'chip'}
            onClick={() => setEtiqueta(etiqueta === e ? null : e)}
          >
            {e} · {leads.filter((l) => l.etiquetas.includes(e)).length}
          </button>
        ))}
        <input
          className="bc-buscar"
          value={q}
          placeholder="Buscar por nombre, empresa, rubro…"
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      <div className="bc-scroll">
        <div className="bc-tabla ctrl-leads-tabla">
          <div className="bc-encabezado">
            <span className="auto-th">Contacto</span>
            <span className="auto-th">Empresa e industria</span>
            <span className="auto-th">Lugar</span>
            <span className="auto-th">Interés</span>
            <span className="auto-th auto-der">Reun.</span>
            <span className="auto-th auto-der">Última</span>
            <span className="auto-th">Proyecto</span>
          </div>

          {vistos.map((l) => (
            <div key={l.id} className="bc-fila">
              <div className="bc-celda bc-lead">
                <span className="bc-nombre">{l.nombre}</span>
                <span className="campo-ayuda">{l.cargo || 'sin cargo'}</span>
              </div>
              <div className="bc-celda bc-empresa">
                <span>{l.empresa || '—'}</span>
                <span className="campo-ayuda">{l.industria || '—'}</span>
              </div>
              <span className="bc-celda bc-texto">
                {[l.ciudad, l.pais].filter(Boolean).join(' · ') || '—'}
              </span>
              <div className="bc-celda ctrl-leads-etiquetas">
                {l.etiquetas.map((e) => (
                  <span key={e} className="ctrl-chip-interes">
                    {e}
                  </span>
                ))}
              </div>
              <span className="bc-celda bc-fuerte tabular">{l.reuniones || '—'}</span>
              <span className="bc-celda bc-texto tabular">{ddmm(l.ultima)}</span>
              <span className="bc-celda">
                {l.proyecto ? (
                  <span className="ctrl-chip-abierto">abierto</span>
                ) : (
                  <span className="campo-ayuda">sin abrir</span>
                )}
              </span>
            </div>
          ))}

          {!vistos.length && (
            <p className="vacio">
              {leads.length
                ? 'Ningún lead coincide con ese filtro.'
                : 'Todavía nadie confirmó interés. Aparecen acá cuando el equipo les pone la etiqueta.'}
            </p>
          )}
        </div>
      </div>

      <p className="ctrl-leyenda">
        Un lead aparece acá cuando alguien del equipo le pone la etiqueta de interés
        {leads[0] ? ` de ${NOMBRE_CASA[leads[0].casa as Casa]}` : ''}. Confirmar interés y abrir el
        proyecto son dos cosas distintas: lo primero sale de una llamada, lo segundo es una
        decisión que alguien toma después.
      </p>
    </div>
  );
}

function Tarjeta({ n, label, alerta }: { n: number; label: string; alerta?: boolean }) {
  return (
    <div className={alerta && n > 0 ? 'ctrl-tarjeta ctrl-tarjeta-alerta' : 'ctrl-tarjeta'}>
      <span className="ctrl-tarjeta-n tabular">{n}</span>
      <span className="ctrl-tarjeta-label">{label}</span>
    </div>
  );
}
