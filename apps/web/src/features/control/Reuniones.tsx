import { useMemo, useState } from 'react';
import {
  NOMBRE_AGRUPADOR,
  NOMBRE_RANGO,
  agrupar,
  alPie,
  delPeriodo,
  desdeDe,
  fechaLocal,
  horaLocal,
  porMes,
  tarjetas,
  type Agrupador,
  type Rango,
  type ReunionMedida,
} from '@crm/core/metricas';
import { diaLocal } from '@crm/core/fecha';

const HOY = diaLocal();

const RANGOS: Rango[] = ['1m', '3m', '6m'];
const AGRUPADORES: Agrupador[] = [
  'pais', 'ciudad', 'industria', 'cargo', 'empresa',
  'cuenta', 'genero', 'estado', 'dia_semana', 'franja',
];

function fechaCorta(iso: string): string {
  const f = String(iso).slice(0, 10);
  if (!f) return '—';
  const [, m, d] = f.split('-');
  return `${d}/${m}`;
}

interface Props {
  reuniones: ReunionMedida[];
}

/**
 * Control → Reuniones (§7.11.2). El dashboard: ocho tarjetas, el gráfico por
 * mes con la banda de las que derivaron en proyecto, los diez agrupadores y la
 * tabla del período.
 *
 * Todo respeta el período elegido — criterio de aceptación 5.
 */
export function Reuniones({ reuniones }: Props) {
  const [rango, setRango] = useState<Rango>('3m');
  const [por, setPor] = useState<Agrupador>('pais');

  const delRango = useMemo(() => delPeriodo(reuniones, rango, HOY), [reuniones, rango]);
  const t = useMemo(() => tarjetas(delRango, rango), [delRango, rango]);
  const barras = useMemo(() => porMes(delRango, rango, HOY), [delRango, rango]);
  const pie = useMemo(() => alPie(delRango, barras), [delRango, barras]);
  const grupos = useMemo(() => agrupar(delRango, por), [delRango, por]);

  const maxBarra = Math.max(1, ...barras.map((b) => b.total));
  const maxGrupo = Math.max(1, ...grupos.map((g) => g.n));

  const cajas = [
    { n: t.total, label: 'Reuniones', detalle: 'Del período elegido.', color: 'var(--accent)' },
    {
      n: t.asistieron,
      label: 'Asistieron',
      detalle: `${t.pct_asistieron}% del total.`,
      color: 'var(--success)',
    },
    { n: t.no_asistio, label: 'No asistió', detalle: 'Agendadas y no ocurridas.', color: 'var(--error)' },
    { n: t.reagendadas, label: 'Reagendadas', detalle: 'Se movieron de fecha.', color: 'var(--warning)' },
    { n: t.con_proyecto, label: 'Con proyecto', detalle: 'Derivaron en un trabajo.', color: 'var(--info)' },
    {
      n: `${t.conversion}%`,
      label: 'Conversión',
      detalle: 'Reuniones que terminaron en proyecto.',
      color: 'var(--accent)',
    },
    { n: t.empresas, label: 'Empresas', detalle: 'Distintas, en el período.', color: 'var(--text)' },
    { n: t.por_semana, label: 'Por semana', detalle: 'Promedio del período.', color: 'var(--text)' },
  ];

  return (
    <>
      <div className="ctrl-periodo">
        <span className="ctrl-filtro-label">Período</span>
        <div className="selector-idioma">
          {RANGOS.map((r) => (
            <button
              key={r}
              type="button"
              className={rango === r ? 'idioma-on' : 'idioma-off'}
              onClick={() => setRango(r)}
            >
              {NOMBRE_RANGO[r]}
            </button>
          ))}
        </div>
        <span className="campo-ayuda tabular">
          {desdeDe(rango, HOY)} → {HOY}
        </span>
      </div>

      <div className="ctrl-tarjetas ctrl-tarjetas-8">
        {cajas.map((c) => (
          <div key={c.label} className="ctrl-tarjeta">
            <span className="ctrl-tarjeta-n" style={{ color: c.color }}>{c.n}</span>
            <span className="ctrl-tarjeta-label">{c.label}</span>
            <span className="ctrl-tarjeta-detalle">{c.detalle}</span>
          </div>
        ))}
      </div>

      <div className="ctrl-grafico-fila">
        <div className="ctrl-bloque">
          <div className="ctrl-bloque-cabecera">
            <span className="ctrl-filtro-label">Reuniones por mes</span>
            <span className="campo-ayuda ctrl-derecha">
              banda oscura = las que derivaron en proyecto
            </span>
          </div>

          <div className="ctrl-barras">
            {barras.map((b) => (
              <div key={b.mes} className="ctrl-barra-col">
                <span className="ctrl-barra-n tabular">{b.total}</span>
                <div
                  className="ctrl-barra"
                  style={{ height: `${(b.total / maxBarra) * 100}%` }}
                  title={`${b.label}: ${b.total} reuniones, ${b.con_proyecto} con proyecto`}
                >
                  <div
                    className="ctrl-barra-proy"
                    style={{ height: b.total ? `${(b.con_proyecto / b.total) * 100}%` : '0%' }}
                  />
                </div>
                <span className="ctrl-barra-label">{b.label}</span>
              </div>
            ))}
          </div>

          <div className="ctrl-pie">
            <span className="ctrl-tarjeta-detalle">
              Promedio: <strong className="tabular">{pie.promedio_mes}</strong> por mes
            </span>
            <span className="ctrl-tarjeta-detalle">
              Mejor mes: <strong>{pie.mejor_mes}</strong>
            </span>
            <span className="ctrl-tarjeta-detalle">
              Duración promedio: <strong>{pie.duracion_promedio} min</strong>
            </span>
          </div>
        </div>

        <div className="ctrl-bloque">
          <div className="ctrl-agrupadores">
            <span className="ctrl-filtro-label">Agrupar por</span>
            <div className="chips">
              {AGRUPADORES.map((g) => (
                <button
                  key={g}
                  type="button"
                  className={`ctrl-chip ${por === g ? 'ctrl-chip-on' : ''}`}
                  onClick={() => setPor(g)}
                >
                  {NOMBRE_AGRUPADOR[g]}
                </button>
              ))}
            </div>
          </div>

          <div className="ctrl-grupos">
            {grupos.length === 0 && <span className="campo-ayuda">Sin reuniones en el período.</span>}
            {grupos.map((g) => (
              <div key={g.label} className="ctrl-grupo">
                <div className="ctrl-grupo-cabecera">
                  <span className="ctrl-grupo-label">{g.label}</span>
                  <span className="ctrl-grupo-n tabular">{g.n}</span>
                  <span className="ctrl-grupo-pct tabular">{g.pct}%</span>
                </div>
                <div className="ctrl-grupo-barra">
                  <div
                    className="ctrl-grupo-relleno"
                    style={{
                      width: `${(g.n / maxGrupo) * 100}%`,
                      background: g.n === maxGrupo ? 'var(--accent)' : 'var(--accent-br)',
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="ctrl-bloque">
        <span className="ctrl-filtro-label">Reuniones del período</span>
        <div className="ctrl-cabecera ctrl-cabecera-reu">
          <span>#</span><span>Fecha</span><span>Hora</span><span>Con quién</span>
          <span>Empresa</span><span>Lugar</span><span>Industria</span><span>Generó</span>
          <span>Estado</span><span>Nota</span>
        </div>
        <div className="ctrl-filas">
          {delRango.length === 0 && <p className="vacio">Sin reuniones en el período.</p>}
          {[...delRango].reverse().map((r, i) => (
            <div key={r.id} className="ctrl-fila-reu">
              <span className="ctrl-doble-2 tabular">{delRango.length - i}</span>
              <span className="ctrl-doble-1 tabular">{fechaCorta(fechaLocal(r))}</span>
              <span className="ctrl-doble-2 tabular">
                {horaLocal(r)} · {r.duracion_min}′
              </span>
              <div className="ctrl-doble">
                <span className="ctrl-nombre">{r.nombre || '—'}</span>
                <span className="ctrl-doble-2">{r.cargo}</span>
              </div>
              <span className="ctrl-doble-1">{r.empresa || '—'}</span>
              <div className="ctrl-doble">
                <span className="ctrl-doble-1">{r.pais || '—'}</span>
                <span className="ctrl-doble-2">{r.ciudad}</span>
              </div>
              <span className="ctrl-doble-2">{r.industria || '—'}</span>
              <span className="ctrl-doble-2">{r.genero || '—'}</span>
              <span className={`ctrl-pastilla ctrl-reunion-${r.estado}`}>{r.estado}</span>
              <span className="ctrl-paso">{r.nota || '—'}</span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
