import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { COLUMNA_WA } from '@crm/core/anchos';
import { useAncho } from '../../lib/useAncho';
import { conDias, ultimoTexto, type MensajeChat } from '@crm/core/chat';
import { paraWhatsApp } from '@crm/core/telefono';
import { diaLocal, horaLocal } from '@crm/core/fecha';
import { pb } from '../../lib/pocketbase';
import { Emojis } from './Emojis';

interface ChatRecord {
  id: string;
  cuenta: string;
  nombre: string;
  telefono: string;
  no_leido: boolean;
  mensajes: MensajeChat[] | null;
  /** La foto de perfil que trajo el worker. Vacio = no hay. */
  foto?: string;
}

/**
 * Los dos filtros de la columna de chats.
 *
 * Son dos y son interruptores, no una lista de opciones: apagarlos ES «todos»,
 * así que un botón «todos» sería un tercero para decir lo mismo.
 *
 * «Personal» y «trabajo» estuvieron y se sacaron el 09/09: los de trabajo se
 * mueven a Follow-up, o sea que lo que queda acá ya es lo personal. Clasificar
 * a mano lo que la estructura ya separa es trabajo que no cambia nada.
 */
type FiltroChat = 'sin_leer' | 'no_agendados';

// La colección «entrante» sigue existiendo en la base: el worker va a escribir
// ahí los mensajes de números desconocidos. Esta pantalla dejó de leerla el
// 09/09 —ver el comentario del triage— así que su tipo tampoco vive acá.

/**
 * Los chats, del que escribió recién al que escribió hace más.
 *
 * No se puede pedir ordenado a la base: la hora vive adentro del último mensaje
 * del JSON, no en una columna. Antes se ordenaba por `updated`, que es cuándo
 * se TOCÓ la fila —marcar leído la toca— así que las horas salían salteadas:
 * 08:12, 11:24, 17:40, 10:45, 13:45.
 */
function porUltimoMensaje<T extends { mensajes: MensajeChat[] | null; updated?: string }>(
  chats: T[],
): T[] {
  const cuando = (c: T) => {
    const ms = c.mensajes ?? [];
    const ultimo = ms.length ? ms[ms.length - 1] : null;
    return String(ultimo?.en ?? c.updated ?? '');
  };
  return [...chats].sort((a, b) => (cuando(a) < cuando(b) ? 1 : cuando(a) > cuando(b) ? -1 : 0));
}

/**
 * Las iniciales, para cuando no hay foto.
 *
 * Dos letras como mucho: tres empiezan a no entrar en el círculo. De un
 * teléfono salen los últimos dos dígitos, que es lo único que lo distingue de
 * otro teléfono a simple vista.
 */
function iniciales(de: string): string {
  const s = String(de ?? '').trim();
  if (!s) return '·';
  if (/^\+?\d[\d\s-]*$/.test(s)) return s.replace(/\D/g, '').slice(-2);
  return s
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0] ?? '')
    .join('')
    .toUpperCase();
}

// La hora la convierte core: cortar el texto del ISO da la hora UTC, y el
// 11/09 eso mostraba 17:05 donde WhatsApp decia 11:05.
const hora = horaLocal;

/**
 * Los últimos ocho dígitos de un teléfono.
 *
 * El mismo número aparece escrito de tres formas —con +52, con 52, con
 * espacios— según de dónde venga, así que compararlos enteros no encuentra
 * nada. La cola es lo que sobrevive a todos los formatos.
 */
function ultimosOcho(tel: string): string {
  return String(tel ?? '').replace(/\D/g, '').slice(-8);
}

/** El teléfono como se muestra: los últimos dígitos alcanzan para reconocerlo. */
function corto(tel: string): string {
  const t = String(tel ?? '');
  return t.length > 6 ? `…${t.slice(-6)}` : t;
}

interface Props {
  onIrAlLead: (id: string) => void;
}

/**
 * WA Personal (§7.4). Portada de `docs/prototipo/WhatsappPersonal.dc.html`.
 *
 * Existe para separar dos cosas que llegan por el mismo canal: el WhatsApp de
 * trabajo y el personal. La columna izquierda tiene tres franjas apiladas —lo
 * que ya se ruteó solo, lo que hay que decidir, y los chats personales— y esa
 * pila es el orden en que hay que mirarlas: primero lo que no requiere nada,
 * después lo que sí, y al final el archivo.
 */
export function WaPersonal({ onIrAlLead }: Props) {
  /**
   * El toggle de Gmail (§8.5, decisión #8).
   *
   * Es estado de interfaz y nada más: la decisión es explícita en que no hay
   * pantalla de permisos ni elección de cuenta. Se guarda por navegador,
   * igual que los anchos: depende de cómo trabaja cada uno, no de quién es.
   */
  // §9.4: la lista de chats se arrastra, igual que la columna 1 de
  // Follow-up. Es la misma clase de panel y se usa igual de seguido.
  const anchoCol = useAncho(COLUMNA_WA);

  const [chats, setChats] = useState<ChatRecord[]>([]);
  const [filtros, setFiltros] = useState<Set<FiltroChat>>(new Set());
  const [marcando, setMarcando] = useState<string | null>(null);
  /** Qué teléfono se acaba de copiar, para poder decirlo. */
  const [copiado, setCopiado] = useState<string | null>(null);

  /**
   * El hilo arranca ABAJO, en el último mensaje.
   *
   * Pedido el 11/09: *«que por default aparezca en el último mensaje»*. Es lo
   * que hace cualquier chat, y con 400 mensajes por conversación abrir uno y
   * caer en un «hola» de hace dos meses obliga a rodar la rueda hasta abajo
   * cada vez.
   *
   * `auto` y no `smooth` al abrir: la animación de dos meses de mensajes se ve
   * como un tirón. El botón de bajar sí va suave, porque ahí uno mira.
   */
  const cajaHilo = useRef<HTMLDivElement | null>(null);
  const [lejosDelFondo, setLejosDelFondo] = useState(false);

  function alFondo(suave = false) {
    const c = cajaHilo.current;
    if (!c) return;
    c.scrollTo({ top: c.scrollHeight, behavior: suave ? 'smooth' : 'auto' });
  }

  /**
   * Si uno se fue para arriba, aparece el botón de volver.
   *
   * El umbral son 200px y no 0: con el botón apareciendo al primer píxel de
   * scroll, cualquier rueda sin querer lo prende y apaga. 200 es «me fui a
   * buscar algo», que es cuando sirve.
   */
  function mirarSiLlegoAlFondo() {
    const c = cajaHilo.current;
    if (!c) return;
    setLejosDelFondo(c.scrollHeight - c.scrollTop - c.clientHeight > 200);
  }

  /**
   * Copiar el teléfono al portapapeles.
   *
   * El «✓ copiado» dura dos segundos: sin confirmación uno aprieta dos veces
   * porque no sabe si funcionó, y el portapapeles no da ninguna señal propia.
   */
  async function copiar(tel: string) {
    const n = String(tel ?? '').trim();
    if (!n) return;
    try {
      await navigator.clipboard.writeText(n);
      setCopiado(n);
      setTimeout(() => setCopiado((v) => (v === n ? null : v)), 2000);
    } catch {
      // Sin permiso de portapapeles —pasa fuera de https— no hay nada que
      // hacer desde acá. El número está a la vista para copiarlo a mano.
    }
  }
  /**
   * Los teléfonos que YA existen como lead.
   *
   * Es lo que hace falta para «no agendados»: un chat cuyo número no está en la
   * base es alguien con quien se habla y que el CRM no conoce. Se guardan los
   * últimos ocho dígitos porque el mismo número aparece escrito de tres formas
   * —con +52, con 52, con espacios— y compararlos enteros no encuentra nada.
   */
  const [telefonosEnLaBase, setTelefonosEnLaBase] = useState<Set<string>>(new Set());
  const [sel, setSel] = useState<string | null>(null);
  const [borrador, setBorrador] = useState('');
  const [emojisAbiertos, setEmojisAbiertos] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hoy = diaLocal();

  const recargar = useCallback(async () => {
    try {
      // Ordenados por la hora del ÚLTIMO MENSAJE, como cualquier lista de
      // chats. `updated` es cuándo se tocó la fila —marcar leído la toca— así
      // que ordenaba por otra cosa y las horas salían salteadas.
      const [c, conTelefono] = await Promise.all([
        // Por el último mensaje, como cualquier lista de chats: arriba el que
        // escribió recién.
        pb.collection('chat_personal').getFullList<ChatRecord>({ sort: '-updated' }),
        // Los leads que ya existen, sólo para saber qué número YA está en la
        // base. Es lo que hace falta para el filtro «no agendados».
        pb
          .collection('lead')
          .getFullList<{ expand?: { perfil?: { telefono?: string } } }>({
            expand: 'perfil',
            fields: 'id,expand.perfil.telefono',
          })
          .catch(() => []),
      ]);
      setChats(porUltimoMensaje(c));
      setTelefonosEnLaBase(
        new Set(
          conTelefono
            .map((l) => ultimosOcho(l.expand?.perfil?.telefono ?? ''))
            .filter((t) => t.length >= 6),
        ),
      );
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  useEffect(() => {
    void recargar();
  }, [recargar]);

  const activo = chats.find((c) => c.id === sel) ?? chats[0] ?? null;
  const hilo = useMemo(() => conDias(activo?.mensajes ?? [], hoy), [activo, hoy]);

  /**
   * Al cambiar de chat, al fondo.
   *
   * Va en un `useEffect` y no en el `onClick` de la fila porque el hilo se
   * dibuja DESPUÉS de elegir: en el clic todavía está la conversación anterior
   * y bajar ahí bajaría la de antes.
   */
  useEffect(() => {
    alFondo();
    setLejosDelFondo(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activo?.id, hilo.length]);

  // Los que YA se rutearon solos: se avisa, no se pide nada.
  const visibles = useMemo(() => {
    // Los filtros se acumulan: sin leer Y no agendados es una pregunta legítima
    // —«¿a quién le debo respuesta que además no tengo cargado?»—.
    let v = chats;
    if (filtros.has('sin_leer')) v = v.filter((c) => c.no_leido);
    if (filtros.has('no_agendados')) {
      v = v.filter((c) => !telefonosEnLaBase.has(ultimosOcho(c.telefono)));
    }
    return v;
  }, [chats, filtros, telefonosEnLaBase]);

  const alternar = (f: FiltroChat) =>
    setFiltros((s) => {
      const n = new Set(s);
      if (n.has(f)) n.delete(f);
      else n.add(f);
      return n;
    });

  /** 6.3 · Devolverlo a «sin leer» para retomarlo más tarde. */
  async function marcarSinLeer(c: ChatRecord) {
    setMarcando(c.id);
    try {
      await pb.collection('chat_personal').update(c.id, { no_leido: true });
      setChats((v) => v.map((x) => (x.id === c.id ? { ...x, no_leido: true } : x)));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setMarcando(null);
    }
  }

  /**
   * «Mover a FU»: crea el perfil y el lead bajo la cuenta que recibió el
   * mensaje, y abre la ficha.
   *
   * Crea SIEMPRE con el teléfono como dato del perfil (D08), no del lead: si el
   * mismo número aparece mañana en otra cuenta, tiene que encontrar este mismo
   * perfil y no armar un duplicado.
   */
  async function moverAFollowup(telefono: string, nombre: string, cuenta: string, entranteId?: string, chatId?: string) {
    try {
      const perfil = await pb.collection('perfil').create({
        nombre: nombre || corto(telefono),
        telefono,
        telefono_raw: telefono,
        telefono_valido: Boolean(paraWhatsApp(telefono)),
      });
      const lead = await pb.collection('lead').create({
        perfil: perfil.id,
        cuenta,
        etapa: 'R0',
        situacion: 'en_curso',
        lista: 'Entrante de WhatsApp',
      });
      if (entranteId) await pb.collection('entrante').update(entranteId, { resuelto: true });
      if (chatId) await pb.collection('chat_personal').delete(chatId);
      await recargar();
      onIrAlLead(lead.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function enviar() {
    if (!activo || !borrador.trim()) return;
    const nuevos: MensajeChat[] = [
      ...(activo.mensajes ?? []),
      { quien: 'out', texto: borrador.trim(), en: new Date().toISOString() },
    ];
    setBorrador('');
    setChats((cs) => cs.map((c) => (c.id === activo.id ? { ...c, mensajes: nuevos, no_leido: false } : c)));
    await pb
      .collection('chat_personal')
      .update(activo.id, { mensajes: nuevos, no_leido: false })
      .catch(() => void recargar());
  }

  async function elegir(c: ChatRecord) {
    setSel(c.id);
    setBorrador('');
    if (c.no_leido) {
      setChats((cs) => cs.map((x) => (x.id === c.id ? { ...x, no_leido: false } : x)));
      await pb.collection('chat_personal').update(c.id, { no_leido: false }).catch(() => void recargar());
    }
  }

  return (
    <section
      className="wap"
      style={{ '--ancho-wa': `calc(${anchoCol.ancho}px * var(--escala-texto))` } as React.CSSProperties}
    >
      <div className="wap-col">
        <div className="wap-cabecera">
          <span className="wap-titulo">WA Personal</span>
          <span className="campo-ayuda">amigos y familia</span>
          <span className="campo-ayuda tabular al-final">{chats.length} chats</span>
        </div>

        {/*
          EL TRIAGE DE NÚMEROS DESCONOCIDOS SE FUE (09/09/2026).

          Era un bloque arriba de la lista que separaba «ya estaban en la base»
          de «números que no están en la base», con sus propios botones. Augusto:
          «eso no se debe mostrar ahí; no agendados es sólo un filtro normal,
          como no leídos, nada especial».

          Y es cierto: la lista de chats YA tiene esos números, y el filtro de no
          agendados los deja solos. Dos formas de ver lo mismo, una encima de la
          otra, empujando la lista de chats hacia abajo.
        */}

        {/* Los dos interruptores. Apagados es «todos», así que no hay un botón
            «todos»: sería un tercero para decir lo mismo. */}
        <div className="wap-filtros">
          <button
            type="button"
            className={`wap-filtro ${filtros.has('sin_leer') ? 'wap-filtro-on' : ''}`}
            title="Sólo los que no leíste"
            onClick={() => alternar('sin_leer')}
          >
            <span aria-hidden="true">●</span>
            <span className="tabular">{chats.filter((c) => c.no_leido).length}</span>
          </button>
          <button
            type="button"
            className={`wap-filtro ${filtros.has('no_agendados') ? 'wap-filtro-on' : ''}`}
            title="Sólo los números que no existen como lead en el CRM"
            onClick={() => alternar('no_agendados')}
          >
            <span aria-hidden="true">👤</span>
            <span className="tabular">
              {chats.filter((c) => !telefonosEnLaBase.has(ultimosOcho(c.telefono))).length}
            </span>
          </button>
          {/* Sin conteo suelto. Cada interruptor ya trae el suyo, y un «5 de 5»
              al lado no dice de qué: hay que deducir a cuál de los dos se
              refiere. La información ya está en los botones. */}
        </div>

        <div className="wap-chats">
          {visibles.map((c) => (
            <div
              key={c.id}
              className={`wap-chat ${activo?.id === c.id ? 'wap-chat-on' : ''}`}
              onClick={() => void elegir(c)}
            >
              {/* La marca de sin leer va a la IZQUIERDA, antes del nombre: es
                  lo primero que se busca al recorrer la lista. Y es el mismo
                  botón que lo devuelve a sin leer, no dos cosas distintas. */}
              {/*
                LA FOTO, o las iniciales.

                La trae el worker de WhatsApp y la guarda en la base — no se
                pide a la URL de WhatsApp desde acá, que vence en unas horas y
                dejaría la lista llena de cuadros rotos.

                Cuando no hay foto van las iniciales sobre un fondo tranquilo,
                que es lo que hace WhatsApp: un espacio vacío del tamaño de una
                foto se lee como que algo falló.
              */}
              {c.foto ? (
                <img
                  className="wap-foto"
                  src={pb.files.getURL(c, c.foto, { thumb: '80x80' })}
                  alt=""
                  loading="lazy"
                />
              ) : (
                <span className="wap-foto wap-foto-vacia" aria-hidden="true">
                  {iniciales(c.nombre || c.telefono)}
                </span>
              )}
              <button
                type="button"
                className={`wap-punto-boton ${c.no_leido ? 'wap-punto-on' : ''}`}
                title={c.no_leido ? 'Sin leer' : 'Dejarlo sin leer para volver después'}
                disabled={marcando === c.id}
                onClick={(ev) => {
                  ev.stopPropagation();
                  if (!c.no_leido) void marcarSinLeer(c);
                }}
              >
                ●
              </button>
              <div className="wap-chat-medio">
                <span className="wap-chat-arriba">
                  {/*
                    EL NÚMERO CUANDO NO ESTÁ AGENDADO, igual que WhatsApp.

                    Un chat cuyo número no está en la base es alguien a quien
                    el CRM no conoce, y mostrar el nombre que mandó WhatsApp
                    hace creer que sí. Con el filtro de «no agendados» puesto
                    era peor: una lista entera de nombres, que es justo lo
                    contrario de lo que ese filtro busca.

                    Se usa la MISMA cuenta que el filtro —los últimos ocho
                    dígitos— para que las dos cosas no puedan discrepar.
                  */}
                  <span className="wap-chat-nombre">
                    {telefonosEnLaBase.has(ultimosOcho(c.telefono))
                      ? c.nombre
                      : String(c.telefono ?? '').trim() || c.nombre}
                  </span>
                  {/*
                    LAS FLECHAS VAN ACÁ, pegadas al nombre, y la hora se fue al
                    borde derecho. Es el tercer pedido de Augusto sobre lo
                    mismo, así que esta vez va literal: donde estaba la hora van
                    las flechas y donde estaban las flechas va la hora.

                    Cada flecha dice una cosa distinta: la diagonal SALE de la
                    aplicación —abre el chat real de WhatsApp— y la horizontal
                    MUEVE de una lista a otra, dentro del CRM.
                  */}
                  <span className="wap-chat-acciones" onClick={(ev) => ev.stopPropagation()}>
                    <a
                      className="wap-accion"
                      href={`https://wa.me/${String(c.telefono ?? '').replace(/\D/g, '')}`}
                      target="_blank"
                      rel="noreferrer"
                      title="Abrir la conversación en WhatsApp"
                    >
                      ↗
                    </a>
                    <button
                      type="button"
                      className="wap-accion wap-accion-fu"
                      title="Mover a Follow-up: le crea un lead y entra en la cadencia"
                      onClick={() => {
                        void moverAFollowup(c.telefono, c.nombre, c.cuenta, undefined, c.id);
                      }}
                    >
                      →
                    </button>
                  </span>
                </span>
                {/*
                  EL TELÉFONO DEBAJO DEL NOMBRE, con un botón para copiarlo.

                  Pedido el 11/09: *«la foto y el teléfono abajo del nombre, con
                  la opción de poder copiar el teléfono rápido»*. El número se
                  copia para pegarlo en otro lado —una planilla, un mail, un
                  mensaje— y hasta ahora había que seleccionarlo a mano de un
                  renglón que además era el nombre.

                  No se repite cuando el nombre YA es el número: arriba se
                  muestra el teléfono cuando el contacto no está agendado, y
                  dos veces el mismo dato ocupa el lugar del último mensaje.
                */}
                {String(c.telefono ?? '').trim() &&
                  telefonosEnLaBase.has(ultimosOcho(c.telefono)) && (
                    <span className="wap-chat-tel" onClick={(ev) => ev.stopPropagation()}>
                      <span className="tabular">{c.telefono}</span>
                      <button
                        type="button"
                        className="wap-copiar"
                        title="Copiar el teléfono"
                        onClick={() => void copiar(c.telefono)}
                      >
                        {copiado === c.telefono ? '✓ copiado' : 'copiar'}
                      </button>
                    </span>
                  )}
                <span className="wap-chat-ultimo">{ultimoTexto(c.mensajes ?? [])}</span>
              </div>
              <span className="wap-chat-hora tabular">
                {hora(String(c.mensajes?.[c.mensajes.length - 1]?.en ?? ''))}
              </span>
            </div>
          ))}
          {visibles.length === 0 && chats.length > 0 && (
            <div className="wap-vacio">ningún chat con ese filtro</div>
          )}
          {!chats.length && <p className="vacio">Todavía no hay chats personales.</p>}
        </div>
      </div>

      {/* §9.4: 5 px, con doble clic para volver al ancho normal. */}
      <div
        className="divisor divisor-der"
        title="Arrastrá para cambiar el ancho de la lista · doble clic para volver"
        {...anchoCol.divisor}
      />

      <div className="wap-hilo">
        <div className="wap-hilo-header">
          <span className="wap-hilo-nombre">{activo?.nombre ?? 'sin chat seleccionado'}</span>
          {activo && (
            <button
              type="button"
              className="wap-boton al-final"
              title="Es un contacto de trabajo: lo pasa a la base y abre su ficha en Follow-up"
              onClick={() => void moverAFollowup(activo.telefono, activo.nombre, activo.cuenta, undefined, activo.id)}
            >
              Mover a FU
            </button>
          )}
        </div>

        {error && <div className="aviso-error">{error}</div>}

        <div className="wap-burbujas" ref={cajaHilo} onScroll={mirarSiLlegoAlFondo}>
          {hilo.map((i, n) =>
            i.tipo === 'dia' ? (
              <div key={n} className="wap-dia">
                <span>{i.etiqueta}</span>
              </div>
            ) : (
              <div key={n} className={`wap-linea ${i.quien === 'out' ? 'wap-linea-out' : ''}`}>
                <div className={`wap-burbuja ${i.quien === 'out' ? 'wap-burbuja-out' : ''}`}>
                  {i.texto}
                  <span className="wap-burbuja-hora tabular">{i.hora}</span>
                </div>
              </div>
            ),
          )}
          {!hilo.length && <p className="vacio">Elegí un chat.</p>}
        </div>

        {/* Volver al último mensaje. Aparece sólo si uno se fue para arriba:
            un botón permanente que la mitad del tiempo no hace nada ocupa
            lugar sobre la conversación, que es lo que se está leyendo. */}
        {lejosDelFondo && (
          <button
            type="button"
            className="wap-bajar"
            title="Ir al último mensaje"
            aria-label="Ir al último mensaje"
            onClick={() => alFondo(true)}
          >
            ⌄
          </button>
        )}

        <div className="wap-escribir">
          {/* El selector de emojis, arriba del cuadro. Se abre y se cierra con
              el mismo botón, como en WhatsApp. */}
          {emojisAbiertos && (
            <Emojis
              onCerrar={() => setEmojisAbiertos(false)}
              onElegir={(e) => setBorrador((b) => b + e)}
            />
          )}
          <button
            type="button"
            className="wap-icono"
            title="Emojis"
            aria-label="Emojis"
            onClick={() => setEmojisAbiertos((v) => !v)}
          >
            ☺
          </button>
          <textarea
            value={borrador}
            placeholder="Escribir mensaje…"
            onChange={(e) => setBorrador(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void enviar();
              }
            }}
          />
          <button type="button" className="wap-enviar" title="Enviar" disabled={!activo} onClick={() => void enviar()}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
              <path d="M4 12l16-8-6 16-2-6-8-2z" />
            </svg>
          </button>
        </div>
      </div>
    </section>
  );
}
