// Lo único del worker que abre Chrome.
//
// DOS COSAS QUE NO SON DETALLE:
//
// 1. **Se abre el Chrome de verdad con el perfil de la cuenta**, no el Chromium
//    que trae Playwright. La sesión de LinkedIn vive en ese perfil: en un
//    navegador limpio no hay sesión, y en el perfil equivocado se navega como
//    otra cuenta — que en LinkedIn deja rastro y es exactamente el problema que
//    la migración `chrome_por_cuenta` vino a resolver.
//
// 2. **Los gestos.** Mover el mouse antes de hacer clic, hacer scroll como si se
//    estuviera leyendo, esperar de más cada tanto. Suena a superstición y no lo
//    es: un navegador que abre una página y hace clic a los 200 ms sin haber
//    movido el mouse es la firma más barata de detectar que existe.

import os from 'node:os';
import path from 'node:path';
import { chromium, type BrowserContext, type Page } from 'playwright';

/**
 * La carpeta `User Data` de Chrome.
 *
 * Es la que contiene «Default», «Profile 1», «Profile 2»… No se adivina el
 * perfil: se adivina la carpeta que los contiene, que sí es estándar. El perfil
 * viene de la base (`cuenta.chrome_perfil`) porque depende de la máquina.
 */
export function carpetaDeChrome(): string {
  const puesta = process.env.CHROME_USER_DATA;
  if (puesta) return puesta;
  if (process.platform === 'win32') {
    return path.join(os.homedir(), 'AppData', 'Local', 'Google', 'Chrome', 'User Data');
  }
  if (process.platform === 'darwin') {
    return path.join(os.homedir(), 'Library', 'Application Support', 'Google', 'Chrome');
  }
  return path.join(os.homedir(), '.config', 'google-chrome');
}

export interface Sesion {
  contexto: BrowserContext;
  pagina: Page;
}

/**
 * Abre Chrome con el perfil de una cuenta.
 *
 * `--profile-directory` es lo que elige cuál de las carpetas de perfil se usa
 * dentro de `User Data`. Chrome **bloquea** esa carpeta mientras está abierto,
 * así que si el navegador está corriendo con ese perfil esto falla — y falla
 * ruidosamente a propósito: abrir un perfil distinto «para poder seguir» sería
 * navegar como otra cuenta.
 */
export async function abrirChrome(perfil: string): Promise<Sesion> {
  const contexto = await chromium.launchPersistentContext(carpetaDeChrome(), {
    channel: 'chrome',
    headless: false,
    viewport: { width: 1280, height: 860 },
    args: [`--profile-directory=${perfil}`],
  });
  const pagina = contexto.pages()[0] ?? (await contexto.newPage());
  return { contexto, pagina };
}

/** Cerrar y volver a abrir: limpia la huella que se acumula en el proceso. */
export async function reabrirChrome(sesion: Sesion, perfil: string): Promise<Sesion> {
  await sesion.contexto.close().catch(() => {});
  // Un rato antes de volver: cerrar y abrir en el mismo segundo es un patrón
  // tan reconocible como no cerrar nunca.
  await dormir(5000 + Math.random() * 5000);
  return abrirChrome(perfil);
}

export const dormir = (ms: number) => new Promise((r) => setTimeout(r, Math.max(0, ms)));

/** Los tres sorteos que `core/invitar.ts` pide por argumento. */
export const sortear = () => ({ espera: Math.random(), pausa: Math.random(), latencia: Math.random() });

/** Mover el mouse a algún lado, con recorrido y no de un salto. */
export async function moverElMouse(pagina: Page): Promise<void> {
  try {
    await pagina.mouse.move(200 + Math.random() * 800, 200 + Math.random() * 400, {
      steps: 8 + Math.floor(Math.random() * 12),
    });
  } catch {
    // Un gesto que no se pudo hacer no arruina la corrida.
  }
}

/** Scroll lento, como quien lee. Dos a cinco tirones y a veces vuelve arriba. */
export async function simularLectura(pagina: Page): Promise<void> {
  try {
    const tirones = 2 + Math.floor(Math.random() * 4);
    for (let i = 0; i < tirones; i++) {
      await pagina.evaluate((d) => window.scrollBy({ top: d, behavior: 'smooth' }), 200 + Math.random() * 400);
      await dormir(800 + Math.random() * 2200);
    }
    if (Math.random() < 0.5) {
      await pagina.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
      await dormir(1000 + Math.random() * 1500);
    }
  } catch {
    // Ídem.
  }
}

/**
 * Navegar y devolver cuánto tardó.
 *
 * La latencia no es para el log: la usa `factorDeEspera` de core para decidir
 * si hay que ir más lento. Que LinkedIn conteste muy rápido es mala señal.
 */
export async function irA(pagina: Page, url: string): Promise<number> {
  const t0 = Date.now();
  await pagina.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await pagina.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
  const tardo = Date.now() - t0;
  await moverElMouse(pagina);
  return tardo;
}

/**
 * La media de las últimas navegaciones.
 *
 * Ocho muestras: suficientes para que una página lenta suelta no mueva la
 * media, pocas como para que un cambio de ritmo se note en un minuto.
 */
export class Latencias {
  private readonly ultimas: number[] = [];
  private readonly cuantas = 8;

  anotar(ms: number): void {
    this.ultimas.push(ms);
    if (this.ultimas.length > this.cuantas) this.ultimas.shift();
  }

  media(): number | null {
    if (!this.ultimas.length) return null;
    return this.ultimas.reduce((a, b) => a + b, 0) / this.ultimas.length;
  }

  /** Si las últimas tres van al doble de la media: eso es estrangulamiento. */
  seEstaFrenando(): boolean {
    if (this.ultimas.length < 5) return false;
    const media = this.media()!;
    const recientes = this.ultimas.slice(-3);
    return recientes.reduce((a, b) => a + b, 0) / recientes.length > media * 2;
  }
}
