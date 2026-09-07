/// <reference path="../../../.pb/pb_data/types.d.ts" />

// Etapa 2: el repositorio de mensajes.
//
// D16: la plantilla se ata al paso por el campo `paso`, NO por el nombre.
// El nombre es libre y editable: renombrar ya no rompe los envios en silencio.
// Puede haber varias por paso, con una marcada `por_defecto`.

migrate(
  (app) => {
    const PASOS = [
      'R0', 'R0-recontacto', 'R1', 'R2', 'R3', 'R4',
      'R5', 'R6', 'R7', 'R8', 'agradecimiento',
    ];

    app.save(
      new Collection({
        type: 'base',
        name: 'plantilla',
        listRule: '@request.auth.id != ""',
        viewRule: '@request.auth.id != ""',
        createRule: '@request.auth.id != ""',
        updateRule: '@request.auth.id != ""',
        deleteRule: '@request.auth.id != ""',
        fields: [
          {
            name: 'id',
            type: 'text',
            system: true,
            primaryKey: true,
            required: true,
            min: 15,
            max: 15,
            pattern: '^[a-z0-9]+$',
            autogeneratePattern: '[a-z0-9]{15}',
          },
          // Libre. Renombrar no rompe nada (D16).
          { name: 'nombre', type: 'text', required: true, max: 0, min: 0 },
          // Lo que la ata a la cadencia. Vacio = suelta, solo para usar a mano.
          { name: 'paso', type: 'select', maxSelect: 1, values: PASOS },
          // La que usa la automatizacion y la que precarga Vencimientos.
          { name: 'por_defecto', type: 'bool' },
          // { es, pt, en }. Pueden faltar: SS5.2 pide avisar, no inventar.
          { name: 'textos', type: 'json', maxSize: 50000 },
          // null | "todas" | lista de abreviaturas ("AL, DL") - SS3.5
          { name: 'destacado', type: 'text', max: 0, min: 0 },
          { name: 'orden', type: 'number', onlyInt: true },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE INDEX idx_plantilla_paso ON plantilla (paso)',
          // Una sola por defecto por paso: si no, la automatizacion no sabe cual usar.
          "CREATE UNIQUE INDEX idx_plantilla_defecto ON plantilla (paso) WHERE por_defecto = TRUE AND paso != ''",
        ],
      }),
    );

    // La columna `plantilla` de `envio` pasa de texto suelto a relacion real,
    // para que la analitica de variantes (SS5.5) pueda hacer join.
    const envio = app.findCollectionByNameOrId('envio');
    const plantillaId = app.findCollectionByNameOrId('plantilla').id;
    envio.fields.removeByName('plantilla');
    envio.fields.add(
      new Field({
        name: 'plantilla',
        type: 'relation',
        collectionId: plantillaId,
        cascadeDelete: false,
        maxSelect: 1,
      }),
    );
    app.save(envio);
  },

  (app) => {
    const envio = app.findCollectionByNameOrId('envio');
    envio.fields.removeByName('plantilla');
    envio.fields.add(new Field({ name: 'plantilla', type: 'text', max: 0, min: 0 }));
    app.save(envio);

    app.delete(app.findCollectionByNameOrId('plantilla'));
  },
);
