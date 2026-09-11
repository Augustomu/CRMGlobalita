/// <reference path="../pb_data/types.d.ts" />

// Una persona puede conectar más de una cuenta de Google (§8.3).
//
// POR QUE. Augusto lo pidió el 11/09: *«agregame un botón para conectar cuenta
// de Gmail nueva»*. La razón concreta es que sus cosas están repartidas: el
// calendario del CRM está en `augustou@globalita.io` y **la agenda de contactos
// está en otra cuenta**. Con una sola conexión, «Traer los nombres» lee la
// agenda equivocada — la de la cuenta de trabajo, que casi no tiene teléfonos.
//
// Hasta hoy había un índice ÚNICO sobre `usuario`: una cuenta de Google por
// persona del CRM, y conectar otra pisaba la anterior. Pasa a ser único sobre
// `(usuario, email)`: se pueden tener varias, y la misma dos veces no.
//
// LA DEL CALENDARIO SIGUE SIENDO UNA SOLA, marcada con `principal`. El
// calendario no admite ambigüedad: una reunión se escribe en UN calendario, y
// si hubiera dos conectadas habría que preguntar en cuál cada vez. Las demás
// cuentas son para LEER —la agenda, y lo que venga después—, que sí se puede
// hacer sobre varias a la vez sin que nadie tenga que elegir.

migrate(
  (app) => {
    const c = app.findCollectionByNameOrId('google_cuenta');

    if (!c.fields.getByName('principal')) {
      c.fields.add(new Field({ name: 'principal', type: 'bool', required: false }));
    }

    // El índice viejo impide la segunda cuenta; el nuevo impide la repetida.
    c.indexes = (c.indexes || [])
      .filter((i) => i.indexOf('idx_google_usuario') < 0)
      .concat(['CREATE UNIQUE INDEX `idx_google_usuario_email` ON `google_cuenta` (`usuario`, `email`)']);

    app.save(c);

    // La que ya estaba conectada es la del calendario: es la que viene
    // sincronizando desde el 10/09 y la que tiene el `sync_token`.
    for (const fila of app.findAllRecords('google_cuenta')) {
      fila.set('principal', true);
      app.save(fila);
    }
  },

  (app) => {
    const c = app.findCollectionByNameOrId('google_cuenta');
    c.fields.removeByName('principal');
    c.indexes = (c.indexes || [])
      .filter((i) => i.indexOf('idx_google_usuario_email') < 0)
      .concat(['CREATE UNIQUE INDEX `idx_google_usuario` ON `google_cuenta` (`usuario`)']);
    app.save(c);
  },
);
