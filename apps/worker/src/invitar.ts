// La corrida de invitaciones. El orquestador.
//
// Este archivo NO DECIDE NADA. Pregunta y ejecuta:
//
//   ¿a quién le toca?          → core/invitar.aQuienLeToca
//   ¿puede operar?             → core/invitar.porQueNoInvita (vía seguridad.ts)
//   ¿cuánto espero ahora?      → core/invitar.ritmoDespuesDe
//   ¿qué hago si LinkedIn avisó? → core/invitar.frenoPorAviso
//
// Si en algún momento aparece acá un número —una espera, un tope, un cada
// cuántos— está mal ubicado. Va a la configuración, y la regla que lo usa a
// core con su test.
//
//   node apps/worker/src/invitar.ts <ABREV>
//   node apps/worker/src/invitar.ts <ABREV> --simular
//
// Ver `apps/worker/README.md`.

import {
  aQuienLeToca,
  esperaDeArranqueMs,
  frenoPorAviso,
  ritmoDespuesDe,
  turnoDeInvitaciones,
  type AvisoDeLinkedIn,
  type Turno,
} from '@crm/core/invitar';
import { paginaAlTerminar } from '@crm/core/invitar';
import { urlDeLista, type ListaInvitacion } from '@crm/core/invitacion';
import { nombreDePersona } from '@crm/core/linkedin';
import { anotarFreno, anotarInvitacion, entrar, guardarPagina, leerEstado, senalDeVida, type EstadoDeLaBase } from './base.ts';
import { NoSePuede, verificarSeguridad } from './seguridad.ts';
// Los dos módulos que tocan el navegador entran por `import()` adentro de
// `correr()`, y NO acá arriba. El motivo es `--simular`: promete no abrir nada,
// y con el import estático ni siquiera podría arrancar sin Playwright
// instalado. Así se puede verificar a quién le toca y con qué ritmo en una
// máquina pelada, antes de bajar un navegador. Los tipos sí van arriba: se
// borran al ejecutar.
import type { Sesion } from './navegador.ts';

const decir = (msg: string) => console.log(`[${new Date().toISOString().slice(11, 19)}] ${msg}`);

async function principal(): Promise<void> {
  const args = process.argv.slice(2);
  const simular = args.includes('--simular');
  const abrev = args.find((a) => !a.startsWith('--'))?.toUpperCase();

  if (!abrev) {
    console.error('Falta la cuenta: node apps/worker/src/invitar.ts <ABREV> [--simular]');
    process.exit(2);
  }

  const pb = await entrar();
  const estado = await leerEstado(pb);

  // El turno se calcula sobre TODAS las cuentas y no sólo sobre la pedida: es lo
  // que permite decir «a esta no le toca, y a esta otra sí» en vez de un «no» sin
  // contexto. Van en el orden de slot, que es el orden en que se trabajan.
  const turnos = turnoDeInvitaciones(
    estado.cuentas,
    estado.listasPorCuenta,
    estado.enviadasHoy,
    estado.config,
    estado.pausado,
  );
  mostrarTurnos(turnos);

  const turno = turnos.find((t) => t.abrev === abrev);
  if (!turno) {
    console.error(`No hay ninguna cuenta con abreviatura «${abrev}».`);
    process.exit(2);
  }

  const cuenta = estado.cuentas.find((c) => c.id === turno.cuenta)!;
  const listas = estado.listasPorCuenta.get(cuenta.id) ?? [];

  // EL CHEQUEO PREVIO, ANTES DE ABRIR NADA. La mitad del valor de esto es no
  // haber abierto el navegador.
  try {
    verificarSeguridad({
      cuenta,
      listas,
      enviadasHoy: estado.enviadasHoy.get(cuenta.id) ?? 0,
      config: estado.config,
      pausado: estado.pausado,
    });
  } catch (e) {
    if (e instanceof NoSePuede) {
      decir(`No se corre. ${e.motivo}`);
      process.exit(1);
    }
    throw e;
  }

  const lista = turno.lista;
  if (!lista) {
    decir(`${abrev}: ninguna lista con páginas.`);
    process.exit(1);
  }
  // La dirección se ARMA a partir de `origen_id`, no se guarda: la URL copiada
  // del navegador trae `lipi` y `snfl` de la sesión que la generó y envejece
  // mal. `urlDeLista` devuelve vacío cuando no hay `origen_id`, o cuando lo que
  // hay adentro no es un savedSearchId — y sin dirección no se abre nada:
  // inventar una sería navegar a la búsqueda de otro.
  if (!urlDeLista(lista.fuente, lista.origen_id)) {
    decir(
      `${abrev}: la lista «${lista.nombre}» no tiene de dónde salen los perfiles (origen_id).\n` +
        '       Se carga desde Automatizaciones. No va en un archivo del repositorio: el repositorio es público.',
    );
    process.exit(1);
  }

  decir(`${abrev} · lista «${lista.nombre}» · página ${lista.pagina + 1} · salen hasta ${turno.cuantas}`);

  if (simular) {
    decir('--simular: hasta acá llega. No se abrió Chrome ni se tocó la base.');
    return;
  }

  await correr(pb, estado, turno, cuenta.chrome_perfil!, lista);
}

function mostrarTurnos(turnos: Turno[]): void {
  for (const t of turnos) {
    const detalle = t.impedimento ? t.impedimento.detalle : `${t.cuantas} · «${t.lista?.nombre}»`;
    console.log(`  ${t.abrev.padEnd(4)} ${detalle}`);
  }
  const toca = aQuienLeToca(turnos);
  console.log(toca ? `  → ahora le toca a ${toca.abrev}` : '  → ahora no le toca a nadie');
}

async function correr(
  pb: Awaited<ReturnType<typeof entrar>>,
  estado: EstadoDeLaBase,
  turno: Turno,
  perfilDeChrome: string,
  lista: ListaInvitacion,
): Promise<void> {
  const { config } = estado;

  const { Latencias, abrirChrome, dormir, irA, moverElMouse, reabrirChrome, simularLectura, sortear } =
    await import('./navegador.ts');
  const {
    avisoDeLinkedIn,
    datosDelPerfil,
    esperarResultados,
    haySenalesRaras,
    invitar,
    irASiguientePagina,
    perfilesDeLaPagina,
    urlDeLaPagina,
    yaEstaPendiente,
  } = await import('./salesnav.ts');

  const latencias = new Latencias();

  let sesion: Sesion = await abrirChrome(perfilDeChrome);
  let hechas = 0;
  let paginasHechas = 0;
  let pagina = lista.pagina + 1;
  const vistos = new Set<string>();

  /** Cortar bien: guardar lo avanzado y cerrar el navegador. */
  const terminar = async (motivo: string) => {
    await guardarPagina(pb, lista.id, paginaAlTerminar(lista, paginasHechas)).catch(() => {});
    await sesion.contexto.close().catch(() => {});
    decir(`Fin: ${motivo}. Salieron ${hechas} invitaciones; la lista quedó en la página ${paginaAlTerminar(lista, paginasHechas)}.`);
  };

  /** LinkedIn avisó: se frena, se escribe y no se insiste. */
  const frenar = async (aviso: AvisoDeLinkedIn) => {
    const freno = frenoPorAviso(aviso, config, turno.abrev);
    await anotarFreno(pb, estado, turno.cuenta, freno).catch((e) =>
      console.error('[invitar] no se pudo escribir el freno: ' + (e as Error).message),
    );
    decir(`LINKEDIN AVISÓ. ${freno.motivo}`);
    await terminar('aviso de LinkedIn');
  };

  try {
    // El navegador se abre y no hace nada durante unos segundos. Abrir y
    // disparar en el mismo instante es la firma más barata de detectar.
    const arranque = esperaDeArranqueMs(config, sortear());
    decir(`Chrome abierto con «${perfilDeChrome}». Espera de arranque: ${Math.round(arranque / 1000)} s.`);
    await dormir(arranque);

    latencias.anotar(await irA(sesion.pagina, urlDeLaPagina(lista, pagina)));
    await senalDeVida(pb, turno.cuenta);

    const primerAviso = await avisoDeLinkedIn(sesion.pagina);
    if (primerAviso) return await frenar(primerAviso);

    if (!(await esperarResultados(sesion.pagina))) {
      return await terminar('la búsqueda no trajo resultados');
    }

    while (hechas < turno.cuantas) {
      const filas = perfilesDeLaPagina(sesion.pagina);
      const cuantas = await filas.count();

      if (cuantas === 0) {
        decir(`La página ${pagina} vino vacía.`);
        break;
      }

      let algunaEnEstaPagina = false;

      for (let i = 0; i < cuantas && hechas < turno.cuantas; i++) {
        const fila = filas.nth(i);
        const datos = await datosDelPerfil(fila);

        // Sin nombre no se puede anotar en la base, y anotar «desconocido»
        // ensucia el repositorio de personas para siempre.
        if (!datos.nombre) continue;
        // La misma persona puede aparecer dos veces si la página se recargó.
        const clave = datos.url_sales || datos.nombre;
        if (vistos.has(clave)) continue;
        vistos.add(clave);

        if (yaEstaPendiente(datos.texto)) continue;

        await simularLectura(sesion.pagina);
        const resultado = await invitar(sesion.pagina, fila);

        // Todo lo que sigue pasa DESPUÉS de que LinkedIn contestó: la sesión
        // está viva y hay que decirlo.
        await senalDeVida(pb, turno.cuenta);

        if (resultado === 'enviada') {
          const leadId = await anotarInvitacion(pb, turno.cuenta, {
            nombre: datos.nombre,
            url_sales: datos.url_sales,
            cargo: datos.cargo,
            empresa: datos.empresa,
            lista: lista.nombre,
            pagina,
          }).catch((e) => {
            // La solicitud YA salió: si esto falla, lo que hay es una
            // invitación sin registrar, y eso se dice fuerte. Callarlo sería
            // dejar que el conteo del día mienta.
            console.error(`[invitar] ¡salió la invitación a «${nombreDePersona(datos.nombre)}» y NO se pudo anotar!: ${(e as Error).message}`);
            return 'sin-anotar';
          });
          hechas++;
          algunaEnEstaPagina = true;
          decir(`  ${hechas}/${turno.cuantas} · ${nombreDePersona(datos.nombre)}${leadId === 'sin-anotar' ? ' (sin anotar)' : ''}`);
        } else if (resultado === 'pide-correo') {
          decir(`  — ${nombreDePersona(datos.nombre)}: LinkedIn pide el correo. Se saltea (ver README).`);
        } else if (resultado === 'sin-boton') {
          decir(`  — ${nombreDePersona(datos.nombre)}: no había con qué invitar.`);
        }

        // El ritmo. Todo lo que sigue lo decidió core.
        const ritmo = ritmoDespuesDe(hechas, config, sortear(), latencias.media());

        if (ritmo.mirarPreBloqueo || latencias.seEstaFrenando()) {
          const aviso = await avisoDeLinkedIn(sesion.pagina);
          if (aviso) return await frenar(aviso);
          const raro = await haySenalesRaras(sesion.pagina);
          if (raro || latencias.seEstaFrenando()) {
            decir(`  Señal rara (${raro ?? 'las respuestas se están frenando'}): pausa larga preventiva.`);
            await dormir(config.pausa_larga_max_s * 1000);
          }
        }

        if (ritmo.cortar) return await terminar('se llegó al tope de la corrida');

        for (const pausa of ritmo.pausas) {
          decir(`  Pausa ${pausa.tipo}: ${Math.round(pausa.ms / 1000)} s.`);
          await dormir(pausa.ms);
        }

        if (ritmo.resetNavegador) {
          decir('  Reiniciando Chrome: limpia la huella acumulada.');
          sesion = await reabrirChrome(sesion, perfilDeChrome);
          latencias.anotar(await irA(sesion.pagina, urlDeLaPagina(lista, pagina)));
          await senalDeVida(pb, turno.cuenta);
          if (!(await esperarResultados(sesion.pagina))) {
            return await terminar('después de reiniciar, la página no volvió');
          }
          break; // las filas viejas ya no existen: se rearma el bucle
        }

        await dormir(ritmo.esperaMs);
        await moverElMouse(sesion.pagina);
      }

      if (hechas >= turno.cuantas) break;

      // Sólo se cuenta como página hecha la que se recorrió entera. Si la
      // corrida cortó por el cupo en la mitad, la página sigue siendo la misma:
      // marcarla como hecha saltearía a los que quedaron sin mirar, y eso no se
      // nota hasta semanas después.
      if (algunaEnEstaPagina || vistos.size >= cuantas) paginasHechas++;

      pagina++;
      decir(`Página ${pagina}.`);
      const hay = await irASiguientePagina(sesion.pagina, lista, pagina);
      await senalDeVida(pb, turno.cuenta);
      const aviso = await avisoDeLinkedIn(sesion.pagina);
      if (aviso) return await frenar(aviso);
      if (!hay) return await terminar('se acabaron las páginas de la lista');
      vistos.clear();
    }

    await terminar('salió lo del cupo de hoy');
  } catch (e) {
    // Ante cualquier error se cierra el navegador y se guarda lo avanzado. Un
    // Chrome que queda abierto con la sesión adentro bloquea el perfil y la
    // corrida siguiente no arranca.
    await terminar('error: ' + (e as Error).message);
    throw e;
  }
}

principal().catch((e) => {
  console.error(e instanceof Error ? e.message : String(e));
  process.exit(1);
});
