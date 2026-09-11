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
