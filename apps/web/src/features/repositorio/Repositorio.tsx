import { useEffect, useMemo, useState } from 'react';
import {
  escribirAlcance,
  leerAlcance,
  nombreDeAlcance,
  reordenar,
  resolverTexto,
  type Alcance,
} from '@crm/core/plantilla';
import type { Idioma } from '@crm/core/tipos';
import { pb } from '../../lib/pocketbase';
import type { PlantillaRecord } from '../../lib/types';

const IDIOMAS: Idioma[] = ['es', 'pt', 'en'];
const PASOS = [
  'R0', 'R0-recontacto', 'R1', 'R2', 'R3', 'R4', 'R5', 'R6', 'R7', 'R8', 'agradecimiento',
] as const;

/** Ejemplo para la vista previa: se ve cómo queda con datos reales. */
const EJEMPLO = {
  nombre: 'Wellington Abner Simoes',
  empresa: 'GlobalTec',
  industria: 'Alimentos',
  ciudad: 'Campinas',
};

interface Props {
  onCerrar: () => void;
  onCambio: () => void;
}

/**
 * Repositorio de mensajes (§7.9). Es el **único lugar de verdad de los textos**:
 * lo que se edite acá se refleja al instante en Enviar mensaje y en Vencimientos.
 */
export function Repositorio({ onCerrar, onCambio }: Props) {
  const [plantillas, setPlantillas] = useState<PlantillaRecord[]>([]);
  const [seleccionada, setSeleccionada] = useState<string | null>(null);
  const [idioma, setIdioma] = useState<Idioma>('es');
  const [borrador, setBorrador] = useState('');
  const [nombre, setNombre] = useState('');
  const [sucio, setSucio] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Qué plantilla tiene abierto el selector de alcance del destacado. */
  const [alcanceDe, setAlcanceDe] = useState<string | null>(null);
  const [eligiendo, setEligiendo] = useState<string[]>([]);
  /** El id que se está arrastrando, y sobre cuál está parado. */
  const [arrastrando, setArrastrando] = useState<string | null>(null);
  const [sobre, setSobre] = useState<string | null>(null);
  const [cuentas, setCuentas] = useState<string[]>([]);

  async function recargar() {
    try {
      const r = await pb.collection('plantilla').getFullList<PlantillaRecord>({ sort: 'orden' });
      setPlantillas(r);
      if (!seleccionada && r[0]) setSeleccionada(r[0].id);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  useEffect(() => {
    void recargar();
    // Las abreviaturas del selector de alcance salen de la base: escribir la
    // lista a mano la deja vieja en cuanto se suma una cuenta.
    pb.collection('cuenta')
      .getFullList<{ abrev: string }>({ sort: 'slot' })
      .then((cs) => setCuentas(cs.map((c) => c.abrev)))
      .catch(() => setCuentas([]));
  }, []);

  async function guardarAlcance(id: string, a: Alcance) {
    setAlcanceDe(null);
    setEligiendo([]);
    await pb.collection('plantilla').update(id, { destacado: escribirAlcance(a) });
    await recargar();
    onCambio();
  }

  /**
   * Arrastrar dentro del grupo del paso.
   *
   * Se renumera el grupo entero y no el par que se cruza: guardando solo los
   * dos quedan números repetidos y el orden pasa a decidirlo el desempate.
   */
  async function soltar(destinoId: string, delPaso: PlantillaRecord[]) {
    const cambios = reordenar(delPaso, arrastrando ?? '', destinoId);
    setArrastrando(null);
    setSobre(null);
    if (!cambios.length) return;
    for (const c of cambios) await pb.collection('plantilla').update(c.id, { orden: c.orden });
    await recargar();
    onCambio();
  }

  async function borrar(id: string) {
    await pb.collection('plantilla').delete(id);
    if (seleccionada === id) setSeleccionada(null);
    await recargar();
    onCambio();
  }

  const plantilla = plantillas.find((p) => p.id === seleccionada) ?? null;

  useEffect(() => {
    if (!plantilla) return;
    setNombre(plantilla.nombre);
    setBorrador(plantilla.textos?.[idioma] ?? '');
    setSucio(false);
  }, [plantilla?.id, idioma]);

  useEffect(() => {
    const f = (e: KeyboardEvent) => e.key === 'Escape' && !sucio && onCerrar();
    document.addEventListener('keydown', f);
    return () => document.removeEventListener('keydown', f);
  }, [onCerrar, sucio]);

  const vistaPrevia = useMemo(
    () => (borrador ? resolverTexto(borrador, EJEMPLO, idioma) : ''),
    [borrador, idioma],
  );

  /** Qué pasos tienen plantilla y cuáles no (§5.2: hay que avisarlo). */
  const pasosSinPlantilla = useMemo(() => {
    const con = new Set(plantillas.map((p) => p.paso).filter(Boolean));
    return PASOS.filter((p) => !con.has(p));
  }, [plantillas]);

  async function guardar() {
    if (!plantilla) return;
    setGuardando(true);
    setError(null);
    try {
      const textos = { ...(plantilla.textos ?? {}) };
      if (borrador.trim()) textos[idioma] = borrador;
      else delete textos[idioma];
      const g = await pb.collection('plantilla').update<PlantillaRecord>(plantilla.id, {
        nombre,
        textos,
      });
      setPlantillas((ps) => ps.map((p) => (p.id === g.id ? g : p)));
      setSucio(false);
      onCambio();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setGuardando(false);
    }
  }

  async function crear(paso: string) {
    setGuardando(true);
    try {
      const orden = Math.max(0, ...plantillas.map((p) => p.orden ?? 0)) + 1;
      const nueva = await pb.collection('plantilla').create<PlantillaRecord>({
        nombre: `${paso} · nueva`,
        paso,
        por_defecto: !plantillas.some((p) => p.paso === paso),
        textos: {},
        destacado: '',
        orden,
      });
      setPlantillas((ps) => [...ps, nueva]);
      setSeleccionada(nueva.id);
      onCambio();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setGuardando(false);
    }
  }

  async function hacerPorDefecto() {
    if (!plantilla?.paso) return;
    setGuardando(true);
    try {
      // Una sola por defecto por paso (D16): primero se baja la actual.
      const actual = plantillas.find((p) => p.paso === plantilla.paso && p.por_defecto);
      if (actual && actual.id !== plantilla.id) {
        await pb.collection('plantilla').update(actual.id, { por_defecto: false });
      }
      await pb.collection('plantilla').update(plantilla.id, { por_defecto: true });
      await recargar();
      onCambio();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="overlay-fondo" onClick={() => !sucio && onCerrar()}>
      <div
        className="overlay-caja overlay-ancho"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="overlay-header">
          <span className="overlay-titulo">Repositorio de mensajes</span>
          <span className="overlay-progreso">{plantillas.length}</span>
          <div className="barra" />
          <button type="button" className="boton-icono-26" onClick={onCerrar} title="Cerrar">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </header>

        <div className="repo">
          <aside className="repo-lista">
            {PASOS.map((paso) => {
              const delPaso = plantillas.filter((p) => p.paso === paso);
              return (
                <div key={paso} className="repo-grupo">
                  <div className="repo-grupo-cabecera">
                    <span className="campo-label">{paso}</span>
                    <button
                      type="button"
                      className="boton-mini"
                      onClick={() => void crear(paso)}
                      disabled={guardando}
                      title={`Agregar una variante de ${paso}`}
                    >
                      +
                    </button>
                  </div>
                  {delPaso.map((p) => {
                    const alcance = leerAlcance(p.destacado);
                    return (
                      <div
                        key={p.id}
                        className={[
                          'repo-item',
                          seleccionada === p.id ? 'repo-item-on' : '',
                          arrastrando === p.id ? 'repo-item-yendo' : '',
                          sobre === p.id && arrastrando !== p.id ? 'repo-item-blanco' : '',
                        ].join(' ')}
                        draggable
                        onDragStart={() => setArrastrando(p.id)}
                        onDragOver={(e) => {
                          e.preventDefault();
                          if (sobre !== p.id) setSobre(p.id);
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          void soltar(p.id, delPaso);
                        }}
                        onDragEnd={() => {
                          setArrastrando(null);
                          setSobre(null);
                        }}
                        onClick={() => setSeleccionada(p.id)}
                      >
                        <span className="repo-agarre" title="Arrastrar para reordenar">
                          &#10495;
                        </span>
                        <span className="repo-nombre">{p.nombre}</span>
                        <span className="repo-idiomas">
                          {IDIOMAS.filter((i) => p.textos?.[i]).join(' ') || '—'}
                        </span>
                        {p.por_defecto && (
                          <span className="repo-defecto" title="La principal del paso (D16)">
                            ★
                          </span>
                        )}
                        <span className="relativo">
                          <button
                            type="button"
                            className={
                              alcance.tipo !== 'ninguno' ? 'repo-destacar repo-destacar-on' : 'repo-destacar'
                            }
                            title={
                              alcance.tipo === 'ninguno'
                                ? 'Destacar este mensaje'
                                : 'Destacado en ' + nombreDeAlcance(alcance)
                            }
                            onClick={(e) => {
                              e.stopPropagation();
                              setAlcanceDe(alcanceDe === p.id ? null : p.id);
                              setEligiendo(alcance.tipo === 'cuentas' ? alcance.cuentas : []);
                            }}
                          >
                            ★
                          </button>
                          {alcanceDe === p.id && (
                            <>
                              <div
                                className="popover-fondo"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setAlcanceDe(null);
                                }}
                              />
                              <div
                                className="popover popover-anclado repo-alcance"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <span className="campo-label">¿Para qué cuentas?</span>
                                <button
                                  type="button"
                                  className="lot-opcion"
                                  onClick={() => void guardarAlcance(p.id, { tipo: 'todas' })}
                                >
                                  Todas las cuentas
                                  <span className="campo-ayuda al-final">{cuentas.length}</span>
                                </button>
                                <span className="campo-label">O elegí cuáles</span>
                                <div className="chips">
                                  {cuentas.map((c) => (
                                    <button
                                      key={c}
                                      type="button"
                                      className={eligiendo.includes(c) ? 'chip chip-on' : 'chip'}
                                      onClick={() =>
                                        setEligiendo((sel) =>
                                          sel.includes(c) ? sel.filter((x) => x !== c) : [...sel, c],
                                        )
                                      }
                                    >
                                      {c}
                                    </button>
                                  ))}
                                </div>
                                <div className="repo-alcance-pie">
                                  {alcance.tipo !== 'ninguno' && (
                                    <button
                                      type="button"
                                      className="boton-mini"
                                      onClick={() => void guardarAlcance(p.id, { tipo: 'ninguno' })}
                                    >
                                      Quitar destaque
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    className="boton-mini al-final"
                                    disabled={!eligiendo.length}
                                    onClick={() =>
                                      void guardarAlcance(p.id, { tipo: 'cuentas', cuentas: eligiendo })
                                    }
                                  >
                                    Aplicar
                                  </button>
                                </div>
                              </div>
                            </>
                          )}
                        </span>
                        {/* La principal del paso no se borra: dejaría el paso sin
                            texto y la cadencia sin qué mandar (D16). */}
                        {!p.por_defecto && (
                          <button
                            type="button"
                            className="pet-icono pet-icono-borrar"
                            title="Eliminar esta variante"
                            onClick={(e) => {
                              e.stopPropagation();
                              void borrar(p.id);
                            }}
                          >
                            ×
                          </button>
                        )}
                      </div>
                    );
                  })}
                  {delPaso.length === 0 && <span className="repo-vacio">sin plantilla</span>}
                </div>
              );
            })}
          </aside>

          <section className="repo-editor">
            {!plantilla ? (
              <p className="vacio">Elegí una plantilla.</p>
            ) : (
              <>
                <label className="campo">
                  <span className="campo-label">Nombre</span>
                  <input
                    value={nombre}
                    onChange={(e) => {
                      setNombre(e.target.value);
                      setSucio(true);
                    }}
                  />
                  <span className="campo-ayuda">
                    El nombre es libre: lo que ata la plantilla al paso es el campo{' '}
                    <code>{plantilla.paso || 'sin paso'}</code>, no el texto (D16).
                  </span>
                </label>

                <div className="venc-mensaje-cabecera">
                  <span className="campo-label">Texto</span>
                  {!plantilla.por_defecto && plantilla.paso && (
                    <button
                      type="button"
                      className="boton-mini"
                      onClick={() => void hacerPorDefecto()}
                      disabled={guardando}
                    >
                      Hacer la principal
                    </button>
                  )}
                  <div className="selector-idioma">
                    {IDIOMAS.map((i) => (
                      <button
                        key={i}
                        type="button"
                        className={idioma === i ? 'idioma-on' : 'idioma-off'}
                        onClick={() => setIdioma(i)}
                        title={plantilla.textos?.[i] ? 'Tiene texto' : 'Sin texto en este idioma'}
                      >
                        {i}
                        {plantilla.textos?.[i] ? '' : ' ·'}
                      </button>
                    ))}
                  </div>
                </div>

                <textarea
                  rows={7}
                  value={borrador}
                  onChange={(e) => {
                    setBorrador(e.target.value);
                    setSucio(true);
                  }}
                  placeholder={`Texto en ${idioma}. Variables: {nombre} {empresa} {industria} {ciudad} {tema}`}
                />

                <div className="campo">
                  <span className="campo-label">Vista previa</span>
                  <div className="reunion-preview">
                    {vistaPrevia || <span className="campo-ayuda">Escribí el texto para verlo.</span>}
                  </div>
                  <span className="campo-ayuda">
                    Con datos de ejemplo. Un campo vacío usa el genérico del idioma
                    (su planta / sua planta).
                  </span>
                </div>

                {error && <div className="login-error">{error}</div>}
              </>
            )}
          </section>
        </div>

        <footer className="overlay-pie">
          {pasosSinPlantilla.length > 0 ? (
            <span className="campo-ayuda">
              Sin plantilla todavía: <strong>{pasosSinPlantilla.join(', ')}</strong>
            </span>
          ) : (
            <span className="campo-ayuda">Todos los pasos tienen plantilla.</span>
          )}
          <button
            type="button"
            className="boton-principal al-final"
            disabled={!sucio || guardando}
            onClick={() => void guardar()}
          >
            {guardando ? 'Guardando…' : 'Guardar'}
          </button>
        </footer>
      </div>
    </div>
  );
}
