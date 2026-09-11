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
 * NO TRAE EL HISTORIAL. Baileys puede pedirle a WhatsApp todas las
 * conversaciones viejas al vincular. No se hace: este es el WhatsApp PERSONAL
 * de Augusto, y traerlo entero volcaría años de charlas privadas —familia,
 * amigos, médicos— adentro del CRM, donde las ve cualquiera que tenga acceso.
 * Se escucha lo que llega a partir de ahora. Si algún día hay que traer algo
 * viejo, que sea una decisión explícita y acotada, no el efecto colateral de
 * vincular un teléfono.
 */
import type { WASocket } from '@whiskeysockets/baileys';
import { decidirRuteoEntrante, type PerfilConTelefono } from '@crm/core/ruteo';
import { normalizarTelefono } from '@crm/core/telefono';
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
  texto: string;
  recibidoEn: string;
  nombre: string;
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
  const tel = normalizarTelefono(e.telefono, pais);
  const e164 = tel.valido ? tel.valor : e.telefono.replace(/\D+/g, '');

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
  const porDonde = e164
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
      mensajes: [...anteriores, nuevo],
      no_leido: true,
    });
  } else {
    await pb.collection('chat_personal').create({
      cuenta: cuentaId,
      telefono: e164,
      nombre: e.nombre || '',
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
): void {
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
            nombre: m.pushName ?? '',
          });

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
