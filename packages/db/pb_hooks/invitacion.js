/// <reference path="../../../.pb/pb_data/types.d.ts" />

// Apoyo del hook de invitaciones: buscar el token, emitirlo y mandar el correo.
//
// LAS REGLAS SON LAS DE `packages/core/src/alta.ts`.
//
// Estan escritas dos veces —aca en JS para el servidor de PocketBase, alla en
// TS para la web— porque goja no puede importar el core. Eso es exactamente el
// tipo de duplicacion que se desincroniza sola, asi que hay un test en
// `packages/core/test/alta.test.ts` que LEE este archivo y falla si los
// numeros o el texto del correo dejan de coincidir. Si tocas algo aca, tocalo
// alla; el test te lo va a recordar igual.

const DIAS_DE_INVITACION = 7;
const LARGO_MINIMO_CLAVE = 8;
const PARAMETRO_INVITACION = 'invitacion';

const MENSAJE_ESTADO = {
  usada: 'Ese enlace ya se uso. Entra con tu contraseña, o pedi que te la reinicien.',
  vencida: 'Ese enlace vencio. Pedile otro a quien te dio de alta.',
  inexistente: 'Ese enlace no existe.',
};

/** Lo que hace falta del entorno para que el correo salga. */
function config() {
  return {
    appUrl: (process.env.APP_URL || '').replace(/\/+$/, ''),
    remitente: process.env.MAIL_DESDE || '',
  };
}

/** §6.1: solo con la clave `usuarios` se da de alta a alguien. */
function puedeInvitar(auth) {
  if (!auth) return false;
  const permisos = auth.get('permisos') || {};
  if (Object.prototype.hasOwnProperty.call(permisos, 'usuarios')) return Boolean(permisos.usuarios);
  return String(auth.get('rol') || '') === 'administrador';
}

function problemaDeClave(clave) {
  const c = String(clave || '');
  if (c.length < LARGO_MINIMO_CLAVE) {
    return 'La contraseña tiene que tener al menos ' + LARGO_MINIMO_CLAVE + ' caracteres.';
  }
  return null;
}

function venceEn(ahoraIso, dias) {
  const t = Date.parse(ahoraIso);
  return new Date(t + (dias || DIAS_DE_INVITACION) * 86400000).toISOString();
}

function enlaceDeInvitacion(appUrl, token) {
  return String(appUrl).replace(/\/+$/, '') + '/?' + PARAMETRO_INVITACION + '=' + encodeURIComponent(token);
}

function primerNombre(nombre) {
  const n = String(nombre || '').trim();
  return n ? n.split(/\s+/)[0] : '';
}

function correoDeInvitacion(o) {
  const saludo = primerNombre(o.nombre) ? 'Hola ' + primerNombre(o.nombre) + ',' : 'Hola,';
  const dias = o.dias || DIAS_DE_INVITACION;
  return {
    asunto: 'Tu acceso al CRM de Globalita',
    cuerpo: [
      saludo,
      '',
      o.quienInvita + ' te dio acceso al CRM de prospección.',
      '',
      'Vas a entrar con este usuario: ' + o.email,
      '',
      'Para elegir tu contraseña, entrá acá:',
      o.enlace,
      '',
      'El enlace sirve una sola vez y vence en ' + dias + ' días. Si se te vence, pedile otro a ' + o.quienInvita + '.',
    ].join('\n'),
  };
}

function correoDeReinicio(o) {
  const saludo = primerNombre(o.nombre) ? 'Hola ' + primerNombre(o.nombre) + ',' : 'Hola,';
  const dias = o.dias || DIAS_DE_INVITACION;
  return {
    asunto: 'Volvé a elegir tu contraseña del CRM',
    cuerpo: [
      saludo,
      '',
      o.quienInvita + ' reinició tu contraseña del CRM. La anterior ya no sirve.',
      '',
      'Tu usuario sigue siendo: ' + o.email,
      '',
      'Para elegir una nueva, entrá acá:',
      o.enlace,
      '',
      'El enlace sirve una sola vez y vence en ' + dias + ' días.',
      '',
      'Si no pediste esto, avisale a quien administra el CRM.',
    ].join('\n'),
  };
}

/**
 * El cuerpo en HTML.
 *
 * Se manda texto Y html: hay clientes de correo que no muestran html, y un
 * mail de acceso que llega en blanco es un llamado telefonico.
 */
function aHtml(cuerpo, enlace) {
  const lineas = cuerpo.split('\n');
  const partes = [];
  for (const l of lineas) {
    if (l === enlace) {
      partes.push(
        '<p style="margin:18px 0"><a href="' +
          l +
          '" style="display:inline-block;padding:10px 18px;border-radius:8px;' +
          'background:#0F6E56;color:#ffffff;text-decoration:none;font-weight:600">' +
          'Elegir mi contraseña</a></p>',
      );
    } else if (l === '') {
      partes.push('');
    } else {
      partes.push('<p style="margin:6px 0">' + l.replace(/&/g, '&amp;').replace(/</g, '&lt;') + '</p>');
    }
  }
  return (
    '<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;font-size:14px;' +
    'line-height:1.5;color:#2D2D2A;max-width:520px">' +
    partes.join('\n') +
    '</div>'
  );
}

/**
 * Corta con un error que el navegador pueda LEER.
 *
 * Vive en el modulo y no en el archivo del hook por una razon del runtime:
 * cada handler de PocketBase corre en su propia VM y NO ve las funciones
 * declaradas al lado del `routerAdd`. Una funcion suelta ahi arriba da
 * "ReferenceError" en tiempo de pedido, que PocketBase convierte en un
 * "Something went wrong" generico — el mensaje real se pierde y quien invita no
 * se entera de por que no pudo. Por eso todo lo compartido pasa por `require`.
 *
 * Y por eso mismo devolver `e.json(400, {error})` tampoco sirve: PocketBase lo
 * toma como fallo del handler y lo reemplaza por el mismo generico. El error
 * tipado es lo unico que llega tal cual.
 */
function malo(codigo, mensaje) {
  if (codigo === 403) throw new ForbiddenError(mensaje);
  if (codigo === 404) throw new NotFoundError(mensaje);
  throw new BadRequestError(mensaje);
}

/** El token, hasheado como se guarda. */
function hash(token) {
  return $security.sha256(String(token));
}

/** Las invitaciones de esa persona que todavia nadie uso. */
function abiertasDe(app, usuarioId) {
  try {
    return app.findRecordsByFilter('invitacion', 'usuario = {:u} && usada_en = ""', '-created', 50, 0, {
      u: usuarioId,
    });
  } catch (_) {
    return [];
  }
}

/**
 * Busca un token y dice en que estado esta.
 *
 * Devuelve siempre la misma forma: `{ estado, fila?, usuario? }`.
 */
function buscar(app, token) {
  const t = String(token || '');
  if (!t) return { estado: 'inexistente' };

  let fila = null;
  try {
    fila = app.findFirstRecordByData('invitacion', 'token_hash', hash(t));
  } catch (_) {
    return { estado: 'inexistente' };
  }

  // El orden importa: una usada sigue siendo usada aunque ademas este vencida.
  // Si mandara la fecha, alguien que ya entro veria "pedi otro enlace" cuando
  // en realidad su cuenta funciona.
  if (String(fila.get('usada_en') || '')) return { estado: 'usada', fila: fila };
  if (String(fila.get('expira') || '') <= new Date().toISOString()) {
    return { estado: 'vencida', fila: fila };
  }

  let usuario = null;
  try {
    usuario = app.findRecordById('users', String(fila.get('usuario')));
  } catch (_) {
    return { estado: 'inexistente' };
  }
  return { estado: 'valida', fila: fila, usuario: usuario };
}

/**
 * Emite un token nuevo y manda el correo.
 *
 * Las invitaciones anteriores de esa persona se queman: si no, un correo viejo
 * sigue sirviendo para elegirle la contraseña a alguien.
 */
function emitir(app, usuario, quien, motivo, cfg) {
  const ahora = new Date().toISOString();

  for (const otra of abiertasDe(app, usuario.id)) {
    otra.set('usada_en', ahora);
    app.save(otra);
  }

  const token = $security.randomString(40);
  const expira = venceEn(ahora);

  const fila = new Record(app.findCollectionByNameOrId('invitacion'));
  fila.set('usuario', usuario.id);
  fila.set('token_hash', hash(token));
  fila.set('expira', expira);
  fila.set('motivo', motivo);
  if (quien) fila.set('creada_por', quien.id);
  app.save(fila);

  const enlace = enlaceDeInvitacion(cfg.appUrl, token);
  const armar = motivo === 'reinicio' ? correoDeReinicio : correoDeInvitacion;
  const correo = armar({
    nombre: usuario.get('name'),
    email: usuario.get('email'),
    quienInvita: (quien && quien.get('name')) || 'El administrador',
    enlace: enlace,
  });

  // ------------------------------------------------------------------
  // SIN SMTP NO SE INTENTA: se dice.
  //
  // Antes se llamaba igual y el fallo volvia como el texto crudo de la
  // excepcion, que no le dice a nadie que hay que ir a Settings. Augusto el
  // 10/09: «hay un bug, cuando intento enviar la invitacion no aparece la
  // confirmacion de enviado». No habia bug en el envio: no habia servidor de
  // correo configurado, y el mensaje no lo decia.
  let smtpListo = false;
  try {
    smtpListo = Boolean(app.settings().smtp && app.settings().smtp.enabled);
  } catch (_) {}
  if (!smtpListo) {
    fila.set('usada_en', ahora);
    try { app.save(fila); } catch (_) {}
    return {
      ok: false,
      error:
        'El servidor de correo no esta configurado, asi que la invitacion no se mando. ' +
        'Va en el panel de PocketBase, en Settings > Mail settings (esta el paso a paso ' +
        'en deploy/PASO-A-PASO.md). Local y produccion se configuran por separado.',
    };
  }

  try {
    // EL REMITENTE SALE DEL PANEL, NO DEL ENTORNO. Estaba al reves y era un
    // bug esperando: `MAIL_DESDE` trae por defecto `crm@globalita.test`, un
    // dominio inventado, y con eso el From no coincide con la casilla con la
    // que uno se autentica. Hostinger —y cualquier servidor serio— rechaza
    // mandar en nombre de un dominio que la cuenta no puede usar.
    //
    // El `senderAddress` del panel se carga JUNTO con el usuario y la clave
    // del SMTP, asi que es el unico que se sabe alineado. `MAIL_DESDE` queda
    // como respaldo para un despliegue que configure el correo por entorno.
    const remitente = app.settings().meta.senderAddress || cfg.remitente;
    const mensaje = new MailerMessage({
      from: { address: remitente, name: 'CRM Globalita' },
      to: [{ address: usuario.get('email') }],
      subject: correo.asunto,
      text: correo.cuerpo,
      html: aHtml(correo.cuerpo, enlace),
    });
    app.newMailClient().send(mensaje);
  } catch (err) {
    // La invitacion queda escrita pero sin correo no sirve de nada: se marca
    // usada para que no quede un token vivo que nadie recibio.
    fila.set('usada_en', ahora);
    try {
      app.save(fila);
    } catch (_) {}
    return {
      ok: false,
      error:
        'No se pudo mandar el correo: ' +
        String(err) +
        '. Revisa la configuracion de SMTP (deploy/PASO-A-PASO.md).',
    };
  }

  return { ok: true, expira: expira };
}

module.exports = {
  DIAS_DE_INVITACION,
  malo,
  LARGO_MINIMO_CLAVE,
  MENSAJE_ESTADO,
  PARAMETRO_INVITACION,
  abiertasDe,
  buscar,
  config,
  correoDeInvitacion,
  correoDeReinicio,
  emitir,
  enlaceDeInvitacion,
  problemaDeClave,
  puedeInvitar,
  venceEn,
};
