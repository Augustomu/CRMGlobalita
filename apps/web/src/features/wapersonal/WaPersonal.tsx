import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { COLUMNA_WA } from '@crm/core/anchos';
import { useAncho } from '../../lib/useAncho';
import { conDias, ultimoTexto, type MensajeChat } from '@crm/core/chat';
import { diaLocal, horaLocal } from '@crm/core/fecha';
import { pb } from '../../lib/pocketbase';
import { Emojis } from './Emojis';

interface ChatRecord {
  id: string;
  cuenta: string;
  nombre: string;
  telefono: string;
  no_leido: boolean;
  /** El que dijo WhatsApp. `nombre` es el de la agenda o el que puso alguien. */
  nombre_wa?: string;
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
/**
 * El nombre que se muestra.
 *
 * `nombre` es el de la agenda de Google o el que escribió una persona;
 * `nombre_wa` es el que la otra persona eligió para sí misma. El primero gana
 * cuando existe: es el que Augusto reconoce al recorrer la lista.
 */
function comoSeLlama(c: { nombre?: string; nombre_wa?: string }): string {
  return String(c.nombre ?? '').trim() || String(c.nombre_wa ?? '').trim();
}

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

/**
 * `onIrAlLead` ya no se usa: se iba a la ficha después de «Mover a FU», y ese
 * boton se fue el 11/09. Se deja en las props para no tocar quien la llama.
 */
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
export function WaPersonal(_props: Props) {
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
  /** Lo que se escribió en el buscador de la lista de chats. */
  const [busca, setBusca] = useState('');
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
    // La búsqueda mira nombre Y teléfono: a veces uno se acuerda de la cara y a
    // veces del número. Del teléfono se comparan sólo los dígitos, porque el
    // mismo número está escrito de cinco formas según de dónde vino.
    const q = busca.trim().toLowerCase();
    if (q) {
      const soloDigitos = q.replace(/\D/g, '');
      v = v.filter(
        (c) =>
          comoSeLlama(c).toLowerCase().includes(q) ||
          (soloDigitos.length >= 3 && String(c.telefono ?? '').includes(soloDigitos)),
      );
    }
    return v;
  }, [chats, filtros, telefonosEnLaBase, busca]);

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

  // `moverAFollowup` se fue el 11/09 junto con su botón. Con el diseño nuevo,
  // si alguien ya es lead se le contesta desde donde está el lead; y si no lo
  // es, esta pantalla es donde tiene que quedarse. Crear un lead desde acá era
  // el paso que sobraba.

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
          {/* SIN TÍTULO NI SUBTÍTULO. Augusto, 11/09: «cambiá el título de WA
              PERSONAL amigos y familia, eliminá todo eso». Tiene razón: la
              solapa de arriba ya dice dónde está uno, y «amigos y familia»
              describía un criterio que ya no existe — lo que queda acá es todo
              lo que NO es un lead, no sólo lo personal. */}
          <span className="campo-ayuda tabular">{chats.length} chats</span>
          {/* EL BUSCADOR, donde estaba el conteo. Con 56 conversaciones ya no
              alcanza con recorrer la lista, y va a haber más. Busca por nombre
              y por teléfono: a veces uno se acuerda de la cara y a veces del
              número. */}
          <input
            className="wap-buscar"
            type="search"
            value={busca}
            placeholder="Buscar"
            aria-label="Buscar en los chats"
            onChange={(e) => setBusca(e.target.value)}
          />
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
            {/* CON SU NOMBRE, no sólo el número.
                Augusto, 11/09: *«el emoji de 55, no sé para qué sirve»*. Y
                tenía razón: un icono de persona con un 55 al lado no dice
                «cincuenta y cinco que no están en el CRM» — no lo dice ni
                aunque uno lo piense. Un filtro cuyo criterio hay que adivinar
                es un filtro que no se usa. */}
            <span aria-hidden="true">●</span>
            <span className="tabular">{chats.filter((c) => c.no_leido).length}</span>
            <span>sin leer</span>
          </button>
          <button
            type="button"
            className={`wap-filtro ${filtros.has('no_agendados') ? 'wap-filtro-on' : ''}`}
            title="Sólo los que todavía no existen como lead en el CRM"
            onClick={() => alternar('no_agendados')}
          >
            <span className="tabular">
              {chats.filter((c) => !telefonosEnLaBase.has(ultimosOcho(c.telefono))).length}
            </span>
            <span>sin lead</span>
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
                  {iniciales(comoSeLlama(c) || c.telefono)}
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
                      ? comoSeLlama(c)
                      : String(c.telefono ?? '').trim() || comoSeLlama(c)}
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
                  {/*
                    UNA SOLA ACCIÓN: abrir la conversación en WhatsApp.

                    «Mover a FU» se fue el 11/09, pedido por Augusto: *«el botón
                    de mover a FU ya no estaría»*. Tenía razón y el motivo es
                    del diseño nuevo — si alguien ya es lead, se le contesta
                    desde donde está el lead, no desde acá; y si no lo es, esta
                    pantalla es justamente donde tiene que quedarse.

                    El icono es el de «abrir en otra aplicación» y no una
                    flecha suelta: una flecha diagonal sola no dice a dónde
                    lleva, y al lado de la que movía a Follow-up se confundían.
                  */}
                  <span className="wap-chat-acciones" onClick={(ev) => ev.stopPropagation()}>
                    <a
                      className="wap-accion"
                      /*
                        DIRECTO A LA APLICACIÓN, sin la página de por medio.

                        `wa.me` abre una página de WhatsApp que pregunta si uno
                        quiere abrir la aplicación: dos clics y una pestaña
                        nueva para llegar a un chat. Augusto lo pidió sacar el
                        11/09 — *«¿podremos eliminarla y que directo vaya al
                        chat y lo abra?»*.

                        `whatsapp://` es el enlace que entiende la aplicación
                        instalada. En esta máquina lo está, que es donde corre
                        el CRM.
                      */
                      href={`whatsapp://send?phone=${String(c.telefono ?? '').replace(/\D/g, '')}`}
                      target="_blank"
                      rel="noreferrer"
                      title="Abrir esta conversación en WhatsApp"
                      aria-label="Abrir en WhatsApp"
                    >
                      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M9.5 2.5H13v3.5M13 2.5 7.5 8" strokeLinecap="round" />
                        <path d="M12 9.5V12a1.5 1.5 0 0 1-1.5 1.5h-6A1.5 1.5 0 0 1 3 12V6a1.5 1.5 0 0 1 1.5-1.5H7" strokeLinecap="round" />
                      </svg>
                    </a>
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
                {String(c.telefono ?? '').trim() && (
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
          <span className="wap-hilo-nombre">{(activo && comoSeLlama(activo)) || corto(activo?.telefono ?? '') || 'sin chat seleccionado'}</span>
          {/* «Mover a FU» se fue el 11/09. Con el diseño nuevo, si alguien ya
              es lead se le contesta desde donde esta el lead; y si no lo es,
              esta pantalla es justamente donde tiene que quedarse. */}
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
          {/* ADJUNTAR: el «+» de WhatsApp.
              Está APAGADO y lo dice, en vez de no estar. Mandar un archivo por
              WhatsApp desde una automatización es lo que más rápido hace que
              bloqueen un número, y toda esa parte —la cola de envíos, el tope
              diario— todavía no existe (§8.5b). Un botón que no se puede
              apretar y explica por qué es más honesto que un hueco. */}
          <button
            type="button"
            className="wap-icono"
            title="Adjuntar un documento o una foto. Todavía no: mandar archivos necesita la cola de envíos (§8.5b)."
            aria-label="Adjuntar"
            disabled
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M12 5v14M5 12h14" strokeLinecap="round" />
            </svg>
          </button>

          <button
            type="button"
            className="wap-icono"
            title="Emojis"
            aria-label="Emojis"
            onClick={() => setEmojisAbiertos((v) => !v)}
          >
            {/* La carita, dibujada. El carácter ☺ lo dibuja cada sistema a su
                manera y en Windows sale una carita negra sólida. */}
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
              <circle cx="12" cy="12" r="9" />
              <circle cx="9" cy="10" r="1" fill="currentColor" stroke="none" />
              <circle cx="15" cy="10" r="1" fill="currentColor" stroke="none" />
              <path d="M8.5 14.5a4.5 4.5 0 0 0 7 0" strokeLinecap="round" />
            </svg>
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
          {/* EL MICRÓFONO CUANDO NO HAY NADA ESCRITO, y el avión cuando sí —
              como WhatsApp. El micrófono está apagado por lo mismo que el «+»:
              grabar es fácil, MANDAR el audio es §8.5b. */}
          {borrador.trim() ? (
            <button
              type="button"
              className="wap-enviar"
              title="Enviar"
              disabled={!activo}
              onClick={() => void enviar()}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
                <path d="M4 12l16-8-6 16-2-6-8-2z" />
              </svg>
            </button>
          ) : (
            <button
              type="button"
              className="wap-icono"
              title="Grabar un audio. Todavía no: mandar audios necesita la cola de envíos (§8.5b)."
              aria-label="Grabar audio"
              disabled
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
                <rect x="9" y="3" width="6" height="11" rx="3" />
                <path d="M5 11a7 7 0 0 0 14 0M12 18v3" strokeLinecap="round" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
