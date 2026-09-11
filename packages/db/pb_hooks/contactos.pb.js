/// <reference path="../../../.pb/pb_data/types.d.ts" />

// Traer la agenda de Google y ponerle nombre a lo que no lo tiene (§5.7).
//
// POR QUE EXISTE. Los 58 chats de WhatsApp que se importaron el 11/09 entraron
// con el número pelado: WhatsApp manda su agenda una sola vez, al vincular, y
// manda lo que quiere. Augusto lo dijo mirando la pantalla —«todos los
// teléfonos están sin ser agendados»— y también dónde estaban los nombres:
// «las personas que tengo en WhatsApp ya las tengo agendadas a la mayoría».
//
// Están en su cuenta de Google, y esa se puede consultar cuantas veces haga
// falta. Ahí está la diferencia con WhatsApp: esto se puede volver a correr.
//
// QUE HACE Y QUE NO:
//   · Lee la agenda. `contacts.readonly` — no puede escribir nada en Google.
//   · Completa el nombre de los chats y de los perfiles que NO TIENEN uno.
//   · No pisa ningún nombre existente: puede haberlo puesto una persona.
//   · No crea perfiles ni leads. Un contacto de la agenda no es un lead.
//   · No toca Gmail. Es otro permiso y otra conversación.
//
// LA DECISION NO VIVE ACA. Qué nombre le toca a cuál fila lo decide
// `core/agenda.ts` con sus 11 tests —incluido el caso del número compartido por
// dos personas, que se descarta en vez de elegir uno—. Esto es plomería: pide
// las páginas, junta, y escribe lo que core diga.

routerAdd(
  'POST',
  '/api/google/contactos',
  (e) => {
    const g = require(`${__hooks}/google.js`);
    const a = require(`${__hooks}/agenda.js`);
    const c = g.config();

    if (!g.configurado(c)) {
      return e.json(200, { ok: false, error: 'Falta configurar Google en el servidor.' });
    }

    const fila = g.cuentaDe(e.auth.id);
    if (!fila || !fila.get('refresh_token')) {
      return e.json(200, {
        ok: false,
        error: 'Tu cuenta de Google no está conectada. Conectala desde Cuentas conectadas.',
      });
    }

    let token;
    try {
      token = g.accessToken(c, fila.get('refresh_token'));
    } catch (err) {
      return e.json(200, {
        ok: false,
        error:
          'Google rechazó la conexión: ' + String(err) + '. ' +
          'Si dice «invalid_grant», hay que volver a conectar la cuenta.',
      });
    }

    let contactos;
    try {
      contactos = a.traerAgenda(token);
    } catch (err) {
      // El caso más común y el que hay que saber distinguir: el permiso de
      // contactos es NUEVO, así que una cuenta conectada antes del 11/09 no lo
      // tiene. Google contesta 403 y hay que volver a conectar UNA vez.
      const m = String(err);
      return e.json(200, {
        ok: false,
        error:
          m.indexOf('403') >= 0
            ? 'Tu cuenta está conectada pero sin permiso para leer la agenda: es un permiso ' +
              'nuevo. Desconectá Google y volvé a conectarlo — una sola vez.'
            : 'No se pudo leer la agenda: ' + m,
      });
    }

    const r = a.ponerNombres(contactos);
    $app.logger().info(
      'google-contactos',
      'contactos', contactos.length,
      'chats', r.chats,
      'perfiles', r.perfiles,
    );
    return e.json(200, { ok: true, contactos: contactos.length, ...r });
  },
  $apis.requireAuth(),
);
