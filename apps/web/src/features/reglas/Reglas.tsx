import { useCallback, useEffect, useState } from 'react';
import {
  ACCIONES,
  CONDICIONES,
  DISPARADORES,
  HORAS_RECORDATORIO,
  REUNION_POR_DEFECTO,
  describir,
  queFalta,
  resumen,
  sePuedeBorrar,
  type Regla,
  type ReglasDeReunion,
} from '@crm/core/regla';
import { pb } from '../../lib/pocketbase';
import { useEscape } from '../../lib/useEscape';

interface ConfigRecord {
  id: string;
  clave: string;
  valor: Record<string, unknown>;
}

interface Props {
  onCerrar: () => void;
}

/** Un grupo de chips donde solo uno queda elegido. */
function Chips({
  opciones,
  elegido,
  onElegir,
}: {
  opciones: readonly string[];
  elegido: string | null;
  onElegir: (v: string) => void;
}) {
  return (
    <div className="chips">
      {opciones.map((o) => (
        <button
          key={o}
          type="button"
          className={`chip ${elegido === o ? 'chip-on' : ''}`}
          onClick={() => onElegir(o)}
        >
          {o}
        </button>
      ))}
    </div>
  );
}

/**
 * Reglas y acciones rápidas (§7.9). Portada de `docs/prototipo/ReglasAcciones.dc.html`.
 *
 * Define reglas; no las corre — eso es del worker. Lo que se ve acá es el
 * contrato: si el panel dijera una cosa y el worker hiciera otra, el panel
 * sería peor que no tenerlo.
 */
export function Reglas({ onCerrar }: Props) {
  useEscape(onCerrar);
  const [reglas, setReglas] = useState<Regla[]>([]);
  const [config, setConfig] = useState<ConfigRecord | null>(null);
  const [creando, setCreando] = useState(false);
  const [nombre, setNombre] = useState('');
  const [disparador, setDisparador] = useState<string | null>(null);
  const [condicion, setCondicion] = useState<string | null>(null);
  const [accion, setAccion] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const recargar = useCallback(async () => {
    try {
      const [r, c] = await Promise.all([
        pb.collection('regla').getFullList<Regla>({ sort: '-de_fabrica,created' }),
        pb.collection('configuracion').getFullList<ConfigRecord>({ filter: "clave = 'reglas_reunion'" }),
      ]);
      setReglas(r);
      setConfig(c[0] ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    void recargar();
  }, [recargar]);

  const reunion = (config?.valor ?? REUNION_POR_DEFECTO) as unknown as ReglasDeReunion;

  async function guardarReunion(patch: Partial<ReglasDeReunion>) {
    const valor = { ...reunion, ...patch };
    setConfig((c) => (c ? { ...c, valor: valor as unknown as Record<string, unknown> } : c));
    if (config?.id) {
      await pb.collection('configuracion').update(config.id, { valor }).catch(() => void recargar());
    }
  }

  async function alternar(r: Regla) {
    setReglas((rs) => rs.map((x) => (x.id === r.id ? { ...x, activa: !x.activa } : x)));
    await pb.collection('regla').update(r.id, { activa: !r.activa }).catch(() => void recargar());
  }

  async function borrar(r: Regla) {
    if (!sePuedeBorrar(r)) return;
    setReglas((rs) => rs.filter((x) => x.id !== r.id));
    await pb.collection('regla').delete(r.id).catch(() => void recargar());
  }

  const faltan = queFalta({ nombre, disparador, accion });

  async function crear() {
    if (faltan.length) return;
    try {
      await pb.collection('regla').create({
        nombre: nombre.trim(),
        disparador,
        condicion: condicion && condicion !== 'sin condición' ? condicion : '',
        accion,
        activa: true,
        de_fabrica: false,
        corridas_semana: 0,
      });
      setCreando(false);
      setNombre('');
      setDisparador(null);
      setCondicion(null);
      setAccion(null);
      await recargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <div className="overlay-fondo" onClick={onCerrar}>
      <div className="overlay-caja reg" onClick={(e) => e.stopPropagation()}>
        <div className="overlay-header">
          <span className="overlay-titulo">Reglas y acciones rápidas</span>
          <span className="campo-ayuda">{resumen(reglas)}</span>
          <button type="button" className="reg-nueva al-final" onClick={() => setCreando((c) => !c)}>
            Nueva regla
          </button>
          <button type="button" className="boton-icono-28" title="Cerrar" onClick={onCerrar}>
            ×
          </button>
        </div>

        <div className="overlay-cuerpo reg-cuerpo">
          {error && <div className="aviso-error">{error}</div>}

          {creando && (
            <div className="reg-nueva-caja">
              <span className="reg-titulo-acento">Regla nueva</span>
              <input
                autoFocus
                value={nombre}
                placeholder="Nombre de la regla"
                onChange={(e) => setNombre(e.target.value)}
              />
              <div className="reg-campo">
                <span className="auto-th">Si pasa esto</span>
                <Chips opciones={DISPARADORES} elegido={disparador} onElegir={setDisparador} />
              </div>
              <div className="reg-campo">
                <span className="auto-th">Y se cumple</span>
                <Chips opciones={CONDICIONES} elegido={condicion} onElegir={setCondicion} />
              </div>
              <div className="reg-campo">
                <span className="auto-th">Entonces</span>
                <Chips opciones={ACCIONES} elegido={accion} onElegir={setAccion} />
              </div>
              {/* Decir QUÉ falta y no solo apagar el botón: un botón gris sin
                  explicación obliga a adivinar cuál de los tres campos es. */}
              {faltan.length > 0 && <span className="campo-ayuda">Falta {faltan.join(', ')}.</span>}
              <div className="reg-acciones">
                <button type="button" className="boton-secundario" onClick={() => setCreando(false)}>
                  Cancelar
                </button>
                <button
                  type="button"
                  className="boton-principal al-final"
                  disabled={faltan.length > 0}
                  onClick={() => void crear()}
                >
                  Crear regla
                </button>
              </div>
            </div>
          )}

          {reglas.map((r) => (
            <div key={r.id} className={`reg-fila ${r.activa ? 'reg-fila-on' : ''}`}>
              <div className="reg-fila-header">
                <span className="reg-nombre">{r.nombre}</span>
                {r.de_fabrica && (
                  <span
                    className="auto-chip"
                    title="Describe algo que el sistema ya hace en el código. Se puede apagar, no borrar."
                  >
                    de fábrica
                  </span>
                )}
                <span className="campo-ayuda tabular al-final">
                  {r.activa
                    ? r.corridas_semana
                      ? `${r.corridas_semana} esta semana`
                      : 'sin correr esta semana'
                    : 'apagada'}
                </span>
                <button
                  type="button"
                  className={`auto-estado ${r.activa ? 'auto-estado-on' : ''}`}
                  onClick={() => void alternar(r)}
                >
                  {r.activa ? 'activa' : 'apagada'}
                </button>
                {sePuedeBorrar(r) && (
                  <button
                    type="button"
                    className="csg-descartar"
                    title="Eliminar la regla"
                    onClick={() => void borrar(r)}
                  >
                    ×
                  </button>
                )}
              </div>
              <span className="reg-frase">{describir(r)}</span>
            </div>
          ))}

          <div className="reg-seccion">
            <span className="auto-titulo">Alrededor de la reunión</span>
            {(
              [
                ['confirmacion_24h', 'Confirmación 24 h antes', 'por el canal donde respondió'],
                ['aviso_90min', 'Aviso 1 h 30 antes', 'con el link de la reunión'],
                ['agradecimiento', 'Agradecimiento post reunión', 'sale si el estado queda en asistió'],
              ] as const
            ).map(([k, titulo, detalle]) => (
              <div key={k} className="reg-toggle">
                <button
                  type="button"
                  className={`reunion-check ${reunion[k] ? 'reunion-check-on' : ''}`}
                  onClick={() => void guardarReunion({ [k]: !reunion[k] } as Partial<ReglasDeReunion>)}
                >
                  <span className="reunion-check-caja" />
                </button>
                <div className="reg-toggle-texto">
                  <span>{titulo}</span>
                  <span className="campo-ayuda">{detalle}</span>
                </div>
              </div>
            ))}

            <div className="reg-campo">
              <span className="auto-th">Recordatorio extra</span>
              <div className="chips">
                {HORAS_RECORDATORIO.map((h) => (
                  <button
                    key={h}
                    type="button"
                    className={`chip ${reunion.recordatorio_extra_h === h ? 'chip-on' : ''}`}
                    onClick={() => void guardarReunion({ recordatorio_extra_h: h })}
                  >
                    {h === 0 ? 'ninguno' : `${h} h antes`}
                  </button>
                ))}
              </div>
              {/* Es UN valor y no una lista: dos recordatorios el mismo día
                  para la misma reunión se leen como un error del sistema. */}
              <span className="campo-ayuda">
                Uno solo. Dos avisos el mismo día para la misma reunión se leen como un error del
                sistema, no como atención.
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
