/// <reference path="../../../.pb/pb_data/types.d.ts" />

// Escribir la reunion en Google Calendar sola. Cierra D10.
//
// DONDE CORRE. En PocketBase, no en el navegador. Si el evento lo creara la
// pantalla haria falta que alguien tenga el CRM abierto, y no serviria para
// reagendar desde un proceso ni para reintentar cuando Google falla. PocketBase
// tiene motor JS del lado del servidor, asi que no hay que levantar otro
// proceso: ver packages/db/pb_hooks/google-calendar.pb.js.
//
// EL TOKEN. Google devuelve un refresh_token la PRIMERA vez que la persona da
// permiso, y con eso se pide un access_token cada vez que hace falta. Ese
// refresh_token es una llave permanente a su calendario: vive en una coleccion
// con TODAS las reglas cerradas, para que no salga nunca por la API.
//
// EL TEXTO DEL EVENTO NO SE ARMA ACA. El titulo y la descripcion los calcula
// core/reunion.ts y los guarda la pantalla al crear la reunion. El hook solo
// manda lo que ya esta escrito: la regla vive en un solo lugar (regla 1 del
// CLAUDE.md) y el hook queda como lo que es, plomeria.

migrate(
  (app) => {
    const usersId = app.findCollectionByNameOrId('users').id;

    // ---------- google_cuenta ----------
    // Una fila por usuario que conecto su Google.
    app.save(
      new Collection({
        type: 'base',
        name: 'google_cuenta',
        // TODAS cerradas. Ni el dueno puede leer su propio refresh_token por la
        // API: para saber si esta conectado esta /api/google/estado, que
        // responde si o no sin devolver la llave.
        listRule: null,
        viewRule: null,
        createRule: null,
        updateRule: null,
        deleteRule: null,
        fields: [
          { name: 'id', type: 'text', primaryKey: true, required: true, min: 15, max: 15, autogeneratePattern: '[a-z0-9]{15}' },
          { name: 'usuario', type: 'relation', collectionId: usersId, maxSelect: 1, required: true, cascadeDelete: true },
          // Con que cuenta de Google se conecto. Se muestra para que se vea si
          // alguien conecto la equivocada.
          { name: 'email', type: 'text' },
          { name: 'refresh_token', type: 'text', max: 2000 },
          // 'primary' salvo que se elija otro. Los eventos historicos vivian en
          // el calendario principal de augustou@globalita.io.
          { name: 'calendario', type: 'text' },
          // Anti-CSRF del ida y vuelta con Google: se genera al empezar y se
          // exige igual en la vuelta.
          { name: 'estado_oauth', type: 'text', max: 100 },
          { name: 'conectado', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: ['CREATE UNIQUE INDEX idx_google_usuario ON google_cuenta (usuario)'],
      }),
    );

    // ---------- reunion: el texto ya resuelto y el resultado del envio ----------
    const reunion = app.findCollectionByNameOrId('reunion');

    // Los calcula core/reunion.ts y los escribe la pantalla.
    reunion.fields.add(new Field({ name: 'titulo_evento', type: 'text', max: 300 }));
    reunion.fields.add(new Field({ name: 'descripcion_evento', type: 'text', max: 2000 }));
    // Con quien es, para invitarlo.
    reunion.fields.add(new Field({ name: 'invitado_email', type: 'text' }));

    // Que paso con la sincronizacion. Sin esto un fallo de Google es invisible:
    // la reunion queda guardada y nadie se entera de que el evento no existe.
    reunion.fields.add(
      new Field({
        name: 'sync',
        type: 'select',
        maxSelect: 1,
        values: ['pendiente', 'ok', 'sin_conexion', 'error', 'omitida'],
      }),
    );
    reunion.fields.add(new Field({ name: 'sync_detalle', type: 'text', max: 500 }));

    app.save(reunion);
  },

  (app) => {
    const reunion = app.findCollectionByNameOrId('reunion');
    for (const f of ['titulo_evento', 'descripcion_evento', 'invitado_email', 'sync', 'sync_detalle']) {
      reunion.fields.removeByName(f);
    }
    app.save(reunion);

    app.delete(app.findCollectionByNameOrId('google_cuenta'));
  },
);
