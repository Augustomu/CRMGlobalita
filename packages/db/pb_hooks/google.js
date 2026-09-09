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
// QUE PERMISOS SE PIDEN, y por que son dos.
//
// - calendar.events: crear y actualizar los eventos de las reuniones. Es el
//   que hace que el CRM escriba.
// - calendar.readonly: LEER la disponibilidad de los otros calendarios que la
//   persona ya tiene en su lista.
//
// El segundo no estaba y hacia falta. Se descubrio el 09/09/2026 mirando la
// lista de calendarios de Augusto: `alejandroc@globalita.io` —la cuenta AL—
// aparece ahi con accessRole "owner". O sea que la agenda de Alejandro NO hay
// que pedirla ni raspar ninguna pagina: ya se puede leer con la misma conexion,
// y lo unico que faltaba era el permiso de lectura.
//
// Van juntos en el mismo consentimiento a proposito: agregar un alcance despues
// obliga a que cada persona vuelva a conectar su cuenta.
const SCOPE =
  'https://www.googleapis.com/auth/calendar.events ' +
  'https://www.googleapis.com/auth/calendar.readonly';

/**
 * Lo que hace falta tener puesto. Ver deploy/PASO-A-PASO.md, paso 4.6.
 *
 * SON DOS URL, no una, y en produccion son la misma.
 *
 * - APP_URL es donde la persona ve la aplicacion. Ahi vuelve el navegador
 *   despues de dar el permiso.
 * - PB_URL es donde CONTESTA PocketBase, que es lo unico que le importa a
 *   Google: el redirect_uri tiene que apuntar a una ruta de este servidor.
 *
 * En el VPS PocketBase sirve la app, asi que alcanza con APP_URL y PB_URL se
 * cae a lo mismo. En desarrollo son distintas —la app la sirve Vite en :5173 y
 * PocketBase contesta en :8090— y sin separarlas la vuelta de Google aterriza
 * en un 404: la conexion queda guardada pero parece que fallo.
 */
function config() {
  const app = ($os.getenv('APP_URL') || '').replace(/\/+$/, '');
  return {
    clientId: $os.getenv('GOOGLE_CLIENT_ID'),
    clientSecret: $os.getenv('GOOGLE_CLIENT_SECRET'),
    appUrl: app,
    pbUrl: ($os.getenv('PB_URL') || '').replace(/\/+$/, '') || app,
  };
}

function configurado(c) {
  return Boolean(c.clientId && c.clientSecret && c.appUrl);
}

function redirectUri(c) {
  // Contra PB_URL: la ruta la sirve PocketBase, no la aplicacion de React.
  // Este string tiene que coincidir LETRA POR LETRA con el que se cargo en la
  // consola de Google —barra final incluida— o Google contesta redirect_uri_mismatch.
  return c.pbUrl + '/api/google/callback';
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

  // De QUIEN es la agenda donde cae la reunion.
  //
  // Primero `reunion.calendario`, que es lo que eligio la pantalla al crearla
  // (FechaReunion guarda ahi el usuario que agenda). Recien si esta vacio se
  // cae a `lead.asignado`, que es el dueno del seguimiento.
  //
  // EL ORDEN IMPORTA, y no es teorico: mirando solo `asignado` esto no
  // funcionaba nunca. Los 242 leads tienen `asignado` vacio —la asignacion es
  // opcional y todavia no se uso—, asi que toda reunion nueva terminaba en
  // "el lead no tiene a nadie asignado" y jamas llegaba a Google. Ademas,
  // `calendario` es el campo que la agenda usa para saber de quien es cada
  // bloque: si el evento se escribiera en otra agenda que la que dibuja la
  // grilla, la pantalla estaria mintiendo.
  let usuarioId = String(reunion.get('calendario') || '');
  if (!usuarioId) {
    try {
      usuarioId = $app.findRecordById('lead', reunion.get('lead')).get('asignado');
    } catch (_) {}
  }
  if (!usuarioId) {
    return { estado: 'sin_conexion', detalle: 'la reunion no tiene calendario ni el lead un asignado' };
  }

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

  // A QUIEN SE LE AVISA, y por que no siempre.
  //
  // Mover una reunion que todavia no paso es reagendarla: el invitado tiene
  // que enterarse, y para eso esta `sendUpdates=all` (§8.3).
  //
  // Corregir la fecha de una que YA PASO es otra cosa: es arreglar un dato.
  // Mandarle a alguien «tu reunion se movio» por una reunion de hace ocho
  // meses no es avisarle nada, es ruido — y encima en el CRM eso pasa
  // justamente cuando uno esta ordenando el historico, o sea de a muchas.
  const yaPaso = new Date(String(inicio).replace(' ', 'T')).getTime() < Date.now();
  const aviso = yaPaso ? 'none' : 'all';

  const res = $http.send({
    url: eventId
      ? base + '/' + encodeURIComponent(eventId) + '?sendUpdates=' + aviso
      : base + '?sendUpdates=' + aviso,
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
    // Quien resulto ser el dueno, para dejarlo escrito si venia del asignado.
    duenio: usuarioId,
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
  // `calendario = ''` en el WHERE de SET: solo se completa si estaba vacio.
  // Pisarlo siempre le sacaria la reunion de la agenda a quien la tenia.
  const sql =
    'UPDATE reunion SET sync = {:s}, sync_detalle = {:d}' +
    (r.eventId ? ', google_event_id = {:e}, google_calendar_id = {:c}' : '') +
    (r.duenio ? ", calendario = CASE WHEN calendario = '' OR calendario IS NULL THEN {:u} ELSE calendario END" : '') +
    ' WHERE id = {:id}';

  const params = { s: r.estado, d: r.detalle, id };
  if (r.eventId) {
    params.e = r.eventId;
    params.c = r.calendario;
  }
  if (r.duenio) params.u = r.duenio;

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

// ===========================================================================
// LA VUELTA: de Google al CRM.
//
// La dispara el reloj de google-entrada.pb.js. Ver ahi el porque de cada
// decision; aca esta el como.
// ===========================================================================

/**
 * ESPEJO de `cambioDeGoogle()` de packages/core/src/sincronizar.ts.
 *
 * La version buena vive alla, en TypeScript y con nueve tests. Esta existe
 * porque el motor JS de PocketBase no puede cargar TypeScript y los hooks no
 * tienen paso de build. SI SE TOCA UNA, SE TOCAN LAS DOS.
 *
 * Lo que decide: si hubo cambio de verdad. Equivocarse hacia el lado de "si"
 * hace que la reunion se reescriba, que el hook de salida la mande a Google, y
 * que Google le mande un mail al invitado. Cada cinco minutos.
 */
function cambioDeGoogle(crm, evento) {
  const sinCambio = (motivo) => ({ hay: false, campos: {}, motivo });
  const instante = (x) => new Date(String(x).replace(' ', 'T')).getTime();

  if (evento.cancelado) {
    if (crm.estado === 'cancelada') return sinCambio('ya estaba cancelada');
    return { hay: true, campos: { estado: 'cancelada' }, motivo: 'cancelada en Google Calendar' };
  }

  if (!evento.inicio || !evento.fin) return sinCambio('el evento no tiene horario');

  const desde = instante(evento.inicio);
  const hasta = instante(evento.fin);
  if (!isFinite(desde) || !isFinite(hasta)) return sinCambio('el evento vino con una fecha ilegible');

  const duracion = Math.round((hasta - desde) / 60000);
  if (duracion <= 0) return sinCambio('el evento termina antes de empezar');

  const campos = {};
  // Por INSTANTE, no por texto: "2026-09-15 16:00:00.000Z" y
  // "2026-09-15T10:00:00-06:00" son la misma hora.
  if (instante(crm.inicio) !== desde) campos.inicio = new Date(desde).toISOString().replace('T', ' ');
  if (Number(crm.duracion_min) !== duracion) campos.duracion_min = duracion;

  if (!campos.inicio && campos.duracion_min === undefined) return sinCambio('sin cambios');

  const partes = [];
  if (campos.inicio) partes.push('movida');
  if (campos.duracion_min !== undefined) partes.push(duracion + ' min');
  return { hay: true, campos, motivo: partes.join(', ') + ' desde Google Calendar' };
}

/**
 * Escribe el cambio en la reunion. Devuelve true si toco algo.
 *
 * CON SQL PLANO, A PROPOSITO. `$app.save()` dispararia el hook de salida, que
 * mandaria la reunion de vuelta a Google, que en la vuelta siguiente la traeria
 * como un cambio: eco infinito, con un mail al lead en cada rebote. Una
 * consulta directa no dispara hooks. Es el mismo motivo por el que `anotar()`
 * escribe asi.
 */
function aplicarEvento(ev, duenioDelCalendario) {
  const id = String((ev && ev.id) || '');
  if (!id) return false;

  let reunion;
  try {
    reunion = $app.findFirstRecordByFilter('reunion', 'google_event_id = {:g}', { g: id });
  } catch (_) {
    // No es una reunion del CRM. Es la MAYORIA de lo que hay en el calendario:
    // el almuerzo, la clase, la reunion interna, el turno medico.
    //
    // Antes se ignoraban, y por eso la agenda del CRM mostraba el jueves libre
    // a las 12 cuando no lo estaba. Ahora se guardan como evento externo: la
    // grilla los dibuja y dejan de aparecer huecos que no existen.
    guardarEventoExterno(ev, duenioDelCalendario);
    return false;
  }

  const crm = {
    inicio: String(reunion.get('inicio') || ''),
    duracion_min: Number(reunion.get('duracion_min') || 0),
    estado: String(reunion.get('estado') || ''),
  };

  const cambio = cambioDeGoogle(crm, {
    cancelado: String((ev && ev.status) || '') === 'cancelled',
    inicio: ev.start && ev.start.dateTime,
    fin: ev.end && ev.end.dateTime,
  });

  if (!cambio.hay) return false;

  // Cancelar es una decision del CRM y hoy NO borra el evento de Google, asi
  // que el reloj lo va a encontrar vivo cada vuelta. Si eso la reactivara,
  // cancelar seria imposible: se descancelaria sola a los cinco minutos.
  if (crm.estado === 'cancelada') return false;

  const sets = [];
  const params = { id: reunion.id, d: cambio.motivo, u: new Date().toISOString().replace('T', ' ') };
  if (cambio.campos.inicio) {
    sets.push('inicio = {:i}');
    params.i = cambio.campos.inicio;
  }
  if (cambio.campos.duracion_min !== undefined) {
    sets.push('duracion_min = {:m}');
    params.m = cambio.campos.duracion_min;
  }
  if (cambio.campos.estado) {
    sets.push('estado = {:e}');
    params.e = cambio.campos.estado;
  }
  sets.push('sync_detalle = {:d}');
  // `updated` a mano: con SQL plano el autodate no corre, y sin esto la agenda
  // no tiene como saber que la fila cambio.
  sets.push('updated = {:u}');

  $app
    .db()
    .newQuery('UPDATE reunion SET ' + sets.join(', ') + ' WHERE id = {:id}')
    .bind(params)
    .execute();

  $app.logger().info('google-entrada', 'reunion', reunion.id, 'detalle', cambio.motivo);
  return true;
}

/**
 * Pide a Google lo que cambio desde la ultima vuelta y lo aplica.
 *
 * Incremental con `syncToken`: Google contesta SOLO lo que se movio, se creo o
 * se borro. Sin token no habria forma de enterarse de un evento BORRADO —un
 * evento borrado no aparece en un listado normal—; con token viene explicito,
 * con `status: "cancelled"`.
 */
function traerCambios(cuenta) {
  const c = config();
  const token = accessToken(c, cuenta.get('refresh_token'));
  const calendario = encodeURIComponent(cuenta.get('calendario') || 'primary');
  const base = GOOGLE_API + '/calendars/' + calendario + '/events';

  const sync = String(cuenta.get('sync_token') || '');
  let pageToken = '';
  let nuevoSync = '';
  let vistos = 0;
  let tocados = 0;

  const anotarLectura = (texto) => {
    cuenta.set('ultima_lectura', new Date().toISOString() + ' - ' + texto);
    $app.save(cuenta);
  };

  // El tope de vueltas es una red, no una expectativa: sin el, una respuesta
  // con nextPageToken siempre presente colgaria el reloj para siempre.
  for (let vuelta = 0; vuelta < 20; vuelta++) {
    const params = { showDeleted: 'true', singleEvents: 'true', maxResults: '250' };
    if (sync) {
      params.syncToken = sync;
    } else {
      // Primera vez: una ventana ACOTADA DE LOS DOS LADOS.
      //
      // El techo no es una preferencia, es obligatorio. Con singleEvents=true
      // Google expande cada evento repetitivo en instancias, y una repeticion
      // SIN FECHA DE FIN genera instancias para siempre: la respuesta trae
      // nextPageToken indefinidamente y nunca llega el nextSyncToken.
      //
      // Paso de verdad en la primera corrida real (09/09/2026): 5000 eventos
      // revisados —el tope de 20 vueltas por 250— y sync_token vacio. Y como
      // el token es lo que hace incremental a la sincronizacion, sin el
      // volvia a listar los mismos 5000 cada cinco minutos, para siempre.
      //
      // 60 dias para atras y 180 para adelante: alcanza de sobra para
      // prospeccion —nadie agenda una reunion a un ano— y deja la expansion
      // de los repetitivos en un numero finito.
      params.timeMin = new Date(Date.now() - 60 * 24 * 3600 * 1000).toISOString();
      params.timeMax = new Date(Date.now() + 180 * 24 * 3600 * 1000).toISOString();
    }
    if (pageToken) params.pageToken = pageToken;

    const res = $http.send({
      url: base + '?' + form(params),
      headers: { Authorization: 'Bearer ' + token },
      timeout: 25,
    });

    // 410: el token caduco. Se vacia y la proxima vuelta lista de cero. Es la
    // forma que tiene Google de decir "perdiste el hilo", y reintentar con el
    // mismo token daria 410 para siempre.
    if (res.statusCode === 410) {
      cuenta.set('sync_token', '');
      anotarLectura('el token caduco, se vuelve a listar en la proxima vuelta');
      return;
    }
    if (res.statusCode < 200 || res.statusCode > 299) {
      const d = (res.json && res.json.error && res.json.error.message) || 'HTTP ' + res.statusCode;
      throw new Error(d);
    }

    const cuerpo = res.json || {};
    const items = cuerpo.items || [];
    for (let i = 0; i < items.length; i++) {
      vistos++;
      if (aplicarEvento(items[i], String(cuenta.get('usuario') || ''))) tocados++;
    }

    pageToken = cuerpo.nextPageToken || '';
    nuevoSync = cuerpo.nextSyncToken || nuevoSync;
    if (!pageToken) break;
  }

  cuenta.set('sync_token', nuevoSync || sync);
  anotarLectura(vistos + ' revisados, ' + tocados + ' actualizados');

  // Con que cuenta de Google quedo conectada, si todavia no se sabe.
  //
  // El callback lo intenta con /oauth2/v2/userinfo y ahi FALLA, porque ese
  // endpoint necesita el alcance "email" y nosotros pedimos solo los dos de
  // calendario. Se veia como una pantalla que dice "conectada" sin decir a
  // cual, que es justo el dato que sirve para darse cuenta de que uno conecto
  // la cuenta equivocada.
  //
  // El id de un calendario ES la direccion de correo, asi que se saca de aca
  // sin pedir ningun permiso mas. Agregar el alcance "email" obligaria a que
  // todos vuelvan a dar el consentimiento.
  if (!String(cuenta.get('email') || '')) {
    try {
      const quien = $http.send({
        url: GOOGLE_API + '/calendars/' + calendario,
        headers: { Authorization: 'Bearer ' + token },
        timeout: 15,
      });
      if (quien.statusCode === 200 && quien.json && quien.json.id) {
        cuenta.set('email', String(quien.json.id));
        $app.save(cuenta);
      }
    } catch (_) {
      // Es un dato para mostrar, no algo de lo que dependa la sincronizacion.
    }
  }
}

module.exports.traerCambios = traerCambios;

/**
 * Guarda —o actualiza, o borra— un evento del calendario que NO es del CRM.
 *
 * Es upsert por (calendario, google_event_id): el mismo evento movido dos veces
 * tiene que quedar una sola fila. Y `status: "cancelled"` BORRA la fila, no la
 * marca: un evento cancelado no ocupa el horario, y dejarlo con una bandera
 * obligaria a filtrarlo en cada consulta.
 *
 * Nunca lanza. Esto corre adentro del reloj de sincronizacion y un evento raro
 * —una fecha imposible, un titulo de 10 KB— no puede frenar a los otros mil.
 */
function guardarEventoExterno(ev, duenioDelCalendario) {
  if (!duenioDelCalendario) return;
  const id = String((ev && ev.id) || '');
  if (!id) return;

  try {
    let fila = null;
    try {
      fila = $app.findFirstRecordByFilter(
        'evento_externo',
        'calendario = {:u} && google_event_id = {:g}',
        { u: duenioDelCalendario, g: id },
      );
    } catch (_) {
      fila = null;
    }

    if (String((ev && ev.status) || '') === 'cancelled') {
      if (fila) $app.delete(fila);
      return;
    }

    const arranca = (ev.start && (ev.start.dateTime || ev.start.date)) || '';
    const termina = (ev.end && (ev.end.dateTime || ev.end.date)) || '';
    if (!arranca) return;

    const diaEntero = Boolean(ev.start && !ev.start.dateTime && ev.start.date);

    let duracion = 0;
    if (!diaEntero && termina) {
      const a = new Date(String(arranca).replace(' ', 'T')).getTime();
      const b = new Date(String(termina).replace(' ', 'T')).getTime();
      duracion = Math.round((b - a) / 60000);
    }
    // Una duracion imposible se guarda como media hora antes que dibujar un
    // bloque invertido o uno que tape el dia entero.
    if (!diaEntero && (!isFinite(duracion) || duracion <= 0 || duracion > 24 * 60)) duracion = 30;

    const cuando = diaEntero
      ? String(arranca)
      : new Date(String(arranca).replace(' ', 'T')).toISOString().replace('T', ' ');

    if (!fila) {
      fila = new Record($app.findCollectionByNameOrId('evento_externo'));
      fila.set('google_event_id', id);
      fila.set('calendario', duenioDelCalendario);
    }
    fila.set('titulo', String((ev && ev.summary) || '(sin titulo)').slice(0, 300));
    fila.set('inicio', cuando);
    fila.set('duracion_min', duracion);
    fila.set('zona', String((ev.start && ev.start.timeZone) || ''));
    fila.set('dia_entero', diaEntero);
    $app.save(fila);
  } catch (err) {
    $app.logger().error('google-entrada', 'evento_externo', id, 'err', String(err));
  }
}

/**
 * Trae el HISTORICO del calendario en un rango, sin tocar el syncToken.
 *
 * Es otra cosa que `traerCambios`, y por eso es otra funcion. Aquel mantiene al
 * dia lo que se mueve —una ventana chica, incremental, cada cinco minutos—;
 * este llena la agenda hacia atras una sola vez. Mezclarlos romperia el token:
 * el scope de un syncToken queda atado a la ventana con la que se pidio, y
 * pedir dos anos para despues sincronizar dos meses lo deja inservible.
 *
 * Devuelve cuantos eventos miro.
 */
function traerHistorico(cuenta, desdeIso, hastaIso) {
  const c = config();
  const token = accessToken(c, cuenta.get('refresh_token'));
  const calendario = encodeURIComponent(cuenta.get('calendario') || 'primary');
  const base = GOOGLE_API + '/calendars/' + calendario + '/events';
  const duenio = String(cuenta.get('usuario') || '');

  let pageToken = '';
  let vistos = 0;

  // 60 vueltas por 250 = 15000 eventos. Mas que eso no es un calendario, es un
  // problema distinto, y el tope evita que un repetitivo sin fin cuelgue esto.
  for (let vuelta = 0; vuelta < 60; vuelta++) {
    const params = {
      singleEvents: 'true',
      maxResults: '250',
      timeMin: desdeIso,
      timeMax: hastaIso,
      orderBy: 'startTime',
    };
    if (pageToken) params.pageToken = pageToken;

    const res = $http.send({
      url: base + '?' + form(params),
      headers: { Authorization: 'Bearer ' + token },
      timeout: 30,
    });
    if (res.statusCode < 200 || res.statusCode > 299) {
      const d = (res.json && res.json.error && res.json.error.message) || 'HTTP ' + res.statusCode;
      throw new Error(d);
    }

    const cuerpo = res.json || {};
    const items = cuerpo.items || [];
    for (let i = 0; i < items.length; i++) {
      vistos++;
      // Si el evento ES una reunion del CRM, aplicarEvento la actualiza y no
      // la duplica como externa. Si no lo es, la guarda como externa.
      aplicarEvento(items[i], duenio);
    }

    pageToken = cuerpo.nextPageToken || '';
    if (!pageToken) break;
  }

  return vistos;
}

module.exports.traerHistorico = traerHistorico;
