/// <reference path="../pb_data/types.d.ts" />

// El `syncToken` de Google, para traer SOLO lo que cambio (§8.3).
//
// POR QUE UN TOKEN Y NO "traeme los eventos de los proximos 60 dias".
//
// Google devuelve, con cada listado, un `nextSyncToken`. Si en la vuelta
// siguiente se manda ese token, contesta unicamente lo que se movio, se creo o
// se borro desde entonces. Sin el habria que pedir la ventana entera cada cinco
// minutos y comparar todo contra la base: mas trafico, mas cuota de API, y —lo
// que importa— ninguna forma de enterarse de un evento BORRADO, porque un
// evento borrado simplemente no aparece en el listado. Con el token, Google lo
// manda explicitamente con `status: "cancelled"`.
//
// El token caduca. Cuando pasa, Google contesta 410 y hay que volver a listar
// desde cero: por eso el campo se puede vaciar, y vaciarlo es la forma sana de
// forzar una resincronizacion completa.
//
// Va en `google_cuenta`, que tiene TODAS las reglas en null: el token no dice
// nada sensible por si mismo, pero vive al lado del refresh_token y no hay
// ninguna razon para que salga por la API.

migrate(
  (app) => {
    const c = app.findCollectionByNameOrId('google_cuenta');
    if (!c.fields.getByName('sync_token')) {
      c.fields.add(new Field({ name: 'sync_token', type: 'text', max: 3000 }));
    }
    // Cuando corrio el reloj por ultima vez y que encontro. Sin esto, "no pasa
    // nada" y "esta roto hace tres dias" se ven exactamente igual.
    if (!c.fields.getByName('ultima_lectura')) {
      c.fields.add(new Field({ name: 'ultima_lectura', type: 'text', max: 300 }));
    }
    app.save(c);
  },

  (app) => {
    const c = app.findCollectionByNameOrId('google_cuenta');
    c.fields.removeByName('sync_token');
    c.fields.removeByName('ultima_lectura');
    app.save(c);
  },
);
