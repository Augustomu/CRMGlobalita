/**
 * La sesión de WhatsApp de una cuenta (§8.2).
 *
 *   node apps/worker/src/whatsapp.ts vincular <ABREV>
 *   node apps/worker/src/whatsapp.ts estado <ABREV>
 *
 * ─────────────────────────────────────────────────────────────────────────
 * QUE HACE Y QUE NO HACE. Vincula el teléfono y mantiene viva la señal. **No
 * manda ni un mensaje**, y eso es a propósito: una sesión que sólo está
 * conectada no se bloquea, así que este es el paso con menos riesgo de todo
 * §8.2 y el que desbloquea lo demás. Enviar es otra corrida y otra decisión.
 *
 * BAILEYS NO ES UNA API OFICIAL. Es un cliente del protocolo de WhatsApp Web.
 * WhatsApp puede bloquear el número, el bloqueo puede ser permanente y no hay
 * soporte al que apelar. Por eso todo lo que decide —si se reconecta, cuánto se
 * espera, cuándo hay que dejar de insistir— vive en `core/whatsapp.ts` con sus
 * tests, y este archivo sólo ejecuta. Insistir contra un rechazo es lo que
 * convierte un bloqueo temporal en uno permanente.
 *
 * LA CREDENCIAL NO VA A LA BASE NI AL REPOSITORIO. Baileys guarda la sesión en
 * archivos; van a una carpeta del home, fuera de todo lo que se respalda. Una
 * sesión de WhatsApp no se respalda: se vuelve a vincular. Copiarla a un lugar
 * versionado es peor que perderla.
 */
import { appendFileSync, mkdirSync, existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import baileys, { Browsers, useMultiFileAuthState, type WASocket } from '@whiskeysockets/baileys';
import { toString as qrEnTexto } from 'qrcode';
import {
  SEGUNDOS_QR_VIGENTE,
  comoSeVeLaSesionWa,
  esElNumeroEsperado,
  esperaDeReintento,
  hayQueDescartarLaCredencial,
  numeroTapado,
  queHacerConLaCaida,
  type SesionWaEnLaBase,
} from '@crm/core/whatsapp';
import { entrar } from './base.ts';
import { NoSePuede } from './seguridad.ts';
import { escuchar } from './entrantes.ts';

/**
 * Todo lo que este proceso dice, también a un archivo.
 *
 * POR QUE. Cuando al worker lo lanza el botón del CRM, nadie está mirando una
 * terminal: PocketBase arranca el proceso y descarta su salida. Si el proceso
 * se muere al arrancar —un token que no sirve, una dependencia que falta, una
 * variable de entorno que no llegó— **desde la pantalla se ve exactamente igual
 * que si el botón no hiciera nada**. Pasó el 11/09 y costó media hora
 * encontrarlo a mano.
 *
 * Se pisa en cada corrida a propósito: lo que importa es POR QUE FALLÓ ESTA
 * VEZ. Un log que crece es un log que nadie abre.
 */
let dondeEscribir: string | null = null;
function abrirElDiario(dir: string): void {
  dondeEscribir = join(dir, 'ultima-corrida.log');
  try {
    writeFileSync(dondeEscribir, `${new Date().toISOString()} · arranca\n`, 'utf8');
  } catch {
    dondeEscribir = null;
  }
}

const decir = (m: string) => {
  console.log(m);
  if (!dondeEscribir) return;
  try {
    appendFileSync(dondeEscribir, m + '\n', 'utf8');
  } catch {
    // Si no se puede escribir el diario, la corrida sigue: es un espejo, no el
    // trabajo. Pero deja de intentarlo, para no repetir el error 300 veces.
    dondeEscribir = null;
  }
};

const dormir = (ms: number) => new Promise((r) => setTimeout(r, Math.max(0, ms)));

/**
 * Dónde vive la credencial. Fuera del repositorio y fuera de `pb_data`.
 *
 * Una carpeta por cuenta: dos sesiones compartiendo credenciales se pisan y se
 * desloguean entre ellas.
 */
function carpetaDeSesion(abrev: string): string {
  const base = process.env.WA_SESION_DIR || join(homedir(), '.globalita-wa');
  const dir = join(base, abrev.toLowerCase());
  mkdirSync(dir, { recursive: true });
  return dir;
}

/**
 * La credencial va en una SUBCARPETA, y el resto de la casa no se toca.
 *
 * POR QUE, y costó una tarde. Cuando la credencial muere hay que borrarla —si
 * no, Baileys falla igual la próxima vez y el síntoma parece de red—. Eso se
 * hacía con un `rmSync` de la carpeta entera, y adentro de esa carpeta vivían
 * también **el turno y el diario**.
 *
 * O sea que justo cuando algo salía mal se borraban las dos cosas que sirven
 * para entender qué pasó y para impedir que arranque un segundo proceso. El
 * 11/09 eso terminó en dos sesiones peleando por la misma credencial,
 * deslogueándose entre ellas en un bucle, con la carpeta vacía y sin una línea
 * de log: exactamente el estado en el que es imposible saber nada.
 *
 * Ahora se borra `cred/` y nada más.
 */
function carpetaDeCredencial(casa: string): string {
  const dir = join(casa, 'cred');
  mkdirSync(dir, { recursive: true });
  return dir;
}

/**
 * Una sola sesión por cuenta, y la que llega segunda se va.
 *
 * POR QUE. Baileys guarda la credencial en archivos. Dos procesos sobre la
 * misma carpeta se pisan los `creds.update` y **se desloguean entre ellos**:
 * queda una sesión muerta, un QR que no aparece y la sospecha de que WhatsApp
 * se rompió. Antes esto no podía pasar porque el comando lo tipeaba una
 * persona; desde el 11/09 lo lanza un botón, y un botón se aprieta dos veces.
 *
 * Es el mismo agujero que en `globalita-automation` dejó cuatro escaneos
 * corriendo a la vez y le costó un aviso de LinkedIn a Francisco el 12/05.
 *
 * EL PID SE COMPRUEBA, no se cree. Un archivo de turno que quedó de un proceso
 * que murió mal bloquearía la cuenta para siempre; `process.kill(pid, 0)` no
 * manda ninguna señal, sólo pregunta si ese proceso existe.
 */
function tomarElTurno(dir: string, abrev: string): void {
  const turno = join(dir, 'turno.pid');

  if (existsSync(turno)) {
    const previo = Number(readFileSync(turno, 'utf8').trim());
    if (Number.isInteger(previo) && previo > 0 && previo !== process.pid) {
      let vivo = true;
      try {
        process.kill(previo, 0);
      } catch {
        vivo = false;
      }
      if (vivo) {
        throw new NoSePuede(
          `Ya hay una sesión de WhatsApp de ${abrev} corriendo (proceso ${previo}).\n` +
            'Dos sesiones sobre la misma credencial se desloguean entre ellas, así que no arranco.\n' +
            'Cortá esa con Ctrl+C, o esperá a que el QR aparezca solo: el que ya está corriendo lo emite.',
        );
      }
      decir(`  (el turno era del proceso ${previo}, que ya no está: lo tomo yo)`);
    }
  }

  writeFileSync(turno, String(process.pid), 'utf8');

  // Al salir se suelta, para que el próximo no tenga que comprobar el PID.
  // `exit` no admite trabajo asíncrono, así que el borrado es sincrónico.
  const soltar = () => {
    try {
      if (existsSync(turno) && readFileSync(turno, 'utf8').trim() === String(process.pid)) {
        rmSync(turno, { force: true });
      }
    } catch {
      // Si no se puede borrar, el próximo arranque comprueba el PID y sigue.
    }
  };
  process.once('exit', soltar);
  process.once('SIGINT', () => {
    soltar();
    process.exit(0);
  });
}

/** Lo que Baileys llama `id`: «5491133334444:12@s.whatsapp.net». */
function numeroDelJid(jid: string | undefined): string {
  return String(jid ?? '').split(':')[0]?.split('@')[0] ?? '';
}

/** Guarda en la cuenta lo que la pantalla necesita para decir la verdad. */
async function anotar(
  pb: Awaited<ReturnType<typeof entrar>>,
  cuentaId: string,
  campos: Partial<SesionWaEnLaBase>,
): Promise<void> {
  try {
    await pb.collection('cuenta').update(cuentaId, campos);
  } catch (e) {
    // No tira: es un dato de estado, no el trabajo. Pero se dice, para que no
    // se descubra dentro de dos semanas mirando una pantalla que miente.
    console.warn('[wa] no se pudo escribir el estado: ' + (e as Error).message);
  }
}

async function buscarCuenta(pb: Awaited<ReturnType<typeof entrar>>, abrev: string) {
  const todas = await pb.collection('cuenta').getFullList<{ id: string; abrev: string } & SesionWaEnLaBase>();
  const c = todas.find((x) => String(x.abrev).toUpperCase() === abrev);
  if (!c) {
    throw new NoSePuede(
      `No hay ninguna cuenta con abreviatura «${abrev}». Hay: ${todas.map((x) => x.abrev).join(', ')}.`,
    );
  }
  return c;
}

// ---------------------------------------------------------------- estado

async function verEstado(abrev: string): Promise<number> {
  const pb = await entrar();
  const c = await buscarCuenta(pb, abrev);
  const v = comoSeVeLaSesionWa(c);

  decir('');
  decir(`${abrev} · ${v.titular}`);
  if (c.wa_numero) decir(`  número vinculado: ${numeroTapado(c.wa_numero)}`);
  if (v.qr_vigente) decir('  hay un QR vigente esperando que alguien lo escanee.');
  if (v.que_hacer) decir(`  → ${v.que_hacer}`);
  decir('');
  return v.estado === 'activa' ? 0 : 1;
}

// -------------------------------------------------------------- vincular

async function vincular(abrev: string): Promise<number> {
  const pb = await entrar();
  const cuenta = await buscarCuenta(pb, abrev);
  const esperado = String(process.env.WA_NUMERO ?? '').trim();
  const casa = carpetaDeSesion(abrev);
  const cred = carpetaDeCredencial(casa);

  tomarElTurno(casa, abrev);

  decir(`${abrev}: credencial en ${cred}`);
  if (esperado) decir(`  se espera el número ${numeroTapado(esperado)} (WA_NUMERO del .env)`);
  else decir('  ⚠ WA_NUMERO no está en el entorno: no voy a poder avisarte si escaneás con el teléfono equivocado.');

  let intento = 0;
  let listo = false;
  let salida = 1;

  while (!listo) {
    const { state, saveCreds } = await useMultiFileAuthState(cred);
    const sock: WASocket = baileys({
      auth: state,
      // El QR se dibuja acá abajo con la librería, no con el de Baileys: el
      // suyo está deprecado en la 7 y además hay que escribirlo igual en la
      // base para que lo muestre la pantalla.
      printQRInTerminal: false,
      // Que WhatsApp vea un navegador normal y no algo raro.
      browser: Browsers.appropriate('Chrome'),
      /*
       * El historial viejo: apagado salvo que se pida.
       *
       * WhatsApp sólo lo manda AL VINCULAR, así que esto se decide antes de
       * escanear y no se puede cambiar de opinión después sin desvincular el
       * dispositivo desde el teléfono y volver a empezar.
       *
       * Apagado por default a propósito: este es un WhatsApp personal, y
       * traerlo entero volcaría años de conversaciones privadas al CRM, a los
       * backups y a GitHub. Se prende poniendo `WA_HISTORIAL_DIAS` —cuántos
       * días traer—, que es la misma variable que usa el corte al guardar. Una
       * sola perilla: no se puede pedir el historial y olvidarse del límite.
       */
      syncFullHistory: Number(process.env.WA_HISTORIAL_DIAS ?? 0) > 0,
    } as Parameters<typeof baileys>[0]);

    sock.ev.on('creds.update', saveCreds);

    const cerro = await new Promise<{ codigo?: number; abrio: boolean }>((resolve) => {
      let resuelto = false;
      const terminar = (v: { codigo?: number; abrio: boolean }) => {
        if (resuelto) return;
        resuelto = true;
        resolve(v);
      };

      sock.ev.on('connection.update', (u) => {
        void (async () => {
          if (u.qr) {
            // Se dibuja en la terminal Y se escribe en la base: el que escanea
            // puede estar mirando cualquiera de las dos.
            const dibujo = await qrEnTexto(u.qr, { type: 'terminal', small: true });
            decir('');
            decir(dibujo);
            decir(`  Escaneá desde WhatsApp → Dispositivos vinculados. Vence en ${SEGUNDOS_QR_VIGENTE} s.`);
            await anotar(pb, cuenta.id, {
              qr_wa: u.qr,
              qr_wa_desde: new Date().toISOString(),
              wa_motivo: 'nunca_vinculada',
            });
          }

          if (u.connection === 'open') {
            const numero = numeroDelJid(sock.user?.id);
            decir('');
            decir(`✓ ${abrev}: vinculado con ${numeroTapado(numero)}.`);

            if (esperado && !esElNumeroEsperado(numero, esperado)) {
              // Se avisa FUERTE y no se sigue. Descubrir esto el día que sale
              // un mensaje es el peor día para descubrirlo.
              decir('');
              decir(`⚠ PERO NO ES EL NUMERO ESPERADO. Se vinculó ${numeroTapado(numero)} y se esperaba ${numeroTapado(esperado)}.`);
              decir('  Desvinculalo desde el teléfono (WhatsApp → Dispositivos vinculados) y volvé a correr esto');
              decir('  con el teléfono correcto en la mano.');
              await anotar(pb, cuenta.id, { wa_motivo: 'nunca_vinculada', qr_wa: '', wa_numero: numero });
              salida = 2;
              terminar({ abrio: true });
              return;
            }

            await anotar(pb, cuenta.id, {
              ultima_senal_wa: new Date().toISOString(),
              qr_wa: '',
              qr_wa_desde: '',
              /*
               * UN PEDIDO DE BAJA NO SE BORRA AL CONECTAR.
               *
               * `wa_motivo` guarda por qué la sesión NO está viva, así que al
               * conectar se limpia — salvo cuando dice «desvincular», que no es
               * un motivo sino una ORDEN pendiente.
               *
               * El 11/09 Augusto apretó Desvincular sin ningún worker vivo. El
               * pedido quedó escrito, el worker arrancó después, conectó, y su
               * primera escritura lo borró: cuando el reloj fue a mirar si
               * había algo que hacer, ya no había nada. Dos veces seguidas, y
               * desde la pantalla se ve igual que un botón roto.
               */
              wa_motivo: cuenta.wa_motivo === 'desvincular' ? 'desvincular' : '',
              wa_numero: numero,
            });
            intento = 0;
            salida = 0;
            decir('  Señal escrita. Cuentas conectadas ya lo muestra.');
            decir('');
            decir('  Dejo la sesión abierta y latiendo. Cortá con Ctrl+C cuando quieras:');
            decir('  la credencial queda guardada y la próxima vez no hace falta escanear.');
            listo = true;
            latir(pb, cuenta.id);

            // Y a partir de acá, escucha. Hasta el 11/09 la sesión sólo se
            // mantenía viva: WhatsApp conectado y nadie del otro lado. Augusto
            // lo notó apenas vinculó — «está conectado pero no veo mis chats».
            escuchar(sock, pb, cuenta.id, process.env.WA_PAIS || 'Argentina', decir, cred);
            decir('  Escuchando lo que entre. No contesta nada.');
            return;
          }

          if (u.connection === 'close') {
            const codigo = (u.lastDisconnect?.error as { output?: { statusCode?: number } } | undefined)
              ?.output?.statusCode;
            terminar({ codigo, abrio: false });
          }
        })();
      });
    });

    if (listo) break;

    // La decisión NO se toma acá: la toma core, que tiene los tests.
    const que = queHacerConLaCaida(cerro.codigo, intento + 1);
    if (que.cuenta_como_intento) intento += 1;

    decir('');
    decir(`  conexión cerrada (${cerro.codigo ?? 'sin código'}) — ${que.detalle}`);
    await anotar(pb, cuenta.id, { wa_motivo: que.motivo });

    if (hayQueDescartarLaCredencial(que.motivo)) {
      // La credencial murió: dejarla obliga a Baileys a fallar igual la próxima
      // vez, y el síntoma parece de red.
      // SOLO `cred/`: el turno y el diario viven en la casa y no se tocan.
      if (existsSync(cred)) rmSync(cred, { recursive: true, force: true });
      decir('  Credencial borrada: la próxima vuelta pide un QR nuevo.');
    }

    if (que.accion === 'rendirse') {
      decir('  No insisto más. Revisá el teléfono y volvé a correr esto cuando quieras.');
      return 1;
    }

    const espera = que.espera_ms || esperaDeReintento(intento);
    if (espera > 0) {
      decir(`  Espero ${Math.round(espera / 1000)} s y vuelvo a intentar.`);
      await dormir(espera);
    }
  }

  // Se queda vivo hasta que lo corten. Es lo que mantiene la señal fresca.
  await new Promise(() => {});
  return salida;
}

/**
 * El latido. La señal dura 15 minutos (`core/sesion.ts`), así que se refresca
 * bastante antes: una sesión viva que figura caída es tan inútil como una caída
 * que figura viva.
 */
function latir(pb: Awaited<ReturnType<typeof entrar>>, cuentaId: string): void {
  const cada = 5 * 60 * 1000;
  const t = setInterval(() => {
    void anotar(pb, cuentaId, { ultima_senal_wa: new Date().toISOString() });
  }, cada);
  // No mantiene el proceso vivo por sí solo: lo mantiene la promesa de arriba.
  t.unref?.();
}

// ------------------------------------------------------------------ main

async function correr(): Promise<number> {
  const args = process.argv.slice(2);
  const comando = args[0];
  const abrev = args[1]?.toUpperCase();

  if (!comando || !abrev || !['vincular', 'estado'].includes(comando)) {
    console.error('Uso:');
    console.error('  node apps/worker/src/whatsapp.ts vincular <ABREV>');
    console.error('  node apps/worker/src/whatsapp.ts estado <ABREV>');
    return 2;
  }

  // Lo PRIMERO, antes de hablar con la base. Lo que más se rompe es justamente
  // entrar —un token vencido, una variable que no llegó— y si el diario se
  // abriera después, ese error sería el único que no queda escrito.
  abrirElDiario(carpetaDeSesion(abrev));

  return comando === 'estado' ? verEstado(abrev) : vincular(abrev);
}

correr()
  .then((c) => process.exit(c))
  .catch((e) => {
    // Por `decir` y no por `console.error`: el que lanzó esto puede ser el
    // botón del CRM, y ahí nadie ve la consola. El diario es lo único que
    // queda, y es lo que la pantalla lee para decir qué pasó.
    if (e instanceof NoSePuede) {
      decir('\n' + e.message + '\n');
      process.exit(1);
    }
    decir('\nSe rompió: ' + ((e as Error)?.message || String(e)) + '\n');
    process.exit(3);
  });
