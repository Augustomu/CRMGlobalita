import { useMemo, useState } from 'react';
import {
  ESTADOS_ACTIVOS,
  NOMBRE_ESTADO,
  NOMBRE_TIPO,
  REGLA_ESTADO,
  estadoEfectivo,
  proximaAccion,
  TIPOS_VIGENTES,
  NOMBRE_CASA,
  ultimaActualizacion,
  ultimaReunion,
  type EstadoProyecto,
  type TipoProyecto,
} from '@crm/core/proyecto';
import { diaLocal } from '@crm/core/fecha';
import type { ProyectoConDatos } from './useControl';

const HOY = diaLocal();

// Los tres vigentes. El prototipo saco «Prototipo» y sus proyectos pasaron a
// Fabript/PIV: ofrecer un filtro que no matchea nada seria ruido.
const TIPOS: TipoProyecto[] = TIPOS_VIGENTES;
const ESTADOS: EstadoProyecto[] = [
  'sin_hablar', 'en_conversacion', 'propuesta_enviada', 'nuestra_pelota',
  'congelado', 'cerrado_ganado', 'cerrado_perdido',
];

function fechaCorta(iso: string): string {
  const f = String(iso).slice(0, 10);
  if (!f) return '—';
  const [, m, d] = f.split('-');
  return `${d}/${m}`;
}

interface Props {
  proyectos: ProyectoConDatos[];
  onAbrir: (p: ProyectoConDatos) => void;
  seleccionado: string | null;
}

/**
 * Control → Proyectos (§7.11.1). Portado de `docs/prototipo/Control.dc.html`:
 * tarjetas de resumen, filas de filtros rotuladas y la tabla de dos líneas con
 * la última actualización en su propia columna.
 *
 * Solo lectura, como toda la sección. Lo que se edita se edita en la ficha.
 */
export function Proyectos({ proyectos, onAbrir, seleccionado }: Props) {
  const [tipo, setTipo] = useState<TipoProyecto | null>(null);
  const [estado, setEstado] = useState<EstadoProyecto | null>(null);

  // El estado mostrado es el efectivo, no el guardado: Congelado se deriva del
  // último movimiento (§3, regla 1). Se calcula una vez y se reusa en los
  // filtros, los conteos y las tarjetas, para que no puedan discrepar.
  const conEstado = useMemo(
    () =>
      proyectos.map((p) => ({
        ...p,
        efectivo: estadoEfectivo(p.proyecto, p.reuniones, HOY),
      })),
    [proyectos],
  );

  const filas = useMemo(
    () =>
      conEstado.filter(
        (p) => (!tipo || p.proyecto.tipo === tipo) && (!estado || p.efectivo === estado),
      ),
    [conEstado, tipo, estado],
  );

  const cuenta = (f: (p: (typeof conEstado)[number]) => boolean) => conEstado.filter(f).length;

  const tarjetas = [
    {
      n: cuenta((p) => ESTADOS_ACTIVOS.includes(p.efectivo)),
      label: 'Activos',
      detalle: 'Sin hablar, en conversación, propuesta enviada y nuestra pelota.',
      color: 'var(--accent)',
    },
    {
      n: cuenta((p) => p.efectivo === 'propuesta_enviada'),
      label: 'Propuesta enviada',
      detalle: 'La pelota está del otro lado.',
      color: 'var(--info)',
    },
    {
      n: cuenta((p) => p.efectivo === 'nuestra_pelota'),
      label: 'Nuestra pelota',
      detalle: 'Nos falta hacer algo a nosotros.',
      color: 'var(--warning)',
    },
    {
      n: cuenta((p) => p.efectivo === 'congelado'),
      label: 'Congelados',
      detalle: 'Más de 30 días sin movimiento.',
      color: 'var(--muted)',
    },
    {
      n: cuenta((p) => p.efectivo === 'cerrado_ganado'),
      label: 'Cerrados ganados',
      detalle: 'Se cerraron y arrancó el trabajo.',
      color: 'var(--success)',
    },
  ];

  return (
    <>
      <div className="ctrl-tarjetas">
        {tarjetas.map((t) => (
          <div key={t.label} className="ctrl-tarjeta">
            <span className="ctrl-tarjeta-n" style={{ color: t.color }}>{t.n}</span>
            <span className="ctrl-tarjeta-label">{t.label}</span>
            <span className="ctrl-tarjeta-detalle">{t.detalle}</span>
          </div>
        ))}
      </div>

      <div className="ctrl-bloque">
        <div className="ctrl-filtros">
          <div className="ctrl-filtro-fila">
            <span className="ctrl-filtro-label">Tipo</span>
            <div className="chips">
              <button
                type="button"
                className={`ctrl-chip ${tipo === null ? 'ctrl-chip-on' : ''}`}
                onClick={() => setTipo(null)}
              >
                Todos · {conEstado.length}
              </button>
              {TIPOS.map((t) => (
                <button
                  key={t}
                  type="button"
                  className={`ctrl-chip ctrl-tipo-${t} ${tipo === t ? 'ctrl-chip-on' : ''}`}
                  onClick={() => setTipo(tipo === t ? null : t)}
                >
                  {NOMBRE_TIPO[t]} · {cuenta((p) => p.proyecto.tipo === t)}
                </button>
              ))}
            </div>
          </div>
          <div className="ctrl-filtro-fila">
            <span className="ctrl-filtro-label">Estado</span>
            <div className="chips">
              {ESTADOS.map((e) => (
                <button
                  key={e}
                  type="button"
                  className={`ctrl-chip ctrl-estado-${e} ${estado === e ? 'ctrl-chip-on' : ''}`}
                  onClick={() => setEstado(estado === e ? null : e)}
                >
                  {NOMBRE_ESTADO[e]} · {cuenta((p) => p.efectivo === e)}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="ctrl-cabecera">
          <span>Proyecto</span>
          <span>Empresa y tipo</span>
          <span>Estado</span>
          <span>Lugar</span>
          <span>Industria y rol</span>
          <span className="ctrl-num">Reun.</span>
          <span>Últ. reunión</span>
          <span>Actualización</span>
          <span>Próxima acción</span>
        </div>

        <div className="ctrl-filas">
          {filas.length === 0 && (
            <p className="vacio">
              {conEstado.length === 0
                ? 'Todavía no hay proyectos. Se abren desde la ficha de un lead.'
                : 'Ningún proyecto con ese filtro.'}
            </p>
          )}

          {filas.map((p) => {
            const ult = ultimaReunion(p.reuniones, HOY);
            const paso = proximaAccion(p.proyecto);
            const ultimaAct = ultimaActualizacion(p.proyecto);
            const notas = p.proyecto.notas ?? [];

            return (
              <div
                key={p.proyecto.id}
                className={`ctrl-fila ${seleccionado === p.proyecto.id ? 'ctrl-fila-on' : ''}`}
              >
                <div className="ctrl-fila-datos" onClick={() => onAbrir(p)}>
                  <div className="ctrl-proyecto">
                    <div className="ctrl-proyecto-texto">
                      <span className="ctrl-nombre">{p.proyecto.nombre}</span>
                      <span className="ctrl-empresa">
                        {[p.proyecto.empresa, p.proyecto.contacto].filter(Boolean).join(' · ')}
                      </span>
                    </div>
                    <span
                      className={`ctrl-notas ${notas.length ? 'ctrl-notas-on' : ''}`}
                      title={
                        p.proyecto.nota_lead || notas.at(-1)?.texto || 'Sin notas'
                      }
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
                        <path d="M4 5h16v11l-4 4H4z" />
                        <path d="M7 9h10M7 13h6" />
                      </svg>
                    </span>
                  </div>

                  <div className="ctrl-casa-tipo">
                    <span className={`ctrl-casa ctrl-casa-${p.casa}`}>{NOMBRE_CASA[p.casa]}</span>
                    <span className={`ctrl-pastilla ctrl-tipo-${p.proyecto.tipo}`}>
                      {NOMBRE_TIPO[p.proyecto.tipo as TipoProyecto] ?? '—'}
                    </span>
                  </div>
                  <span className={`ctrl-pastilla ctrl-estado-${p.efectivo}`}>
                    {NOMBRE_ESTADO[p.efectivo]}
                  </span>

                  <div className="ctrl-doble">
                    <span className="ctrl-doble-1">{p.proyecto.pais || '—'}</span>
                    <span className="ctrl-doble-2">{p.proyecto.ciudad}</span>
                  </div>
                  <div className="ctrl-doble">
                    <span className="ctrl-doble-1">{p.proyecto.industria || '—'}</span>
                    <span className="ctrl-doble-2">{p.proyecto.rol_contacto}</span>
                  </div>

                  <span className="ctrl-num tabular">{ult.total}</span>

                  <div className="ctrl-doble">
                    <span className="ctrl-doble-1 tabular">
                      {ult.fecha ? (ult.fecha === '—' ? '—' : fechaCorta(ult.fecha)) : '—'}
                    </span>
                    <span className="ctrl-doble-2">{ult.detalle}</span>
                  </div>

                  {/* La última novedad, en la fila. Antes era una tira de
                      tarjetas debajo de cada proyecto: con trece proyectos son
                      trece tiras y la tabla deja de leerse de un vistazo, que
                      es lo único que Control tiene que hacer. El historial
                      completo sigue estando en el panel que abre la fila. */}
                  <div className="ctrl-doble" title={ultimaAct?.texto ?? ''}>
                    <span className="ctrl-doble-1 tabular">
                      {ultimaAct ? fechaCorta(ultimaAct.fecha) : '—'}
                    </span>
                    <span className="ctrl-actualizacion">
                      {ultimaAct?.texto ?? 'sin novedades'}
                    </span>
                  </div>

                  <span className="ctrl-paso">{paso?.texto ?? '—'}</span>
                </div>
              </div>
            );
          })}
        </div>

        <span className="campo-ayuda">
          La columna Actualización muestra la última novedad del proyecto. Cliqueando la fila se
          abre la ficha: notas, actualizaciones y próximas acciones en columnas.
        </span>
      </div>

      <div className="ctrl-bloque">
        <span className="ctrl-filtro-label">Los estados y cuándo se aplican</span>
        <div className="ctrl-leyenda">
          {ESTADOS.map((e) => (
            <div key={e} className="ctrl-leyenda-item">
              <span className={`ctrl-pastilla ctrl-estado-${e}`}>{NOMBRE_ESTADO[e]}</span>
              <span className="ctrl-tarjeta-detalle">{REGLA_ESTADO[e]}</span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
