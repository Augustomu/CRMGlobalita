/// <reference path="../../../.pb/pb_data/types.d.ts" />

// La agenda de Google: traerla y volcarla. Lo llama contactos.pb.js.
//
// Está aparte del handler por la misma razón que google.js: en PocketBase cada
// handler corre en un runtime JS aislado y NO ve el scope del archivo que lo
// registró. Lo común va en un módulo y se pide con `require` adentro.
//
// LA DECISION NO ESTA ACA. Qué nombre le toca a cuál fila lo decide
// `core/agenda.ts`, que tiene los tests. Acá está la copia de esas dos
// funciones traducida a lo que el runtime de PocketBase entiende — no importa
// TypeScript ni puede alcanzar `packages/core`.
//
// ⚠ SON DOS COPIAS DE LA MISMA REGLA y eso es deuda, anotada como tal. La
// alternativa sería que el volcado lo hiciera el worker —que sí puede importar
// core— en vez de un endpoint. Si esto crece, se muda ahí.

const PEOPLE = 'https://people.googleapis.com/v1/people/me/connections';

/** Los últimos ocho dígitos. Copia de `core/agenda.ts colaDelTelefono`. */
function cola(tel) {
  const d = String(tel || '').replace(/\D+/g, '');
  return d.length >= 8 ? d.slice(-8) : '';
}

/**
 * Trae la agenda entera, paginando.
 *
 * Google devuelve de a 1000 como máximo. Se pide sólo lo que se usa —nombre y
 * teléfonos— para no arrastrar direcciones, cumpleaños ni fotos de gente que no
 * tiene nada que ver con el CRM.
 *
 * El tope de 20 páginas es una red: 20.000 contactos es más de lo que tiene
 * cualquier agenda personal, y sin tope un `nextPageToken` que no avanza sería
 * un bucle infinito adentro de un servidor.
 */
function traerAgenda(token) {
  const salida = [];
  let pageToken = '';

  for (let i = 0; i < 20; i++) {
    const url =
      PEOPLE +
      '?personFields=names,phoneNumbers&pageSize=1000' +
      (pageToken ? '&pageToken=' + encodeURIComponent(pageToken) : '');

    const res = $http.send({
      url,
      method: 'GET',
      headers: { Authorization: 'Bearer ' + token },
      timeout: 30,
    });

    if (res.statusCode !== 200) {
      const d = (res.json && res.json.error && res.json.error.message) || '';
      throw new Error('HTTP ' + res.statusCode + (d ? ' — ' + d : ''));
    }

    const conexiones = (res.json && res.json.connections) || [];
    for (const p of conexiones) {
      const nombre =
        (p.names && p.names.length && String(p.names[0].displayName || '').trim()) || '';
      const telefonos = ((p.phoneNumbers || []).map((t) => String(t.value || ''))).filter(Boolean);
      if (nombre && telefonos.length) salida.push({ nombre, telefonos });
    }

    pageToken = (res.json && res.json.nextPageToken) || '';
    if (!pageToken) break;
  }

  return salida;
}

/**
 * El índice teléfono → nombre. Copia de `core/agenda.ts indiceDeLaAgenda`.
 *
 * Un número que aparece con DOS nombres distintos se descarta: es el teléfono
 * de la empresa guardado en la ficha de tres personas. Elegir uno le pondría a
 * un chat el nombre de otro, y un nombre equivocado no se nota — un número sí
 * se reconoce.
 */
function indice(contactos) {
  const porCola = {};
  for (const c of contactos) {
    for (const t of c.telefonos) {
      const k = cola(t);
      if (!k) continue;
      if (!porCola[k]) porCola[k] = {};
      porCola[k][c.nombre] = true;
    }
  }
  const i = {};
  for (const k of Object.keys(porCola)) {
    const nombres = Object.keys(porCola[k]);
    if (nombres.length === 1) i[k] = nombres[0];
  }
  return i;
}

/**
 * Escribe los nombres que faltan, en los chats y en los perfiles.
 *
 * SOLO LOS QUE NO TIENEN. Una fila con nombre puede haberlo recibido de una
 * persona, y la agenda no sabe más que ella. Además, escribir de más mueve la
 * fecha de modificación y el lead sube en cualquier lista ordenada por fecha
 * sin que haya pasado nada.
 */
function ponerNombres(contactos) {
  const i = indice(contactos);
  const r = { chats: 0, perfiles: 0 };

  for (const fila of $app.findAllRecords('chat_personal')) {
    if (String(fila.getString('nombre') || '').trim()) continue;
    const n = i[cola(fila.getString('telefono'))];
    if (!n) continue;
    fila.set('nombre', n);
    $app.save(fila);
    r.chats++;
  }

  for (const fila of $app.findAllRecords('perfil')) {
    if (String(fila.getString('nombre') || '').trim()) continue;
    const n = i[cola(fila.getString('telefono'))];
    if (!n) continue;
    fila.set('nombre', n);
    $app.save(fila);
    r.perfiles++;
  }

  return r;
}

module.exports = { traerAgenda, ponerNombres };

/**
 * Por que fallo la agenda. Copia de `core/agenda.ts porQueFalloLaAgenda`.
 *
 * ESTA COPIA EXISTE porque los hooks de PocketBase corren en su propio runtime
 * y no alcanzan `packages/core`. La decision —y sus tests— viven alla; si se
 * toca una, se tocan las dos en la misma tanda.
 *
 * LO QUE DECIDE, y por que importa: el 11/09 Google contesto «HTTP 403 — People
 * API has not been used in project ... or it is disabled» y este archivo lo
 * leyo como «le falta el permiso, desconectala y volve a conectarla». Augusto
 * lo hizo, y los contactos siguieron sin aparecer, porque el interruptor esta
 * en la consola de Google Cloud. Tres reportes del mismo sintoma salieron de
 * ese diagnostico equivocado.
 */
function porQueFalloLaAgenda(mensaje) {
  const t = String(mensaje == null ? '' : mensaje);
  const b = t.toLowerCase();

  const enlaceDeLaConsola = () => {
    const m = /https:\/\/console\.(?:developers|cloud)\.google\.com\/[^\s"'<>)]+/.exec(t);
    return m ? m[0].replace(/[.,;]+$/, '') : '';
  };

  // La API apagada se mira PRIMERO: los dos son 403 y este mensaje es el mas
  // especifico. Al reves, el generico se queda con todos los casos y nadie se
  // entera nunca de que hay un interruptor sin prender.
  if (
    b.indexOf('has not been used in project') >= 0 ||
    b.indexOf('accessnotconfigured') >= 0 ||
    b.indexOf('service_disabled') >= 0 ||
    (b.indexOf('people api') >= 0 && b.indexOf('disabled') >= 0)
  ) {
    return {
      causa: 'api_apagada',
      que_hacer:
        'La agenda de Google esta apagada en el proyecto: hay que prender la People API una vez, ' +
        'en la consola de Google Cloud. No se arregla desconectando y volviendo a conectar la cuenta. ' +
        'Despues de prenderla, Google tarda un par de minutos.',
      enlace: enlaceDeLaConsola() || 'https://console.cloud.google.com/apis/library/people.googleapis.com',
    };
  }

  if (
    b.indexOf('insufficient authentication scopes') >= 0 ||
    b.indexOf('access_token_scope_insufficient') >= 0 ||
    b.indexOf('insufficient permission') >= 0
  ) {
    return {
      causa: 'sin_permiso',
      que_hacer:
        'Esta cuenta se conecto antes de que el CRM pidiera leer la agenda, asi que su permiso no ' +
        'la incluye. Desconectala y volve a conectarla: es una sola vez.',
      enlace: '',
    };
  }

  if (b.indexOf('invalid_grant') >= 0 || b.indexOf('unauthorized_client') >= 0 || /\b401\b/.test(b)) {
    return {
      causa: 'permiso_vencido',
      que_hacer:
        'Google dejo de aceptar el permiso de esta cuenta —lo revocaron, o vencio. Volve a conectarla.',
      enlace: '',
    };
  }

  // Sin inventar un diagnostico: se muestra lo que dijo Google, que es lo unico
  // cierto que hay.
  return { causa: 'otra', que_hacer: t.trim() || 'Google no dijo por que.', enlace: '' };
}

module.exports.porQueFalloLaAgenda = porQueFalloLaAgenda;

/**
 * El mismo fallo, en UN renglon para mostrar.
 *
 * Junta el quien, el que hacer y el enlace. Esta aca y no en cada llamador
 * porque los dos lugares que lo muestran —la vuelta de Google y el boton de
 * reintentar— tienen que decir exactamente lo mismo.
 */
function comoSeCuentaElFallo(quien, mensaje) {
  const r = porQueFalloLaAgenda(mensaje);
  return quien + ': ' + r.que_hacer + (r.enlace ? ' → ' + r.enlace : '');
}

module.exports.comoSeCuentaElFallo = comoSeCuentaElFallo;
