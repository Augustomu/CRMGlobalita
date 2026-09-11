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

    /*
     * `?nueva=1` conecta OTRA cuenta de Google en vez de reemplazar la que hay.
     *
     * Pedido el 11/09: *«agregame un botón para conectar cuenta de Gmail
     * nueva»*. La razón concreta: el calendario del CRM está en una cuenta y la
     * agenda de contactos en otra, así que «Traer los nombres» leía la agenda
     * equivocada.
     *
     * La fila nueva arranca SIN `principal`: el calendario sigue siendo el de
     * la primera. Cambiar dónde se escriben las reuniones es otra decisión y no
     * puede ser el efecto secundario de conectar una cuenta para leer contactos.
     */
    const nueva = String(e.request.url.query().get('nueva') || '') === '1';

    let fila = nueva ? null : g.cuentaDe(e.auth.id);
    if (!fila) {
      fila = new Record($app.findCollectionByNameOrId('google_cuenta'));
      fila.set('usuario', e.auth.id);
      fila.set('calendario', 'primary');
      // La primera es la del calendario. Las demás, no.
      fila.set('principal', g.cuentasDe(e.auth.id).length === 0);
      // El email se completa en la vuelta, cuando Google dice quién entró. Va
      // un valor provisorio y único porque el índice es (usuario, email) y dos
      // filas a medio conectar con el email vacío chocarían entre ellas.
      fila.set('email', 'conectando-' + estado.slice(0, 10));
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
        // Para una cuenta NUEVA se pide además el selector: sin
        // `select_account`, Google entra derecho con la sesión que ya está
        // abierta en el navegador y termina reconectando la misma cuenta.
        prompt: nueva ? 'consent select_account' : 'consent',
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

  /*
   * Y SI ESO FALLO —que es siempre— el correo sale del CALENDARIO.
   *
   * /oauth2/v2/userinfo necesita el alcance "email", que no pedimos a
   * proposito: agregarlo obligaria a que todos vuelvan a dar el consentimiento.
   * Pero el id del calendario principal ES la direccion de correo de su dueno,
   * y para eso ya tenemos permiso.
   *
   * Esto estaba resuelto y estaba en el lugar equivocado: adentro de
   * `traerCambios`, que corre solo para la cuenta del calendario. Una cuenta
   * conectada para leer la agenda no pasa por ahi nunca, asi que se quedaba en
   * «sin correo» — y sin correo, dos cuentas conectadas son dos renglones
   * iguales que no se pueden distinguir.
   */
  if (!email) {
    try {
      const cal = $http.send({
        url: g.GOOGLE_API + '/calendars/primary',
        headers: { Authorization: 'Bearer ' + res.json.access_token },
        timeout: 15,
      });
      if (cal.statusCode === 200 && cal.json && cal.json.id) email = String(cal.json.id);
    } catch (_) {
      // Es un dato para mostrar. Que no se sepa el correo no invalida el
      // permiso, que es lo que de verdad se vino a buscar.
    }
  }

  /*
   * SI ESA CUENTA YA ESTABA CONECTADA, se actualiza la que hay y se tira la
   * fila nueva. Sin esto, conectar dos veces la misma cuenta choca contra el
   * índice único (usuario, email) y la vuelta termina en un error que no dice
   * nada — cuando en realidad no pasó nada malo: ya estaba.
   */
  if (email) {
    try {
      const ya = $app.findFirstRecordByFilter(
        'google_cuenta',
        'usuario = {:u} && email = {:e}',
        { u: fila.get('usuario'), e: email },
      );
      if (ya && ya.id !== fila.id) {
        ya.set('refresh_token', res.json.refresh_token);
        ya.set('estado_oauth', '');
        $app.save(ya);
        // La fila a medio conectar no queda dando vueltas.
        try { $app.delete(fila); } catch (_) {}
        return volver('esa cuenta ya estaba conectada, se renovo el permiso');
      }
    } catch (_) {
      // No habia otra con ese email. Sigue el camino normal.
    }
  }

  fila.set('refresh_token', res.json.refresh_token);
  fila.set('email', email);
  fila.set('estado_oauth', ''); // se quema: un state sirve una sola vez
  if (!fila.get('calendario')) fila.set('calendario', 'primary');
  $app.save(fila);

  /*
   * LA AGENDA SE TRAE ACA MISMO, sin que nadie apriete nada.
   *
   * Estuvo como boton —«Sincronizar contactos»— y estaba mal pensado, igual
   * que el del historico: conectar una cuenta y que los chats sigan mostrando
   * numeros hasta acordarse de apretar otra cosa es pedirle a la persona que
   * sepa como funciona esto por dentro. Augusto lo dijo el 11/09: *«sincronizar
   * contactos tiene que ser ya confirmado, no tiene que haber un boton para
   * eso»*.
   *
   * Conectar una cuenta de Google ES pedir que se usen sus contactos.
   *
   * Si falla, la conexion ya quedo guardada: no se pierde por esto.
   */
  let nombres = '';
  try {
    const a = require(`${__hooks}/agenda.js`);
    const contactos = a.traerAgenda(res.json.access_token);
    const r = a.ponerNombres(contactos);
    nombres = ', ' + contactos.length + ' contactos leidos (' + r.chats + ' chats y ' + r.perfiles + ' perfiles con nombre)';
    $app.logger().info('google-callback', 'contactos', contactos.length, 'chats', r.chats, 'perfiles', r.perfiles);
  } catch (err) {
    $app.logger().error('google-callback', 'contactos', String(err));
    // QUE SALIO MAL LO DICE CORE. Un 403 de Google puede ser «falta el permiso»
    // —se arregla reconectando— o «la People API esta apagada en el proyecto»,
    // que no se arregla reconectando ni una sola vez. Ver
    // core/agenda.ts porQueFalloLaAgenda.
    nombres = ', pero no se pudo leer la agenda. ' +
      require(`${__hooks}/agenda.js`).porQueFalloLaAgenda(String(err)).que_hacer;
  }

  // Una cuenta conectada SOLO PARA LEER no trae el calendario: no es la que
  // escribe las reuniones y traerle un ano de eventos seria llenar la agenda
  // con el calendario personal de alguien.
  if (!fila.get('principal')) {
    return volver('cuenta conectada: ' + (email || 'sin correo') + nombres);
  }

  // Y se trae el historico ACA MISMO, sin que nadie apriete nada.
  //
  // Estuvo como boton y estaba mal pensado: conectar un calendario y ver la
  // agenda vacia hasta acordarse de apretar otra cosa es pedirle a la persona
  // que sepa como funciona esto por dentro. Conectar el calendario ES pedir
  // que se vea el calendario.
  //
  // Un ano para atras. Si falla —Google lento, demasiados eventos— la conexion
  // ya quedo guardada y el reloj de cada cinco minutos sigue andando: el
  // historico se puede volver a pedir, la conexion no se pierde por esto.
  try {
    const desde = new Date(Date.now() - 365 * 24 * 3600 * 1000).toISOString();
    const hasta = new Date(Date.now() + 180 * 24 * 3600 * 1000).toISOString();
    const vistos = g.traerHistorico(fila, desde, hasta);
    $app.logger().info('google-callback', 'historico', vistos);
    return volver('conectado, ' + vistos + ' eventos traidos');
  } catch (err) {
    $app.logger().error('google-callback', 'historico', String(err));
    return volver('conectado, pero el historico no se pudo traer todavia');
  }
});

routerAdd(
  'GET',
  '/api/google/estado',
  (e) => {
    const g = require(`${__hooks}/google.js`);
    const fila = g.cuentaDe(e.auth.id);

    /*
     * TODAS las cuentas, no sólo la del calendario.
     *
     * Desde el 11/09 una persona puede tener varias conectadas —para leer la
     * agenda de todas— y la pantalla tiene que mostrarlas: Augusto conectó una
     * segunda y no la veía por ningún lado, así que parecía que no había
     * funcionado.
     *
     * El `refresh_token` NO SALE NUNCA de acá: es una llave permanente a la
     * cuenta de una persona. Se responde el correo y si está conectada.
     */
    const todas = g.cuentasDe(e.auth.id).map((f) => ({
      id: f.id,
      email: f.get('email') || '',
      principal: Boolean(f.get('principal')),
      conectada: Boolean(f.get('refresh_token')),
      calendario: f.get('calendario') || '',
    }));

    return e.json(200, {
      servidor_listo: g.configurado(g.config()),
      conectado: Boolean(fila && fila.get('refresh_token')),
      email: fila ? fila.get('email') : '',
      calendario: fila ? fila.get('calendario') : '',
      cuentas: todas,
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

/*
 * DESCONECTAR UNA CUENTA. Cual, lo dice `id`; sin `id`, la del calendario.
 *
 * Hasta el 11/09 desconectaba siempre la del calendario y no habia forma de
 * soltar una de las otras: Augusto conecto una segunda, quedo mal, y el unico
 * boton que existia apagaba la que estaba bien.
 *
 * NO SE PROMUEVE NINGUNA EN SU LUGAR. Si se va la del calendario y quedan
 * otras, el CRM se queda sin calendario y lo dice. Elegir una sola cambiaria
 * en silencio a que agenda van a parar las reuniones, que es justo la decision
 * que no puede tomar un efecto secundario.
 */
routerAdd(
  'POST',
  '/api/google/desconectar',
  (e) => {
    const g = require(`${__hooks}/google.js`);

    const cuerpo = new DynamicModel({ id: '' });
    e.bindBody(cuerpo);
    const pedido = String(cuerpo.id || '');

    let fila;
    if (pedido) {
      // El dueno se verifica SIEMPRE. Sin esto, un id ajeno en el cuerpo del
      // pedido desconecta el Google de otra persona.
      try {
        fila = $app.findRecordById('google_cuenta', pedido);
      } catch (_) {
        return e.json(404, { error: 'Esa cuenta no existe.' });
      }
      if (String(fila.get('usuario')) !== String(e.auth.id)) {
        return e.json(404, { error: 'Esa cuenta no existe.' });
      }
    } else {
      fila = g.cuentaDe(e.auth.id);
    }

    if (fila) $app.delete(fila);
    return e.json(200, { conectado: false });
  },
  $apis.requireAuth(),
);

/*
 * CUAL DE LAS CUENTAS ES LA DEL CALENDARIO.
 *
 * Existe porque la alternativa era peor. Augusto queria que las reuniones se
 * escriban en la cuenta de trabajo y el CRM tenia la personal: para cambiarlo
 * habia que desconectar las dos y volver a conectarlas EN ORDEN, porque la
 * primera que entra se queda con el calendario. Un orden que hay que saber de
 * antemano no es una interfaz.
 *
 * LO QUE CAMBIA Y LO QUE NO: de aca en adelante las reuniones nuevas se
 * escriben en la cuenta elegida. Las que ya estan creadas siguen en el
 * calendario donde nacieron — moverlas seria borrarlas de un lado y crearlas
 * del otro, y ninguna de las dos mitades es reversible si la otra falla.
 *
 * El `sync_token` de la que deja de ser principal se tira: esta atado a una
 * ventana de fechas pedida con otro alcance y reusarlo trae cambios de menos.
 */
routerAdd(
  'POST',
  '/api/google/calendario',
  (e) => {
    const g = require(`${__hooks}/google.js`);

    const cuerpo = new DynamicModel({ id: '' });
    e.bindBody(cuerpo);
    const pedido = String(cuerpo.id || '');
    if (!pedido) return e.json(400, { error: 'Falta decir cual cuenta.' });

    let nueva;
    try {
      nueva = $app.findRecordById('google_cuenta', pedido);
    } catch (_) {
      return e.json(404, { error: 'Esa cuenta no existe.' });
    }
    if (String(nueva.get('usuario')) !== String(e.auth.id)) {
      return e.json(404, { error: 'Esa cuenta no existe.' });
    }
    if (!nueva.get('refresh_token')) {
      return e.json(400, { error: 'Esa cuenta no esta conectada.' });
    }

    const todas = g.cuentasDe(e.auth.id);
    for (let i = 0; i < todas.length; i++) {
      const f = todas[i];
      const esLaNueva = f.id === nueva.id;
      if (Boolean(f.get('principal')) === esLaNueva) continue;
      f.set('principal', esLaNueva);
      if (esLaNueva) f.set('sync_token', '');
      $app.save(f);
    }

    $app.logger().info('google-calendario', 'ahora', String(nueva.get('email') || nueva.id));
    return e.json(200, { ok: true, email: String(nueva.get('email') || '') });
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

// ---------------------------------------------- mover un evento de Google
//
// §7.6 · Desde el 09/09 un bloque del calendario se arrastra y se estira en la
// agenda. Cuando eso pasa hay que moverlo TAMBIEN en Google, que es donde el
// invitado lo ve.
//
// SOLO SI CAMBIO EL HORARIO. Conectar un evento con un lead tambien es un
// update de esta coleccion, y no tiene por que mandarle un mail a nadie:
// vincular es una anotacion del CRM, no un cambio del evento.
//
// EL ECO ESTA CERRADO DEL OTRO LADO: la sincronizacion de ENTRADA escribe con
// SQL plano, que no dispara hooks. Sin eso, esto que sigue seria un bucle
// infinito con un mail al invitado en cada vuelta. Ver guardarEventoExterno().
onRecordAfterUpdateSuccess((e) => {
  const importa = ['inicio', 'duracion_min', 'zona'];
  let cambio = false;
  try {
    const viejo = e.record.original();
    cambio = importa.some((f) => String(e.record.get(f)) !== String(viejo.get(f)));
  } catch (_) {}

  // El require va ADENTRO del callback: los handlers corren aislados y no ven
  // el scope del archivo. Es la familia 5 del registro y ya se cometio dos veces.
  if (cambio) require(`${__hooks}/google.js`).moverYAnotar(e.record);
  e.next();
}, 'evento_externo');
