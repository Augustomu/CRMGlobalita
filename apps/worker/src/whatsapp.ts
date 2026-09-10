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
import { mkdirSync, existsSync, rmSync } from 'node:fs';
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

const decir = (m: string) => console.log(m);
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

/** Lo que Baileys llama `id`: «5491161902745:12@s.whatsapp.net». */
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
  const dir = carpetaDeSesion(abrev);

  decir(`${abrev}: credencial en ${dir}`);
  if (esperado) decir(`  se espera el número ${numeroTapado(esperado)} (WA_NUMERO del .env)`);
  else decir('  ⚠ WA_NUMERO no está en el entorno: no voy a poder avisarte si escaneás con el teléfono equivocado.');

  let intento = 0;
  let listo = false;
  let salida = 1;

  while (!listo) {
    const { state, saveCreds } = await useMultiFileAuthState(dir);
    const sock: WASocket = baileys({
      auth: state,
      // El QR se dibuja acá abajo con la librería, no con el de Baileys: el
      // suyo está deprecado en la 7 y además hay que escribirlo igual en la
      // base para que lo muestre la pantalla.
      printQRInTerminal: false,
      // Que WhatsApp vea un navegador normal y no algo raro.
      browser: Browsers.appropriate('Chrome'),
      syncFullHistory: false,
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
              wa_motivo: '',
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
      if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
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

  return comando === 'estado' ? verEstado(abrev) : vincular(abrev);
}

correr()
  .then((c) => process.exit(c))
  .catch((e) => {
    if (e instanceof NoSePuede) {
      console.error('\n' + e.message + '\n');
      process.exit(1);
    }
    console.error('\nSe rompió: ' + (e as Error).message + '\n');
    process.exit(3);
  });
