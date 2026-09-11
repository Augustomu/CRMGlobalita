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

    /*
     * SE LEEN TODAS LAS CUENTAS CONECTADAS, no sólo la del calendario.
     *
     * Los contactos de una persona están repartidos: la cuenta de trabajo tiene
     * los compañeros, la personal tiene los teléfonos. Pedirle que elija cuál
     * leer es pedirle que sepa de antemano en cuál está cada número.
     *
     * Una que falla no corta a las demás: se anota y se sigue. Es lo contrario
     * de lo que conviene en una escritura, pero acá el resultado de cada cuenta
     * es independiente del de las otras.
     */
    const filas = g.cuentasDe(e.auth.id).filter((f) => f.get('refresh_token'));
    if (!filas.length) {
      return e.json(200, {
        ok: false,
        error: 'No hay ninguna cuenta de Google conectada. Conectala desde Cuentas conectadas.',
      });
    }

    const contactos = [];
    const fallos = [];
    for (const fila of filas) {
      const quien = String(fila.get('email') || 'una cuenta');
      try {
        const token = g.accessToken(c, fila.get('refresh_token'));
        const suyos = a.traerAgenda(token);
        for (const x of suyos) contactos.push(x);
      } catch (err) {
        // El caso más común y el que hay que saber distinguir: el permiso de
        // contactos es NUEVO, así que una cuenta conectada antes del 11/09 no
        // lo tiene. Google contesta 403 y hay que volver a conectar UNA vez.
        const m = String(err);
        fallos.push(
          quien +
            (m.indexOf('403') >= 0
              ? ': conectada pero sin permiso para leer la agenda. Desconectala y volvé a conectarla.'
              : ': ' + m),
        );
      }
    }

    if (!contactos.length) {
      return e.json(200, {
        ok: false,
        error: fallos.length
          ? fallos.join(' · ')
          : 'Las cuentas conectadas no tienen ningún contacto con teléfono.',
      });
    }

    const r = a.ponerNombres(contactos);
    $app.logger().info(
      'google-contactos',
      'cuentas', filas.length,
      'contactos', contactos.length,
      'chats', r.chats,
      'perfiles', r.perfiles,
    );
    return e.json(200, {
      ok: true,
      cuentas: filas.length,
      contactos: contactos.length,
      // Los fallos se devuelven AUNQUE haya salido bien: si una de tres cuentas
      // no se pudo leer, el resultado es parcial y quien lo mira tiene que
      // saberlo. Un «listo» que esconde un error es un «listo» que miente.
      fallos,
      ...r,
    });
  },
  $apis.requireAuth(),
);
