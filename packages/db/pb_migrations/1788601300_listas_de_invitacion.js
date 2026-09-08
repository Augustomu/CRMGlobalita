/// <reference path="../../../.pb/pb_data/types.d.ts" />

// Las listas de invitación de cada cuenta (§7.3 «Invitaciones»).
//
// Una lista es de dónde saca perfiles el script: una búsqueda guardada de Sales
// Navigator o un CSV importado. Cada cuenta tiene varias y las trabaja EN
// ORDEN: la de prioridad más alta que todavía tenga páginas.
//
// `pagina` es dato de la automatización, no del usuario: es hasta dónde llegó
// el script. Se muestra pero no se edita — si alguien lo pudiera mover a mano,
// el script re-invitaría a gente ya invitada o saltearía un tramo entero, y
// ninguna de las dos cosas deja rastro visible hasta semanas después.
//
// `por_pagina` es por lista y no una constante porque no todas las fuentes
// rinden igual: Sales Navigator pagina de a 25, un CSV importado puede venir
// como una sola "página" con todo adentro.

migrate(
  (app) => {
    const cuentaId = app.findCollectionByNameOrId('cuenta').id;

    app.save(
      new Collection({
        type: 'base',
        name: 'lista_invitacion',
        listRule: '@request.auth.id != ""',
        viewRule: '@request.auth.id != ""',
        // La prioridad y el cupo los toca el administrador desde el panel; el
        // permiso fino lo aplica la UI con `automatizaciones`.
        createRule: '@request.auth.id != ""',
        updateRule: '@request.auth.id != ""',
        deleteRule: '@request.auth.id != ""',
        fields: [
          { name: 'id', type: 'text', primaryKey: true, required: true, min: 15, max: 15, autogeneratePattern: '[a-z0-9]{15}' },
          { name: 'cuenta', type: 'relation', collectionId: cuentaId, maxSelect: 1, required: true, cascadeDelete: true },
          { name: 'nombre', type: 'text', required: true, max: 120 },
          { name: 'fuente', type: 'select', maxSelect: 1, required: true, values: ['sales_navigator', 'csv', 'manual'] },
          { name: 'orden', type: 'number', onlyInt: true, min: 1 },
          { name: 'pagina', type: 'number', onlyInt: true, min: 0 },
          { name: 'paginas', type: 'number', onlyInt: true, min: 0 },
          { name: 'por_pagina', type: 'number', onlyInt: true, min: 1 },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        // El nombre lleva la coleccion entera: `idx_lista_cuenta` ya lo usa la
        // coleccion `lista`, y en SQLite los indices comparten un unico
        // espacio de nombres.
        indexes: ['CREATE INDEX idx_lista_invitacion_cuenta ON lista_invitacion (cuenta, orden)'],
      }),
    );

    // El interruptor global «en marcha / todo en pausa» de §7.3.
    //
    // Vive en `configuracion` y no en memoria de la pantalla porque tiene que
    // valer para el worker: una pausa que solo existe en el navegador de quien
    // la apretó no pausa nada.
    const cfg = new Record(app.findCollectionByNameOrId('configuracion'));
    cfg.set('clave', 'automatizacion');
    cfg.set('descripcion', 'Interruptor global de la automatizacion. Lo lee el worker.');
    cfg.set('valor', { pausado: false });
    app.save(cfg);
  },

  (app) => {
    app.delete(app.findCollectionByNameOrId('lista_invitacion'));
    try {
      app.delete(app.findFirstRecordByFilter('configuracion', "clave = 'automatizacion'"));
    } catch (_) {}
  },
);
