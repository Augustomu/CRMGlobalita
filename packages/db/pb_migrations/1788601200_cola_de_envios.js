/// <reference path="../../../.pb/pb_data/types.d.ts" />

// La cola de envíos (§7.2, §8.1).
//
// POR QUÉ ES UNA COLECCIÓN Y NO SE DEDUCE DE LOS LEADS.
//
// Sería tentador calcular la cola al vuelo: "los leads con próximo contacto
// hoy". Pero §8.1 es explícito — los envíos corren del lado del servidor y la
// cola tiene que sobrevivir a que el navegador esté cerrado. Una cola que se
// deduce de la pantalla no existe cuando nadie mira la pantalla.
//
// Además hay cosas que solo se saben en el momento de encolar y que después ya
// no se pueden reconstruir: con qué texto salió, en qué idioma, con qué cuenta,
// y por qué falló si falló. `envio` (§3.2) guarda lo que YA se mandó; esto
// guarda lo que se va a mandar. Son dos tablas porque son dos preguntas.
//
// El `estado` no se infiere del reloj. Un ítem cuya hora pasó puede estar
// pendiente (se cayó la sesión), enviado, o en error. Tratar "le pasó la hora"
// como "salió" es exactamente el bug que hace que alguien crea que un mensaje
// se mandó cuando no se mandó.

migrate(
  (app) => {
    const leadId = app.findCollectionByNameOrId('lead').id;
    const cuentaId = app.findCollectionByNameOrId('cuenta').id;
    const plantillaId = app.findCollectionByNameOrId('plantilla').id;

    app.save(
      new Collection({
        type: 'base',
        name: 'cola',
        // Se ve con sesión. Quién puede verla de verdad lo decide el permiso
        // `colaEnvios` en la UI (§10, tabla de permisos): acá alcanza con que
        // no sea pública.
        listRule: '@request.auth.id != ""',
        viewRule: '@request.auth.id != ""',
        createRule: '@request.auth.id != ""',
        updateRule: '@request.auth.id != ""',
        // Nada se borra: se cancela. Un envío que desaparece sin dejar rastro
        // no se puede explicar después.
        deleteRule: null,
        fields: [
          { name: 'id', type: 'text', primaryKey: true, required: true, min: 15, max: 15, autogeneratePattern: '[a-z0-9]{15}' },
          { name: 'lead', type: 'relation', collectionId: leadId, maxSelect: 1, required: true, cascadeDelete: true },
          {
            name: 'tipo',
            type: 'select',
            maxSelect: 1,
            required: true,
            // Los tres que salen solos. Solo `mensaje` hace lote: el
            // recordatorio y el agradecimiento no consumen cupo de la cuenta.
            values: ['mensaje', 'recordatorio', 'gracias'],
          },
          // La cuenta que envía. El lote y el cupo son SUYOS, no del sistema.
          { name: 'cuenta', type: 'relation', collectionId: cuentaId, maxSelect: 1 },
          { name: 'canal', type: 'select', maxSelect: 1, values: ['linkedin', 'whatsapp', 'email'] },
          // R1..R8 o vacío. Sirve para el detalle de la fila y para la métrica.
          { name: 'paso', type: 'text', max: 20 },
          { name: 'plantilla', type: 'relation', collectionId: plantillaId, maxSelect: 1 },
          // El texto ya resuelto. Se guarda al encolar y no se recalcula: si la
          // plantilla cambia entre que se encola y que sale, sale lo que se
          // aprobó, no lo nuevo.
          { name: 'texto', type: 'text', max: 4000 },
          { name: 'idioma', type: 'select', maxSelect: 1, values: ['es', 'pt', 'en'] },
          { name: 'cuando', type: 'date', required: true },
          {
            name: 'estado',
            type: 'select',
            maxSelect: 1,
            required: true,
            values: ['pendiente', 'enviado', 'error', 'cancelado'],
          },
          { name: 'enviado_en', type: 'date' },
          { name: 'error', type: 'text', max: 500 },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        // El worker pregunta siempre lo mismo: qué está pendiente y ya vence.
        indexes: [
          'CREATE INDEX idx_cola_pendiente ON cola (estado, cuando)',
          'CREATE INDEX idx_cola_lead ON cola (lead)',
        ],
      }),
    );
  },

  (app) => {
    app.delete(app.findCollectionByNameOrId('cola'));
  },
);
