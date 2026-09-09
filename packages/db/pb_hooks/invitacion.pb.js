/// <reference path="../../../.pb/pb_data/types.d.ts" />

// El alta de usuario por correo (§6.7, §7.5).
//
// Tres endpoints y ninguna escritura desde el navegador:
//
//   POST /api/invitar             crea el usuario y le manda el correo
//   GET  /api/invitacion/:token   dice si el enlace sirve, y de quien es
//   POST /api/invitacion/:token   recibe la clave elegida y activa la cuenta
//
// Los dos ultimos son PUBLICOS a proposito: quien los usa todavia no tiene
// sesion — de eso se trata. Lo que los protege es el token, que es aleatorio de
// 40 caracteres, se guarda hasheado y vale una sola vez.
//
// Por que el flujo entero vive del lado del servidor:
//
//   Crear un usuario desde el navegador exige que la coleccion `users` acepte
//   `create` desde la API. Con eso puesto, cualquiera que sepa la URL se da de
//   alta solo. El manual dice que no hay auto-registro (§7.5): a alguien lo da
//   de alta un administrador. La unica forma de que eso sea cierto de verdad es
//   que la creacion pase por aca, donde se puede exigir quien la pide.

// ---------------------------------------------------------------------------
// POST /api/invitar
// ---------------------------------------------------------------------------
routerAdd(
  'POST',
  '/api/invitar',
  (e) => {
    const inv = require(`${__hooks}/invitacion.js`);
    const quien = e.auth;

    // §6.1: `usuarios` es la clave que habilita dar de alta y reasignar. Se
    // comprueba aca y no solo en la pantalla: la pantalla decide que se dibuja,
    // esto decide que se puede hacer.
    if (!inv.puedeInvitar(quien)) {
      return inv.malo(403, 'Hace falta el permiso de usuarios para dar de alta a alguien.');
    }

    const cuerpo = new DynamicModel({ nombre: '', email: '', rol: '', usuario_id: '' });
    e.bindBody(cuerpo);

    const email = String(cuerpo.email || '').trim().toLowerCase();
    const nombre = String(cuerpo.nombre || '').trim();
    const rol = String(cuerpo.rol || 'colaborador');
    // Con `usuario_id` es un reinicio de clave de alguien que ya existe.
    const usuarioId = String(cuerpo.usuario_id || '');

    const cfg = inv.config();
    if (!cfg.appUrl) {
      return inv.malo(
        500,
        'Falta APP_URL en el servidor: sin eso el enlace del correo apuntaria a ningun lado. ' +
          'Esta en deploy/PASO-A-PASO.md.',
      );
    }

    let usuario = null;
    let motivo = 'alta';

    if (usuarioId) {
      motivo = 'reinicio';
      try {
        usuario = $app.findRecordById('users', usuarioId);
      } catch (_) {
        usuario = null;
      }
      if (!usuario) return inv.malo(404, 'Ese usuario no existe.');
    } else {
      if (!email || email.indexOf('@') < 0) return inv.malo(400, 'Falta un email valido.');
      if (!nombre) return inv.malo(400, 'Falta el nombre.');

      // Un alta con un email que ya existe no es un alta: es un reinicio mal
      // pedido. Se dice, en vez de dejar el error crudo de la base.
      //
      // El aviso va FUERA del try: adentro, el propio `catch` se lo tragaba y
      // el codigo seguia hasta el save, que fallaba con "Value must be unique"
      // — cierto, pero ilegible para quien esta invitando a alguien.
      let yaExiste = false;
      try {
        $app.findFirstRecordByData('users', 'email', email);
        yaExiste = true;
      } catch (_) {}
      if (yaExiste) {
        return inv.malo(409, 'Ya hay un usuario con ese email. Reinicia su clave desde su ficha.');
      }

      usuario = new Record($app.findCollectionByNameOrId('users'));
      usuario.set('name', nombre);
      usuario.set('email', email);
      usuario.set('emailVisibility', true);
      // La cuenta nace SIN clave que nadie conozca: se le pone una aleatoria
      // larga que no viaja a ningun lado. La real la elige la persona con el
      // enlace. Asi no existe, en ningun momento, una clave que un tercero
      // pudiera adivinar o encontrar escrita.
      const provisoria = $security.randomString(50);
      usuario.set('password', provisoria);
      usuario.set('passwordConfirm', provisoria);
      usuario.set('verified', true);
      usuario.set('rol', rol);
      // §3.1: `pendiente` = invitado y todavia no entro. No puede iniciar
      // sesion hasta aceptar, y eso lo hace el hook de login mas abajo.
      usuario.set('estado', 'pendiente');
      usuario.set('permisos', {});
      usuario.set('metodo_invitacion', 'link');
      usuario.set('invitado_en', new Date().toISOString().replace('T', ' '));
      usuario.set('debe_cambiar_clave', true);
      $app.save(usuario);
    }

    const res = inv.emitir($app, usuario, quien, motivo, cfg);
    if (!res.ok) {
      // Si el correo no sale y la cuenta se acaba de crear, se deshace: dejar
      // un usuario que nadie puede usar y que ademas bloquea el email es peor
      // que no haber hecho nada.
      if (motivo === 'alta') {
        try {
          $app.delete(usuario);
        } catch (_) {}
      }
      return inv.malo(502, res.error);
    }

    return e.json(200, {
      ok: true,
      usuario_id: usuario.id,
      email: usuario.get('email'),
      expira: res.expira,
    });
  },
  $apis.requireAuth(),
);

// ---------------------------------------------------------------------------
// GET /api/invitacion/:token   — publico
// ---------------------------------------------------------------------------
routerAdd('GET', '/api/invitacion/{token}', (e) => {
  const inv = require(`${__hooks}/invitacion.js`);
  const r = inv.buscar($app, e.request.pathValue('token'));

  // Los tres "no" se distinguen: a quien abre un enlace vencido hay que
  // decirle que pida otro; a quien abre uno ya usado, que entre con su clave.
  if (r.estado !== 'valida') return e.json(200, { estado: r.estado });

  return e.json(200, {
    estado: 'valida',
    nombre: r.usuario.get('name'),
    email: r.usuario.get('email'),
    motivo: r.fila.get('motivo'),
  });
});

// ---------------------------------------------------------------------------
// POST /api/invitacion/:token   — publico
// ---------------------------------------------------------------------------
routerAdd('POST', '/api/invitacion/{token}', (e) => {
  const inv = require(`${__hooks}/invitacion.js`);
  const cuerpo = new DynamicModel({ clave: '' });
  e.bindBody(cuerpo);
  const clave = String(cuerpo.clave || '');

  const problema = inv.problemaDeClave(clave);
  if (problema) return inv.malo(400, problema);

  const r = inv.buscar($app, e.request.pathValue('token'));
  if (r.estado !== 'valida') {
    return inv.malo(400, inv.MENSAJE_ESTADO[r.estado] || 'Ese enlace no sirve.');
  }

  r.usuario.set('password', clave);
  r.usuario.set('passwordConfirm', clave);
  r.usuario.set('estado', 'activo');
  r.usuario.set('debe_cambiar_clave', false);
  $app.save(r.usuario);

  // Se quema el token. Y se queman TODAS las invitaciones abiertas de esa
  // persona, no solo la que se uso: si le mandaron dos correos, el segundo
  // enlace seguiria sirviendo para cambiarle la clave a alguien que ya entro.
  const ahora = new Date().toISOString();
  for (const otra of inv.abiertasDe($app, r.usuario.id)) {
    otra.set('usada_en', ahora);
    $app.save(otra);
  }

  return e.json(200, { ok: true, email: r.usuario.get('email') });
});

// ---------------------------------------------------------------------------
// Un usuario `pendiente` no entra
// ---------------------------------------------------------------------------
//
// §3.1 lo dice: pendiente = invitado por link y todavia no entro, no puede
// iniciar sesion hasta aceptar. Sin esto la regla es decorativa: la cuenta
// existe con una clave aleatoria de 50 caracteres que nadie conoce, pero si
// alguna vez se le pusiera una clave conocida, entraria igual.
onRecordAuthRequest((e) => {
  if (e.collection.name !== 'users') return e.next();
  const estado = String(e.record.get('estado') || '');
  if (estado === 'pendiente') {
    throw new BadRequestError('Todavia no elegiste tu contraseña. Revisa el correo de invitacion.');
  }
  if (estado === 'suspendido') {
    throw new BadRequestError('Tu usuario esta suspendido.');
  }
  e.next();
}, 'users');
