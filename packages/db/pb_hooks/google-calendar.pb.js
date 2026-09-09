/// <reference path="../../../.pb/pb_data/types.d.ts" />

// Google Calendar: rutas y disparadores. Cierra D10.
//
// Corre DENTRO de PocketBase, del lado del servidor. Si el evento lo creara la
// pantalla haria falta que alguien tenga el CRM abierto, y no habria forma de
// reagendar ni de reintentar cuando Google falla.
//
// Cada handler arranca con un require: en PocketBase el handler se ejecuta en
// un runtime aislado y NO ve el scope de este archivo. Lo comun vive en
// google.js, que explica el porque.
//
// Es plomeria: no decide nada. El titulo y la descripcion los calcula
// core/reunion.ts y los guarda la pantalla en la reunion (regla 1 del
// CLAUDE.md: la regla en un solo lugar).

// -------------------------------------------------------------- conectar

routerAdd(
  'GET',
  '/api/google/inicio',
  (e) => {
    const g = require(`${__hooks}/google.js`);
    const c = g.config();

    if (!g.configurado(c)) {
      return e.json(200, {
        listo: false,
        motivo:
          'Falta configurar Google en el servidor: GOOGLE_CLIENT_ID, ' +
          'GOOGLE_CLIENT_SECRET y APP_URL. Está en deploy/PASO-A-PASO.md.',
      });
    }

    // El `state` ata esta vuelta a este usuario. Sin él, alguien podría hacerle
    // completar el flujo a otro y quedarse con su calendario.
    const estado = $security.randomString(40);

    let fila = g.cuentaDe(e.auth.id);
    if (!fila) {
      fila = new Record($app.findCollectionByNameOrId('google_cuenta'));
      fila.set('usuario', e.auth.id);
      fila.set('calendario', 'primary');
    }
    fila.set('estado_oauth', estado);
    $app.save(fila);

    const url =
      g.GOOGLE_AUTH +
      '?' +
      g.form({
        client_id: c.clientId,
        redirect_uri: g.redirectUri(c),
        response_type: 'code',
        scope: g.SCOPE,
        // offline + consent son los que hacen que Google mande el refresh_token.
        // Sin `prompt=consent`, la segunda vez NO lo manda y no queda forma de
        // escribir en el calendario sin la persona presente.
        access_type: 'offline',
        prompt: 'consent',
        state: estado,
      });

    return e.json(200, { listo: true, url });
  },
  $apis.requireAuth(),
);

// La vuelta de Google. Sin auth: acá llega el navegador redirigido, no el SDK.
routerAdd('GET', '/api/google/callback', (e) => {
  const g = require(`${__hooks}/google.js`);
  const c = g.config();

  const volver = (msg) => e.redirect(302, (c.appUrl || '') + '/?google=' + encodeURIComponent(msg));

  const code = e.request.url.query().get('code');
  const estado = e.request.url.query().get('state');
  if (!code || !estado) return volver('falta el código de Google');

  // El `state` dice de quién es esta vuelta, y que la empezamos nosotros.
  let fila;
  try {
    fila = $app.findFirstRecordByFilter('google_cuenta', 'estado_oauth = {:s}', { s: estado });
  } catch (_) {
    return volver('el permiso no coincide, probá de nuevo');
  }

  const res = $http.send({
    url: g.GOOGLE_TOKEN,
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: g.form({
      code,
      client_id: c.clientId,
      client_secret: c.clientSecret,
      redirect_uri: g.redirectUri(c),
      grant_type: 'authorization_code',
    }),
    timeout: 20,
  });

  if (res.statusCode !== 200 || !res.json || !res.json.refresh_token) {
    return volver('Google no devolvió el permiso permanente');
  }

  // Con qué cuenta se conectó, para que se vea si alguien conectó la equivocada.
  let email = '';
  try {
    const quien = $http.send({
      url: 'https://www.googleapis.com/oauth2/v2/userinfo',
      headers: { Authorization: 'Bearer ' + res.json.access_token },
      timeout: 15,
    });
    if (quien.statusCode === 200 && quien.json) email = quien.json.email || '';
  } catch (_) {}

  fila.set('refresh_token', res.json.refresh_token);
  fila.set('email', email);
  fila.set('estado_oauth', ''); // se quema: un state sirve una sola vez
  if (!fila.get('calendario')) fila.set('calendario', 'primary');
  $app.save(fila);

  return volver('conectado');
});

routerAdd(
  'GET',
  '/api/google/estado',
  (e) => {
    const g = require(`${__hooks}/google.js`);
    const fila = g.cuentaDe(e.auth.id);
    return e.json(200, {
      servidor_listo: g.configurado(g.config()),
      // Se responde sí o no. El refresh_token no sale nunca de acá.
      conectado: Boolean(fila && fila.get('refresh_token')),
      email: fila ? fila.get('email') : '',
      calendario: fila ? fila.get('calendario') : '',
    });
  },
  $apis.requireAuth(),
);

// Traer el HISTORICO del calendario, una vez.
//
// Es un pedido aparte y no parte del reloj, a proposito: el reloj mantiene al
// dia una ventana chica, y el scope de un syncToken queda atado a la ventana
// con la que se pidio. Meter dos anos ahi lo dejaria inservible.
//
// Puede tardar: son hasta 15000 eventos paginados de a 250. Por eso lo dispara
// una persona apretando un boton, y no un reloj cada cinco minutos.
routerAdd(
  'POST',
  '/api/google/historico',
  (e) => {
    const g = require(`${__hooks}/google.js`);
    const c = g.config();
    if (!g.configurado(c)) return e.json(400, { error: 'Google no esta configurado en el servidor.' });

    const fila = g.cuentaDe(e.auth.id);
    if (!fila || !fila.get('refresh_token')) {
      return e.json(400, { error: 'Todavia no conectaste tu Google Calendar.' });
    }

    const cuerpo = new DynamicModel({ desde: '' });
    e.bindBody(cuerpo);

    // Por defecto, unos 400 dias para atras: cubre «desde septiembre del ano
    // pasado», que es donde arranca el historico que ya esta importado.
    const pedido = String(cuerpo.desde || '');
    const atras = new Date(Date.now() - 400 * 24 * 3600 * 1000).toISOString();
    const adelante = new Date(Date.now() + 180 * 24 * 3600 * 1000).toISOString();
    const desde = pedido || atras;

    try {
      const vistos = g.traerHistorico(fila, desde, adelante);
      return e.json(200, { ok: true, vistos, desde, hasta: adelante });
    } catch (err) {
      $app.logger().error('google-historico', 'err', String(err));
      return e.json(500, { error: String(err) });
    }
  },
  $apis.requireAuth(),
);

routerAdd(
  'POST',
  '/api/google/desconectar',
  (e) => {
    const g = require(`${__hooks}/google.js`);
    const fila = g.cuentaDe(e.auth.id);
    if (fila) $app.delete(fila);
    return e.json(200, { conectado: false });
  },
  $apis.requireAuth(),
);

// ---------------------------------------------------------- la escritura
//
// Ojo: los callbacks tambien corren aislados. Todo lo que usan tiene que venir
// del require de adentro; una funcion declarada en este archivo no se ve.

onRecordAfterCreateSuccess((e) => {
  require(`${__hooks}/google.js`).sincronizarYAnotar(e.record);
  e.next();
}, 'reunion');

onRecordAfterUpdateSuccess((e) => {
  const g = require(`${__hooks}/google.js`);

  // Solo se vuelve a Google si cambio algo que el evento muestra. Sin esto,
  // marcar "asistio" le mandaria un mail de actualizacion al invitado.
  const importa = ['inicio', 'duracion_min', 'zona', 'titulo_evento', 'descripcion_evento', 'invitado_email'];
  let cambio = false;
  try {
    const viejo = e.record.original();
    cambio = importa.some((f) => String(e.record.get(f)) !== String(viejo.get(f)));
  } catch (_) {}

  if (cambio) g.sincronizarYAnotar(e.record);
  e.next();
}, 'reunion');
