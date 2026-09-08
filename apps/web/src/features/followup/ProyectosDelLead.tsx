import { useCallback, useEffect, useState } from 'react';
import {
  ESTADOS_CERRADOS,
  NOMBRE_ESTADO,
  NOMBRE_TIPO,
  estadoEfectivo,
  type EstadoProyecto,
  type Proyecto,
  type Registro,
  type TipoProyecto,
} from '@crm/core/proyecto';
import { diaLocal } from '@crm/core/fecha';
import { pb } from '../../lib/pocketbase';
import type { LeadRecord } from '../../lib/types';

const HOY = diaLocal();

/** Los que se eligen a mano. `congelado` no está: lo pone el sistema (§3.1). */
const ELEGIBLES: EstadoProyecto[] = [
  'sin_hablar',
  'en_conversacion',
  'propuesta_enviada',
  'nuestra_pelota',
  'cerrado_ganado',
  'cerrado_perdido',
];

type Carril = 'updates' | 'notas' | 'acciones';

const CARRIL: Record<Carril, { label: string; placeholder: string; boton: string }> = {
  updates: {
    label: 'Actualización',
    placeholder: 'Qué se habló, qué pasó…',
    boton: 'Registrar',
  },
  notas: {
    label: 'Nota',
    placeholder: 'Contexto que no cambia el estado…',
    boton: 'Anotar',
  },
  acciones: {
    label: 'Próxima acción',
    placeholder: 'Qué hay que hacer…',
    boton: 'Agregar',
  },
};

function fechaCorta(iso: string): string {
  const f = String(iso).slice(0, 10);
  if (!f) return '';
  const [, m, d] = f.split('-');
  return `${d}/${m}`;
}

interface Props {
  lead: LeadRecord;
  editable: boolean;
  /** Se llama al escribir, para que Control se entere sin recargar (criterio 7). */
  onCambio: () => void;
}

/**
 * Los proyectos del lead, desde la ficha.
 *
 * **Acá se edita; en Control se mira.** El manual define Control como solo
 * lectura y no dice dónde se cargan las actualizaciones — sin este bloque un
 * proyecto no se puede mover nunca y todos terminan Congelados a los 30 días,
 * que es exactamente lo que la regla quiere señalar, no provocar.
 *
 * Se llama `proyecto` y no `nota del lead` a propósito: la nota de la ficha es
 * sobre la persona, esto es sobre el trabajo.
 */
export function ProyectosDelLead({ lead, editable, onCambio }: Props) {
  const [proyectos, setProyectos] = useState<(Proyecto & { cuenta: string })[]>([]);
  const [borrador, setBorrador] = useState<Record<string, string>>({});
  const [carril, setCarril] = useState<Record<string, Carril>>({});
  const [fechaAccion, setFechaAccion] = useState<Record<string, string>>({});
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    try {
      const r = await pb.collection('proyecto').getFullList({ filter: `lead = "${lead.id}"` });
      setProyectos(r as unknown as typeof proyectos);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [lead.id]);

  useEffect(() => {
    setBorrador({});
    setCarril({});
    void cargar();
  }, [cargar]);

  async function escribir(p: Proyecto, cambios: Record<string, unknown>) {
    setGuardando(true);
    setError(null);
    try {
      await pb.collection('proyecto').update(p.id, {
        ...cambios,
        // Cualquier escritura mueve el proyecto: es lo que lo saca de Congelado
        // sin tener que recordar en qué estado estaba (§3.1).
        ultimo_movimiento: HOY,
      });
      await cargar();
      onCambio();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setGuardando(false);
    }
  }

  async function agregar(p: Proyecto & { cuenta: string }) {
    const texto = (borrador[p.id] ?? '').trim();
    if (!texto || guardando) return;
    const cual = carril[p.id] ?? 'updates';

    const nuevo: Registro = { fecha: HOY, texto };
    if (cual === 'acciones') nuevo.fecha = fechaAccion[p.id] || HOY;

    await escribir(p, { [cual]: [...(p[cual] ?? []), nuevo] });
    setBorrador((b) => ({ ...b, [p.id]: '' }));
  }

  async function marcarHecha(p: Proyecto & { cuenta: string }, i: number) {
    const acciones = (p.acciones ?? []).map((a, n) => (n === i ? { ...a, hecha: !a.hecha } : a));
    await escribir(p, { acciones });
  }

  if (error) return <div className="login-error">{error}</div>;
  if (proyectos.length === 0) {
    return (
      <span className="campo-ayuda">
        Este lead no tiene proyectos. Se abren con el botón de Control de proyectos, arriba.
      </span>
    );
  }

  return (
    <div className="proyectos-lead">
      {proyectos.map((p) => {
        const cual = carril[p.id] ?? 'updates';
        const efectivo = estadoEfectivo(p, [], HOY);
        const pendientes = (p.acciones ?? []).filter((a) => !a.hecha).length;

        return (
          <div key={p.id} className="proyecto-bloque">
            <div className="proyecto-cabecera">
              <span className="ctrl-nombre">{p.nombre}</span>
              <span className={`ctrl-pastilla ctrl-tipo-${p.tipo}`}>
                {NOMBRE_TIPO[p.tipo as TipoProyecto] ?? '—'}
              </span>
              <span className={`ctrl-pastilla ctrl-estado-${efectivo}`}>
                {NOMBRE_ESTADO[efectivo]}
              </span>
              {efectivo === 'congelado' && (
                <span className="campo-ayuda">
                  Sin movimiento hace más de 30 días. Cargá una actualización y vuelve solo.
                </span>
              )}
            </div>

            {editable && (
              <div className="campo">
                <span className="campo-label">Estado</span>
                <div className="chips">
                  {ELEGIBLES.map((e) => (
                    <button
                      key={e}
                      type="button"
                      className={`ctrl-chip ctrl-estado-${e} ${p.estado === e ? 'ctrl-chip-on' : ''}`}
                      onClick={() => void escribir(p, { estado: e })}
                      disabled={guardando}
                    >
                      {NOMBRE_ESTADO[e]}
                    </button>
                  ))}
                </div>
                {ESTADOS_CERRADOS.includes(p.estado as EstadoProyecto) && (
                  <span className="campo-ayuda">
                    Cerrado. No se congela solo; para reabrirlo, elegí otro estado.
                  </span>
                )}
              </div>
            )}

            <div className="proyecto-carriles">
              {(Object.keys(CARRIL) as Carril[]).map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`chip ${cual === c ? 'chip-on' : ''}`}
                  onClick={() => setCarril((x) => ({ ...x, [p.id]: c }))}
                >
                  {CARRIL[c].label}
                  {c === 'acciones' && pendientes > 0 && ` · ${pendientes}`}
                </button>
              ))}
            </div>

            {editable && (
              <div className="proyecto-alta">
                <textarea
                  rows={2}
                  value={borrador[p.id] ?? ''}
                  placeholder={CARRIL[cual].placeholder}
                  onChange={(e) => setBorrador((b) => ({ ...b, [p.id]: e.target.value }))}
                />
                <div className="proyecto-alta-pie">
                  {cual === 'acciones' && (
                    <label className="campo campo-chico">
                      <span className="campo-label">Para cuándo</span>
                      <input
                        type="date"
                        value={fechaAccion[p.id] ?? HOY}
                        onChange={(e) =>
                          setFechaAccion((f) => ({ ...f, [p.id]: e.target.value }))
                        }
                      />
                    </label>
                  )}
                  <button
                    type="button"
                    className="boton-principal al-final"
                    onClick={() => void agregar(p)}
                    disabled={guardando || !(borrador[p.id] ?? '').trim()}
                  >
                    {guardando ? 'Guardando…' : CARRIL[cual].boton}
                  </button>
                </div>
              </div>
            )}

            <div className="proyecto-historial">
              {(p[cual] ?? []).length === 0 && (
                <span className="campo-ayuda">Sin registros todavía.</span>
              )}
              {[...(p[cual] ?? [])]
                .map((r, i) => ({ r, i }))
                .sort((a, b) =>
                  cual === 'acciones'
                    ? String(a.r.fecha).localeCompare(String(b.r.fecha))
                    : String(b.r.fecha).localeCompare(String(a.r.fecha)),
                )
                .map(({ r, i }) => (
                  <div key={i} className="proyecto-item">
                    <span className="panel-item-fecha tabular">{fechaCorta(r.fecha)}</span>
                    <span
                      className={`panel-item-texto ${r.hecha ? 'proyecto-item-hecha' : ''}`}
                    >
                      {r.texto}
                    </span>
                    {cual === 'acciones' && editable && (
                      <button
                        type="button"
                        className="boton-mini"
                        onClick={() => void marcarHecha(p, i)}
                        disabled={guardando}
                      >
                        {r.hecha ? 'reabrir' : '✓ hecha'}
                      </button>
                    )}
                  </div>
                ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
