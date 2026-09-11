/**
 * La agenda: cruzar los contactos de Google con lo que ya está en el CRM (§5.7).
 *
 * ─────────────────────────────────────────────────────────────────────────
 * POR QUE EXISTE. Los chats de WhatsApp llegan con un número y, casi siempre,
 * sin nombre: WhatsApp manda su agenda una sola vez, al vincular, y manda lo
 * que quiere. Augusto lo dijo el 11/09 mirando 58 chats importados —*«todos los
 * teléfonos están sin ser agendados»*— y también dónde estaban los nombres:
 * *«las personas que tengo en WhatsApp ya las tengo agendadas a la mayoría»*.
 *
 * Están en su cuenta de Google. Y a diferencia de WhatsApp, esa se puede
 * consultar cuantas veces haga falta.
 *
 * SE CRUZA POR LOS ULTIMOS OCHO DIGITOS. El mismo número está escrito de cinco
 * formas distintas según de dónde venga: `+52 1 55 2303 6183` en la agenda,
 * `5215523036183` en el JID de WhatsApp, `521 5523036183` tipeado a mano.
 * Comparar enteros no encuentra nada. Los últimos ocho sobreviven a todos los
 * formatos y siguen siendo suficientes para identificar a una persona.
 *
 * OCHO Y NO SEIS: con seis empiezan a chocar números distintos. Se probó contra
 * los 487 perfiles de la base.
 *
 * LO QUE ESTE MODULO NO HACE: no pisa un nombre que ya está. Si alguien
 * corrigió a mano «Juan» por «Juan Pérez - Logística», la agenda no tiene por
 * qué saber más que esa persona.
 */

/**
 * Los últimos ocho dígitos, que es como se compara un teléfono con otro.
 *
 * Devuelve vacío cuando no hay suficientes: un número de seis dígitos no
 * identifica a nadie, y hacer coincidir dos de esos es peor que no hacer nada.
 */
export function colaDelTelefono(tel: string | null | undefined): string {
  const d = String(tel ?? '').replace(/\D+/g, '');
  return d.length >= 8 ? d.slice(-8) : '';
}

/** Un contacto de la agenda, reducido a lo que sirve para cruzar. */
export interface ContactoDeAgenda {
  nombre: string;
  telefonos: string[];
}

/** Algo del CRM que podría recibir un nombre: un chat, un perfil. */
export interface SinNombre {
  id: string;
  telefono: string;
  nombre?: string | null;
}

export interface NombreEncontrado {
  id: string;
  nombre: string;
}

/**
 * Arma el índice teléfono → nombre a partir de la agenda.
 *
 * CUANDO DOS CONTACTOS COMPARTEN UN NUMERO, ESE NUMERO SE DESCARTA. Pasa de
 * verdad: el teléfono de la empresa guardado en la ficha de tres personas, o un
 * contacto duplicado con dos nombres distintos. Elegir uno de los dos sería
 * ponerle a un chat el nombre de otra persona, que es peor que dejarlo sin
 * nombre — el número se ve y se reconoce; un nombre equivocado no se nota.
 *
 * Dos entradas con el MISMO nombre no son un conflicto: es el mismo contacto
 * cargado dos veces.
 */
export function indiceDeLaAgenda(contactos: ContactoDeAgenda[]): Map<string, string> {
  const porCola = new Map<string, Set<string>>();

  for (const c of contactos ?? []) {
    const nombre = String(c?.nombre ?? '').trim();
    if (!nombre) continue;
    for (const t of c?.telefonos ?? []) {
      const cola = colaDelTelefono(t);
      if (!cola) continue;
      if (!porCola.has(cola)) porCola.set(cola, new Set());
      porCola.get(cola)!.add(nombre);
    }
  }

  const indice = new Map<string, string>();
  for (const [cola, nombres] of porCola) {
    if (nombres.size === 1) indice.set(cola, [...nombres][0]!);
  }
  return indice;
}

/**
 * Qué nombres hay que escribir, y en qué filas.
 *
 * SOLO DEVUELVE LO QUE FALTA. Una fila que ya tiene nombre no se toca: puede
 * haberlo puesto una persona, y la agenda no sabe más que ella. Y una
 * escritura de más mueve la fecha de modificación de la fila, con lo que el
 * lead sube en cualquier lista ordenada por fecha sin que haya pasado nada.
 */
export function nombresQueFaltan(
  filas: SinNombre[],
  indice: Map<string, string>,
): NombreEncontrado[] {
  const salida: NombreEncontrado[] = [];

  for (const f of filas ?? []) {
    if (String(f?.nombre ?? '').trim()) continue;

    const cola = colaDelTelefono(f?.telefono);
    if (!cola) continue;

    const nombre = indice.get(cola);
    if (!nombre) continue;

    salida.push({ id: f.id, nombre });
  }

  return salida;
}
/**
 * Por qué falló la lectura de la agenda (§5.7).
 *
 * ────────────────────────────────────────────────────────────────────────────
 * POR QUÉ ES UNA REGLA Y NO UN `if` EN EL HOOK. El 11/09, Google contestó esto
 * al conectar una cuenta:
 *
 *   HTTP 403 — People API has not been used in project 000000000000 before or
 *   it is disabled.
 *
 * y el hook lo leyó como «403, entonces le falta el permiso: desconectala y
 * volvé a conectarla». Es un 403, sí, pero de otra cosa: la API está APAGADA en
 * el proyecto de Google Cloud. Desconectar y volver a conectar no la prende, y
 * la persona puede repetirlo diez veces sin que cambie nada — que es exactamente
 * lo que pasó, tres veces reportado como «los contactos siguen sin agendarse».
 *
 * Las dos causas se parecen en el número y no se parecen en NADA más: una se
 * arregla en el navegador de quien usa el CRM, la otra en la consola de Google
 * Cloud del proyecto. Decir la equivocada no es un detalle de redacción: manda
 * a la persona a repetir para siempre algo que no puede funcionar.
 *
 * Por eso la distinción vive acá, con sus tests, y no adentro de un `catch`.
 */
export type CausaAgenda =
  /** La API de contactos está apagada en el proyecto de Google Cloud. */
  | 'api_apagada'
  /** La cuenta está conectada, pero sin el permiso de leer contactos. */
  | 'sin_permiso'
  /** El permiso venció o fue revocado desde la cuenta de Google. */
  | 'permiso_vencido'
  /** Cualquier otra. Se muestra el texto de Google tal cual. */
  | 'otra';

export interface FalloDeLaAgenda {
  causa: CausaAgenda;
  /** Qué hay que hacer, en una frase, sin jerga. */
  que_hacer: string;
  /** A dónde ir, si hay un lugar concreto. Vacío cuando no lo hay. */
  enlace: string;
}

/** El enlace que Google mete en el mensaje cuando la API está apagada. */
function enlaceDeLaConsola(mensaje: string): string {
  const m = /https:\/\/console\.(?:developers|cloud)\.google\.com\/[^\s"'<>)]+/.exec(mensaje);
  // Google termina la oración pegada al enlace: «…?project=123 then retry.»
  return m ? m[0].replace(/[.,;]+$/, '') : '';
}

/**
 * Traduce lo que contestó Google a qué hay que hacer.
 *
 * EL ORDEN DE LAS PREGUNTAS ES LA REGLA. «API apagada» se mira PRIMERO, antes
 * que el permiso: los dos son 403 y el mensaje de la API apagada es el más
 * específico de los dos. Al revés, la más genérica se queda con todos los casos
 * y nadie se entera nunca de que hay un interruptor sin prender.
 */
export function porQueFalloLaAgenda(mensaje: string): FalloDeLaAgenda {
  const t = String(mensaje ?? '');
  const b = t.toLowerCase();

  // La API apagada. Google lo dice de tres formas según por dónde entre el
  // pedido, y las tres traen el enlace a la pantalla donde se prende.
  if (
    b.includes('has not been used in project') ||
    b.includes('accessnotconfigured') ||
    b.includes('service_disabled') ||
    (b.includes('people api') && b.includes('disabled'))
  ) {
    const enlace = enlaceDeLaConsola(t);
    return {
      causa: 'api_apagada',
      que_hacer:
        'La agenda de Google está apagada en el proyecto: hay que prender la People API una vez, ' +
        'en la consola de Google Cloud. No se arregla desconectando y volviendo a conectar la cuenta. ' +
        'Después de prenderla, Google tarda un par de minutos.',
      enlace: enlace || 'https://console.cloud.google.com/apis/library/people.googleapis.com',
    };
  }

  // El permiso que falta. Pasa con una cuenta conectada ANTES de que el CRM
  // pidiera leer contactos: el permiso viejo no lo incluye.
  if (
    b.includes('insufficient authentication scopes') ||
    b.includes('access_token_scope_insufficient') ||
    b.includes('insufficient permission')
  ) {
    return {
      causa: 'sin_permiso',
      que_hacer:
        'Esta cuenta se conectó antes de que el CRM pidiera leer la agenda, así que su permiso no ' +
        'la incluye. Desconectala y volvé a conectarla: es una sola vez.',
      enlace: '',
    };
  }

  // El permiso revocado o vencido. Google contesta 401 con invalid_grant.
  if (b.includes('invalid_grant') || b.includes('unauthorized_client') || /\b401\b/.test(b)) {
    return {
      causa: 'permiso_vencido',
      que_hacer:
        'Google dejó de aceptar el permiso de esta cuenta —lo revocaron, o venció. Volvé a conectarla.',
      enlace: '',
    };
  }

  return {
    causa: 'otra',
    // Sin inventar un diagnóstico: se muestra lo que dijo Google, que es lo
    // único cierto que hay. Una explicación amable e inventada es peor que el
    // texto crudo, porque manda a buscar donde no está.
    que_hacer: t.trim() || 'Google no dijo por qué.',
    enlace: '',
  };
}
