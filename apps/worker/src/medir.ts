/**
 * Medir las listas de una cuenta: cuántas páginas tiene cada búsqueda (§3.4).
 *
 *   node apps/worker/src/medir.ts <ABREV>
 *   node apps/worker/src/medir.ts <ABREV> --simular   # no abre nada
 *   node apps/worker/src/medir.ts <ABREV> --todas     # también las ya medidas
 *
 * ─────────────────────────────────────────────────────────────────────────
 * POR QUÉ EXISTE: ERA EL ÚLTIMO BLOQUEANTE PARA QUE SALGA UNA INVITACIÓN.
 *
 * Las 22 búsquedas guardadas de Sales Navigator están cargadas con su
 * `savedSearchId` desde el 10/09, pero `paginas` quedó en 0 en todas: el
 * documento traía los nombres y los ids, no cuántas páginas tiene cada una. Con
 * 0, la lista figura «sin medir», no entra en la cola (`laQueTrabaja` la
 * saltea) y el worker calcula **0 invitaciones** por más cupo que sobre.
 *
 * Hasta hoy el único camino era que alguien contara a mano las páginas de 22
 * búsquedas y las tipeara. Eso se hace mal una vez y además envejece solo: una
 * búsqueda guardada crece, y el número escrito hace un mes sigue diciendo lo de
 * hace un mes.
 *
 * ESTO LO DESCUBRE. Sales Navigator escribe arriba de la lista cuántos
 * resultados tiene la búsqueda —«About 1,234 results»— y de ahí sale el total
 * dividiendo por `por_pagina`. Una navegación por lista, sin invitar a nadie:
 *
 *   1. Abre Chrome con el perfil de esa cuenta.
 *   2. Entra a la primera página de la búsqueda.
 *   3. Lee el encabezado y le pregunta a core cuántas páginas son.
 *   4. Si se pudo leer, lo guarda. Si no, **no escribe nada** y lo dice.
 *
 * QUÉ CHEQUEA Y QUÉ NO. Lo mismo que `vincular`: concurrencia primero, después
 * pausa general, cooldown, franja horaria y perfil de Chrome. No exige señal
 * previa de la sesión —la escribe cuando LinkedIn contesta— y obviamente no
 * exige material en las listas: es lo que viene a arreglar.
 *
 * ⚠️ ESTE COMANDO ABRE LINKEDIN, así que corre con las mismas reglas de ritmo
 * que `invitar` y por los mismos motivos: el aviso del 12/05/2026 vino de
 * cuatro instancias a la vez y seis navegadores en paralelo. Una lista por
 * navegación, con la espera de arranque, la espera sorteada entre una y otra,
 * las pausas media y larga cuando caen, y el reinicio del navegador cuando toca
 * — todo decidido por `core/invitar.ts`, que es donde viven esos números.
 *
 * NO INVITA A NADIE y no toca `pagina`: sólo escribe `paginas`.
 */
import {
  enCooldown,
  esperaDeArranqueMs,
  frenoPorAviso,
  ritmoDespuesDe,
  fueraDeHorario,
  type CuentaQueInvita,
} from '@crm/core/invitar';
import {
  TOPE_DE_PAGINAS,
  enPrioridad,
  medidaDelEncabezado,
  paraMedir,
  sePuedeMedirSola,
  sinMedir,
  type ListaInvitacion,
} from '@crm/core/invitacion';
import { anotarFreno, entrar, guardarMedida, leerEstado, senalDeVida } from './base.ts';
import { NoSePuede, otrosProcesos } from './seguridad.ts';
// Igual que en `invitar.ts`: los dos módulos que abren el navegador entran por
// `import()` adentro de la corrida y no acá arriba, para que `--simular` pueda
// contestar en una máquina sin Playwright instalado. Los tipos sí van arriba:
// se borran al ejecutar.
import type { Sesion } from './navegador.ts';

const decir = (m: string) => console.log(m);

async function correr(): Promise<number> {
  const args = process.argv.slice(2);
  const simular = args.includes('--simular');
  const todas = args.includes('--todas');
  const abrev = args.find((a) => !a.startsWith('--'))?.toUpperCase();

  if (!abrev) {
    console.error('Falta la cuenta: node apps/worker/src/medir.ts <ABREV> [--simular] [--todas]');
    return 2;
  }

  // La concurrencia se chequea ANTES de tocar la base, igual que en `vincular`:
  // es lo único que no depende de nada y lo que más caro sale ignorar.
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

  if (estado.pausado) {
    throw new NoSePuede('La automatización está en pausa. Se saca desde Automatizaciones.');
  }
  if (enCooldown(cuenta as CuentaQueInvita, ahora)) {
    throw new NoSePuede(
      `${abrev} está frenada por un aviso de LinkedIn hasta ${String(cuenta.cooldown_hasta).slice(0, 16)}.\n` +
        'Entrar con esa cuenta ahora es justo lo que el freno evita — medir también entra.',
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

  const listas = estado.listasPorCuenta.get(cuenta.id) ?? [];
  // `--todas` vuelve a medir también las que ya tienen total: una búsqueda
  // guardada crece, y el número de hace un mes dice lo de hace un mes.
  const aMedir = todas ? enPrioridad(listas.filter(sePuedeMedirSola)) : paraMedir(listas);

  // Las que no se pueden medir solas y siguen sin medir: se nombran para que no
  // desaparezcan del problema. Son las que hay que cargar a mano.
  const aMano = sinMedir(listas).filter((l) => !sePuedeMedirSola(l));

  decir(`${abrev}: ${listas.length} lista(s), ${sinMedir(listas).length} sin medir.`);
  for (const l of aMedir) decir(`  · ${l.nombre}${l.paginas > 0 ? ` (hoy dice ${l.paginas})` : ''}`);
  if (aMano.length) {
    decir('');
    decir(`  ${aMano.length} sin medir NO se pueden medir solas (sin savedSearchId, o CSV):`);
    for (const l of aMano) decir(`    · ${l.nombre}`);
    decir('    Ésas se cargan a mano desde Automatizaciones.');
  }

  if (!aMedir.length) {
    decir('');
    decir('No hay nada que medir con este comando. No se abrió Chrome.');
    return aMano.length ? 1 : 0;
  }

  decir('');
  decir(`Perfil de Chrome «${perfil}». Van ${aMedir.length} navegación(es), una por lista.`);

  if (simular) {
    decir('--simular: hasta acá llega. No se abrió Chrome ni se tocó la base.');
    return 0;
  }

  return await medir(pb, estado, cuenta as CuentaQueInvita, perfil, aMedir);
}

async function medir(
  pb: Awaited<ReturnType<typeof entrar>>,
  estado: Awaited<ReturnType<typeof leerEstado>>,
  cuenta: CuentaQueInvita,
  perfilDeChrome: string,
  listas: ListaInvitacion[],
): Promise<number> {
  const { config } = estado;

  const { Latencias, abrirChrome, dormir, irA, reabrirChrome, simularLectura, sortear } = await import(
    './navegador.ts'
  );
  const { avisoDeLinkedIn, esperarResultados, resultadosDeLaBusqueda, urlDeLaPagina } = await import(
    './salesnav.ts'
  );

  const latencias = new Latencias();
  let sesion: Sesion = await abrirChrome(perfilDeChrome);
  let medidas = 0;
  let ilegibles = 0;
  /**
   * Cuántas listas seguidas no trajeron resultados.
   *
   * Con la sesión caída, LinkedIn manda al login y NINGUNA búsqueda va a cargar
   * nunca. Sin este contador, el comando visitaría la página de login 22 veces
   * seguidas — que es tráfico raro contra LinkedIn hecho por un proceso
   * automático, justo lo que todo lo demás de este archivo evita. A la segunda
   * seguida se corta y se dice qué correr.
   */
  let vaciasSeguidas = 0;

  try {
    // El navegador se abre y no hace nada unos segundos. Abrir y disparar en el
    // mismo instante es la firma más barata de detectar que existe.
    const arranque = esperaDeArranqueMs(config, sortear());
    decir(`Chrome abierto. Espera de arranque: ${Math.round(arranque / 1000)} s.`);
    await dormir(arranque);

    for (let i = 0; i < listas.length; i++) {
      const lista = listas[i];
      decir('');
      decir(`[${i + 1}/${listas.length}] «${lista.nombre}»`);

      latencias.anotar(await irA(sesion.pagina, urlDeLaPagina(lista, 1)));
      // LinkedIn contestó: la sesión está viva y hay que decirlo. Es la misma
      // señal que escribe `vincular`, y por eso este comando no la exige antes.
      await senalDeVida(pb, cuenta.id);

      // El aviso primero. Una cuenta avisada que «anda» es la peor lectura
      // posible: invita a seguir usándola.
      const aviso = await avisoDeLinkedIn(sesion.pagina);
      if (aviso) {
        const freno = frenoPorAviso(aviso, config, cuenta.abrev, new Date());
        decir('');
        decir(`⚠ LINKEDIN AVISÓ: ${freno.motivo}`);
        if (freno.pausa_general) decir('  Y se pausa TODA la automatización: las cuentas comparten IP.');
        decir(`  Se corta acá. Quedaron ${listas.length - i} lista(s) sin medir.`);
        await anotarFreno(pb, estado, cuenta.id, freno);
        return 1;
      }

      if (!(await esperarResultados(sesion.pagina))) {
        // Sin filas no hay búsqueda cargada. Puede ser una sesión caída, un
        // `savedSearchId` que ya no existe, o una búsqueda vacía de verdad. No
        // se escribe nada: no se sabe cuál de las tres es.
        decir('  ✗ La búsqueda no trajo resultados. No se toca el total.');
        decir(`     Abrila a mano: ${urlDeLaPagina(lista, 1)}`);
        ilegibles++;
        vaciasSeguidas++;
        if (vaciasSeguidas >= 2) {
          decir('');
          decir('Dos listas seguidas sin cargar: eso no son dos búsquedas vacías, es la sesión.');
          decir(`  Comprobala y volvé: node apps/worker/src/vincular.ts ${cuenta.abrev}`);
          decir(`  Quedaron ${listas.length - i - 1} lista(s) sin mirar.`);
          return 1;
        }
      } else {
        vaciasSeguidas = 0;
        // Un rato mirando la página antes de leerla, como quien la abrió para
        // ver qué tiene.
        await simularLectura(sesion.pagina);

        const encabezado = await resultadosDeLaBusqueda(sesion.pagina);
        const medida = medidaDelEncabezado(encabezado.texto, lista.por_pagina);

        if (!medida) {
          // NO SE SABE. No se escribe 0 —que significa «sin medir» y encima se
          // ve igual que «agotada»— ni un número inventado, que haría prometer
          // invitaciones que no existen.
          ilegibles++;
          decir('  ✗ No se pudo leer cuántos resultados tiene. NO se guardó nada.');
          if (encabezado.candidatos.length) {
            decir('     Lo que decía la página (por si cambió la frase):');
            for (const c of encabezado.candidatos.slice(0, 3)) decir(`       «${c}»`);
          } else {
            decir('     La página no tenía ningún texto con «resultados» ni «results».');
            decir('     Eso es el DOM cambiado: hay que revisar `apps/worker/src/salesnav.ts`.');
          }
          decir('     Mientras tanto, el total se carga a mano desde Automatizaciones.');
        } else if (medida.paginas === 0) {
          // 0 leído de verdad ≠ no se pudo leer. Guardar 0 no cambiaría nada
          // (0 es «sin medir»), así que lo único útil es decirlo.
          ilegibles++;
          decir(`  ✗ La búsqueda dice ${medida.resultados} resultados: no hay a quién invitar.`);
          decir('     Queda sin medir a propósito. Revisá los filtros en Sales Navigator.');
        } else {
          await guardarMedida(pb, lista.id, medida.paginas);
          medidas++;
          decir(
            `  ✓ ${medida.resultados} resultados · ${lista.por_pagina} por página → ` +
              `${medida.paginas} páginas${lista.paginas > 0 ? ` (antes decía ${lista.paginas})` : ''}`,
          );
          decir(`     Encabezado leído: «${encabezado.texto}»`);
          if (medida.topeado) {
            decir(
              `     ⚠ La búsqueda tiene más de lo que Sales Navigator deja paginar: se topeó en ${TOPE_DE_PAGINAS}.`,
            );
            decir('       Para llegar al resto hay que partir la búsqueda con más filtros.');
          }
          if (encabezado.distintos.length > 1) {
            decir(
              `     ⚠ La página tenía ${encabezado.distintos.length} conteos distintos (${encabezado.distintos.join(', ')}).`,
            );
            decir('       Se tomó el de más arriba. Si no era ése, corregilo desde Automatizaciones.');
          }
        }
      }

      if (i === listas.length - 1) break;

      // EL RITMO, y lo decide core. Si acá apareciera un número —una espera, un
      // cada cuántos— estaría mal ubicado: va a la configuración de §7.3, la
      // misma que usa `invitar`.
      const ritmo = ritmoDespuesDe(i + 1, config, sortear(), latencias.media());
      if (ritmo.cortar) {
        decir('');
        decir(`Se llegó al tope de la corrida. Quedaron ${listas.length - i - 1} sin medir: volvé a correr esto.`);
        break;
      }
      for (const pausa of ritmo.pausas) {
        decir(`  Pausa ${pausa.tipo}: ${Math.round(pausa.ms / 1000)} s.`);
        await dormir(pausa.ms);
      }
      if (ritmo.resetNavegador) {
        decir('  Reiniciando Chrome: limpia la huella acumulada.');
        sesion = await reabrirChrome(sesion, perfilDeChrome);
      }
      await dormir(ritmo.esperaMs);
    }

    decir('');
    decir(`Fin. ${medidas} lista(s) medida(s), ${ilegibles} sin poder medir.`);
    if (medidas) {
      decir('  Automatizaciones ya lo muestra. Para ver a quién le toca ahora:');
      decir(`     node apps/worker/src/invitar.ts ${cuenta.abrev} --simular`);
    }
    return ilegibles && !medidas ? 1 : 0;
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
