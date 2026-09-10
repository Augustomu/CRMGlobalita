/**
 * Comprobar que la sesión de LinkedIn de una cuenta está viva (§8.1).
 *
 *   node apps/worker/src/vincular.ts <ABREV>
 *   node apps/worker/src/vincular.ts <ABREV> --simular   # no abre nada
 *
 * ─────────────────────────────────────────────────────────────────────────
 * POR QUÉ EXISTE: SIN ESTO, INVITAR NO PUEDE ARRANCAR NUNCA.
 *
 * `porQueNoInvita()` frena la corrida cuando la sesión está `sin_vincular`, y
 * eso está bien: mandar invitaciones con una sesión que nadie verificó es la
 * forma de descubrir que estaba caída dos horas después.
 *
 * Pero `sin_vincular` significa «`ultima_senal_li` está vacío», y esa fecha la
 * escribe el worker cuando LinkedIn le contesta… dentro de la corrida que el
 * freno no deja empezar. Círculo cerrado: se comprobó el 10/09 contra la base
 * real y las NUEVE cuentas daban «la sesión de LinkedIn nunca dio señal», con
 * sus listas cargadas y su perfil de Chrome puesto.
 *
 * Esto lo abre. Una navegación, sin invitar a nadie:
 *
 *   1. Abre Chrome con el perfil de esa cuenta.
 *   2. Entra a LinkedIn.
 *   3. Mira si la sesión está iniciada y si LinkedIn tiene algo que decir.
 *   4. Si está viva, escribe la señal. Si no, NO la escribe y dice por qué.
 *
 * NO ES SÓLO UN ARRANQUE. Es la respuesta a «¿mis sesiones están vivas?», que
 * es lo que la pantalla de Cuentas conectadas promete y hasta hoy no podía
 * saber. Se corre cuando uno quiera, y cada vez refresca la señal. Como los 15
 * minutos de `MINUTOS_SIN_SENAL` son cortos, la respuesta que da vale para
 * empezar una corrida ahora, no para toda la tarde — que es exactamente lo que
 * uno quiere de un estado de sesión.
 *
 * QUÉ CHEQUEA Y QUÉ NO. Chequea lo mismo que `invitar` **menos las dos cosas
 * que este comando existe para resolver**: no exige señal previa (es la que va
 * a escribir) ni material en las listas (no va a invitar a nadie). Todo lo
 * demás se respeta, y el orden importa: la concurrencia primero, porque dos
 * navegadores a la vez es la causa confirmada del aviso del 12/05/2026.
 */
import {
  enCooldown,
  fueraDeHorario,
  frenoPorAviso,
  type CuentaQueInvita,
} from '@crm/core/invitar';
import { MINUTOS_SIN_SENAL } from '@crm/core/sesion';
import { entrar, leerEstado, senalDeVida, anotarFreno } from './base.ts';
import { abrirChrome, irA, dormir } from './navegador.ts';
import { NoSePuede, otrosProcesos } from './seguridad.ts';
import { avisoDeLinkedIn } from './salesnav.ts';

const decir = (m: string) => console.log(m);

/** Dónde entra: el feed. Redirige al login si la sesión no está iniciada. */
const FEED = 'https://www.linkedin.com/feed/';

/**
 * ¿La sesión está iniciada?
 *
 * Se mira LA URL DONDE TERMINÓ y no el contenido de la página. LinkedIn manda
 * a `/login`, `/uas/login` o `/checkpoint` cuando no hay sesión, y eso es
 * estable; buscar un texto o un selector del feed es apostar a un DOM que
 * cambia sin aviso, y equivocarse acá tiene dos costos distintos: decir «viva»
 * cuando está caída deja arrancar una corrida que va a fallar de entrada.
 *
 * Ante la duda, se responde que NO está iniciada. Es el error barato.
 */
function laSesionEstaIniciada(url: string): boolean {
  const u = url.toLowerCase();
  if (u.includes('/login') || u.includes('/uas/') || u.includes('/checkpoint')) return false;
  if (u.includes('/authwall') || u.includes('signup')) return false;
  return u.includes('linkedin.com');
}

async function correr(): Promise<number> {
  const args = process.argv.slice(2);
  const simular = args.includes('--simular');
  const abrev = args.find((a) => !a.startsWith('--'))?.toUpperCase();

  if (!abrev) {
    console.error('Falta la cuenta: node apps/worker/src/vincular.ts <ABREV> [--simular]');
    return 2;
  }

  // La concurrencia se chequea ANTES de tocar la base: es lo único que no
  // depende de nada y lo que más caro sale ignorar.
  const otros = otrosProcesos();
  if (otros.length > 0) {
    throw new NoSePuede(
      `Ya hay ${otros.length} proceso(s) del worker corriendo (PID ${otros.map((p) => p.pid).join(', ')}).\n` +
        'Dos sesiones de Playwright a la vez es la causa confirmada del aviso del 12/05/2026.',
    );
  }

  const pb = await entrar();
  const estado = await leerEstado(pb);
  const cuenta = estado.cuentas.find((c) => String(c.abrev).toUpperCase() === abrev);

  if (!cuenta) {
    throw new NoSePuede(
      `No hay ninguna cuenta con abreviatura «${abrev}». Hay: ${estado.cuentas.map((c) => c.abrev).join(', ')}.`,
    );
  }

  const ahora = new Date();

  // Los frenos que SÍ aplican. `sin_vincular` y `sin_material` quedan afuera a
  // propósito: son los dos que este comando existe para poder saltear.
  if (estado.pausado) {
    throw new NoSePuede('La automatización está en pausa. Se saca desde Automatizaciones.');
  }
  if (enCooldown(cuenta as CuentaQueInvita, ahora)) {
    throw new NoSePuede(
      `${abrev} está frenada por un aviso de LinkedIn hasta ${String(cuenta.cooldown_hasta).slice(0, 16)}.\n` +
        'Entrar con esa cuenta ahora es justo lo que el freno evita.',
    );
  }
  if (fueraDeHorario(ahora, estado.config)) {
    throw new NoSePuede(
      `Fuera de la franja ${estado.config.hora_desde}:00–${estado.config.hora_hasta}:00. ` +
        'Una sesión que se abre a las 3 de la mañana no la abre un humano.',
    );
  }
  const perfil = String(cuenta.chrome_perfil ?? '').trim();
  if (!perfil) {
    throw new NoSePuede(
      `${abrev} no tiene cargado con qué perfil de Chrome se abre. Se pone en Automatizaciones.`,
    );
  }

  decir(`${abrev}: perfil de Chrome «${perfil}».`);

  if (simular) {
    decir('--simular: hasta acá llega. No se abrió Chrome ni se tocó la base.');
    return 0;
  }

  decir('Abriendo Chrome… (cerralo antes si lo tenés abierto con ese perfil: bloquea la carpeta)');
  const sesion = await abrirChrome(perfil);

  try {
    // Un rato antes de pedir nada. Abrir el navegador y disparar la primera
    // navegación en el mismo instante no lo hace una persona.
    await dormir(2000 + Math.random() * 3000);

    const tardo = await irA(sesion.pagina, FEED);
    const urlFinal = sesion.pagina.url();

    // El aviso primero: si LinkedIn está diciendo algo, importa más que si la
    // sesión responde. Una cuenta avisada que «anda» es la peor lectura
    // posible — invita a seguir usándola.
    const aviso = await avisoDeLinkedIn(sesion.pagina);
    if (aviso) {
      const freno = frenoPorAviso(aviso, estado.config, abrev, new Date());
      decir('');
      decir(`⚠ LINKEDIN AVISÓ: ${aviso}`);
      decir(`  ${abrev} queda frenada hasta ${freno.cooldown_hasta.slice(0, 16)}.`);
      if (freno.pausa_general) {
        decir('  Y se pausa TODA la automatización: las cuentas comparten IP.');
      }
      decir('  NO se escribió señal de sesión: una cuenta avisada no está «viva» para invitar.');
      await anotarFreno(pb, estado, cuenta.id, freno);
      return 1;
    }

    if (!laSesionEstaIniciada(urlFinal)) {
      decir('');
      decir(`✗ La sesión NO está iniciada. LinkedIn mandó a: ${urlFinal}`);
      decir('  Entrá a mano en ese Chrome, iniciá sesión, y volvé a correr esto.');
      decir('  NO se escribió señal: la pantalla va a seguir diciendo «sin vincular», que es la verdad.');
      return 1;
    }

    await senalDeVida(pb, cuenta.id);
    decir('');
    decir(`✓ ${abrev}: la sesión está viva. LinkedIn contestó en ${tardo} ms.`);
    decir('  Señal escrita. Cuentas conectadas ya lo muestra, y ahora sí puede correr:');
    decir(`     node apps/worker/src/invitar.ts ${abrev} --simular`);
    decir('');
    decir(`  La señal vale ${MINUTOS_SIN_SENAL} minutos (core/sesion.ts). Pasado ese rato la cuenta`);
    decir('  vuelve a figurar caída, que es lo correcto: nadie comprobó nada desde entonces.');
    return 0;
  } finally {
    await sesion.contexto.close().catch(() => {});
  }
}

correr()
  .then((codigo) => process.exit(codigo))
  .catch((e) => {
    if (e instanceof NoSePuede) {
      console.error('\n' + e.message + '\n');
      process.exit(1);
    }
    console.error('\nSe rompió: ' + (e as Error).message + '\n');
    process.exit(3);
  });
