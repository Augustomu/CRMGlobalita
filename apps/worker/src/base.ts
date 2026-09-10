// Lo único del worker que habla con PocketBase.
//
// Está aparte por una razón concreta: todo lo demás de esta carpeta tiene que
// poder mirarse sin saber cómo está guardado nada. El orquestador pregunta «¿a
// quién le toca?» y anota «salió una invitación»; que eso sean tres colecciones
// y un upsert es problema de este archivo.
//
// Y por una segunda razón, del §8.1 y del repositorio viejo: **la invitación se
// anota en la base, no en un JSON al lado del script**. En
// `globalita-automation` el historial vivía en `history.json` y las cuotas en
// `quota-invitar.json`, los dos en la raíz del repositorio y los dos en el
// disco que se formateó el 03/09. Lo que existe en un solo disco no existe.

import PocketBase from 'pocketbase';
import { createInterface } from 'node:readline';
import { CONFIG_INVITAR_INICIAL, type ConfigInvitar, type CuentaQueInvita } from '@crm/core/invitar';
import type { ListaInvitacion } from '@crm/core/invitacion';
import { decidirAlta, identidad } from '@crm/core/dedupe';
import { nombreDePersona, slugDeLinkedIn } from '@crm/core/linkedin';

const PB_URL = process.env.PB_URL || 'http://127.0.0.1:8090';
const LOCAL = PB_URL.includes('127.0.0.1') || PB_URL.includes('localhost');
const PB_COL = process.env.PB_COL || 'users';

/** Pregunta sin eco. Mismo criterio que `packages/db/recuperacion/entrar.mjs`. */
function preguntar(texto: string): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!process.stdin.isTTY) {
      reject(
        new Error(
          'Hace falta la clave y no hay teclado disponible.\n' +
            'Corré el worker desde una terminal, o pasá PB_PASS por variable de entorno.',
        ),
      );
      return;
    }
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    const escribir = (rl as unknown as { _writeToOutput?: (s: string) => void })._writeToOutput?.bind(rl);
    (rl as unknown as { _writeToOutput: (s: string) => void })._writeToOutput = (s: string) =>
      escribir?.(s.includes(texto) ? s : '');
    rl.question(texto, (v) => {
      rl.close();
      process.stdout.write('\n');
      resolve(v.trim());
    });
  });
}

export async function entrar(): Promise<PocketBase> {
  // El usuario de demo YA NO EXISTE. `alberto@globalita.test` / `demo12345`
  // eran del seed, y el seed se limpió: hoy la base local tiene una sola
  // cuenta, la de Augusto. Se dejan como último recurso —por si alguien
  // levanta una base nueva con el seed puesto— pero lo normal es que fallen, y
  // por eso el error de abajo dice qué hacer en vez de sólo «credenciales
  // inválidas», que es lo que decía y no ayudaba a nadie.
  const usuario = process.env.PB_USER || (LOCAL ? 'alberto@globalita.test' : await preguntar(`Usuario de ${PB_URL}: `));
  const clave = process.env.PB_PASS || (LOCAL ? 'demo12345' : await preguntar('Clave: '));

  const pb = new PocketBase(PB_URL);
  pb.autoCancellation(false);
  try {
    await pb.collection(PB_COL).authWithPassword(usuario, clave);
  } catch (e) {
    const err = e as { status?: number; message?: string };
    const detalle = err?.status === 400 ? 'usuario o clave incorrectos' : err?.message || String(e);
    if (err?.status === 400 && LOCAL && !process.env.PB_USER) {
      throw new Error(
        `No se pudo entrar a ${PB_URL} como ${usuario}: ${detalle}.\n\n` +
          'Ese es el usuario del seed de demo, y la base local ya no lo tiene.\n' +
          'Pasá el tuyo por variable de entorno. En PowerShell:\n\n' +
          '    $env:PB_USER = "tu-correo@ejemplo.com"\n' +
          '    $env:PB_PASS = "tu clave"\n' +
          '    node apps/worker/src/vincular.ts AL\n\n' +
          'Es la MISMA cuenta con la que entrás al CRM en localhost:5173,\n' +
          'no la del panel de PocketBase (esa es otra, va contra _superusers).',
      );
    }
    throw new Error(`No se pudo entrar a ${PB_URL} como ${usuario}: ${detalle}`);
  }
  return pb;
}

export interface EstadoDeLaBase {
  cuentas: (CuentaQueInvita & { slot?: number })[];
  listasPorCuenta: Map<string, ListaInvitacion[]>;
  /** Cuántas invitaciones ya salieron hoy, por cuenta. */
  enviadasHoy: Map<string, number>;
  config: ConfigInvitar;
  pausado: boolean;
  /** El id de la fila de `configuracion` con clave `automatizacion`, para poder pausarla. */
  idAutomatizacion: string | null;
}

const hoyISO = () => new Date().toISOString().slice(0, 10);

/**
 * Todo lo que hace falta para decidir, en una sola lectura.
 *
 * Se lee TODO junto y de una vez a propósito: si el cupo se leyera al arrancar y
 * el ritmo en la mitad de la corrida, dos lecturas podrían contradecirse y
 * nadie se enteraría. Una foto, una decisión.
 */
export async function leerEstado(pb: PocketBase): Promise<EstadoDeLaBase> {
  const [cuentas, listas, config] = await Promise.all([
    pb.collection('cuenta').getFullList<CuentaQueInvita & { slot?: number }>({ sort: 'slot' }),
    pb.collection('lista_invitacion').getFullList<ListaInvitacion>({ sort: 'orden' }),
    pb.collection('configuracion').getFullList<{ id: string; clave: string; valor: unknown }>(),
  ]);

  const listasPorCuenta = new Map<string, ListaInvitacion[]>();
  for (const l of listas) listasPorCuenta.set(l.cuenta, [...(listasPorCuenta.get(l.cuenta) ?? []), l]);

  // Lo que salió hoy son los envíos R0 de hoy, no un contador aparte. Un
  // contador aparte es lo que en el repositorio viejo se desincronizaba con la
  // realidad cada vez que un proceso moría a la mitad.
  const desde = `${hoyISO()} 00:00:00`;
  const envios = await pb.collection('envio').getFullList<{ lead: string; expand?: { lead?: { cuenta?: string } } }>({
    filter: `paso = "R0" && canal = "linkedin" && enviado_en >= "${desde}"`,
    expand: 'lead',
  });
  const enviadasHoy = new Map<string, number>();
  for (const e of envios) {
    const cuenta = e.expand?.lead?.cuenta;
    if (cuenta) enviadasHoy.set(cuenta, (enviadasHoy.get(cuenta) ?? 0) + 1);
  }

  const porClave = new Map(config.map((c) => [c.clave, c]));
  const fila = porClave.get('invitaciones');
  // Si la fila todavía no está sembrada se usan los valores iniciales de core,
  // pero se avisa: una corrida con valores que nadie configuró tiene que
  // notarse, no pasar de largo.
  if (!fila) {
    console.warn(
      '[base] No hay configuración `invitaciones` en la base: se usan los valores iniciales de core.\n' +
        '       Corré las migraciones (`npm run db:dev`) para que se pueda editar desde la pantalla.',
    );
  }
  const guardado = (fila?.valor ?? {}) as Partial<ConfigInvitar>;

  return {
    cuentas,
    listasPorCuenta,
    enviadasHoy,
    // Se completa contra los iniciales: una configuración a la que le falta un
    // campo no puede dejar el ritmo en `undefined`, que en una multiplicación
    // da `NaN` y en una espera da cero.
    config: { ...CONFIG_INVITAR_INICIAL, ...guardado },
    pausado: Boolean((porClave.get('automatizacion')?.valor as { pausado?: boolean })?.pausado),
    idAutomatizacion: porClave.get('automatizacion')?.id ?? null,
  };
}

/**
 * La señal de vida de la sesión (§8.1, `core/sesion.ts`).
 *
 * Se llama cada vez que LinkedIn contesta. **Nadie escribía esto**, y por eso
 * las siete cuentas figuraban «sin vincular» en Cuentas conectadas aunque la
 * sesión estuviera abierta: el estado se deduce de esta fecha y la fecha no
 * existía.
 *
 * Nunca tira: si la señal no se puede escribir, la corrida sigue. Es un dato de
 * estado, no el trabajo. Lo que sí hace es avisar, para que no se descubra
 * dentro de dos semanas mirando una pantalla que dice «sin vincular».
 */
export async function senalDeVida(pb: PocketBase, cuentaId: string): Promise<void> {
  try {
    await pb.collection('cuenta').update(cuentaId, { ultima_senal_li: new Date().toISOString() });
  } catch (e) {
    console.warn('[base] no se pudo escribir la señal de la sesión: ' + (e as Error).message);
  }
}

export interface PerfilInvitado {
  /** El nombre tal como lo muestra LinkedIn, completo (§10.9). */
  nombre: string;
  /** La URL del perfil público, si se pudo sacar. */
  url?: string;
  /** La URL de Sales Navigator (`/lead/…`), de donde sale el `urn`. */
  url_sales?: string;
  cargo?: string;
  empresa?: string;
  /** La lista de la que salió, y en qué página. */
  lista: string;
  pagina: number;
}

/**
 * Anotar una invitación que ya salió.
 *
 * Son tres escrituras y ninguna se puede saltear:
 *
 * - `perfil` — la persona. Se busca antes de crear, con las tres identidades de
 *   D02 (slug, urn, huella) resueltas por `core/dedupe.ts`. Una persona = una
 *   fila, aunque la invite otra cuenta.
 * - `lead` — la relación de ESA cuenta con esa persona, con `f_invitacion`.
 * - `envio` — R0 por LinkedIn. Es la base de toda la analítica (§3.2) y lo que
 *   hace que la tasa de aceptación de §5.5 exista.
 *
 * Devuelve el id del lead. Si ya había un lead invitado para esa cuenta y esa
 * persona, **no vuelve a invitar**: devuelve `null` y quien llama lo saltea. Sin
 * eso, una corrida que se repite le manda dos solicitudes a la misma persona.
 */
export async function anotarInvitacion(
  pb: PocketBase,
  cuentaId: string,
  p: PerfilInvitado,
): Promise<string | null> {
  const id = identidad({ url: p.url, url_sales: p.url_sales, nombre: p.nombre, empresa: p.empresa });

  // Los candidatos: sólo los que comparten alguna identidad, no la tabla entera.
  const partes = [
    id.slug && `slug = "${id.slug}"`,
    id.urn && `urn = "${id.urn}"`,
    id.huella && `huella = "${id.huella}"`,
  ].filter(Boolean);
  const conocidos = partes.length
    ? await pb
        .collection('perfil')
        .getFullList<{ id: string; slug: string; urn: string; huella: string }>({ filter: partes.join(' || ') })
    : [];

  const veredicto = decidirAlta(id, conocidos);

  let perfilId: string;
  if (veredicto.accion === 'mismo') {
    perfilId = veredicto.perfil_id;
    // Completar lo que faltaba, sin pisar lo que ya estaba: el scan de hoy
    // puede traer el `urn` que el CSV de ayer no tenía.
    const completar = Object.fromEntries(
      Object.entries(veredicto.completar).filter(([, v]) => String(v ?? '').trim()),
    );
    if (Object.keys(completar).length) await pb.collection('perfil').update(perfilId, completar);
  } else {
    // `nuevo_posible_duplicado` también entra como nuevo: la fusión la decide
    // una persona desde la pantalla de Duplicados, no un proceso a las tres de
    // la tarde. Lo que sí se hace es dejarlo dicho.
    if (veredicto.accion === 'nuevo_posible_duplicado') {
      console.warn(`[base] «${nombreDePersona(p.nombre)}» se parece a ${veredicto.candidatos.length} perfil(es) ya cargados: entra igual y queda para Duplicados.`);
    }
    const creado = await pb.collection('perfil').create<{ id: string }>({
      slug: id.slug || slugDeLinkedIn(p.url ?? ''),
      urn: id.urn,
      huella: id.huella,
      nombre: p.nombre,
      cargo: p.cargo ?? '',
      empresa: p.empresa ?? '',
    });
    perfilId = creado.id;
  }

  // ¿Ya existe el lead de esta cuenta con esta persona? El índice único
  // `idx_lead_perfil_cuenta` lo garantiza del lado de la base; acá se pregunta
  // antes para no mandar una segunda solicitud a alguien que ya la tiene.
  const existente = await pb
    .collection('lead')
    .getFirstListItem<{ id: string; f_invitacion?: string }>(`perfil = "${perfilId}" && cuenta = "${cuentaId}"`)
    .catch(() => null);

  if (existente?.f_invitacion) return null;

  const ahora = new Date().toISOString();
  const lead = existente
    ? await pb.collection('lead').update<{ id: string }>(existente.id, {
        f_invitacion: ahora,
        lista: p.lista,
        pagina_origen: p.pagina,
      })
    : await pb.collection('lead').create<{ id: string }>({
        perfil: perfilId,
        cuenta: cuentaId,
        situacion: 'en_curso',
        etapa: 'R0',
        f_invitacion: ahora,
        lista: p.lista,
        pagina_origen: p.pagina,
      });

  await pb.collection('envio').create({
    lead: lead.id,
    paso: 'R0',
    enviado_en: ahora,
    canal: 'linkedin',
    a_mano: false,
  });

  return lead.id;
}

/** Hasta dónde llegó el script en la lista (§3.4). Es el único que mueve esto. */
export async function guardarPagina(pb: PocketBase, listaId: string, pagina: number): Promise<void> {
  await pb.collection('lista_invitacion').update(listaId, { pagina });
}

/**
 * Escribir el freno que decidió core cuando LinkedIn avisó.
 *
 * La pausa general es la MISMA de §7.3, la que se ve en Automatizaciones. Un
 * freno de emergencia invisible es un freno que alguien levanta sin enterarse
 * de por qué estaba puesto.
 */
export async function anotarFreno(
  pb: PocketBase,
  estado: EstadoDeLaBase,
  cuentaId: string,
  freno: { cooldown_hasta: string; pausa_general: boolean; motivo: string },
): Promise<void> {
  await pb.collection('cuenta').update(cuentaId, { cooldown_hasta: freno.cooldown_hasta });
  if (freno.pausa_general && estado.idAutomatizacion) {
    await pb.collection('configuracion').update(estado.idAutomatizacion, {
      valor: { pausado: true, motivo: freno.motivo, desde: new Date().toISOString() },
    });
  }
}
