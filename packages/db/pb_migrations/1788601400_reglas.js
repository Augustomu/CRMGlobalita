/// <reference path="../../../.pb/pb_data/types.d.ts" />

// Reglas y acciones rapidas (§7.9).
//
// La regla se guarda como DATO —disparador, condicion, accion— y no como
// codigo. El motor que las corre es del worker; esta coleccion es el contrato
// entre lo que el usuario define y lo que el worker ejecuta, y por eso los tres
// campos son texto de un catalogo cerrado (core/regla.ts) y no una expresion
// libre: una regla que se escribe a mano es una regla que nadie puede validar
// antes de que corra sobre la base entera.
//
// `de_fabrica` marca las que describen algo que el sistema YA hace en el codigo
// (la cadencia sugiere el proximo R, enviar un R agrega la etiqueta
// Recordatorio). Se pueden apagar pero no borrar: borrarlas dejaria un sistema
// que sigue haciendo algo que ya no figura en ningun lado.

migrate(
  (app) => {
    app.save(
      new Collection({
        type: 'base',
        name: 'regla',
        listRule: '@request.auth.id != ""',
        viewRule: '@request.auth.id != ""',
        createRule: '@request.auth.id != ""',
        updateRule: '@request.auth.id != ""',
        deleteRule: '@request.auth.id != ""',
        fields: [
          { name: 'id', type: 'text', primaryKey: true, required: true, min: 15, max: 15, autogeneratePattern: '[a-z0-9]{15}' },
          { name: 'nombre', type: 'text', required: true, max: 120 },
          { name: 'disparador', type: 'text', required: true, max: 200 },
          { name: 'condicion', type: 'text', max: 200 },
          { name: 'accion', type: 'text', required: true, max: 200 },
          { name: 'activa', type: 'bool' },
          { name: 'de_fabrica', type: 'bool' },
          // Lo escribe el worker cuando la corre. Sirve para saber si una regla
          // esta viva o quedo definida y nunca se disparo.
          { name: 'corridas', type: 'number', onlyInt: true, min: 0 },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
      }),
    );

    // Las tres automatizaciones alrededor de la reunion (§5.11) mas el
    // recordatorio extra. Van en `configuracion` y no como reglas porque no se
    // crean ni se borran: son siempre las mismas tres y lo unico que cambia es
    // si estan prendidas.
    const cfg = new Record(app.findCollectionByNameOrId('configuracion'));
    cfg.set('clave', 'reglas_reunion');
    cfg.set('descripcion', 'Confirmacion, aviso, agradecimiento y recordatorio extra de la reunion.');
    cfg.set('valor', {
      confirmacion_24h: true,
      aviso_90min: true,
      agradecimiento: true,
      recordatorio_extra_h: 3,
    });
    app.save(cfg);
  },

  (app) => {
    app.delete(app.findCollectionByNameOrId('regla'));
    try {
      app.delete(app.findFirstRecordByFilter('configuracion', "clave = 'reglas_reunion'"));
    } catch (_) {}
  },
);
