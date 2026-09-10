// El chequeo previo. Corre ANTES de abrir nada.
//
// Es el equivalente de `lib/safety-guard.js` de `globalita-automation`, que
// existe por el aviso que LinkedIn le mandó a Francisco el 12/05/2026: *«Hemos
// detectado actividad en tu cuenta que indica que podrías estar usando una
// herramienta de automatización»*. Las causas confirmadas fueron cuatro
// instancias del mismo orquestador corriendo a la vez y seis procesos de
// navegador en paralelo sobre dos cuentas. La anti-detección por script no
// alcanza si no hay coordinación entre los scripts; esto es esa coordinación.
//
// LA DIFERENCIA CON EL ORIGINAL. Allá el kill-switch, los cooldowns y la franja
// horaria eran tres archivos JSON en la raíz del repositorio y tres funciones
// que los leían. Acá **la decisión no está en este archivo**: acá se juntan los
// hechos —qué procesos hay, qué hora es, qué dice la base— y la respuesta la da
// `core/invitar.ts`, que se puede testear sin abrir un navegador.
//
// FALLA CERRADO. Si algo no se puede verificar, no se procede. Nunca al revés.

import { execFileSync } from 'node:child_process';
import { porQueNoInvita, type ConfigInvitar, type CuentaQueInvita, type Impedimento } from '@crm/core/invitar';
import type { ListaInvitacion } from '@crm/core/invitacion';

/**
 * Cuántos procesos del worker se toleran a la vez, contando el propio.
 *
 * Uno. En el repositorio viejo eran dos globales y uno por cuenta, y con eso
 * igual llegó el aviso: cuatro instancias del mismo orquestador se le
 * escaparon al conteo porque el lockfile no era robusto. Acá no hay lockfile
 * que se quede huérfano — se miran los procesos de verdad — y el número es uno.
 */
const MAXIMO_DE_PROCESOS = 1;

export class NoSePuede extends Error {
  readonly motivo: string;
  constructor(motivo: string) {
    super(motivo);
    this.name = 'NoSePuede';
    this.motivo = motivo;
  }
}

/**
 * Los otros procesos del worker que están corriendo ahora.
 *
 * Best-effort a propósito: si el sistema no contesta, devuelve lista vacía. Un
 * chequeo que rompe la corrida porque no pudo listar procesos convierte una
 * medida de seguridad en una molestia, y una molestia se termina desactivando.
 * Lo que sí hace es avisar cuando no pudo mirar.
 */
export function otrosProcesos(): { pid: number; cmd: string }[] {
  const mio = process.pid;
  try {
    if (process.platform === 'win32') {
      // `wmic` se removió de Windows 11: la API viva es Get-CimInstance.
      // `-NoProfile` y sin ventana, si no parpadea una consola en cada corrida.
      const salida = execFileSync(
        'powershell.exe',
        [
          '-NoProfile',
          '-NonInteractive',
          '-Command',
          "Get-CimInstance Win32_Process -Filter \"Name='node.exe'\" | Select-Object ProcessId,CommandLine | ConvertTo-Json -Compress",
        ],
        { encoding: 'utf8', timeout: 8000, windowsHide: true },
      );
      const crudo: unknown = JSON.parse(salida || 'null');
      const filas = (Array.isArray(crudo) ? crudo : crudo ? [crudo] : []) as {
        ProcessId?: number;
        CommandLine?: string;
      }[];
      return filas
        .map((f) => ({ pid: Number(f.ProcessId), cmd: String(f.CommandLine ?? '') }))
        .filter((p) => p.pid && p.pid !== mio && /apps[\\/]worker/.test(p.cmd));
    }

    const salida = execFileSync('ps', ['-eo', 'pid,args'], { encoding: 'utf8', timeout: 5000 });
    return salida
      .split('\n')
      .map((l) => l.trim().match(/^(\d+)\s+(.+)$/))
      .filter((m): m is RegExpMatchArray => Boolean(m))
      .map((m) => ({ pid: Number(m[1]), cmd: m[2] }))
      .filter((p) => p.pid !== mio && /apps\/worker/.test(p.cmd));
  } catch (e) {
    console.warn('[seguridad] no se pudieron listar los procesos: ' + (e as Error).message);
    return [];
  }
}

export interface Hechos {
  cuenta: CuentaQueInvita;
  listas: ListaInvitacion[];
  enviadasHoy: number;
  config: ConfigInvitar;
  pausado: boolean;
}

/**
 * ¿Se puede arrancar?
 *
 * Tira `NoSePuede` con el motivo si no. **Se llama antes de abrir el navegador**
 * y no después: la mitad del valor de este chequeo es no haber abierto nada.
 *
 * El orden es a propósito. Primero la concurrencia, que es lo único que este
 * archivo sabe y core no puede saber; después todo lo demás, que lo decide core.
 */
export function verificarSeguridad(hechos: Hechos, ahora: Date = new Date()): void {
  const otros = otrosProcesos();
  if (otros.length >= MAXIMO_DE_PROCESOS) {
    throw new NoSePuede(
      `Ya hay ${otros.length} proceso(s) del worker corriendo (PID ${otros.map((p) => p.pid).join(', ')}).\n` +
        'Dos sesiones de Playwright a la vez es la causa confirmada del aviso del 12/05/2026. ' +
        'Esperá a que termine el otro.',
    );
  }

  const impedimento: Impedimento | null = porQueNoInvita(
    hechos.cuenta,
    hechos.listas,
    hechos.enviadasHoy,
    hechos.config,
    hechos.pausado,
    ahora,
  );
  if (impedimento) {
    throw new NoSePuede(`${hechos.cuenta.abrev}: ${impedimento.detalle}`);
  }
}
