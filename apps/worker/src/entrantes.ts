/**
 * Lo que llega por WhatsApp, ruteado según §5.8 del manual.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * QUE HACE. La sesión de `whatsapp.ts` sólo se mantenía viva: WhatsApp
 * conectado y nada más. Augusto lo notó apenas vinculó, el 11/09: *«está
 * conectado pero no veo mis chats en la pantalla»*. Tenía razón — no había
 * nadie escuchando. Esto es ese alguien.
 *
 * Por cada mensaje que entra:
 *   1. Saca el teléfono del remitente y lo normaliza (§5.7).
 *   2. Busca UNA vez contra `perfil.telefono` — contra la identidad de la
 *      persona, no contra cada lead por separado (D08).
 *   3. Le pregunta a `core/ruteo.ts` qué corresponde, y ejecuta.
 *
 * LAS CUATRO SALIDAS, y por qué cada una:
 *
 *   · `conocido_en_esta_cuenta` — ya es un lead tuyo. El mensaje va **sólo al
 *     follow-up**: el lead se marca `sin_leer_wa` y aparece en la solapa Sin
 *     leer. En WA Personal no se crea nada. Es lo que pidió Augusto textual:
 *     *«que hagan match con el chat de WhatsApp y automáticamente me los
 *     muestre en follow up, en su defecto en sin leer»*.
 *   · `conocido_otra_cuenta` — es alguien conocido, pero lo trabaja otra
 *     cuenta. **No se auto-asigna**: queda como entrante pre-identificado.
 *   · `ambiguo` — dos perfiles con el mismo teléfono. Queda para elegir a
 *     mano. Nunca se le cuelga el mensaje al lead equivocado.
 *   · `desconocido` — entrante nuevo en WA Personal, con sus tres salidas.
 *
 * NO CONTESTA NADA, y es a propósito. Recibir no puede hacer que WhatsApp
 * bloquee el número; mandar sí. Eso es §8.5b y es otra decisión.
 *
 * EL HISTORIAL SE TRAE SOLO SI SE PIDE, y con un corte. `WA_HISTORIAL_DIAS`
 * prende las dos cosas a la vez: que se pida el historial y cuántos días
 * entran. Una sola perilla, para que no se pueda pedir el historial y
 * olvidarse del límite.
 *
 * Apagado por default porque este es un WhatsApp PERSONAL: traerlo entero
 * volcaría años de charlas privadas —familia, amigos, médicos— adentro del
 * CRM, donde las ve cualquiera con acceso y de donde pasan a los backups.
 *
 * ⚠ WhatsApp manda el historial UNA SOLA VEZ, al vincular. A una sesión ya
 * corriendo no se le puede pedir: hay que desvincular desde el teléfono y
 * escanear de nuevo. Así que esta decisión se toma ANTES de escanear.
 */
import type { WASocket } from '@whiskeysockets/baileys';
import { decidirRuteoEntrante, type PerfilConTelefono } from '@crm/core/ruteo';
import { DIAS_DE_HISTORIAL, entraEnElHistorial, recortarChat } from '@crm/core/chat';
import { existsSync, rmSync } from 'node:fs';
import type PocketBase from 'pocketbase';

/** El JID de WhatsApp: «5491133334444@s.whatsapp.net». */
function telefonoDelJid(jid: string | undefined): string {
  const izq = String(jid ?? '').split('@')[0] ?? '';
  // Los JID de dispositivo traen «:12» pegado al número.
  return izq.split(':')[0]!.replace(/\D+/g, '');
}

/**
 * El teléfono del que escribió, cuando WhatsApp lo da.
 *
 * NO SIEMPRE LO DA, y eso rompió el primer entrante real. WhatsApp está
 * migrando a los **LID** —`140166408724554@lid`—, un identificador interno que
 * **no es un número de teléfono**: es la forma de no revelar el número de
 * alguien que escribe desde una comunidad o con la privacidad activada.
 *
 * Tomarlo como teléfono deja un «·4554» que no es de nadie, no cruza con
 * ningún perfil y ensucia la base. Así que:
 *
 *   1. Si el JID es `@s.whatsapp.net`, ese ES el número.
 *   2. Si es un LID, WhatsApp a veces manda el número aparte (`senderPn`).
 *   3. Si no está en ninguno, se devuelve vacío: **el chat se guarda igual**
 *      —con el nombre que manda WhatsApp— pero sin inventar un teléfono.
 *      Un campo vacío es honesto; un número falso cruza mal para siempre.
 */
export function telefonoDeQuienEscribe(key: Record<string, unknown> | null | undefined): string {
  const k = (key ?? {}) as Record<string, unknown>;
  const jid = String(k.remoteJid ?? '');

  if (jid.endsWith('@s.whatsapp.net')) return telefonoDelJid(jid);

  for (const alterno of ['senderPn', 'remoteJidAlt', 'participantPn']) {
    const v = String(k[alterno] ?? '');
    if (v.endsWith('@s.whatsapp.net')) return telefonoDelJid(v);
  }

  return '';
}

/**
 * El texto de un mensaje, venga en el formato que venga.
 *
 * WhatsApp tiene una decena de formas de decir «texto»: el mensaje simple, el
 * extendido con vista previa de un link, el pie de una foto, el de un botón.
 * Si no se reconoce ninguna, se guarda el tipo en vez de una cadena vacía —
 * «[audio]» dice mucho más que un renglón en blanco cuando alguien mira la
 * pantalla para entender qué llegó.
 */
export function textoDelMensaje(m: Record<string, unknown> | null | undefined): string {
  if (!m) return '';
  const o = m as Record<string, unknown>;

  const simple = o.conversation;
  if (typeof simple === 'string' && simple.trim()) return simple.trim();

  const extendido = o.extendedTextMessage as { text?: string } | undefined;
  if (extendido?.text?.trim()) return extendido.text.trim();

  for (const clave of ['imageMessage', 'videoMessage', 'documentMessage']) {
    const cm = o[clave] as { caption?: string } | undefined;
    if (cm?.caption?.trim()) return cm.caption.trim();
  }

  const tipo = Object.keys(o).find((k) => k.endsWith('Message'));
  if (tipo) return `[${tipo.replace(/Message$/, '')}]`;

  return '';
}

interface FilaPerfil {
  id: string;
  telefono?: string;
}
interface FilaLead {
  id: string;
  perfil: string;
  cuenta: string;
}

/**
 * Los perfiles cuyo teléfono coincide, con sus leads.
 *
 * Se compara por E.164 completo contra una identidad única (D08), así que la
 * ambigüedad por dígitos parecidos casi desaparece: sólo puede pasar si dos
 * perfiles distintos comparten el mismo teléfono de verdad.
 */
async function candidatosPorTelefono(
  pb: PocketBase,
  e164: string,
): Promise<PerfilConTelefono[]> {
  if (!e164) return [];

  const perfiles = await pb
    .collection('perfil')
    .getFullList<FilaPerfil>({ filter: `telefono = "${e164}"`, fields: 'id,telefono' })
    .catch(() => [] as FilaPerfil[]);

  if (!perfiles.length) return [];

  const leads = await pb
    .collection('lead')
    .getFullList<FilaLead>({
      filter: perfiles.map((p) => `perfil = "${p.id}"`).join(' || '),
      fields: 'id,perfil,cuenta',
    })
    .catch(() => [] as FilaLead[]);

  return perfiles.map((p) => ({
    perfil_id: p.id,
    telefono: String(p.telefono ?? ''),
    leads: leads
      .filter((l) => l.perfil === p.id)
      .map((l) => ({ lead_id: l.id, cuenta_id: l.cuenta })),
  }));
}

export interface Entrante {
  telefono: string;
  /** El identificador de la conversacion en WhatsApp. Ver migracion 1788720000. */
  jid?: string;
  texto: string;
  recibidoEn: string;
  nombre: string;
}

/**
 * Baja la foto de perfil y la guarda en el chat.
 *
 * SE GUARDA EL ARCHIVO Y NO EL ENLACE. WhatsApp da la foto como una URL de su
 * CDN **que vence en unas horas**: guardar el enlace es una línea menos de
 * código y una lista llena de cuadros rotos al día siguiente.
 *
 * NO TIRA NUNCA. Una foto que no se pudo bajar no puede hacer que se pierda un
 * mensaje: la conversación vale, la foto es decoración. Se intenta una vez y
 * se sigue.
 *
 * Sólo se pide cuando el chat todavía no tiene una. Pedirla en cada mensaje
 * serían cientos de consultas a WhatsApp por algo que casi nunca cambia — y
 * cada consulta de más es una señal de más.
 */
async function traerLaFoto(
  sock: WASocket,
  pb: PocketBase,
  chatId: string,
  jid: string,
): Promise<boolean> {
  try {
    const url = await sock.profilePictureUrl(jid, 'preview');
    if (!url) return false;

    const r = await fetch(url);
    if (!r.ok) return false;
    const bytes = new Uint8Array(await r.arrayBuffer());
    // Una foto de perfil pesa decenas de KB. Algo de 2 MB no es una foto de
    // perfil, y el campo la rechazaría igual: mejor no mandarla.
    if (!bytes.length || bytes.length > 2_097_152) return false;

    const form = new FormData();
    form.append('foto', new Blob([bytes], { type: 'image/jpeg' }), 'perfil.jpg');
    await pb.collection('chat_personal').update(chatId, form);
    return true;
  } catch {
    // Sin foto, con la privacidad puesta, o WhatsApp que no contestó. Los tres
    // dan lo mismo acá: no hay foto y no pasa nada.
    return false;
  }
}

/**
 * Guarda un entrante donde corresponda. Devuelve qué se hizo, para el log.
 *
 * Es una función aparte de la suscripción para poder probarla sin WhatsApp:
 * recibe un entrante ya armado y no sabe nada de Baileys.
 */
export async function guardarEntrante(
  pb: PocketBase,
  cuentaId: string,
  pais: string,
  e: Entrante,
): Promise<string> {
  /*
   * EL NUMERO DE UN JID YA ES E.164. No se normaliza contra ningún país.
   *
   * Encontrado el 11/09 revisando los primeros entrantes reales: un mexicano
   * había quedado guardado como `545215523036183`. WhatsApp había mandado
   * `5215523036183` —52 de México, ya internacional— y `normalizarTelefono`,
   * al ver que no empezaba con el 54 de Argentina, le pegó el 54 adelante.
   *
   * Con un solo país de prospección no se notaba. Acá se prospecta en México y
   * Brasil, así que **la mayoría de los números entrantes no son argentinos**:
   * el país configurado los rompía a casi todos, y un teléfono roto no cruza
   * con ningún perfil nunca más.
   *
   * `normalizarTelefono` sigue siendo lo correcto para lo que TIPEA una
   * persona —ahí sí falta el país—. Un JID no: WhatsApp no tiene números
   * locales.
   */
  void pais;
  const e164 = e.telefono.replace(/\D+/g, '');

  const candidatos = await candidatosPorTelefono(pb, e164);
  const r = decidirRuteoEntrante(cuentaId, candidatos);

  if (r.accion === 'conocido_en_esta_cuenta') {
    // SOLO AL FOLLOW-UP. No se crea nada en WA Personal: el lead pasa a «sin
    // leer» y ahí se queda hasta que una persona lo mueva (§7.6).
    await pb.collection('lead').update(r.lead_id, { sin_leer_wa: true });
    await pb.collection('mensaje').create({
      lead: r.lead_id,
      canal: 'whatsapp',
      quien: 'in',
      texto: e.texto,
      enviado_en: e.recibidoEn,
    });
    return `lead ${r.lead_id} → sin leer`;
  }

  // EL CHAT PRIMERO, el aviso después. El orden importa y se aprendió el
  // 11/09: estaba al revés, la escritura del chat falló por un campo inválido,
  // y quedaron tres avisos en la cola apuntando a una conversación que no
  // existía. Los mensajes habían llegado y la pantalla estaba vacía.
  //
  // El chat es lo que se LEE; el aviso es metadata. Si algo va a fallar, que
  // falle lo segundo.
  //
  // El chat en sí: un solo hilo por
  // teléfono: los mensajes se acumulan adentro, no se crea una fila por
  // mensaje.
  //
  // `tipo` NO SE ESCRIBE, y ahí estaba el error del 11/09: el worker mandaba
  // «sin_clasificar» y el campo sólo acepta «personal» o «trabajo», así que
  // PocketBase rechazaba la fila entera. Los mensajes llegaban, el entrante se
  // guardaba, y el chat —lo único que se ve en la pantalla— no.
  //
  // Vacío es el valor correcto: quién es lo decide una PERSONA con los botones
  // de §5.8, y hasta que eso pase el CRM no tiene por qué haber elegido.
  // Cuando WhatsApp no dio el número (un LID), el hilo se busca por nombre: es
  // lo único que hay. Buscar por `telefono = ""` juntaría en una sola
  // conversación a todos los que escribieron sin número, que son personas
  // distintas.
  // PRIMERO POR JID, que es lo único que WhatsApp garantiza único; el teléfono
  // queda de respaldo para los chats que se guardaron antes de que existiera.
  // Sin esto, un mensaje nuevo creaba una conversación aparte de la que ya
  // tenía el historial de esa misma persona.
  const porDonde = e.jid
    ? `wa_jid = "${e.jid}"` + (e164 ? ` || (wa_jid = "" && telefono = "${e164}")` : '')
    : e164
      ? `telefono = "${e164}"`
      : e.nombre
        ? `telefono = "" && nombre = "${e.nombre.replace(/"/g, '')}"`
        : null;

  const previos = porDonde
    ? await pb
        .collection('chat_personal')
        .getFullList<{ id: string; mensajes?: unknown }>({ filter: porDonde })
        .catch(() => [] as { id: string; mensajes?: unknown }[])
    : [];

  // La forma la manda `MensajeChat` de core: quien es 'in'/'out' y la fecha
  // se llama `en`. El 11/09 esto decia { quien: 'ellos', cuando: ... } y la
  // pantalla no mostraba nada: los mensajes estaban guardados con una forma
  // que nadie sabe leer. Es la familia 6 del registro —programar contra el
  // modelo imaginado en vez de contra el que existe— y va por la octava vez.
  const nuevo = { quien: 'in', texto: e.texto, en: e.recibidoEn };

  if (previos.length) {
    const anteriores = Array.isArray(previos[0]!.mensajes) ? previos[0]!.mensajes : [];
    await pb.collection('chat_personal').update(previos[0]!.id, {
      // Recortado, igual que el historial: el campo admite 500 KB y una
      // conversación de dos meses los rozó.
      mensajes: recortarChat([...anteriores, nuevo] as never) as unknown as typeof anteriores,
      no_leido: true,
      // Se completa el JID si el chat es de antes de que existiera.
      ...(e.jid ? { wa_jid: e.jid } : {}),
    });
  } else {
    await pb.collection('chat_personal').create({
      cuenta: cuentaId,
      // EL JID TAMBIEN ACA. El historial lo guardaba y los mensajes nuevos no,
      // así que un chat creado por un mensaje nuevo quedaba sin identidad y no
      // se podía pegar después con el resto de su conversación.
      wa_jid: e.jid || '',
      telefono: e164,
      // EL NOMBRE DE WHATSAPP VA A SU CAMPO.  queda para la agenda de
      // Google y para lo que escriba una persona: hasta el 11/09 caian todos
      // en el mismo, y como la agenda no pisa lo que ya esta, no podia
      // completar ni un solo chat de los 56.
      nombre_wa: e.nombre || '',
      mensajes: [nuevo],
      no_leido: true,
    });
  }

  // Y recién ahora el aviso en la cola de WA Personal, con el ruteo que decidió
  // core: así la pantalla muestra lo que ya se sabe —quién es, con qué cuenta
  // habla— en vez de volver a decidirlo.
  await pb.collection('entrante').create({
    cuenta: cuentaId,
    telefono: e164,
    texto: e.texto,
    recibido_en: e.recibidoEn,
    ruteo: r.accion,
    candidatos: r.accion === 'ambiguo' ? r.candidatos : [],
    resuelto: false,
  });

  return `${r.accion} → WA Personal`;
}

/**
 * El historial que WhatsApp manda al vincular (§8.2).
 *
 * ─────────────────────────────────────────────────────────────────────────
 * UNA SOLA OPORTUNIDAD. WhatsApp manda las conversaciones viejas **únicamente
 * en el momento de vincular**, en tandas, por el evento `messaging-history.set`.
 * A una sesión ya corriendo no se le puede pedir «mandame lo de los últimos dos
 * meses»: hay que desvincular el dispositivo desde el teléfono y escanear otra
 * vez. Por eso esto tiene que estar bien ANTES de que alguien escanee — si
 * falla, el costo es volver a desvincular.
 *
 * QUE SE GUARDA Y QUE NO:
 *   · Sólo lo de los últimos `DIAS_DE_HISTORIAL` días. El corte lo decide
 *     `core/chat.ts` con sus tests.
 *   · **Los dos lados de la conversación**, los que entraron y los que salieron.
 *     Un historial con la mitad de los renglones no es un historial.
 *   · Nada se marca como sin leer. Son mensajes viejos: si el historial
 *     prendiera la marca, la bandeja aparecería con cientos de «nuevos» que
 *     nadie dejó sin leer.
 *   · Ni grupos ni difusiones.
 *
 * NO DUPLICA. Cada tanda puede repetir lo de la anterior, y el que ya llegó por
 * `messages.upsert` también está. Se compara por texto y hora antes de sumar.
 */
export interface MensajeCrudo {
  key?: { remoteJid?: string | null; fromMe?: boolean | null; id?: string | null } | null;
  message?: unknown;
  messageTimestamp?: number | Long | null;
  pushName?: string | null;
}
type Long = { toNumber?: () => number; low?: number };

function segundosDe(ts: MensajeCrudo['messageTimestamp']): number {
  if (ts == null) return 0;
  if (typeof ts === 'number') return ts;
  const l = ts as Long;
  if (typeof l.toNumber === 'function') return l.toNumber();
  return Number(l.low ?? 0);
}

export interface ResumenHistorial {
  mirados: number;
  guardados: number;
  viejos: number;
  chats: number;
}

/**
 * Vuelca una tanda de historial a la base. Devuelve qué hizo, para el log.
 *
 * Está separada de la suscripción para poder probarla sin WhatsApp: recibe
 * mensajes crudos y no sabe nada de Baileys.
 */
export async function guardarHistorial(
  pb: PocketBase,
  cuentaId: string,
  mensajes: MensajeCrudo[],
  sock: WASocket | null = null,
  dias: number = DIAS_DE_HISTORIAL,
  ahora: Date = new Date(),
  /**
   * Cómo se llama cada uno en la agenda del teléfono: JID → nombre.
   *
   * Augusto, 11/09: *«las personas que tengo en WhatsApp ya las tengo
   * agendadas a la mayoría, por qué no me lo mostrás tal cual»*. Tenía razón:
   * lo que se guardaba era `pushName`, que es el nombre que **el otro** eligió
   * para sí mismo, no el que vos le pusiste. Así que un contacto guardado como
   * «Juan Contador» aparecía como «Juancito» o vacío.
   *
   * WhatsApp manda la agenda junto con el historial, y esto es esa agenda.
   */
  nombres: Map<string, string> = new Map(),
): Promise<ResumenHistorial> {
  const r: ResumenHistorial = { mirados: 0, guardados: 0, viejos: 0, chats: 0 };

  // Se agrupa por conversación antes de escribir: una sola lectura y una sola
  // escritura por chat, en vez de una por mensaje. Con dos meses de historial
  // la diferencia es entre decenas de escrituras y miles.
  const porChat = new Map<string, { nombre: string; tel: string; jid: string; ms: { quien: string; texto: string; en: string }[] }>();

  for (const m of mensajes ?? []) {
    r.mirados++;
    const jid = String(m.key?.remoteJid ?? '');
    if (!jid || jid.endsWith('@g.us') || jid.endsWith('@broadcast') || jid === 'status@broadcast') continue;

    const seg = segundosDe(m.messageTimestamp);
    if (!entraEnElHistorial(seg, dias, ahora)) {
      r.viejos++;
      continue;
    }

    const texto = textoDelMensaje(m.message as Record<string, unknown> | null);
    if (!texto) continue;

    const tel = telefonoDeQuienEscribe(m.key as Record<string, unknown> | null);

    // EL DE LA AGENDA PRIMERO. `pushName` es el nombre que el otro eligió para
    // sí mismo; el de la agenda es el que le puso Augusto, y es el que
    // reconoce al abrir la pantalla. Sólo se cae al `pushName` cuando el
    // contacto no está guardado.
    const nombre = nombres.get(jid) || (tel ? nombres.get(`${tel}@s.whatsapp.net`) : '') || m.pushName || '';
    // LA IDENTIDAD ES EL JID. Ver la migracion 1788720000: agrupar por «sin
    // telefono y sin nombre» junto las conversaciones de personas distintas
    // en una sola de 4.468 mensajes.
    const clave = jid;

    if (!porChat.has(clave)) porChat.set(clave, { nombre, tel, jid, ms: [] });
    // Si una tanda posterior trae el nombre de la agenda y la primera no lo
    // tenía, se completa: el historial llega desordenado.
    else if (nombre && !porChat.get(clave)!.nombre) porChat.get(clave)!.nombre = nombre;

    porChat.get(clave)!.ms.push({
      // Del historial vienen los dos lados. `fromMe` dice cuál es cuál.
      quien: m.key?.fromMe ? 'out' : 'in',
      texto,
      en: new Date(seg * 1000).toISOString(),
    });
  }

  for (const [clave, c] of porChat) {
    /*
     * SE BUSCA POR JID. Ver la migración 1788720000.
     *
     * Antes se buscaba por teléfono y, cuando no había, por «teléfono vacío y
     * nombre vacío» — una condición que cumplen TODOS los que no tienen ni
     * número ni nombre. El 11/09 eso juntó las conversaciones de varias
     * personas en una sola fila de 4.468 mensajes.
     *
     * El teléfono queda de respaldo para los chats que se guardaron antes de
     * que existiera el JID: sin eso, cada uno de ellos se duplicaría.
     */
    const filtro = `wa_jid = "${clave}"` + (c.tel ? ` || (wa_jid = "" && telefono = "${c.tel}")` : '');

    const previos = await pb
      .collection('chat_personal')
      .getFullList<{ id: string; mensajes?: unknown; foto?: string }>({ filter: filtro })
      .catch(() => [] as { id: string; mensajes?: unknown; foto?: string }[]);

    const antes = previos.length && Array.isArray(previos[0]!.mensajes) ? (previos[0]!.mensajes as { texto?: string; en?: string }[]) : [];
    const yaEstan = new Set(antes.map((m) => `${m.texto}·${m.en}`));

    const suma = c.ms.filter((m) => !yaEstan.has(`${m.texto}·${m.en}`));
    if (!suma.length) continue;

    // Ordenados por hora: el historial llega en tandas y sin garantía de orden.
    // Y recortados: el campo admite 500 KB y una conversación de dos meses los
    // rozó. El tope y el porqué están en `core/chat.ts`.
    const todos = recortarChat(
      [...antes, ...suma].sort((a, b) => String(a.en ?? '').localeCompare(String(b.en ?? ''))) as never,
    ) as unknown as { texto?: string; en?: string }[];

    let chatId: string;
    if (previos.length) {
      // `no_leido` NO se toca: lo viejo no vuelve a estar sin leer. El nombre y
      // el JID sí se completan si faltaban.
      chatId = previos[0]!.id;
      await pb.collection('chat_personal').update(chatId, {
        mensajes: todos,
        wa_jid: clave,
        ...(c.nombre ? { nombre_wa: c.nombre } : {}),
        ...(c.tel ? { telefono: c.tel } : {}),
      });
    } else {
      const creado = await pb.collection('chat_personal').create({
        cuenta: cuentaId,
        wa_jid: clave,
        telefono: c.tel,
        nombre_wa: c.nombre,
        mensajes: todos,
        no_leido: false,
      });
      chatId = creado.id;
      r.chats++;
    }
    r.guardados += suma.length;

    // Y la foto, una sola vez por chat. Va al final: si WhatsApp tarda, los
    // mensajes ya están guardados.
    if (sock && !previos[0]?.foto) await traerLaFoto(sock, pb, chatId, c.jid);
  }

  return r;
}

/**
 * Engancha la escucha a una sesión ya abierta.
 *
 * Se llama desde `whatsapp.ts` una vez que la conexión está viva. No abre nada
 * ni decide nada: traduce lo que manda Baileys y le pregunta a core.
 */
export function escuchar(
  sock: WASocket,
  pb: PocketBase,
  cuentaId: string,
  pais: string,
  decir: (m: string) => void,
  /** Dónde vive la credencial, para poder borrarla al desvincular. */
  carpetaCred: string,
): void {
  /*
   * El historial, si se pidió traerlo.
   *
   * Llega en tandas y sólo en la vinculación. Cada tanda se guarda apenas
   * llega, no al final: si el proceso se corta en la mitad, lo que ya entró
   * queda. Esperar a la última tanda para escribir sería apostar todo a que
   * nada falle en varios minutos de sincronización.
   */
  const dias = Number(process.env.WA_HISTORIAL_DIAS ?? 0) || 0;
  /*
   * La agenda del teléfono: cómo se llama cada uno para Augusto.
   *
   * Se acumula acá y no se guarda en ningún lado: es una tabla de traducción
   * para esta corrida. WhatsApp manda los contactos en tandas, mezclados con
   * los mensajes y sin garantía de orden, así que hay que ir juntándolos.
   */
  const nombres = new Map<string, string>();
  const anotarNombres = (cs: { id?: string | null; name?: string | null; notify?: string | null }[] | undefined) => {
    for (const c of cs ?? []) {
      const id = String(c?.id ?? '');
      // `name` es el de la agenda. `notify` es el que eligió el otro: sirve de
      // respaldo, pero nunca pisa al de la agenda.
      const n = String(c?.name ?? '').trim() || String(c?.notify ?? '').trim();
      if (id && n && !nombres.has(id)) nombres.set(id, n);
    }
  };
  //  es el unico evento de contactos que Baileys 7 expone con
  // tipo. Los de la sincronizacion inicial vienen dentro de
  // , que se lee mas abajo.
  sock.ev.on('contacts.upsert', anotarNombres);

  /*
   * Desvincular desde el CRM.
   *
   * POR QUE NO ALCANZA CON MATAR EL PROCESO. La sesión no vive sólo acá: el
   * teléfono la tiene anotada como un dispositivo vinculado. Matar el worker
   * deja ese dispositivo colgado en la lista del teléfono y la credencial en
   * el disco — y el próximo «Vincular» reconecta con la misma, sin QR y sin
   * historial. `sock.logout()` la da de baja de los dos lados, que es lo que
   * uno espera cuando aprieta Desvincular.
   *
   * SE ESCUCHA DE LA BASE porque el que aprieta el botón es el navegador y
   * esto es otro proceso. La pantalla escribe `wa_motivo = 'desvincular'` y el
   * worker lo ve por la suscripción en vivo que PocketBase ya ofrece: sin
   * puertos abiertos ni una forma nueva de hablarle a este proceso.
   */
  const darDeBaja = () => {
    void (async () => {
        decir('');
        decir('  Pidieron desvincular desde el CRM.');
        try {
          await sock.logout();
          decir('  ✓ dado de baja también en el teléfono.');
        } catch (err) {
          decir(`  ! WhatsApp no aceptó la baja: ${(err as Error)?.message ?? String(err)}`);
          decir('    Sacalo a mano desde el teléfono: Dispositivos vinculados.');
        }
        /*
         * Y SE BORRA LA CREDENCIAL. Sin esto, desvincular no desvincula.
         *
         * Se probó el 11/09 contra la sesión real: `sock.logout()` cerró el
         * socket, dijo que sí, y **la credencial del disco siguió sirviendo**.
         * El siguiente «Vincular» reconectó con ella —sin QR, sin historial—
         * y desde la pantalla se vio otra vez como que el botón no hace nada.
         *
         * La credencial es lo que hace que no haya que escanear. Si queda, no
         * hay forma de pedir un código nuevo.
         */
        if (carpetaCred && existsSync(carpetaCred)) {
          try {
            rmSync(carpetaCred, { recursive: true, force: true });
            decir('  ✓ credencial borrada: la próxima vez pide un QR nuevo.');
          } catch (err) {
            decir(`  ! no pude borrar la credencial: ${(err as Error)?.message ?? String(err)}`);
            decir(`    Borrá a mano la carpeta: ${carpetaCred}`);
          }
        }

        // El estado queda limpio para que la pantalla no muestre una sesión que
        // ya no existe.
        await pb
          .collection('cuenta')
          .update(cuentaId, { ultima_senal_wa: '', qr_wa: '', qr_wa_desde: '', wa_motivo: 'desvinculado' })
          .catch(() => undefined);
        decir('  Listo. Apretá «Vincular» cuando quieras y va a pedir un QR nuevo.');
        process.exit(0);
      })();
  };

  /*
   * SE PREGUNTA CADA DIEZ SEGUNDOS. No se usa la suscripción en vivo.
   *
   * PocketBase ofrece realtime y la pantalla lo usa — pero en el navegador, que
   * tiene `EventSource` de fábrica. En Node esa suscripción se abre sin quejarse
   * y **no llega ningún evento**: se probó el 11/09 contra la sesión real,
   * apretando el botón con el worker vivo, y el worker no se enteró. Un fallo
   * silencioso, que es el peor de los dos mundos.
   *
   * Preguntar cada diez segundos es una consulta a una fila por índice, contra
   * una base que está en esta misma máquina. Es más barato que el problema que
   * evita, y **no puede fallar en silencio**.
   *
   * Y ATIENDE EL PEDIDO QUE YA ESTABA. El 11/09 Augusto apretó Desvincular sin
   * ningún worker vivo —lo había matado un reinicio— y el pedido quedó escrito
   * sin nadie que lo ejecutara: desde la pantalla, un botón que no hace nada.
   * La primera vuelta del reloj es inmediata justamente por eso.
   */
  let dandoDeBaja = false;
  const mirarSiHayPedido = async () => {
    if (dandoDeBaja) return;
    try {
      const c = await pb.collection('cuenta').getOne(cuentaId);
      if (String((c as { wa_motivo?: string }).wa_motivo ?? '') !== 'desvincular') return;
      dandoDeBaja = true;
      darDeBaja();
    } catch {
      // La base puede estar reiniciándose. Se vuelve a mirar en diez segundos.
    }
  };
  void mirarSiHayPedido();
  const reloj = setInterval(() => void mirarSiHayPedido(), 10000);
  reloj.unref?.();

  if (dias > 0) {
    let total = 0;
    sock.ev.on('messaging-history.set', (h) => {
      void (async () => {
        try {
          // Los contactos de ESTA tanda, antes de usarlos.
          anotarNombres(h.contacts as { id?: string; name?: string; notify?: string }[] | undefined);
          const r = await guardarHistorial(
            pb,
            cuentaId,
            (h.messages ?? []) as MensajeCrudo[],
            sock,
            dias,
            new Date(),
            nombres,
          );
          total += r.guardados;
          decir(
            `  · historial: ${r.guardados} mensajes nuevos, ${r.chats} conversaciones` +
              ` (miró ${r.mirados}, descartó ${r.viejos} por viejos) — van ${total}`,
          );
          if (h.isLatest) decir(`  · historial COMPLETO: ${total} mensajes de los últimos ${dias} días.`);
        } catch (err) {
          decir(`  ! el historial falló: ${(err as Error)?.message ?? String(err)}`);
        }
      })();
    });
    decir(`  Voy a traer el historial de los últimos ${dias} días.`);
  }

  sock.ev.on('messages.upsert', (u) => {
    void (async () => {
      // `notify` son los que llegan ahora. `append` es historial que WhatsApp
      // manda al sincronizar, y ese NO se procesa: ver el comentario de arriba.
      if (u.type !== 'notify') return;

      for (const m of u.messages ?? []) {
        try {
          // Lo que mandamos nosotros vuelve por el mismo canal. Guardarlo sería
          // registrar como entrante lo que salió de este teléfono.
          if (m.key?.fromMe) continue;

          const jid = m.key?.remoteJid ?? '';
          // Los grupos quedan afuera: §5.8 rutea por teléfono de una persona, y
          // un grupo no tiene uno. Meterlo crearía un «lead» que es un grupo.
          if (jid.endsWith('@g.us') || jid.endsWith('@broadcast')) continue;

          // Puede venir vacío si WhatsApp mandó un LID y no el número. No se
          // descarta el mensaje por eso: se guarda con el nombre y sin
          // teléfono, que es la verdad. Descartarlo sería perder un mensaje
          // real por un dato que WhatsApp decidió no dar.
          const telefono = telefonoDeQuienEscribe(m.key as Record<string, unknown> | null);

          const texto = textoDelMensaje(m.message as Record<string, unknown> | null);
          if (!texto) continue;

          const cuando = m.messageTimestamp
            ? new Date(Number(m.messageTimestamp) * 1000).toISOString()
            : new Date().toISOString();

          const que = await guardarEntrante(pb, cuentaId, pais, {
            telefono,
            texto,
            recibidoEn: cuando,
            // El de la agenda primero; el que eligió el otro, de respaldo.
            nombre: nombres.get(jid) || m.pushName || '',
            jid,
          });

          // Y la foto, si este chat todavía no tiene. Va después de guardar el
          // mensaje: si WhatsApp tarda en contestar la foto, el mensaje ya está.
          if (telefono) {
            const ya = await pb
              .collection('chat_personal')
              .getFullList<{ id: string; foto?: string }>({ filter: `telefono = "${telefono}"` })
              .catch(() => [] as { id: string; foto?: string }[]);
            if (ya.length && !ya[0]!.foto) await traerLaFoto(sock, pb, ya[0]!.id, jid);
          }

          // El teléfono tapado y el texto recortado: este log se lee en
          // pantalla y se pega en mensajes.
          decir(`  ← ${telefono ? "···" + telefono.slice(-4) : (m.pushName ?? "sin número")} · ${que}`);
        } catch (err) {
          // Un mensaje que falla no puede cortar la escucha: el próximo tiene
          // que entrar igual. Pero se dice, para que no se descubra dentro de
          // dos semanas mirando una bandeja que le faltan cosas.
          decir(`  ! no se pudo guardar un entrante: ${(err as Error)?.message ?? String(err)}`);
        }
      }
    })();
  });
}
