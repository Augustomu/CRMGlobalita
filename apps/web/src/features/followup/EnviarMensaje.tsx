import { useEffect, useMemo, useRef, useState } from 'react';
import { CADENCIA_POR_DEFECTO, canalDe, siguientePaso } from '@crm/core/cadencia';
import { planDeEnvio } from '@crm/core/envio';
import { idiomaEfectivo } from '@crm/core/idioma';
import {
  estaDestacadaPara, plantillasDe, resolverParaPaso, type Plantilla } from '@crm/core/plantilla';
import type { Canal, Idioma, Paso } from '@crm/core/tipos';
import { pb } from '../../lib/pocketbase';
import type { EnvioRecord, LeadRecord, PlantillaRecord } from '../../lib/types';

const HOY = new Date().toISOString().slice(0, 10);
const IDIOMAS: Idioma[] = ['es', 'pt', 'en'];

/** Del registro de PocketBase al tipo que entienden las reglas de core. */
function aPlantilla(r: PlantillaRecord): Plantilla {
  return {
    id: r.id,
    nombre: r.nombre,
    paso: (r.paso || null) as Plantilla['paso'],
    por_defecto: r.por_defecto,
    textos: r.textos ?? {},
    orden: r.orden ?? 0,
  };
}

/** Lo que el prototipo muestra en el banner ambar despues de registrar. */
export interface Propuesta {
  paso: string;
  fecha: string;
  dias: number;
}

interface Props {
  lead: LeadRecord;
  plantillas: PlantillaRecord[];
  /**
   * El historial de envíos. Vive acá adentro y no en una sección aparte: es lo
   * que se mira JUSTO antes de escribir el siguiente mensaje, y tenerlo tres
   * bloques más abajo obligaba a subir y bajar para no repetirse.
   */
  envios: EnvioRecord[];
  /** Se incrementa con el atajo S para disparar el registro (SS9.1). */
  nonceEnviar: number;
  onRegistrado: (propuesta: Propuesta | null) => void;
}

/**
 * Registrar un envío (§5.10). Hoy los R se mandan a mano (D15): esta pantalla
 * arma el texto, te lleva al chat real, y después registra que lo mandaste.
 * No envía nada por su cuenta — eso llega con el worker, en la Etapa 5.
 */
export function EnviarMensaje({ lead, plantillas, envios, nonceEnviar, onRegistrado }: Props) {
  const perfil = lead.expand?.perfil;
  const cfg = CADENCIA_POR_DEFECTO;

  // El paso que toca: el siguiente al actual. El usuario lo puede cambiar.
  const sugerido = (siguientePaso(cfg, lead.etapa) ?? lead.etapa) as Paso;
  const [paso, setPaso] = useState<Paso | 'agradecimiento'>(sugerido);
  const [idioma, setIdioma] = useState<Idioma>(
    idiomaEfectivo({ pais: perfil?.pais ?? '' }),
  );
  const [plantillaId, setPlantillaId] = useState<string | undefined>(undefined);
  const [texto, setTexto] = useState('');
  const [tocado, setTocado] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const catalogo = useMemo(() => plantillas.map(aPlantilla), [plantillas]);
  const delPaso = useMemo(() => plantillasDe(catalogo, paso), [catalogo, paso]);

  /**
   * Los destacados que valen para la cuenta de este lead.
   *
   * Se filtran por alcance, no se muestran todos: un destacado de otra cuenta
   * en esta pantalla es un texto que no corresponde a esta conversación.
   */
  const destacados = plantillas.filter((p) =>
    estaDestacadaPara(p.destacado, lead.expand?.cuenta?.abrev ?? ''),
  );

  const resuelto = useMemo(
    () =>
      resolverParaPaso(catalogo, paso, idioma, {
        nombre: perfil?.nombre,
        empresa: perfil?.empresa,
        industria: perfil?.industria,
        ciudad: perfil?.ciudad,
      }, plantillaId),
    [catalogo, paso, idioma, plantillaId, perfil],
  );

  // El texto se recarga al cambiar paso/idioma/plantilla, salvo que el usuario
  // ya lo haya editado a mano: ahí manda lo que escribió.
  useEffect(() => {
    if (tocado) return;
    setTexto(resuelto.hay ? resuelto.texto : '');
  }, [resuelto, tocado]);

  // Se resetea la edición manual al cambiar de paso.
  useEffect(() => {
    setTocado(false);
    setPlantillaId(undefined);
  }, [paso]);

  /**
   * Al cambiar de lead hay que volver a calcular el paso y el idioma: `useState`
   * solo usa su valor inicial, así que sin esto el selector se queda con los del
   * lead anterior y se puede registrar el R equivocado.
   */
  useEffect(() => {
    setPaso(sugerido);
    setIdioma(idiomaEfectivo({ pais: perfil?.pais ?? '' }));
    setTocado(false);
    setPlantillaId(undefined);
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lead.id]);

  const canal: Canal =
    paso === 'agradecimiento'
      ? perfil?.telefono_valido
        ? 'whatsapp'
        : 'linkedin'
      : canalDe(cfg, paso, Boolean(perfil?.telefono_valido));

  const plan = planDeEnvio(
    cfg,
    { etapa: lead.etapa, situacion: lead.situacion, tiene_telefono: Boolean(perfil?.telefono_valido) },
    {
      lead_id: lead.id,
      paso,
      canal,
      idioma,
      texto,
      plantilla_id: tocado ? undefined : plantillaId ?? (resuelto.hay ? resuelto.plantilla.id : undefined),
      a_mano: true,
    },
    HOY,
  );

  const urlChat =
    canal === 'whatsapp' && perfil?.telefono
      ? `https://wa.me/${perfil.telefono}`
      : lead.link_chat || (perfil?.slug ? `https://www.linkedin.com/in/${perfil.slug}` : '');

  /**
   * Registra el envío y **no toca la fecha**: devuelve la propuesta para que la
   * ficha muestre el banner de §5.10 punto 4, con "Aceptar fecha" o "La cargo a
   * mano". Es como lo hace el prototipo (`registrarEnvio` → `state.propuesta`).
   */
  async function registrar() {
    if (!texto || guardando) return;
    setGuardando(true);
    setError(null);
    try {
      await pb.collection('envio').create(plan.envio);

      // Las etiquetas se resuelven por nombre contra el catálogo (§5.9).
      const idsEtiquetas = new Set(lead.etiquetas ?? []);
      for (const nombre of plan.etiquetas_a_agregar) {
        const encontrada = await pb
          .collection('etiqueta')
          .getFirstListItem(`nombre = "${nombre}"`)
          .catch(() => null);
        if (encontrada) idsEtiquetas.add(encontrada.id);
      }

      await pb.collection('lead').update(lead.id, {
        situacion: plan.lead.situacion,
        f_ultimo_contacto: plan.lead.f_ultimo_contacto,
        etiquetas: [...idsEtiquetas],
        etapa: paso === 'agradecimiento' ? lead.etapa : paso,
      });

      setTocado(false);
      onRegistrado(
        plan.proximo_contacto_propuesto
          ? {
              paso,
              fecha: plan.proximo_contacto_propuesto,
              dias: Math.round(
                (Date.parse(plan.proximo_contacto_propuesto) - Date.parse(HOY)) / 86_400_000,
              ),
            }
          : null,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setGuardando(false);
    }
  }

  // Atajo S (§9.1): la ficha incrementa el nonce y acá se dispara el registro.
  const primeraVez = useRef(true);
  useEffect(() => {
    if (primeraVez.current) {
      primeraVez.current = false;
      return;
    }
    void registrar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nonceEnviar]);

  return (
    <div className="enviar">
      <div className="enviar-cabecera">
        <span className="colapsable-titulo">Enviar mensaje</span>
        <span className={`pastilla ${canal === 'whatsapp' ? 'pastilla-wa' : 'pastilla-li'}`}>
          {canal}
        </span>
        <span className="enviar-conteo tabular">{envios.length} enviados</span>
      </div>

      <div className="enviar-fila">
        <label className="campo campo-chico">
          <span className="campo-label">Paso</span>
          <select value={paso} onChange={(e) => setPaso(e.target.value as Paso)}>
            {(['R0', 'R0-recontacto', 'R1', 'R2', 'R3', 'R4', 'R5', 'R6', 'R7', 'R8', 'agradecimiento'] as const).map(
              (p) => (
                <option key={p} value={p}>
                  {p}
                  {p === sugerido ? ' (toca)' : ''}
                </option>
              ),
            )}
          </select>
        </label>

        <label className="campo campo-chico">
          <span className="campo-label">Idioma</span>
          <select value={idioma} onChange={(e) => setIdioma(e.target.value as Idioma)}>
            {IDIOMAS.map((i) => (
              <option key={i} value={i}>
                {i}
              </option>
            ))}
          </select>
        </label>

        <div className="campo campo-chico">
          <span className="campo-label">Canal</span>
          <span className={`pastilla ${canal === 'whatsapp' ? 'pastilla-wa' : 'pastilla-li'}`}>
            {canal}
          </span>
        </div>
      </div>

      {delPaso.length > 1 && (
        <div className="chips">
          {delPaso.map((p) => (
            <button
              key={p.id}
              type="button"
              className={`chip ${(plantillaId ?? delPaso[0]!.id) === p.id ? 'chip-on' : ''}`}
              onClick={() => {
                setPlantillaId(p.id);
                setTocado(false);
              }}
              title={p.por_defecto ? 'Por defecto' : 'Variante'}
            >
              {p.nombre}
            </button>
          ))}
        </div>
      )}

      {/* §7.2: los mensajes destacados de ESTA cuenta. Reemplazan el texto de
          un clic. El alcance importa: AL trabaja directores financieros y ED
          maquinaria, y un chip que aparece en la cuenta equivocada se usa una
          vez, sale mal, y después nadie usa los chips. */}
      {destacados.length > 0 && (
        <div className="chips">
          <span className="campo-label">Destacados</span>
          {destacados.map((p) => (
            <button
              key={p.id}
              type="button"
              className="chip chip-destacado"
              title={`Reemplaza el texto con «${p.nombre}»`}
              onClick={() => {
                setTexto(p.textos?.[idioma] ?? p.textos?.es ?? '');
                setTocado(true);
              }}
            >
              ★ {p.nombre}
            </button>
          ))}
        </div>
      )}

      {/* §5.2: si no hay texto para ese paso o idioma, se avisa. No se inventa. */}
      {!resuelto.hay && (
        <div className="aviso-suave">
          {resuelto.motivo === 'sin_plantilla'
            ? `No hay plantilla cargada para ${paso}. Podés escribir el texto a mano.`
            : `«${resuelto.plantilla?.nombre}» no tiene texto en ${idioma}. Podés escribirlo a mano o cambiar de idioma.`}
        </div>
      )}

      <textarea
        rows={5}
        value={texto}
        onChange={(e) => {
          setTexto(e.target.value);
          setTocado(true);
        }}
        placeholder="El texto que le vas a mandar."
      />

      <div className="enviar-acciones">
        {urlChat && (
          <a className="boton-secundario" href={urlChat} target="_blank" rel="noreferrer">
            ↗ Ir al chat
          </a>
        )}
        <button
          type="button"
          className="boton-secundario"
          onClick={() => void navigator.clipboard?.writeText(texto)}
          disabled={!texto}
        >
          Copiar
        </button>

        <button
          type="button"
          className="boton-principal enviar-registrar"
          disabled={!texto || guardando}
          onClick={() => void registrar()}
          title="Registrar que mandaste este mensaje (S)"
        >
          {guardando ? 'Registrando…' : 'Registrar envío'}
        </button>
      </div>

      {plan.etiquetas_a_agregar.length > 0 && (
        <p className="campo-ayuda">
          Al registrar se agregan: {plan.etiquetas_a_agregar.join(', ')}.
        </p>
      )}

      <p className="nota-tecnica">
        El CRM <strong>no manda el mensaje</strong>: lo mandás vos desde el chat real y acá
        queda registrado. El envío automático llega con el worker (Etapa 5).
      </p>

      {/* Lo ya mandado, al pie de donde se escribe lo próximo: es el único
          lugar donde mirarlo sirve de algo. */}
      {envios.length > 0 && (
        <div className="enviar-historial">
          {envios.map((e) => (
            <div key={e.id} className="envio-fila">
              <span className="pastilla">{e.paso}</span>
              <span className={`pastilla ${e.canal === 'whatsapp' ? 'pastilla-wa' : 'pastilla-li'}`}>
                {e.canal}
              </span>
              <span className="envio-fecha tabular">{String(e.enviado_en).slice(0, 10)}</span>
              <p className="envio-texto">{e.texto}</p>
            </div>
          ))}
        </div>
      )}

      {error && <div className="login-error">{error}</div>}
    </div>
  );
}
