// La corrida de invitaciones: a quién le toca, a qué ritmo, y cuándo frenar
// (§5.3 «Cupos y ventana de envío», §8.1 «LinkedIn», §13.6).
//
// POR QUÉ ESTE ARCHIVO EXISTE APARTE DE `invitacion.ts`.
//
// `invitacion.ts` contesta la pregunta del PANEL: qué listas tiene cada cuenta,
// cuánto material queda, cuántas acciones salen hoy. Es planificación: se
// calcula una vez y se dibuja.
//
// Esto contesta la pregunta del PROCESO, que es otra y se hace cada pocos
// segundos: ¿puedo mandar una más ahora?, ¿cuánto espero?, ¿me toca pausa?,
// ¿reinicio el navegador?, ¿ya llegué al tope? Son las decisiones que en el
// repositorio viejo (`globalita-automation/invitar-agent.js`) estaban escritas
// como constantes adentro del script, repartidas entre tres archivos.
//
// Lo que NO se repite: `laQueTrabaja`, `restantes` y `estadoDeSesion` se
// importan. La familia 7 del registro de errores —la misma cosa en dos
// lugares— va por cinco incidentes, y «el cupo de la cuenta manda» calculado
// dos veces sería el sexto.
//
// LO QUE HAY DETRÁS DE CADA NÚMERO. El 12/05/2026 LinkedIn le mandó a Francisco
// un aviso explícito de automatización: *«Hemos detectado actividad en tu
// cuenta que indica que podrías estar usando una herramienta de
// automatización»*. Las causas confirmadas fueron cuatro instancias del mismo
// orquestador corriendo a la vez, seis procesos de navegador en paralelo sobre
// dos cuentas, y ningún freno automático después de los avisos anteriores. Los
// ritmos de acá salen de la respuesta a ese incidente. Que sean configurables
// no los hace opinables: son el piso, no el punto de partida de una
// negociación.

import { estadoDeSesion } from './sesion.ts';
import { laQueTrabaja, restantes, type CuentaInvitacion, type ListaInvitacion } from './invitacion.ts';

/**
 * La cuenta, con lo que hace falta para OPERARLA además de para mostrarla.
 *
 * `chrome_perfil` es la carpeta de Chrome donde vive la sesión de esa cuenta
 * («Default», «Profile 1»…). Sin eso el proceso abriría un navegador limpio,
 * que no está logueado, o —peor— el perfil de otra cuenta: en LinkedIn eso deja
 * rastro. Vacío no es un detalle a completar después, es un impedimento.
 *
 * `cooldown_hasta` es hasta cuándo esta cuenta quedó frenada por un aviso de
 * LinkedIn. Se escribe solo (ver `frenoPorAviso`) y no se levanta a mano: el
 * indicador interno de LinkedIn sigue activo aunque la cuenta «parezca» que
 * volvió.
 */
export interface CuentaQueInvita extends CuentaInvitacion {
  chrome_perfil?: string | null;
  cooldown_hasta?: string | null;
}

/**
 * El aviso que puede llegar de LinkedIn, de menos a más grave.
 *
 * No son cuatro nombres para lo mismo: cambian cuántas horas dura el freno y si
 * además hay que parar TODO. Un captcha es molesto; «cuenta restringida» es una
 * cuenta que puede no volver.
 */
export type AvisoDeLinkedIn = 'captcha' | 'actividad_inusual' | 'automatizacion' | 'restringida';

/**
 * Los números de la corrida. Todos entran por argumento (regla 2 del
 * CLAUDE.md): en el repositorio viejo eran `const` adentro de tres archivos
 * distintos y subir un cupo obligaba a un commit.
 *
 * Los tiempos van en SEGUNDOS y no en milisegundos a propósito: son valores que
 * una persona edita en una pantalla, y «90» se lee y se corrige; «90000» se
 * escribe mal una vez cada tanto y nadie lo nota hasta que el proceso duerme un
 * día entero.
 */
export interface ConfigInvitar {
  /** Entre una invitación y la siguiente. Nunca menos de un segundo. */
  espera_min_s: number;
  espera_max_s: number;
  /** Pausa media: un descanso corto cada tanto. */
  pausa_media_cada: number;
  pausa_media_min_s: number;
  pausa_media_max_s: number;
  /** Pausa larga: más profunda, para cortar el patrón de un bucle sostenido. */
  pausa_larga_cada: number;
  pausa_larga_min_s: number;
  pausa_larga_max_s: number;
  /** Cerrar y volver a abrir el navegador cada N: limpia la huella acumulada. */
  reset_navegador_cada: number;
  /** Cada cuántas invitaciones mirar si hay señales de pre-bloqueo. */
  pre_bloqueo_cada: number;
  /** Tope duro por corrida. Para seguir, se vuelve a correr el proceso. */
  tope_por_corrida: number;
  /** Antes de la primera invitación: abrir el navegador y no hacer nada. */
  warmup_min_s: number;
  warmup_max_s: number;
  /** Franja horaria en la que se puede operar. Hora local, `hasta` excluida. */
  hora_desde: number;
  hora_hasta: number;
  /** Cuántas horas dura el freno de cada aviso. */
  horas_de_freno: Record<AvisoDeLinkedIn, number>;
}

/**
 * Los valores con los que arranca la configuración, para sembrarla la primera
 * vez. **No los lee ninguna función de este archivo**: todas reciben la config
 * por argumento. Están acá y no en la base para que se puedan leer al lado de
 * la explicación de por qué son estos.
 *
 * Salen de `globalita-automation`, donde estuvieron en producción: 40 perfiles
 * por reinicio de navegador, pausa media cada 30, larga cada 50, tope de 250
 * por corrida, y la franja 08:00–22:00. El único que cambia es el tope por
 * corrida, que baja a 40 para que coincida con el cupo diario por cuenta del
 * §5.3 — el repositorio viejo no tenía cupo diario y por eso su tope hacía de
 * las dos cosas.
 */
export const CONFIG_INVITAR_INICIAL: ConfigInvitar = {
  espera_min_s: 3,
  espera_max_s: 9,
  pausa_media_cada: 30,
  pausa_media_min_s: 90,
  pausa_media_max_s: 180,
  pausa_larga_cada: 50,
  pausa_larga_min_s: 180,
  pausa_larga_max_s: 300,
  reset_navegador_cada: 40,
  pre_bloqueo_cada: 10,
  tope_por_corrida: 40,
  warmup_min_s: 10,
  warmup_max_s: 20,
  hora_desde: 8,
  hora_hasta: 22,
  horas_de_freno: {
    captcha: 24,
    actividad_inusual: 24,
    automatizacion: 72,
    restringida: 168,
  },
};

// ---------------------------------------------------------------------------
// Si la cuenta puede operar
// ---------------------------------------------------------------------------

/**
 * Por qué una cuenta no está invitando ahora mismo.
 *
 * Son motivos distintos y no da lo mismo cuál: `pausa_general` la apagó alguien
 * a propósito, `cooldown` la apagó LinkedIn, `sin_vincular` nunca estuvo
 * conectada y `sesion_caida` sí lo estuvo y se cayó. Lo que hay que hacer es
 * distinto en cada caso, y una pantalla que los junta en «no está andando»
 * obliga a ir a averiguar cuál era.
 */
export type Freno =
  | 'pausa_general'
  | 'cooldown'
  | 'fuera_de_horario'
  | 'sin_vincular'
  | 'sesion_caida'
  | 'sin_chrome'
  | 'cupo_cumplido'
  | 'sin_material';

export interface Impedimento {
  freno: Freno;
  /** Una línea para mostrar tal cual. */
  detalle: string;
}

/** El orden en que se evalúan los frenos, y por qué ese orden. */
const ORDEN_DE_FRENOS: readonly Freno[] = [
  // Primero los que no se discuten y valen para todas las cuentas: si alguien
  // apretó la pausa o LinkedIn frenó la cuenta, nada más importa.
  'pausa_general',
  'cooldown',
  'fuera_de_horario',
  // Después los de la sesión: sin sesión viva no hay nada que intentar.
  'sin_vincular',
  'sesion_caida',
  'sin_chrome',
  // Y al final los del trabajo: la cuenta puede, pero no le queda nada.
  'cupo_cumplido',
  'sin_material',
];

function horaLocal(ahora: Date): number {
  return ahora.getHours();
}

/**
 * Si la hora cae fuera de la franja. `hasta` es excluida: con 8 y 22, las 22:00
 * ya está afuera.
 *
 * Contempla la franja que cruza la medianoche (por ejemplo 20 a 4) devolviendo
 * lo contrario, aunque hoy nadie la configure así: es una línea y evita que
 * quien la ponga por error opere las veinticuatro horas sin darse cuenta.
 */
export function fueraDeHorario(ahora: Date, config: ConfigInvitar): boolean {
  const h = horaLocal(ahora);
  const { hora_desde: desde, hora_hasta: hasta } = config;
  if (desde === hasta) return true; // franja vacía: no se opera nunca
  if (desde < hasta) return h < desde || h >= hasta;
  return h < desde && h >= hasta;
}

/** Si el freno automático de la cuenta sigue vigente. */
export function enCooldown(cuenta: CuentaQueInvita, ahora: Date = new Date()): boolean {
  const texto = String(cuenta.cooldown_hasta ?? '').trim();
  if (!texto) return false;
  const hasta = new Date(texto.replace(' ', 'T')).getTime();
  // Una fecha ilegible no levanta el freno. Es el mismo criterio que
  // `estadoDeSesion`: ante la duda, la opción cara es dejar operar.
  if (!Number.isFinite(hasta)) return true;
  return hasta > ahora.getTime();
}

/**
 * El primer impedimento que tiene la cuenta, o `null` si puede invitar.
 *
 * Devuelve UNO y no la lista entera porque la pregunta que contesta es
 * «¿arranco?», y para eso alcanza el primero. Cuál es el primero lo fija
 * `ORDEN_DE_FRENOS`, que no es alfabético: va de lo que no se discute a lo que
 * se resuelve solo.
 */
export function porQueNoInvita(
  cuenta: CuentaQueInvita,
  listas: ListaInvitacion[],
  enviadasHoy: number,
  config: ConfigInvitar,
  pausado: boolean,
  ahora: Date = new Date(),
): Impedimento | null {
  const sesion = estadoDeSesion(cuenta.ultima_senal_li, ahora);
  const lista = laQueTrabaja(listas);
  const cupo = Math.max(0, (cuenta.cupo_diario ?? 0) - Math.max(0, enviadasHoy));

  const detalles: Partial<Record<Freno, string>> = {
    pausa_general: pausado ? 'La automatización está en pausa.' : undefined,
    cooldown: enCooldown(cuenta, ahora)
      ? `Frenada por un aviso de LinkedIn hasta ${String(cuenta.cooldown_hasta).slice(0, 16)}.`
      : undefined,
    fuera_de_horario: fueraDeHorario(ahora, config)
      ? `Fuera de la franja ${config.hora_desde}:00–${config.hora_hasta}:00.`
      : undefined,
    sin_vincular:
      sesion === 'sin_vincular' ? 'La sesión de LinkedIn nunca dio señal.' : undefined,
    sesion_caida: sesion === 'caida' ? 'La sesión de LinkedIn se cayó.' : undefined,
    sin_chrome: !String(cuenta.chrome_perfil ?? '').trim()
      ? 'No está cargado con qué perfil de Chrome se abre esta cuenta.'
      : undefined,
    cupo_cumplido:
      cupo === 0 ? `Ya salieron las ${cuenta.cupo_diario ?? 0} invitaciones del día.` : undefined,
    sin_material: !lista ? 'Ninguna lista de la cuenta tiene páginas.' : undefined,
  };

  for (const freno of ORDEN_DE_FRENOS) {
    const detalle = detalles[freno];
    if (detalle) return { freno, detalle };
  }
  return null;
}

// ---------------------------------------------------------------------------
// A quién le toca
// ---------------------------------------------------------------------------

export interface Turno {
  /** El id de la cuenta, para volver a la base. */
  cuenta: string;
  abrev: string;
  /** La lista que le toca trabajar, o `null` si no le toca ninguna. */
  lista: ListaInvitacion | null;
  /** Cuántas invitaciones puede mandar ahora. 0 si hay impedimento. */
  cuantas: number;
  impedimento: Impedimento | null;
}

/**
 * El turno de cada cuenta, EN EL ORDEN EN QUE VIENEN.
 *
 * El orden lo elige quien llama (hoy, por slot) y se respeta: las cuentas se
 * trabajan **de a una**. No es una preferencia de estilo — seis procesos de
 * navegador en paralelo sobre dos cuentas es la causa confirmada del aviso del
 * 12/05/2026, y §13.6 ya dice que hay un planificador por cuenta y no tres
 * colas independientes.
 *
 * Devuelve TODAS las cuentas, también las frenadas, con su motivo. Una lista
 * que sólo trae las que pueden trabajar contesta «éstas van a salir» y deja sin
 * contestar la única pregunta que se hace cuando algo no sale: por qué.
 */
export function turnoDeInvitaciones(
  cuentas: CuentaQueInvita[],
  listasPorCuenta: Map<string, ListaInvitacion[]>,
  enviadasHoy: Map<string, number>,
  config: ConfigInvitar,
  pausado: boolean,
  ahora: Date = new Date(),
): Turno[] {
  return cuentas.map((c) => {
    const listas = listasPorCuenta.get(c.id) ?? [];
    const hechas = enviadasHoy.get(c.id) ?? 0;
    const impedimento = porQueNoInvita(c, listas, hechas, config, pausado, ahora);
    const lista = laQueTrabaja(listas);

    if (impedimento) {
      return { cuenta: c.id, abrev: c.abrev, lista, cuantas: 0, impedimento };
    }

    // El cupo diario de la cuenta manda (§5.3), pero no puede prometer más de
    // lo que hay en la lista ni más de lo que entra en una corrida.
    const cuantas = Math.min(
      Math.max(0, (c.cupo_diario ?? 0) - hechas),
      lista ? restantes(lista) : 0,
      Math.max(0, config.tope_por_corrida),
    );

    return { cuenta: c.id, abrev: c.abrev, lista, cuantas, impedimento: null };
  });
}

/**
 * A quién le toca la invitación AHORA: el primer turno con trabajo.
 *
 * `null` = no le toca a nadie. Que sea uno solo es el punto: el proceso toma
 * este y no mira los demás hasta terminar.
 */
export function aQuienLeToca(turnos: Turno[]): Turno | null {
  return turnos.find((t) => t.cuantas > 0 && t.lista) ?? null;
}

// ---------------------------------------------------------------------------
// El ritmo
// ---------------------------------------------------------------------------

/**
 * Los tres sorteos de una vuelta, cada uno entre 0 y 1.
 *
 * El azar entra por argumento y no se sortea acá adentro: una función que
 * llama a `Math.random()` no se puede testear, y estos son justo los números
 * que hay que poder probar en los bordes. Quien llama sortea; acá se decide.
 */
export interface Azar {
  /** Dónde cae la espera dentro de su rango. */
  espera: number;
  /** Dónde caen las pausas dentro del suyo. */
  pausa: number;
  /** Dónde cae el factor de latencia dentro de su banda. */
  latencia: number;
}

/** El azar del medio: sirve para leer un test sin hacer cuentas. */
export const AZAR_MEDIO: Azar = { espera: 0.5, pausa: 0.5, latencia: 0.5 };

function entre(min: number, max: number, azar: number): number {
  const a = Math.min(min, max);
  const b = Math.max(min, max);
  const t = Math.min(1, Math.max(0, azar));
  return a + (b - a) * t;
}

export type Pausa = { tipo: 'media' | 'larga'; ms: number };

export interface Ritmo {
  /** Se llegó al tope de la corrida: no hay que mandar ninguna más. */
  cortar: boolean;
  /** Cuánto esperar antes de la siguiente, ya con el factor de latencia. */
  esperaMs: number;
  /** Las pausas que caen en este número. Pueden ser dos. */
  pausas: Pausa[];
  /** Toca cerrar y volver a abrir el navegador. */
  resetNavegador: boolean;
  /** Toca mirar si hay señales de pre-bloqueo antes de seguir. */
  mirarPreBloqueo: boolean;
}

/**
 * Cuánto más lenta o más rápida tiene que ir la corrida según cómo esté
 * respondiendo LinkedIn.
 *
 * La intuición es al revés de lo que parece: **que LinkedIn conteste muy
 * rápido es mala señal**. Una sesión que navega a media pantalla por segundo no
 * se parece a una persona, y la latencia baja suele ser una respuesta servida
 * de caché a un cliente que ya está marcado. Cuando contesta lento, en cambio,
 * el ritmo humano ya es lento por sí solo y no hace falta agregarle.
 *
 * Y cuando contesta MUY lento hay que frenar mucho: eso no es la red, es
 * estrangulamiento, y es la señal que precede al bloqueo.
 *
 * Sin muestras devuelve 1: no se inventa una corrección con un dato que no hay.
 */
export function factorDeEspera(latenciaMediaMs: number | null | undefined, azar: number): number {
  const ms = Number(latenciaMediaMs);
  if (!Number.isFinite(ms) || ms <= 0) return 1;
  if (ms < 500) return entre(1.5, 2.0, azar); // sospechosamente rápido
  if (ms < 2000) return 1; // normal
  if (ms < 4000) return entre(0.75, 0.85, azar); // lento natural: se aprovecha
  return entre(2.0, 3.0, azar); // posible estrangulamiento
}

/**
 * Qué hacer después de haber mandado `hechas` invitaciones en esta corrida.
 *
 * `hechas` es el CONTADOR DE LA CORRIDA, no el del día: el tope, el reinicio de
 * navegador y las pausas son medidas contra el bucle sostenido de un proceso, y
 * un proceso que arranca de cero arranca de cero.
 *
 * Las dos pausas pueden caer juntas —a las 150, con 30 y 50— y en ese caso
 * salen las dos. El repositorio viejo hacía exactamente eso, y hacerlo más
 * corto acá sería aflojar una medida anti-detección sin ninguna razón nueva.
 */
export function ritmoDespuesDe(
  hechas: number,
  config: ConfigInvitar,
  azar: Azar = AZAR_MEDIO,
  latenciaMediaMs: number | null = null,
): Ritmo {
  const n = Math.max(0, Math.floor(hechas));

  // El tope se mira PRIMERO y devuelve todo apagado: si hay que cortar, no
  // tiene sentido decir cuánto esperar para la siguiente.
  if (config.tope_por_corrida > 0 && n >= config.tope_por_corrida) {
    return { cortar: true, esperaMs: 0, pausas: [], resetNavegador: false, mirarPreBloqueo: false };
  }

  const factor = factorDeEspera(latenciaMediaMs, azar.latencia);
  const esperaMs = Math.round(entre(config.espera_min_s, config.espera_max_s, azar.espera) * 1000 * factor);

  const pausas: Pausa[] = [];
  const cae = (cada: number) => cada > 0 && n > 0 && n % cada === 0;
  if (cae(config.pausa_media_cada)) {
    pausas.push({ tipo: 'media', ms: Math.round(entre(config.pausa_media_min_s, config.pausa_media_max_s, azar.pausa) * 1000) });
  }
  if (cae(config.pausa_larga_cada)) {
    pausas.push({ tipo: 'larga', ms: Math.round(entre(config.pausa_larga_min_s, config.pausa_larga_max_s, azar.pausa) * 1000) });
  }

  return {
    cortar: false,
    esperaMs,
    pausas,
    resetNavegador: cae(config.reset_navegador_cada),
    mirarPreBloqueo: cae(config.pre_bloqueo_cada),
  };
}

/**
 * Cuánto esperar entre abrir el navegador y la primera invitación.
 *
 * Un navegador que se abre y a los dos segundos manda una solicitud es la firma
 * más barata de detectar que existe. Una persona abre, mira, y recién ahí hace
 * algo.
 */
export function esperaDeArranqueMs(config: ConfigInvitar, azar: Azar = AZAR_MEDIO): number {
  return Math.round(entre(config.warmup_min_s, config.warmup_max_s, azar.espera) * 1000);
}

// ---------------------------------------------------------------------------
// Cuando LinkedIn avisa
// ---------------------------------------------------------------------------

export interface FrenoPorAviso {
  /** Hasta cuándo queda frenada la cuenta, en ISO. */
  cooldown_hasta: string;
  /** Si además hay que dejar TODO en pausa, no sólo esta cuenta. */
  pausa_general: boolean;
  /** Para escribir en el registro y mostrar en pantalla. */
  motivo: string;
}

/**
 * Qué hay que escribir cuando LinkedIn avisa.
 *
 * Devuelve el dato, no lo guarda: quién lo guarda es el proceso. Es lo que
 * permite testear la regla —72 horas por automatización, una semana por cuenta
 * restringida— sin base de datos.
 *
 * **Los dos avisos graves paran todo, no sólo la cuenta avisada.** Las cuentas
 * vecinas salen de la misma IP: si LinkedIn marcó una, las otras ya están
 * miradas. El 12/05 se frenó una sola y el aviso llegó igual.
 *
 * La pausa general es la MISMA de §7.3, la que se ve en pantalla, y no un
 * interruptor aparte. Un freno de emergencia que no se ve en ningún lado es un
 * freno que alguien va a levantar sin enterarse de por qué estaba puesto.
 */
export function frenoPorAviso(
  aviso: AvisoDeLinkedIn,
  config: ConfigInvitar,
  abrev: string,
  ahora: Date = new Date(),
): FrenoPorAviso {
  const horas = config.horas_de_freno[aviso] ?? 48;
  const grave = aviso === 'automatizacion' || aviso === 'restringida';
  return {
    cooldown_hasta: new Date(ahora.getTime() + horas * 3600_000).toISOString(),
    pausa_general: grave,
    motivo:
      `${abrev}: LinkedIn avisó «${NOMBRE_AVISO[aviso]}». Frenada ${horas} h` +
      (grave ? ', y la automatización queda en pausa: las cuentas vecinas salen de la misma IP.' : '.'),
  };
}

/** Cómo se lee cada aviso en pantalla. */
export const NOMBRE_AVISO: Record<AvisoDeLinkedIn, string> = {
  captcha: 'verificación de que sos humano',
  actividad_inusual: 'actividad inusual',
  automatizacion: 'uso de una herramienta de automatización',
  restringida: 'cuenta restringida',
};

/** Cómo se lee cada freno en pantalla. */
export const NOMBRE_FRENO: Record<Freno, string> = {
  pausa_general: 'en pausa',
  cooldown: 'frenada por LinkedIn',
  fuera_de_horario: 'fuera de horario',
  sin_vincular: 'sin vincular',
  sesion_caida: 'sesión caída',
  sin_chrome: 'sin Chrome',
  cupo_cumplido: 'cupo cumplido',
  sin_material: 'sin material',
};

// ---------------------------------------------------------------------------
// Lo que se avanzó en la lista
// ---------------------------------------------------------------------------

/**
 * Hasta qué página llegó la lista después de una corrida.
 *
 * `pagina` es dato de la automatización (§3.4): se muestra y no se edita. Esta
 * es la única forma legítima de moverlo, y no puede pasarse de `paginas` — una
 * lista «en la página 41 de 40» se ve como un error de la base y manda a
 * revisar la base, no la corrida.
 */
export function paginaAlTerminar(lista: ListaInvitacion, paginasHechas: number): number {
  const avance = Math.max(0, Math.floor(paginasHechas));
  return Math.min(lista.paginas, lista.pagina + avance);
}
