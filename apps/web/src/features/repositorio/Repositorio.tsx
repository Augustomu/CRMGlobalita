import { useEffect, useMemo, useState } from 'react';
import { PANEL_REPOSITORIO } from '@crm/core/anchos';
import {
  escribirAlcance,
  leerAlcance,
  nombreDeAlcance,
  reordenar,
  resolverTexto,
  type Alcance,
} from '@crm/core/plantilla';
import { NOMBRE_CASA, casaDeLinea, type Casa } from '@crm/core/proyecto';
import type { Idioma } from '@crm/core/tipos';
import { pb } from '../../lib/pocketbase';
import { useAncho } from '../../lib/useAncho';
import { useEscape } from '../../lib/useEscape';
import type { PlantillaRecord } from '../../lib/types';

const IDIOMAS: { k: Idioma; label: string }[] = [
  { k: 'es', label: 'ES' },
  { k: 'pt', label: 'PT' },
  { k: 'en', label: 'EN' },
];

const PASOS = [
  'R0', 'R0-recontacto', 'R1', 'R2', 'R3', 'R4', 'R5', 'R6', 'R7', 'R8', 'agradecimiento',
] as const;

/** Ejemplo para la vista previa: se ve cómo queda con datos reales. */
const EJEMPLO = {
  nombre: 'Wellington Abner Simoes',
  empresa: 'Opus CM',
  industria: 'Construcción / Manufactura',
  ciudad: 'Sao Paulo',
};

interface Props {
  onCerrar: () => void;
  onCambio: () => void;
  /**
   * La cuenta del lead que se está mirando.
   *
   * Es lo que hace posible «Solo esta cuenta», que es el caso más común:
   * destacar el mensaje para la cuenta con la que se está trabajando. Sin
   * esto hay que ir a «Elegir cuentas» y tildarla, que son tres clics para lo
   * que el prototipo resuelve en uno.
   */
  cuentaActual?: string;
}

/**
 * Repositorio de mensajes (§7.9). Es el **único lugar de verdad de los textos**:
 * lo que se edite acá se refleja al instante en Enviar mensaje, en Vencimientos
 * y en Automatizaciones.
 *
 * Es un SIDEBAR, no un modal. El manual lo lista junto a la agenda en «Sidebars
 * (una a la vez)», y la diferencia no es decorativa: un modal tapa la ficha, y
 * el momento en que se edita una plantilla es justamente cuando se la está
 * mirando contra el lead al que se le va a mandar.
 *
 * Portado de `docs/prototipo/RepositorioMensajes.dc.html`: una sola columna,
 * cada mensaje es una tarjeta que se abre en el lugar. Los destacados van
 * arriba.
 */
export function Repositorio({ onCerrar, onCambio, cuentaActual }: Props) {
  const [plantillas, setPlantillas] = useState<PlantillaRecord[]>([]);
  /** Cuál está abierta para editar. Una sola a la vez. */
  const [abierta, setAbierta] = useState<string | null>(null);
  const [idioma, setIdioma] = useState<Idioma>('es');
  const [borrador, setBorrador] = useState('');
  const [nombre, setNombre] = useState('');
  const [sucio, setSucio] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<'todos' | 'favoritos'>('todos');
  /** Qué plantilla tiene abierto el selector de alcance del destacado. */
  const [alcanceDe, setAlcanceDe] = useState<string | null>(null);
  const [eligiendo, setEligiendo] = useState<string[] | null>(null);
  const [arrastrando, setArrastrando] = useState<string | null>(null);
  const [sobre, setSobre] = useState<string | null>(null);
  const [cuentas, setCuentas] = useState<string[]>([]);
  /** Cuántas cuentas tiene cada casa hoy, para poder decirlo en la opción. */
  const [porCasa, setPorCasa] = useState<Record<Casa, number>>({ globalita: 0, seng: 0 });

  // §9.4: 300–620, doble clic vuelve a 400, persistido.
  const anchoRepo = useAncho(PANEL_REPOSITORIO);

  async function recargar() {
    try {
      setPlantillas(await pb.collection('plantilla').getFullList<PlantillaRecord>({ sort: 'orden' }));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  useEffect(() => {
    void recargar();
    // Las abreviaturas del selector de alcance salen de la base: escribir la
    // lista a mano la deja vieja en cuanto se suma una cuenta.
    pb.collection('cuenta')
      .getFullList<{ abrev: string; linea_negocio?: string }>({ sort: 'slot' })
      .then((cs) => {
        setCuentas(cs.map((c) => c.abrev));
        const cuenta = { globalita: 0, seng: 0 } as Record<Casa, number>;
        for (const c of cs) {
          const casa = casaDeLinea(c.linea_negocio);
          if (casa) cuenta[casa] += 1;
        }
        setPorCasa(cuenta);
      })
      .catch(() => setCuentas([]));
  }, []);

  useEscape(onCerrar, sucio);

  const plantilla = plantillas.find((p) => p.id === abierta) ?? null;

  useEffect(() => {
    if (!plantilla) {
      setNombre('');
      setBorrador('');
      setSucio(false);
      return;
    }
    setNombre(plantilla.nombre);
    setBorrador(plantilla.textos?.[idioma] ?? '');
    setSucio(false);
  }, [plantilla?.id, idioma]);

  const vistaPrevia = useMemo(
    () => (borrador ? resolverTexto(borrador, EJEMPLO, idioma) : ''),
    [borrador, idioma],
  );

  /**
   * Los destacados van arriba, y adentro de cada grupo manda el orden.
   *
   * No es un capricho del prototipo: el repositorio se abre para buscar algo
   * que ya se usó, y lo que ya se usó es lo destacado.
   */
  const visibles = useMemo(() => {
    const destacados = plantillas.filter((p) => leerAlcance(p.destacado).tipo !== 'ninguno');
    if (filtro === 'favoritos') return destacados;
    return [...destacados, ...plantillas.filter((p) => leerAlcance(p.destacado).tipo === 'ninguno')];
  }, [plantillas, filtro]);

  const nDestacados = plantillas.filter((p) => leerAlcance(p.destacado).tipo !== 'ninguno').length;

  /** Qué pasos no tienen plantilla (§5.2: hay que avisarlo). */
  const pasosSinPlantilla = useMemo(() => {
    const con = new Set(plantillas.map((p) => p.paso).filter(Boolean));
    return PASOS.filter((p) => !con.has(p));
  }, [plantillas]);

  async function guardarAlcance(id: string, a: Alcance) {
    setAlcanceDe(null);
    setEligiendo(null);
    await pb.collection('plantilla').update(id, { destacado: escribirAlcance(a) });
    await recargar();
    onCambio();
  }

  /**
   * Arrastrar para reordenar.
   *
   * Se renumera la lista entera y no el par que se cruza: guardando solo los
   * dos quedan números repetidos y el orden pasa a decidirlo el desempate.
   */
  async function soltar(destinoId: string) {
    const cambios = reordenar(plantillas, arrastrando ?? '', destinoId);
    setArrastrando(null);
    setSobre(null);
    if (!cambios.length) return;
    for (const c of cambios) await pb.collection('plantilla').update(c.id, { orden: c.orden });
    await recargar();
    onCambio();
  }

  async function borrar(id: string) {
    await pb.collection('plantilla').delete(id);
    if (abierta === id) setAbierta(null);
    await recargar();
    onCambio();
  }

  async function guardar() {
    if (!plantilla) return;
    setGuardando(true);
    setError(null);
    try {
      const textos = { ...(plantilla.textos ?? {}) };
      if (borrador.trim()) textos[idioma] = borrador;
      else delete textos[idioma];
      const g = await pb.collection('plantilla').update<PlantillaRecord>(plantilla.id, { nombre, textos });
      setPlantillas((ps) => ps.map((p) => (p.id === g.id ? g : p)));
      setSucio(false);
      onCambio();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setGuardando(false);
    }
  }

  /** Alta. El nombre «R{n} · …» es lo que ata la plantilla al paso (§5.2). */
  async function crear() {
    setGuardando(true);
    try {
      const orden = Math.max(0, ...plantillas.map((p) => p.orden ?? 0)) + 1;
      const nueva = await pb.collection('plantilla').create<PlantillaRecord>({
        nombre: 'Mensaje nuevo',
        paso: '',
        por_defecto: false,
        textos: {},
        destacado: '',
        orden,
      });
      await recargar();
      setFiltro('todos');
      setAbierta(nueva.id);
      setIdioma('es');
      onCambio();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setGuardando(false);
    }
  }

  /** D16: una sola por defecto por paso. */
  async function cambiarPaso(id: string, paso: string) {
    setGuardando(true);
    try {
      const otras = plantillas.filter((p) => p.paso === paso && p.id !== id);
      await pb.collection('plantilla').update(id, { paso, por_defecto: otras.length === 0 });
      await recargar();
      onCambio();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setGuardando(false);
    }
  }

  async function hacerPorDefecto(p: PlantillaRecord) {
    if (!p.paso) return;
    setGuardando(true);
    try {
      const actual = plantillas.find((x) => x.paso === p.paso && x.por_defecto);
      if (actual && actual.id !== p.id) {
        await pb.collection('plantilla').update(actual.id, { por_defecto: false });
      }
      await pb.collection('plantilla').update(p.id, { por_defecto: true });
      await recargar();
      onCambio();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <aside className="repo-sidebar" style={anchoRepo.estilo}>
      <div
        className="divisor divisor-izq"
        title="Arrastrá para cambiar el ancho del repositorio · doble clic para volver al ancho normal"
        {...anchoRepo.divisor}
      />

      <header className="repo-cabecera">
        <span className="colapsable-titulo">Repositorio</span>
        <span className="campo-ayuda tabular">
          {plantillas.length} mensajes · {nDestacados} destacados
        </span>
        <button
          type="button"
          className="repo-nuevo al-final"
          title="Nuevo mensaje"
          disabled={guardando}
          onClick={() => void crear()}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </button>
        <button type="button" className="boton-icono-26" title="Cerrar" onClick={onCerrar}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </header>

      <div className="repo-filtros">
        {(['todos', 'favoritos'] as const).map((f) => (
          <button
            key={f}
            type="button"
            className={`repo-chip ${filtro === f ? 'repo-chip-on' : ''}`}
            onClick={() => setFiltro(f)}
          >
            {f === 'todos' ? 'Todos' : 'Favoritos'}
          </button>
        ))}
        <span className="campo-ayuda al-final">los destacados van arriba</span>
      </div>

      <div className="repo-cuerpo">
        {visibles.map((p) => {
          const alcance = leerAlcance(p.destacado);
          const destacada = alcance.tipo !== 'ninguno';
          const estaAbierta = abierta === p.id;
          return (
            <div
              key={p.id}
              className={[
                'repo-tarjeta',
                arrastrando === p.id ? 'repo-tarjeta-yendo' : '',
                sobre === p.id && arrastrando !== p.id ? 'repo-tarjeta-blanco' : '',
              ].join(' ')}
              draggable
              onDragStart={() => setArrastrando(p.id)}
              onDragOver={(e) => {
                e.preventDefault();
                if (sobre !== p.id) setSobre(p.id);
              }}
              onDrop={(e) => {
                e.preventDefault();
                void soltar(p.id);
              }}
              onDragEnd={() => {
                setArrastrando(null);
                setSobre(null);
              }}
            >
              <div className="repo-fila">
                <span className="repo-agarre" title="Arrastrá para reordenar">
                  &#10495;
                </span>
                <button
                  type="button"
                  className="repo-abrir"
                  onClick={() => {
                    setAbierta(estaAbierta ? null : p.id);
                    setIdioma('es');
                  }}
                >
                  <span className="repo-nombre">{p.nombre}</span>
                </button>

                {p.paso && (
                  <span className="pastilla" title="El paso al que responde (§5.2)">
                    {p.paso}
                  </span>
                )}
                {p.por_defecto && (
                  <span className="repo-defecto" title="La principal del paso (D16)">
                    ★
                  </span>
                )}

                {/* Los tres idiomas SIEMPRE, cargados o no: el hueco se dice.
                    Con solo los cargados no se ve qué falta traducir. */}
                <span className="repo-idiomas">
                  {IDIOMAS.map((i) => (
                    <span
                      key={i.k}
                      className={p.textos?.[i.k] ? 'repo-idioma repo-idioma-on' : 'repo-idioma'}
                      title={p.textos?.[i.k] ? 'Cargado' : 'Sin cargar'}
                    >
                      {i.label}
                    </span>
                  ))}
                </span>

                <button
                  type="button"
                  className={destacada ? 'repo-destacar repo-destacar-on' : 'repo-destacar'}
                  title={destacada ? `Destacado en ${nombreDeAlcance(alcance)}` : 'Destacar este mensaje'}
                  onClick={() => {
                    setAlcanceDe(alcanceDe === p.id ? null : p.id);
                    setEligiendo(alcance.tipo === 'cuentas' ? alcance.cuentas : null);
                  }}
                >
                  <svg viewBox="0 0 24 24" fill={destacada ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.6">
                    <path d="M12 4l2.4 5 5.6.8-4 4 1 5.6-5-2.7-5 2.7 1-5.6-4-4 5.6-.8z" />
                  </svg>
                </button>
              </div>

              {destacada && (
                <div className="repo-destacado-en">
                  <span className="campo-ayuda">destacado en</span>
                  <span className="pastilla pastilla-acento">{nombreDeAlcance(alcance)}</span>
                  <button
                    type="button"
                    className="repo-quitar"
                    title="Quitar de destacados"
                    onClick={() => void guardarAlcance(p.id, { tipo: 'ninguno' })}
                  >
                    ×
                  </button>
                </div>
              )}

              {alcanceDe === p.id && (
                <div className="repo-alcance">
                  <span className="campo-label">¿Para qué cuentas lo destaco?</span>
                  <button
                    type="button"
                    className="repo-opcion"
                    onClick={() => void guardarAlcance(p.id, { tipo: 'todas' })}
                  >
                    <span>Todas las cuentas</span>
                    <span className="campo-ayuda al-final">{cuentas.length} cuentas</span>
                  </button>

                  {/* Por casa. Es el que evita el problema de fondo: con una
                      lista de cuentas, la que se sume mañana empieza sin
                      ningún destacado y nadie se entera. */}
                  {(['globalita', 'seng'] as const).map((c) => (
                    <button
                      key={c}
                      type="button"
                      className="repo-opcion"
                      onClick={() => void guardarAlcance(p.id, { tipo: 'casa', casa: c })}
                    >
                      <span>Todo {NOMBRE_CASA[c]}</span>
                      <span className="campo-ayuda al-final">
                        {porCasa[c]} {porCasa[c] === 1 ? 'cuenta' : 'cuentas'} · y las nuevas
                      </span>
                    </button>
                  ))}
                  {/* Sólo si hay un lead abierto: una opción que no sabe a
                      qué cuenta se refiere no es una opción. */}
                  {cuentaActual && (
                    <button
                      type="button"
                      className="repo-opcion"
                      onClick={() => void guardarAlcance(p.id, { tipo: 'cuentas', cuentas: [cuentaActual] })}
                    >
                      <span>Solo esta cuenta</span>
                      <span className="campo-ayuda al-final">{cuentaActual}</span>
                    </button>
                  )}
                  <button
                    type="button"
                    className="repo-opcion"
                    onClick={() => setEligiendo(eligiendo ? null : [])}
                  >
                    <span>Elegir cuentas</span>
                    <span className="campo-ayuda al-final">seleccionar</span>
                  </button>

                  {eligiendo && (
                    <div className="repo-cuentas">
                      {cuentas.map((c) => (
                        <button
                          key={c}
                          type="button"
                          className={`repo-chip ${eligiendo.includes(c) ? 'repo-chip-on' : ''}`}
                          onClick={() =>
                            setEligiendo((s) =>
                              (s ?? []).includes(c) ? (s ?? []).filter((x) => x !== c) : [...(s ?? []), c],
                            )
                          }
                        >
                          {c}
                        </button>
                      ))}
                      <button
                        type="button"
                        className="boton-mini al-final"
                        disabled={!eligiendo.length}
                        onClick={() => void guardarAlcance(p.id, { tipo: 'cuentas', cuentas: eligiendo })}
                      >
                        Destacar
                      </button>
                    </div>
                  )}
                </div>
              )}

              {estaAbierta && (
                <div className="repo-editor">
                  <input
                    type="text"
                    className="repo-nombre-input"
                    value={nombre}
                    placeholder="Nombre del mensaje…"
                    onChange={(e) => {
                      setNombre(e.target.value);
                      setSucio(true);
                    }}
                  />

                  <div className="repo-editor-controles">
                    <div className="reunion-segmentado">
                      {IDIOMAS.map((i) => (
                        <button
                          key={i.k}
                          type="button"
                          className={idioma === i.k ? 'reunion-seg-on' : ''}
                          onClick={() => setIdioma(i.k)}
                        >
                          {i.label}
                        </button>
                      ))}
                    </div>

                    {/* §5.2: el paso sale del nombre, pero guardarlo aparte es
                        lo que le permite a Automatizaciones encontrarlo sin
                        adivinar de un texto libre. */}
                    <select
                      className="repo-paso"
                      value={p.paso ?? ''}
                      title="A qué paso de la cadencia responde"
                      onChange={(e) => void cambiarPaso(p.id, e.target.value)}
                    >
                      <option value="">sin paso</option>
                      {PASOS.map((x) => (
                        <option key={x} value={x}>
                          {x}
                        </option>
                      ))}
                    </select>

                    <button
                      type="button"
                      className="repo-borrar"
                      title="Eliminar mensaje"
                      onClick={() => void borrar(p.id)}
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
                        <path d="M5 7h14M9 7V5h6v2M7 7l1 13h8l1-13" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      className="boton-principal al-final"
                      disabled={!sucio || guardando}
                      onClick={() => void guardar()}
                    >
                      {guardando ? 'Guardando…' : 'Guardar'}
                    </button>
                  </div>

                  <textarea
                    className="repo-texto"
                    value={borrador}
                    placeholder="Escribir el mensaje…"
                    onChange={(e) => {
                      setBorrador(e.target.value);
                      setSucio(true);
                    }}
                  />
                  <span className="campo-ayuda tabular">{borrador.length} caracteres</span>

                  {vistaPrevia && (
                    <div className="repo-previa">
                      <span className="campo-label">Cómo queda</span>
                      <p>{vistaPrevia}</p>
                    </div>
                  )}

                  {p.paso && !p.por_defecto && (
                    <button
                      type="button"
                      className="boton-mini"
                      onClick={() => void hacerPorDefecto(p)}
                      title="La automatización usa la que está por defecto (D16)"
                    >
                      Hacer la principal de {p.paso}
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {!visibles.length && (
          <div className="repo-vacio">
            {filtro === 'favoritos' ? 'sin mensajes destacados' : 'sin mensajes cargados'}
          </div>
        )}
      </div>

      <footer className="repo-pie">
        {pasosSinPlantilla.length > 0 ? (
          <span className="campo-ayuda">
            Sin plantilla todavía: <strong>{pasosSinPlantilla.join(', ')}</strong>
          </span>
        ) : (
          <span className="campo-ayuda">Todos los pasos tienen plantilla.</span>
        )}
        {error && <span className="login-error">{error}</span>}
      </footer>
    </aside>
  );
}
