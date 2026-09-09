import { useEffect, useMemo, useRef, useState } from 'react';
import { CADENCIA_POR_DEFECTO, canalDe, secuenciaDe, siguientePaso } from '@crm/core/cadencia';
import { planDeEnvio } from '@crm/core/envio';
import { idiomaEfectivo } from '@crm/core/idioma';
import {
  conCuenta,
  escribirAlcance,
  leerAlcance,
  nombreDeAlcance,
  reordenar,
  sinCuenta,
  estaDestacadaPara, plantillasDe, resolverParaPaso, type Plantilla } from '@crm/core/plantilla';
import { casaDeLinea } from '@crm/core/proyecto';
import type { Canal, Idioma, Paso } from '@crm/core/tipos';
import { diaLocal } from '@crm/core/fecha';
import { pb } from '../../lib/pocketbase';
import type { EnvioRecord, LeadRecord, PlantillaRecord } from '../../lib/types';

const HOY = diaLocal();
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
  /** Se llama cuando cambia el repositorio: destacar, o guardar un texto. */
  onPlantillasCambiadas?: () => void;
}

/**
 * Registrar un envío (§5.10). Hoy los R se mandan a mano (D15): esta pantalla
 * arma el texto, te lleva al chat real, y después registra que lo mandaste.
 * No envía nada por su cuenta — eso llega con el worker, en la Etapa 5.
 */
export function EnviarMensaje({
  lead, plantillas, envios, nonceEnviar, onRegistrado, onPlantillasCambiadas,
}: Props) {
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
  /** El modal «Destacar mensajes». */
  const [listaAbierta, setListaAbierta] = useState(false);
  /**
   * 2.1 · Dónde va a valer lo que se destaque.
   *
   * Antes no se preguntaba: todo quedaba en la cuenta actual y punto. Pero un
   * mensaje que sirve para las diez cuentas había que destacarlo diez veces, y
   * uno que sirve sólo para SENG terminaba apareciendo en las de Globalita.
   */
  const [alcanceNuevo, setAlcanceNuevo] = useState<'cuenta' | 'globalita' | 'seng' | 'todas'>(
    'cuenta',
  );
  /**
   * El idioma que se está mirando DENTRO del modal.
   *
   * Es propio y no el del mensaje: elegir «ver los de portugués» para destacar
   * uno no tiene por qué cambiar el idioma con el que sale el mensaje que se
   * está escribiendo. Arranca en el del chat, que es lo más probable.
   */
  const [idiomaModal, setIdiomaModal] = useState<Idioma>(idioma);
  const [marcados, setMarcados] = useState<Set<string>>(new Set());
  /** Qué chip se está arrastrando, para reordenar. */
  const [arrastrando, setArrastrando] = useState<string | null>(null);
  /** Después de guardar un texto: qué quedó guardado, para ofrecer los pasos. */
  const [guardado, setGuardado] = useState<{ id: string; nombre: string } | null>(null);
  const [idiomaExtra, setIdiomaExtra] = useState<Idioma | null>(null);
  const [textoExtra, setTextoExtra] = useState('');
  const [abrevs, setAbrevs] = useState<string[]>([]);

  const catalogo = useMemo(() => plantillas.map(aPlantilla), [plantillas]);
  /** El canal elegido a mano, o null si vale el de la cadencia. */
  const [canalManual, setCanalManual] = useState<Canal | null>(null);

  /**
   * Los destacados que valen para la cuenta de este lead.
   *
   * Se filtran por alcance, no se muestran todos: un destacado de otra cuenta
   * en esta pantalla es un texto que no corresponde a esta conversación.
   */
  const cuenta = lead.expand?.cuenta?.abrev ?? '';
  /**
   * La casa de la cuenta del lead.
   *
   * Hace falta para los destacados con alcance por casa: sin saber de qué
   * empresa es la cuenta no se puede decidir, y adivinar sería mostrarle a
   * alguien los chips de la otra.
   */
  const casa = casaDeLinea(lead.expand?.cuenta?.linea_negocio);
  /** `R0 ✓ · R1 ✓ · R2 …`: qué se mandó, en qué idioma, y cuál toca. */
  const secuencia = useMemo(() => secuenciaDe(envios), [envios]);

  const destacados = useMemo(
    () =>
      plantillas
        .filter((p) => estaDestacadaPara(p.destacado, cuenta, casa))
        // El orden es el del repositorio: el mismo que se arrastra acá y allá,
        // así no hay dos ordenamientos distintos del mismo puñado de mensajes.
        .sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0)),
    [plantillas, cuenta],
  );

  // Las abreviaturas hacen falta para una sola cosa: sacar el chip de un
  // destacado que era «todas las cuentas» sin apagárselo al resto del equipo.
  useEffect(() => {
    let vivo = true;
    pb.collection('cuenta')
      .getFullList<{ abrev: string }>({ fields: 'abrev', sort: 'slot' })
      .then((cs) => vivo && setAbrevs(cs.map((c) => c.abrev)))
      .catch(() => vivo && setAbrevs([]));
    return () => {
      vivo = false;
    };
  }, []);

  /** Cambia el alcance de un mensaje y refresca. */
  async function guardarAlcance(id: string, alcance: ReturnType<typeof leerAlcance>) {
    await pb.collection('plantilla').update(id, { destacado: escribirAlcance(alcance) });
    onPlantillasCambiadas?.();
  }

  /** Guarda el texto escrito como mensaje nuevo del repositorio. */
  async function guardarComoMensaje() {
    const t = texto.trim();
    if (!t) return;
    setGuardando(true);
    try {
      // El nombre sale del paso, que es lo que ata la plantilla a la cadencia
      // (D16). Se puede renombrar después desde el Repositorio.
      const nombre = `${paso} · ${t.slice(0, 40).replace(/\s+/g, ' ').trim()}…`;
      const orden = Math.max(0, ...plantillas.map((x) => x.orden ?? 0)) + 1;
      const creada = await pb.collection('plantilla').create({
        nombre,
        paso: paso === 'agradecimiento' ? '' : paso,
        textos: { [idioma]: t },
        destacado: '',
        orden,
        por_defecto: false,
      });
      setGuardado({ id: creada.id, nombre });
      setIdiomaExtra(null);
      setTextoExtra('');
      onPlantillasCambiadas?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setGuardando(false);
    }
  }

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
    // El canal vuelve al de la cadencia al cambiar de lead: elegir a mano vale
    // para ese mensaje, no se hereda a la persona siguiente.
    setCanalManual(null);
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lead.id]);

  /**
   * 0.2 · El canal ahora SE ELIGE, no se informa.
   *
   * La cadencia sugiere uno —eso no cambió— pero el switch manda. Antes la
   * pastilla mostraba el resultado de `canalDe()` y no había forma de mandar
   * por el otro lado: si el lead contestaba por WhatsApp y la cadencia decía
   * LinkedIn, había que salir del CRM.
   *
   * `null` significa «lo que diga la cadencia», y es lo que vale al abrir un
   * lead. Elegir a mano es para este mensaje, no para siempre.
   */
  const canalSugerido: Canal =
    paso === 'agradecimiento'
      ? perfil?.telefono_valido
        ? 'whatsapp'
        : 'linkedin'
      : canalDe(cfg, paso, Boolean(perfil?.telefono_valido));
  const canal: Canal = canalManual ?? canalSugerido;

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

        {/* 1.5 · El idioma en dos letras, acá y en ningún otro lado.
            Es el MISMO control segmentado que usa el resto del CRM
            (`selector-idioma`, radio 8px, verde de acento). La primera versión
            era un desplegable cuadrado y desentonaba: cada cosa nueva usa los
            controles que ya existen, no unos parecidos. */}
        <div className="selector-idioma enviar-idiomas" role="group" aria-label="Idioma">
          {IDIOMAS.map((i) => (
            <button
              key={i}
              type="button"
              className={idioma === i ? 'idioma-on' : 'idioma-off'}
              title={`Mandar en ${i.toUpperCase()}`}
              onClick={() => setIdioma(i)}
            >
              {i.toUpperCase()}
            </button>
          ))}
        </div>

        {/* 1.2 · El switch de canal. Lo que se elige acá es POR DÓNDE SALE:
            decide el mensaje que se registra y a dónde lleva la flecha.
            Mismo control segmentado que el idioma y que el resto del CRM. */}
        <div className="selector-idioma enviar-canal" role="group" aria-label="Canal">
          {(['linkedin', 'whatsapp'] as const).map((c) => {
            const sinTelefono = c === 'whatsapp' && !perfil?.telefono;
            return (
              <button
                key={c}
                type="button"
                disabled={sinTelefono}
                className={canal === c ? 'idioma-on' : 'idioma-off'}
                title={
                  sinTelefono
                    ? 'Este lead no tiene teléfono cargado'
                    : canalSugerido === c
                      ? `${c === 'linkedin' ? 'LinkedIn' : 'WhatsApp'} — es el que sugiere la cadencia`
                      : `Mandar por ${c === 'linkedin' ? 'LinkedIn' : 'WhatsApp'} en vez del que sugiere la cadencia`
                }
                onClick={() => setCanalManual(c === canalSugerido ? null : c)}
              >
                {c === 'linkedin' ? 'in' : 'wa'}
              </button>
            );
          })}
        </div>

        {/* 1.2 · La flecha va al chat DEL CANAL ELEGIDO. Sin texto: al lado del
            switch, la diagonal ya dice «salir a la conversación». */}
        {urlChat && (
          <a
            className="enviar-ir"
            href={urlChat}
            target="_blank"
            rel="noreferrer"
            title={`Abrir la conversación en ${canal === 'whatsapp' ? 'WhatsApp' : 'LinkedIn'} (H)`}
          >
            ↗
          </a>
        )}

        <span className="enviar-conteo tabular">{envios.length} enviados</span>
      </div>

      {/*
        La secuencia, en vez del desplegable «Paso».

        El desplegable decía cuál tocaba pero escondía el resto: para saber si
        el R1 había salido —y en qué idioma— había que abrir el historial. La
        fila muestra las dos cosas de un vistazo, que es lo que uno mira antes
        de escribir.

        Se puede tocar cualquiera: a veces hay que repetir un paso, o saltear.
        Lo que la fila NO hace es esconder que se salteó.
      */}
      <div className="enviar-secuencia">
        {secuencia.map((x) => (
          <button
            key={x.paso}
            type="button"
            className={[
              'paso-chip',
              x.enviado ? 'paso-chip-enviado' : '',
              x.toca ? 'paso-chip-toca' : '',
              paso === x.paso ? 'paso-chip-elegido' : '',
            ].join(' ')}
            title={
              [
                x.enviado
                  ? `Ya se mandó${x.idioma ? ` en ${x.idioma}` : ''}. Tocá para volver a escribirlo.`
                  : x.toca
                    ? 'Es el que toca'
                    : 'Todavía no se mandó',
                plantillasDe(catalogo, x.paso).length > 1 && paso === x.paso
                  ? 'Tocá de nuevo para pasar a la otra versión de este paso.'
                  : '',
              ]
                .filter(Boolean)
                .join(' ')
            }
            onClick={() => {
              // Tocar el que YA está elegido cicla entre las variantes de ese
              // paso, cuando hay más de una. Es lo que reemplaza a la fila de
              // abajo que mostraba los nombres completos: R3 tiene dos textos y
              // sin esto el segundo quedaba inalcanzable.
              if (paso === x.paso) {
                const variantes = plantillasDe(catalogo, x.paso);
                if (variantes.length > 1) {
                  const i = variantes.findIndex(
                    (v) => v.id === (plantillaId ?? variantes[0]!.id),
                  );
                  setPlantillaId(variantes[(i + 1) % variantes.length]!.id);
                  setTocado(false);
                }
                return;
              }
              setPaso(x.paso);
            }}
          >
            {x.enviado && <span className="paso-chip-tilde">✓</span>}
            <span>{x.paso}</span>
            {/* El idioma va sólo en los enviados: en los que faltan sería una
                promesa, no un dato. */}
            {x.enviado && x.idioma && <span className="paso-chip-idioma">{x.idioma}</span>}
          </button>
        ))}

        {/* Los dos pasos que no son de la cadencia y que a veces hacen falta. */}
        {(['R0-recontacto', 'agradecimiento'] as const).map((extra) => (
          <button
            key={extra}
            type="button"
            className={`paso-chip paso-chip-aparte ${paso === extra ? 'paso-chip-elegido' : ''}`}
            title={
              extra === 'agradecimiento'
                ? 'Después de la reunión. No mueve la etapa (§5.10)'
                : 'La reinvitación, cuando el lead vuelve del recontacto (D24)'
            }
            onClick={() => setPaso(extra)}
          >
            {extra === 'agradecimiento' ? 'gracias' : 'reinvitar'}
          </button>
        ))}

        {/* 1.3 · Los destacados viven en ESTA fila, después de una separación.
            Son lo mismo que un paso —un texto que se pone en el cuadro— así que
            tenerlos en dos renglones distintos era partir una sola decisión. */}
        <span className="enviar-corte" aria-hidden="true" />

        {destacados.map((p) => {
          const alcance = leerAlcance(p.destacado);
          return (
            <span
              key={p.id}
              className={arrastrando === p.id ? 'dest-chip dest-chip-yendo' : 'dest-chip'}
              draggable
              onDragStart={() => setArrastrando(p.id)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={async (e) => {
                e.preventDefault();
                const cambios = reordenar(destacados, arrastrando ?? '', p.id);
                setArrastrando(null);
                if (!cambios.length) return;
                for (const c of cambios) {
                  await pb.collection('plantilla').update(c.id, { orden: c.orden });
                }
                onPlantillasCambiadas?.();
              }}
              onDragEnd={() => setArrastrando(null)}
              title={`${p.nombre} — destacado en ${nombreDeAlcance(alcance)}`}
            >
              <button
                type="button"
                className="dest-chip-usar"
                onClick={() => {
                  setTexto(p.textos?.[idioma] ?? p.textos?.es ?? '');
                  setTocado(true);
                }}
              >
                {p.nombre}
              </button>
              <button
                type="button"
                className="dest-chip-x"
                title="Sacar el chip de esta cuenta"
                onClick={() => void guardarAlcance(p.id, sinCuenta(alcance, cuenta, abrevs))}
              >
                ×
              </button>
            </span>
          );
        })}

        {/* El hueco para sumar otro. */}
        <button
          type="button"
          className="dest-mas"
          title="Elegir y destacar mensajes del repositorio"
          onClick={() => {
            setMarcados(new Set(destacados.map((d) => d.id)));
            // El alcance arranca en «esta cuenta» cada vez: es lo más común y
            // lo menos destructivo. Elegir «todas» sin querer le pone el chip
            // a todo el equipo.
            setAlcanceNuevo('cuenta');
            setIdiomaModal(idioma);
            setListaAbierta(true);
          }}
        >
          +
        </button>
      </div>



      {listaAbierta && (
        <div className="overlay-fondo" onClick={() => setListaAbierta(false)}>
          <div className="overlay-caja dest-modal" onClick={(e) => e.stopPropagation()}>
            <div className="overlay-header">
              <span className="overlay-titulo">Destacar mensajes</span>
              <span className="campo-ayuda">para {cuenta || 'esta cuenta'}</span>
              <button
                type="button"
                className="boton-icono-28 al-final"
                onClick={() => setListaAbierta(false)}
              >
                ×
              </button>
            </div>
            <div className="overlay-cuerpo dest-modal-cuerpo">
              {/*
                EL ORDEN IMPORTA, Y ANTES ESTABA AL REVÉS.

                La primera versión mostraba la lista de mensajes primero, el
                alcance abajo del todo, y en el medio un filtro de idioma de dos
                botones —«sólo EN» / «todos»— que no decía qué iba a pasar. Se
                elegía a ciegas y la pregunta importante aparecía al final.

                Ahora son tres pasos, en el orden en que se piensan: en qué
                idioma, para quién, y recién entonces cuál.
              */}
              <div className="dest-paso">
                <span className="dest-paso-n">1</span>
                <span className="campo-label">Idioma</span>
                <div className="selector-idioma dest-paso-control">
                  {IDIOMAS.map((i) => (
                    <button
                      key={i}
                      type="button"
                      className={idiomaModal === i ? 'idioma-on' : 'idioma-off'}
                      onClick={() => setIdiomaModal(i)}
                    >
                      {i.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              <div className="dest-paso">
                <span className="dest-paso-n">2</span>
                <span className="campo-label">Dónde vale</span>
                <div className="dest-paso-control chips">
                  {(
                    [
                      ['cuenta', cuenta || 'esta cuenta', `Sólo la cuenta ${cuenta || 'actual'}`],
                      ['globalita', 'Globalita', 'Todas las cuentas de la línea de IA'],
                      ['seng', 'SENG', 'Todas las cuentas de inversiones'],
                      ['todas', 'todas', 'Las diez cuentas, de las dos casas'],
                    ] as const
                  ).map(([valor, texto, ayuda]) => (
                    <button
                      key={valor}
                      type="button"
                      className={`chip ${alcanceNuevo === valor ? 'chip-on' : ''}`}
                      title={ayuda}
                      onClick={() => setAlcanceNuevo(valor)}
                    >
                      {texto}
                    </button>
                  ))}
                </div>
              </div>

              <div className="dest-paso">
                <span className="dest-paso-n">3</span>
                <span className="campo-label">Cuáles</span>
                <span className="campo-ayuda dest-paso-control">
                  sólo los que tienen texto en {idiomaModal.toUpperCase()}
                </span>
              </div>

              {plantillas
                .filter((m) => Boolean(m.textos?.[idiomaModal]))
                .map((m) => {
                const marcado = marcados.has(m.id);
                const alcance = leerAlcance(m.destacado);
                return (
                  <button
                    key={m.id}
                    type="button"
                    className={marcado ? 'dest-opcion dest-opcion-on' : 'dest-opcion'}
                    onClick={() =>
                      setMarcados((s) => {
                        const n = new Set(s);
                        if (n.has(m.id)) n.delete(m.id);
                        else n.add(m.id);
                        return n;
                      })
                    }
                  >
                    <span className="dest-check">{marcado ? '✓' : ''}</span>
                    <span className="dest-opcion-texto">
                      <span className="dest-opcion-titulo">
                        <b>{m.nombre}</b>
                        <span className="dest-chip-idioma">
                          {Object.keys(m.textos ?? {}).join(' ').toUpperCase() || '—'}
                        </span>
                        {alcance.tipo !== 'ninguno' && (
                          <span className="campo-ayuda">en {nombreDeAlcance(alcance)}</span>
                        )}
                      </span>
                      <span className="campo-ayuda dest-preview">
                        {(m.textos?.[idiomaModal] ?? '').slice(0, 90) || 'sin texto'}
                      </span>
                    </span>
                  </button>
                );
              })}

              {!plantillas.length && (
                <span className="campo-ayuda">Todavía no hay mensajes en el repositorio.</span>
              )}
              {plantillas.length > 0 && !plantillas.some((m) => m.textos?.[idiomaModal]) && (
                <span className="campo-ayuda">
                  Ninguno de los {plantillas.length} mensajes del repositorio tiene texto en{' '}
                  {idiomaModal.toUpperCase()}. Elegí otro idioma arriba, o cargalo desde el
                  Repositorio de mensajes.
                </span>
              )}

              <div className="dest-modal-pie">
                <span className="campo-ayuda tabular">{marcados.size} elegidos</span>
                <button
                  type="button"
                  className="boton-principal al-final"
                  onClick={async () => {
                    // Se guarda el DELTA, no la lista entera: tocar un mensaje
                    // que ya estaba destacado en otra cuenta no puede sacárselo.
                    for (const m of plantillas) {
                      const antes = leerAlcance(m.destacado);
                      const estaba = estaDestacadaPara(m.destacado, cuenta, casa);
                      const quiere = marcados.has(m.id);
                      if (estaba === quiere) continue;
                      // Al agregar se aplica el alcance elegido; al sacar, se
                      // saca sólo de esta cuenta. No es simétrico a propósito:
                      // destildar un chip no puede apagárselo a todo el equipo
                      // sin avisar.
                      const despues = quiere
                        ? alcanceNuevo === 'todas'
                          ? { tipo: 'todas' as const }
                          : alcanceNuevo === 'globalita'
                            ? { tipo: 'casa' as const, casa: 'globalita' as const }
                            : alcanceNuevo === 'seng'
                              ? { tipo: 'casa' as const, casa: 'seng' as const }
                              : conCuenta(antes, cuenta)
                        : sinCuenta(antes, cuenta, abrevs);
                      await pb
                        .collection('plantilla')
                        .update(m.id, { destacado: escribirAlcance(despues) });
                    }
                    setListaAbierta(false);
                    onPlantillasCambiadas?.();
                  }}
                >
                  Guardar
                </button>
              </div>
              <span className="campo-ayuda">
                ¿Se destacó mal? Volvé a abrir esta lista y destildalo, o corregilo desde el
                Repositorio de mensajes — los cambios se ven en los dos lados.
              </span>
            </div>
          </div>
        </div>
      )}

      {/*
        §5.2 sigue valiendo —si no hay texto se avisa, no se inventa— pero el
        aviso pasó a ser el PLACEHOLDER del cuadro, no un cartel arriba.

        El cartel decía lo que el cuadro vacío ya mostraba, y ocupaba tres
        renglones para hacerlo. Dentro del cuadro, el mismo aviso está justo
        donde hay que escribir y desaparece solo al empezar a escribir.
      */}
      <textarea
        placeholder={
          resuelto.hay
            ? 'El texto que le vas a mandar.'
            : resuelto.motivo === 'sin_plantilla'
              ? `No hay plantilla para ${paso}: escribí el mensaje acá.`
              : `Sin texto en ${idioma.toUpperCase()} para este paso: escribilo acá, o cambiá el idioma arriba.`
        }
        rows={5}
        value={texto}
        onChange={(e) => {
          setTexto(e.target.value);
          setTocado(true);
        }}
      />

      {/* §7.2: guardar lo escrito COMO MENSAJE del repositorio, y desde ahí
          ofrecer los dos pasos que siguen. El texto bueno se escribe una vez,
          en una conversación; si no se puede guardar ahí mismo, se pierde. */}
      <div className="dest-guardar">
        {texto.trim() ? (
          <button
            type="button"
            className="boton-secundario"
            disabled={guardando}
            title="Guardar este texto como mensaje nuevo del repositorio"
            onClick={() => void guardarComoMensaje()}
          >
            ★ Guardar en el repositorio
          </button>
        ) : (
          <span className="campo-ayuda">escribí algo para poder guardarlo en el repositorio</span>
        )}
      </div>

      {guardado && (
        <div className="dest-guardado">
          <span>
            Guardado como <b>{guardado.nombre}</b> en {idioma.toUpperCase()}.
          </span>

          <div className="dest-guardado-fila">
            <span className="campo-ayuda">¿Cargarlo en otro idioma?</span>
            {(['es', 'pt', 'en'] as Idioma[])
              .filter((i) => i !== idioma)
              .map((i) => (
                <button
                  key={i}
                  type="button"
                  className={idiomaExtra === i ? 'chip chip-on' : 'chip'}
                  onClick={() => {
                    setIdiomaExtra(i);
                    setTextoExtra('');
                  }}
                >
                  {i.toUpperCase()}
                </button>
              ))}
          </div>

          {idiomaExtra && (
            <div className="dest-guardado-idioma">
              <textarea
                autoFocus
                rows={2}
                value={textoExtra}
                placeholder={`Texto en ${idiomaExtra.toUpperCase()}…`}
                onChange={(e) => setTextoExtra(e.target.value)}
              />
              <button
                type="button"
                className="boton-mini"
                disabled={!textoExtra.trim()}
                onClick={async () => {
                  const actual = plantillas.find((x) => x.id === guardado.id);
                  await pb.collection('plantilla').update(guardado.id, {
                    textos: { ...(actual?.textos ?? {}), [idiomaExtra]: textoExtra.trim() },
                  });
                  setIdiomaExtra(null);
                  setTextoExtra('');
                  onPlantillasCambiadas?.();
                }}
              >
                Guardar idioma
              </button>
            </div>
          )}

          <div className="dest-guardado-fila">
            <span className="campo-ayuda">¿Destacarlo?</span>
            <button
              type="button"
              className="chip"
              onClick={async () => {
                await guardarAlcance(guardado.id, { tipo: 'todas' });
                setGuardado(null);
              }}
            >
              Todas las cuentas
            </button>
            <button
              type="button"
              className="chip"
              onClick={async () => {
                await guardarAlcance(guardado.id, { tipo: 'cuentas', cuentas: [cuenta] });
                setGuardado(null);
              }}
            >
              Solo {cuenta || 'esta cuenta'}
            </button>
            <button type="button" className="boton-mini al-final" onClick={() => setGuardado(null)}>
              Ahora no
            </button>
          </div>
        </div>
      )}

      {/*
        Sin «Copiar»: «Ir al chat» abre la conversación y el texto se copia solo
        al registrar. Un botón más en la fila que se usa cuarenta veces por día
        es un botón que hay que saltear cuarenta veces.
      */}
      <div className="enviar-acciones">
        <button
          type="button"
          className="boton-principal enviar-registrar"
          disabled={!texto || guardando}
          onClick={() => void registrar()}
          title={
            plan.etiquetas_a_agregar.length
              ? `Registrar que mandaste este mensaje (S). Se agregan: ${plan.etiquetas_a_agregar.join(', ')}`
              : 'Registrar que mandaste este mensaje (S)'
          }
        >
          {guardando ? 'Registrando…' : 'Registrar envío'}
        </button>
      </div>

      {/*
        Acá iban tres textos de ayuda —qué etiquetas se agregan, que el CRM no
        manda el mensaje, que el envío automático llega con el worker—. Se leen
        una vez y después son ruido en el lugar donde se trabaja todo el día.

        Lo que decían no se perdió: las etiquetas que se agregan están en el
        title del botón, y lo del worker está en el manual.
      */}

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
