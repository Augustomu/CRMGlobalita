// Lo único del worker que sabe del HTML de Sales Navigator.
//
// ESTO SE VA A ROMPER. LinkedIn cambia su HTML cuando quiere y sin avisar, y
// cuando lo hace un selector deja de encontrar nada. Está todo en un archivo
// justamente por eso: cuando pase, hay un solo lugar donde mirar.
//
// Los selectores no son inventados: salen de `invitar-agent.js` de
// `globalita-automation`, donde estuvieron en producción. Los que parecen
// arbitrarios —los límites de coordenada Y, el clic con el mouse en vez de con
// el locator— tienen su porqué anotado. Cambiarlos «porque queda más prolijo»
// es volver a los bugs que ya se arreglaron.
//
// NADA DE ACÁ DECIDE. Todo devuelve un dato: qué perfiles hay, si el botón
// estaba, si LinkedIn avisó algo. Qué hacer con eso lo decide `core/invitar.ts`.

import type { Locator, Page } from 'playwright';
import type { AvisoDeLinkedIn } from '@crm/core/invitar';
import { urlDeLista, type ListaInvitacion } from '@crm/core/invitacion';
import { dormir, moverElMouse } from './navegador.ts';

/**
 * Los perfiles de una página de resultados.
 *
 * Se buscan por el enlace al lead y no por una clase: las clases de LinkedIn
 * son generadas y cambian entre despliegues; el enlace `/sales/lead/` es lo que
 * hace que la fila sea una fila de persona.
 */
const PERFILES =
  'ol li:has(a[href*="/sales/lead/"]), ol li:has(a[href*="/sales/people/"]), ' +
  'ul li:has(a[href*="/sales/lead/"]), ul li:has(a[href*="/sales/people/"])';

/** El nombre. `data-anonymize` es de LinkedIn, no nuestro, y es estable. */
const NOMBRE = '[data-anonymize="person-name"]';
const CARGO = '[data-anonymize="title"]';
const EMPRESA = '[data-anonymize="company-name"]';

/**
 * El botón «Conectar» aparece en tres idiomas: las cuentas están en español,
 * portugués e inglés según a quién prospectan.
 */
const CONECTAR = ['Conectar', 'Connect', 'Ligar'];

/**
 * El alto útil de la ventana. Por debajo de 50 está la barra de navegación y
 * por encima de 860 no hay nada visible: un botón «Conectar» encontrado fuera
 * de ese rango es de otro lado de la página —la barra lateral «Más perfiles
 * para ti»— y hacerle clic invita a alguien que no es el que se estaba
 * mirando. Es un bug real y por eso los números están acá.
 */
const Y_MINIMA = 50;
const Y_MAXIMA = 860;

/**
 * La URL de la lista, en la página que toque.
 *
 * La dirección la arma `urlDeLista()` de core a partir de `origen_id`, y acá
 * sólo se le agrega la página. **No se rearma la URL acá**: el motivo por el
 * que se guarda el id y no la dirección —que las URLs copiadas del navegador
 * traen `lipi` y `snfl` de la sesión que las generó, cambian en cada visita y
 * envejecen mal— está en `core/invitacion.ts` con sus tests, y tenerlo escrito
 * dos veces es cómo se separan.
 *
 * Devuelve `''` si la lista no tiene de dónde salir. Quien llama decide: acá no
 * se inventa una dirección.
 */
export function urlDeLaPagina(lista: ListaInvitacion, pagina: number): string {
  const base = urlDeLista(lista.fuente, lista.origen_id);
  return base ? `${base}&page=${Math.max(1, pagina)}` : '';
}

/** Los carteles de LinkedIn tapan botones. Se cierran los que se puede. */
export async function cerrarCarteles(pagina: Page): Promise<void> {
  await pagina
    .evaluate(() => {
      const sels = [
        '[data-test-global-alert-dismiss]',
        '[aria-label="Dismiss"]',
        '[aria-label="Cerrar"]',
        '[aria-label="Fechar"]',
        '.artdeco-global-alert__dismiss',
        '.global-alert-banner__dismiss',
      ];
      for (const s of sels) {
        document.querySelectorAll<HTMLElement>(s).forEach((b) => {
          try {
            b.click();
          } catch {
            /* si no se deja cerrar, se sigue */
          }
        });
      }
    })
    .catch(() => {});
}

/** Si la página de resultados cargó de verdad. */
export async function esperarResultados(pagina: Page): Promise<boolean> {
  const hay = await pagina
    .waitForSelector(PERFILES, { timeout: 15000 })
    .then(() => true)
    .catch(() => false);
  if (hay) {
    await dormir(2000);
    await cerrarCarteles(pagina);
  }
  return hay;
}

export function perfilesDeLaPagina(pagina: Page): Locator {
  return pagina.locator(PERFILES);
}

export interface DatosDelPerfil {
  nombre: string;
  cargo: string;
  empresa: string;
  url_sales: string;
  /** El texto entero de la fila. Sirve para saber si ya está invitado. */
  texto: string;
}

export async function datosDelPerfil(fila: Locator): Promise<DatosDelPerfil> {
  const leer = async (sel: string) =>
    (await fila.locator(sel).first().innerText({ timeout: 3000 }).catch(() => '')).trim();

  const url_sales = await fila
    .locator('a[href*="/sales/lead/"]')
    .first()
    .getAttribute('href')
    .catch(() => null);

  return {
    // El nombre se guarda COMPLETO (§10.9): recortarlo es de la vista, no del
    // dato. `nombreDePersona` de core hace el recorte donde corresponde.
    nombre: await leer(NOMBRE),
    cargo: await leer(CARGO),
    empresa: await leer(EMPRESA),
    url_sales: url_sales ? new URL(url_sales, 'https://www.linkedin.com').toString() : '',
    texto: (await fila.innerText({ timeout: 5000 }).catch(() => '')).trim(),
  };
}

/**
 * Si a esta persona ya se le mandó la solicitud.
 *
 * LinkedIn lo muestra como «Pendiente» en la fila. Se mira antes de intentar
 * invitar porque insistir sobre alguien que ya tiene la solicitud no agrega
 * nada y sí agrega una acción más al conteo del día.
 *
 * El texto va en tres idiomas por lo mismo que `CONECTAR`.
 */
export function yaEstaPendiente(texto: string): boolean {
  const t = texto.toLowerCase();
  return t.includes('pending') || t.includes('pendiente') || t.includes('pendente');
}

export type ResultadoDeInvitar = 'enviada' | 'pide-correo' | 'sin-boton';

/**
 * Mandar la solicitud a una fila.
 *
 * DOS CAMINOS, y el orden importa. Sales Navigator a veces muestra «Conectar»
 * derecho en la fila y a veces lo esconde detrás del botón «···». Se prueba el
 * directo primero porque es un clic contra tres.
 *
 * **Los clics son con el mouse y no con `locator.click()`.** No es
 * preferencia: el menú «···» está hecho con Ember y se cierra solo cuando el
 * clic no viene acompañado del movimiento del mouse. Con `locator.click()` el
 * menú abre y cierra en el mismo instante y la invitación no sale nunca — sin
 * error, que es lo peor.
 */
export async function invitar(pagina: Page, fila: Locator): Promise<ResultadoDeInvitar> {
  await fila.scrollIntoViewIfNeeded().catch(() => {});
  await dormir(400 + Math.random() * 400);

  const directo = await buscarConectar(pagina, 100, 500);
  if (directo) {
    await clickHumano(pagina, directo);
  } else {
    // El botón «···» sólo se renderiza con el mouse encima de la fila.
    const caja = await fila.boundingBox().catch(() => null);
    if (caja) {
      await pagina.mouse.move(caja.x + caja.width / 2, caja.y + 20, { steps: 6 });
      await dormir(280 + Math.random() * 170);
    }

    const mas = await fila
      .evaluate((el) => {
        const conAria = Array.from(el.querySelectorAll<HTMLElement>('button[aria-label]')).find((b) => {
          const a = (b.getAttribute('aria-label') || '').toLowerCase();
          return a.includes('acciones') || a.includes('actions') || a.includes('ações');
        });
        const btn = conAria ?? el.querySelector<HTMLElement>('[data-search-overflow-trigger]');
        if (!btn) return null;
        const r = btn.getBoundingClientRect();
        return r.width === 0 ? null : { x: r.x, y: r.y, w: r.width, h: r.height };
      })
      .catch(() => null);

    if (!mas) return 'sin-boton';

    await clickHumano(pagina, mas);

    // Se espera a que el menú exista de verdad, no un tiempo fijo. Con tiempo
    // fijo o sale de más o se busca el botón antes de que esté.
    await dormir(800);
    const abrio = await pagina
      .waitForFunction(
        ({ min, max }) => {
          const listas = Array.from(document.querySelectorAll('ul')).filter((u) => {
            const r = u.getBoundingClientRect();
            return r.width > 40 && r.height > 20 && r.y > min && r.y < max;
          });
          const menu = document.querySelector('.artdeco-dropdown__content');
          return listas.length > 0 || (menu != null && menu.getBoundingClientRect().width > 0);
        },
        { min: Y_MINIMA, max: Y_MAXIMA },
        { timeout: 3000 },
      )
      .catch(() => null);

    if (!abrio) {
      await pagina.keyboard.press('Escape').catch(() => {});
      return 'sin-boton';
    }

    // El mismo clic puede abrir el menú GLOBAL de Sales Navigator en vez del de
    // la fila. Si lo que aparece tiene «Ajustes» o «Coach», es el global: se
    // cierra y se saltea, porque el «Conectar» que se encuentre ahí no es de
    // esta persona.
    const esGlobal = await pagina
      .evaluate(() => {
        const textos: string[] = [];
        document.querySelectorAll('ul li, .artdeco-dropdown__content li').forEach((e) => {
          const t = (e as HTMLElement).innerText?.trim().toLowerCase();
          if (t) textos.push(t);
        });
        return ['ajustes', 'settings', 'coach', 'recomendaciones', 'recommendations'].some((k) =>
          textos.some((t) => t.includes(k)),
        );
      })
      .catch(() => false);

    if (esGlobal) {
      await pagina.keyboard.press('Escape').catch(() => {});
      return 'sin-boton';
    }

    const enMenu = await buscarConectar(pagina, Y_MINIMA, Y_MAXIMA);
    if (!enMenu) {
      await pagina.keyboard.press('Escape').catch(() => {});
      return 'sin-boton';
    }
    await clickHumano(pagina, enMenu);
  }

  await dormir(1200 + Math.random() * 800);

  // El modal pide el correo cuando LinkedIn no deja invitar a secas. Eso es
  // otro circuito —el F6 del repositorio viejo, con su propia cola— y por ahora
  // se saltea en vez de improvisarlo.
  if (await pidenElCorreo(pagina)) {
    await pagina.keyboard.press('Escape').catch(() => {});
    return 'pide-correo';
  }

  const enviado = await confirmarEnvio(pagina);
  if (!enviado) {
    await pagina.keyboard.press('Escape').catch(() => {});
    return 'sin-boton';
  }

  // Confirmar que la fila pasó a «Pendiente». Sin esto, un modal que se cerró
  // solo se cuenta como invitación enviada y el número del día miente.
  const quedo = await pagina
    .waitForSelector('button:has-text("Pending"), button:has-text("Pendiente"), button:has-text("Pendente")', {
      timeout: 5000,
    })
    .then(() => true)
    .catch(() => false);

  return quedo ? 'enviada' : 'sin-boton';
}

type Caja = { x: number; y: number; w: number; h: number };

/** Un clic con el mouse: mover, esperar un poco, y recién ahí apretar. */
async function clickHumano(pagina: Page, caja: Caja): Promise<void> {
  // ±3 px: dos clics exactamente en el mismo píxel del mismo botón no los da
  // una persona.
  const tiembla = (v: number) => v + (Math.random() * 2 - 1) * 3;
  const x = tiembla(caja.x + caja.w / 2);
  const y = tiembla(caja.y + caja.h / 2);
  await pagina.mouse.move(x, y, { steps: 5 + Math.floor(Math.random() * 8) });
  await dormir(180 + Math.random() * 140);
  await pagina.mouse.click(x, y).catch(() => {});
}

async function buscarConectar(pagina: Page, yMin: number, yMax: number): Promise<Caja | null> {
  return pagina
    .evaluate(
      ({ textos, min, max }) => {
        const botones = Array.from(document.querySelectorAll<HTMLElement>('button, [role="button"]')).filter((b) => {
          const t = (b.innerText || b.textContent || '').trim();
          const r = b.getBoundingClientRect();
          return textos.includes(t) && r.width > 0 && r.y > min && r.y < max;
        });
        if (!botones.length) return null;
        const r = botones[0].getBoundingClientRect();
        return { x: r.x, y: r.y, w: r.width, h: r.height };
      },
      { textos: CONECTAR, min: yMin, max: yMax },
    )
    .catch(() => null);
}

async function pidenElCorreo(pagina: Page): Promise<boolean> {
  return pagina
    .evaluate(() => {
      const modal = document.querySelector('[role="dialog"][aria-modal], .artdeco-modal');
      if (!modal) return false;
      const t = ((modal as HTMLElement).innerText || '').toLowerCase();
      return (
        t.includes('correo electrónico') ||
        t.includes('email address') ||
        t.includes('endereço de e-mail') ||
        Boolean(modal.querySelector('input[type="email"], input[name="email"]'))
      );
    })
    .catch(() => false);
}

/**
 * Apretar «Enviar» en el modal de confirmación.
 *
 * Los botones se buscan SÓLO adentro del modal visible. Buscarlos en toda la
 * página es cómo se termina apretando el «Enviar» de otra cosa: es la regla que
 * el repositorio viejo aprendió a los golpes y dejó escrita como «modal de
 * confirmación siempre acotado».
 */
async function confirmarEnvio(pagina: Page): Promise<boolean> {
  const caja = await pagina
    .evaluate(() => {
      const modal = document.querySelector('[role="dialog"][aria-modal], .artdeco-modal');
      if (!modal || (modal as HTMLElement).getBoundingClientRect().width === 0) return null;
      const textos = ['Enviar', 'Send', 'Enviar ahora', 'Send now', 'Enviar invitación', 'Send invitation'];
      const btn = Array.from(modal.querySelectorAll<HTMLElement>('button')).find((b) => {
        const t = (b.innerText || '').trim();
        return textos.includes(t) && b.getBoundingClientRect().width > 0;
      });
      if (!btn) return null;
      const r = btn.getBoundingClientRect();
      return { x: r.x, y: r.y, w: r.width, h: r.height };
    })
    .catch(() => null);

  // Sin modal no hay confirmación que dar: hay flujos donde el clic en
  // «Conectar» manda la solicitud derecho. Se devuelve `true` y la verificación
  // de «Pendiente» que viene después decide si salió.
  if (!caja) return true;

  await clickHumano(pagina, caja);
  await dormir(800 + Math.random() * 600);
  return true;
}

/**
 * Si LinkedIn está avisando algo.
 *
 * Los textos son los que se recibieron de verdad, no los que uno supondría.
 * El del 12/05/2026 fue literal: *«actividad en tu cuenta que indica que
 * podrías estar usando una herramienta de automatización»*.
 */
export async function avisoDeLinkedIn(pagina: Page): Promise<AvisoDeLinkedIn | null> {
  return pagina
    .evaluate(() => {
      const t = (document.body?.innerText || '').toLowerCase();
      const url = window.location.href.toLowerCase();

      if (t.includes('herramienta de automatización') || t.includes('automation tool') || t.includes('programas automatizados')) {
        return 'automatizacion';
      }
      if (t.includes('has been restricted') || t.includes('ha sido restringida') || t.includes('cuenta restringida')) {
        return 'restringida';
      }
      if (
        url.includes('checkpoint') ||
        url.includes('captcha') ||
        url.includes('uas/login') ||
        t.includes('verifica que eres humano') ||
        t.includes('verify you are human') ||
        document.querySelector('iframe[src*="captcha"], #captcha, .captcha, [data-testid="checkpoint"]')
      ) {
        return 'captcha';
      }
      if (t.includes('actividad inusual') || t.includes('unusual activity')) return 'actividad_inusual';
      return null;
    })
    .catch(() => null) as Promise<AvisoDeLinkedIn | null>;
}

/**
 * Señales de que el aviso está por llegar.
 *
 * Es lo que el repositorio viejo llama pre-bloqueo. La idea es no enterarse
 * cuando ya no se puede hacer nada: una página con cuatro enlaces no es una
 * página de resultados, es un bloqueo parcial servido sin decirlo.
 */
export async function haySenalesRaras(pagina: Page): Promise<string | null> {
  const enlaces = await pagina.evaluate(() => document.querySelectorAll('a[href]').length).catch(() => 999);
  if (enlaces > 0 && enlaces < 10) return `la página trajo sólo ${enlaces} enlaces`;
  return null;
}

/** Pasar a la página siguiente de la búsqueda. */
export async function irASiguientePagina(pagina: Page, lista: ListaInvitacion, siguiente: number): Promise<boolean> {
  await pagina.goto(urlDeLaPagina(lista, siguiente), { waitUntil: 'domcontentloaded', timeout: 30000 });
  const hay = await esperarResultados(pagina);
  if (hay) await moverElMouse(pagina);
  return hay;
}
