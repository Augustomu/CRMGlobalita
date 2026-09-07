import { useMemo, useState } from 'react';
import {
  ESTADOS_ACTIVOS,
  NOMBRE_ESTADO,
  NOMBRE_TIPO,
  REGLA_ESTADO,
  estadoEfectivo,
  proximaAccion,
  tiraDeAvance,
  ultimaReunion,
  type EstadoProyecto,
  type TipoProyecto,
} from '@crm/core/proyecto';
import type { ProyectoConDatos } from './useControl';

const HOY = new Date().toISOString().slice(0, 10);

const TIPOS: TipoProyecto[] = ['fabript_piv', 'parceria', 'prototipo', 'inversion'];
const ESTADOS: EstadoProyecto[] = [
  'sin_hablar', 'en_conversacion', 'propuesta_enviada', 'nuestra_pelota',
  'congelado', 'cerrado_ganado', 'cerrado_perdido',
];

const ETIQUETA_AVANCE = { accion: 'Próxima acción', update: 'Actualización', nota: 'Nota' };

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
 * Control → Proyectos (anexo §4.1). Portado de `docs/prototipo/Control.dc.html`:
 * tarjetas de resumen, dos filas de filtros rotuladas, y la tabla de dos líneas
 * con la tira de avance abajo.
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
          <span>Tipo</span>
          <span>Estado</span>
          <span>Lugar</span>
          <span>Industria y rol</span>
          <span className="ctrl-num">Reun.</span>
          <span>Últ. reunión</span>
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
            const avance = tiraDeAvance(p.proyecto);
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

                  <span className={`ctrl-pastilla ctrl-tipo-${p.proyecto.tipo}`}>
                    {NOMBRE_TIPO[p.proyecto.tipo as TipoProyecto] ?? '—'}
                  </span>
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

                  <span className="ctrl-paso">{paso?.texto ?? '—'}</span>
                </div>

                <div className="ctrl-avance">
                  <span className="ctrl-filtro-label">Avance</span>
                  <div className="ctrl-avance-tira">
                    {avance.length === 0 && (
                      <span className="campo-ayuda">Sin movimientos todavía.</span>
                    )}
                    {avance.map((a, i) => (
                      <div key={i} className={`ctrl-avance-item ctrl-avance-${a.tipo}`}>
                        <div className="ctrl-avance-cabecera">
                          <span className="ctrl-avance-tag">{ETIQUETA_AVANCE[a.tipo]}</span>
                          <span className="ctrl-avance-fecha tabular">{fechaCorta(a.fecha)}</span>
                        </div>
                        <span className="ctrl-avance-texto">{a.texto}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <span className="campo-ayuda">
          La tira de avance arranca en la última novedad y se corre al costado para ver todo el
          historial. Cliqueando la fila se abre la ficha del proyecto.
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
