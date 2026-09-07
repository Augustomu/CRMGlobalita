/// <reference path="../../../.pb/pb_data/types.d.ts" />

// Las piezas compartidas del enlace con Google Calendar.
//
// POR QUE ESTO ES UN MODULO Y NO ESTA ARRIBA EN EL ARCHIVO DE HOOKS. En
// PocketBase cada handler corre en un runtime JS aislado y NO ve el scope del
// archivo que lo registro: una funcion declarada arriba simplemente no existe
// adentro, y el pedido falla con un 400 sin explicacion. La unica forma de
// compartir codigo es require() DENTRO de cada handler.
//
// El nombre no termina en `.pb.js` a proposito: asi PocketBase no lo carga como
// hooks, solo se usa cuando alguien lo pide.

const GOOGLE_AUTH = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN = 'https://oauth2.googleapis.com/token';
const GOOGLE_API = 'https://www.googleapis.com/calendar/v3';
const SCOPE = 'https://www.googleapis.com/auth/calendar.events';

/** Lo que hace falta tener puesto en el VPS. Ver deploy/PASO-A-PASO.md. */
function config() {
  return {
    clientId: $os.getenv('GOOGLE_CLIENT_ID'),
    clientSecret: $os.getenv('GOOGLE_CLIENT_SECRET'),
    appUrl: ($os.getenv('APP_URL') || '').replace(/\/+$/, ''),
  };
}

function configurado(c) {
  return Boolean(c.clientId && c.clientSecret && c.appUrl);
}

function redirectUri(c) {
  return c.appUrl + '/api/google/callback';
}

/** La fila de Google de un usuario, o null si no conecto. */
function cuentaDe(usuarioId) {
  try {
    return $app.findFirstRecordByFilter('google_cuenta', 'usuario = {:u}', { u: usuarioId });
  } catch (_) {
    // findFirstRecordByFilter tira si no hay filas; no es un error.
    return null;
  }
}

function form(campos) {
  return Object.keys(campos)
    .map((k) => k + '=' + encodeURIComponent(campos[k]))
    .join('&');
}

/**
 * Un access_token fresco a partir del refresh_token.
 *
 * No se cachea: duran una hora, se piden pocas veces por dia, y guardarlos
 * seria una llave mas para custodiar sin ganar nada.
 */
function accessToken(c, refreshToken) {
  const res = $http.send({
    url: GOOGLE_TOKEN,
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form({
      client_id: c.clientId,
      client_secret: c.clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
    timeout: 20,
  });

  if (res.statusCode !== 200 || !res.json || !res.json.access_token) {
    // `invalid_grant` = la persona revoco el permiso desde su cuenta de Google.
    // Se arregla volviendo a conectar, no reintentando; por eso se distingue.
    const d = (res.json && (res.json.error_description || res.json.error)) || 'HTTP ' + res.statusCode;
    throw new Error(d);
  }
  return res.json.access_token;
}

/** El fin de la reunion, a partir del inicio y la duracion. */
function finDe(inicioIso, minutos) {
  const d = new Date(String(inicioIso).replace(' ', 'T'));
  return new Date(d.getTime() + (minutos || 30) * 60000).toISOString();
}

/**
 * Crea o actualiza el evento de una reunion. Devuelve el estado a guardar.
 *
 * D10: si la reunion ya tiene `google_event_id` se ACTUALIZA ese evento. Crear
 * uno nuevo al reagendar llenaria el calendario de duplicados, que es lo que
 * pasaba en el sistema viejo.
 *
 * Nunca lanza: devuelve {estado, detalle} y el que llama decide. Una reunion no
 * se puede perder porque Google este caido.
 */
function sincronizar(reunion) {
  const c = config();

  const inicio = String(reunion.get('inicio') || '');
  if (!inicio) return { estado: 'omitida', detalle: 'sin fecha' };

  // Solo se agendan las que todavia no pasaron. Las historicas —los 298 eventos
  // recuperados del Calendar— no tienen que volver a crearse.
  if (new Date(inicio.replace(' ', 'T')) < new Date()) {
    return { estado: 'omitida', detalle: 'la reunion ya paso' };
  }

  if (!configurado(c)) {
    return { estado: 'sin_conexion', detalle: 'Google no esta configurado en el servidor' };
  }

  // El calendario es el de quien tiene el lead asignado: la reunion tiene que
  // caer en la agenda de quien la va a tener.
  let usuarioId = '';
  try {
    usuarioId = $app.findRecordById('lead', reunion.get('lead')).get('asignado');
  } catch (_) {}
  if (!usuarioId) return { estado: 'sin_conexion', detalle: 'el lead no tiene a nadie asignado' };

  const cuenta = cuentaDe(usuarioId);
  if (!cuenta || !cuenta.get('refresh_token')) {
    return { estado: 'sin_conexion', detalle: 'ese usuario todavia no conecto su Google Calendar' };
  }

  let token;
  try {
    token = accessToken(c, cuenta.get('refresh_token'));
  } catch (err) {
    return { estado: 'error', detalle: 'no se pudo renovar el permiso: ' + err.message };
  }

  const zona = reunion.get('zona') || 'UTC';
  const evento = {
    summary: reunion.get('titulo_evento') || 'Reunion',
    description: reunion.get('descripcion_evento') || '',
    start: { dateTime: new Date(inicio.replace(' ', 'T')).toISOString(), timeZone: zona },
    end: { dateTime: finDe(inicio, reunion.get('duracion_min')), timeZone: zona },
  };
  const invitado = String(reunion.get('invitado_email') || '').trim();
  if (invitado) evento.attendees = [{ email: invitado }];

  const calendario = encodeURIComponent(cuenta.get('calendario') || 'primary');
  const eventId = String(reunion.get('google_event_id') || '');
  const base = GOOGLE_API + '/calendars/' + calendario + '/events';

  const res = $http.send({
    url: eventId ? base + '/' + encodeURIComponent(eventId) + '?sendUpdates=all' : base + '?sendUpdates=all',
    method: eventId ? 'PATCH' : 'POST',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify(evento),
    timeout: 25,
  });

  if (res.statusCode < 200 || res.statusCode > 299) {
    const d = (res.json && res.json.error && res.json.error.message) || 'HTTP ' + res.statusCode;
    return { estado: 'error', detalle: d };
  }

  return {
    estado: 'ok',
    detalle: eventId ? 'evento actualizado' : 'evento creado',
    eventId: (res.json && res.json.id) || eventId,
    calendario: cuenta.get('calendario') || 'primary',
  };
}

module.exports = {
  GOOGLE_AUTH,
  GOOGLE_TOKEN,
  SCOPE,
  config,
  configurado,
  redirectUri,
  cuentaDe,
  form,
  sincronizar,
};

/**
 * Guarda el resultado del intento con una consulta directa.
 *
 * NO se usa `$app.save()` sobre el mismo registro: guardarlo dentro de su propio
 * hook deja la peticion colgada — la reunion se crea pero la respuesta nunca
 * vuelve al navegador. Ademas volveria a disparar los hooks. Un UPDATE plano no
 * tiene esos dos problemas, y son cuatro columnas de estado, nada mas.
 */
function anotar(id, r) {
  const sql =
    'UPDATE reunion SET sync = {:s}, sync_detalle = {:d}' +
    (r.eventId ? ', google_event_id = {:e}, google_calendar_id = {:c}' : '') +
    ' WHERE id = {:id}';

  const params = r.eventId
    ? { s: r.estado, d: r.detalle, e: r.eventId, c: r.calendario, id }
    : { s: r.estado, d: r.detalle, id };

  $app.db().newQuery(sql).bind(params).execute();
}

/** Intentar, anotar, y no romper nunca. Es lo que llaman los dos hooks. */
function sincronizarYAnotar(record) {
  try {
    anotar(record.id, sincronizar(record));
  } catch (err) {
    // La reunion ya esta guardada y tiene que quedar asi aunque Google este
    // caido: el error se registra, no se propaga.
    $app.logger().error('google-calendar', 'reunion', record.id, 'err', String(err));
  }
}

module.exports.anotar = anotar;
module.exports.sincronizarYAnotar = sincronizarYAnotar;
