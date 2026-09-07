import { useMemo, useState } from 'react';
import { tocaHoy } from '@crm/core/cadencia';
import type { LeadRecord } from '../../lib/types';

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

interface Props {
  leads: LeadRecord[];
  seleccionado: string | null;
  onSeleccionar: (id: string) => void;
}

export function ListaContactos({ leads, seleccionado, onSeleccionar }: Props) {
  const [busqueda, setBusqueda] = useState('');
  const [cuenta, setCuenta] = useState<string>('todas');
  const [soloVencidos, setSoloVencidos] = useState(false);

  const cuentas = useMemo(() => {
    const abrevs = new Set<string>();
    for (const l of leads) if (l.expand?.cuenta) abrevs.add(l.expand.cuenta.abrev);
    return [...abrevs].sort();
  }, [leads]);

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return leads.filter((l) => {
      const p = l.expand?.perfil;
      if (cuenta !== 'todas' && l.expand?.cuenta?.abrev !== cuenta) return false;

      // "Vencidos" usa la misma función que usará el worker para decidir
      // a quién le toca hoy (D17): una sola definición de vencimiento.
      if (soloVencidos && !tocaHoy({ situacion: l.situacion, proximo_contacto: l.proximo_contacto || null }, HOY)) {
        return false;
      }

      if (!q) return true;
      // §7.2: busca por nombre, empresa, teléfono y ciudad.
      return [p?.nombre, p?.empresa, p?.telefono, p?.ciudad]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
  }, [leads, busqueda, cuenta, soloVencidos]);

  return (
    <aside className="columna-lista">
      <div className="lista-controles">
        <input
          className="buscador"
          placeholder="Buscar por nombre, empresa, teléfono, ciudad"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />

        <div className="chips">
          <button
            type="button"
            className={`chip ${cuenta === 'todas' ? 'chip-on' : ''}`}
            onClick={() => setCuenta('todas')}
          >
            todas
          </button>
          {cuentas.map((a) => (
            <button
              key={a}
              type="button"
              className={`chip ${cuenta === a ? 'chip-on' : ''}`}
              onClick={() => setCuenta(a)}
            >
              {a}
            </button>
          ))}
        </div>

        <label className="filtro-check">
          <input
            type="checkbox"
            checked={soloVencidos}
            onChange={(e) => setSoloVencidos(e.target.checked)}
          />
          Solo vencidos
        </label>

        <div className="lista-conteo">
          {visibles.length} de {leads.length}
        </div>
      </div>

      <div className="lista-filas">
        {visibles.map((l) => {
          const p = l.expand?.perfil;
          const vence = tocaHoy(
            { situacion: l.situacion, proximo_contacto: l.proximo_contacto || null },
            HOY,
          );
          const sinLeer = l.sin_leer_li || l.sin_leer_wa;
          return (
            <button
              key={l.id}
              type="button"
              onClick={() => onSeleccionar(l.id)}
              className={[
                'fila',
                seleccionado === l.id ? 'fila-on' : '',
                sinLeer ? 'fila-sin-leer' : '',
              ].join(' ')}
            >
              <div className="fila-arriba">
                <span className="fila-nombre">{p?.nombre ?? '(sin perfil)'}</span>
                {sinLeer && <span className="pastilla pastilla-nuevo">nuevo</span>}
              </div>
              <div className="fila-abajo">
                <span className="pastilla">{l.expand?.cuenta?.abrev ?? '—'}</span>
                <span className="pastilla">{l.etapa}</span>
                <span className="fila-meta">{NOMBRE_SITUACION[l.situacion] ?? l.situacion}</span>
                {l.proximo_contacto && (
                  <span className={`fila-fecha ${vence ? 'fila-fecha-vencida' : ''}`}>
                    {l.proximo_contacto.slice(0, 10)}
                  </span>
                )}
              </div>
            </button>
          );
        })}

        {visibles.length === 0 && <p className="vacio">Ningún lead con esos filtros.</p>}
      </div>
    </aside>
  );
}
