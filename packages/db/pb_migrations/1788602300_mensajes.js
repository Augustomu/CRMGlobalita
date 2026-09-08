/// <reference path="../pb_data/types.d.ts" />

// La conversacion del lead (§3.2, §7.2, decision cerrada #2).
//
// El manual la define como `mensajes_li[]` y `mensajes_wa[]` dentro del lead,
// cada uno `{ quien: 'in'|'out', texto, enviado_en, ack? }`. Aca son una
// COLECCION con un campo `canal`, no dos arrays embebidos, por tres razones:
//
//   1. Un hilo de LinkedIn de dos años son cientos de mensajes. Embebidos en el
//      lead, cada vez que alguien cambia una etiqueta se reescribe el hilo
//      entero, y cada vez que la lista pide 189 leads se traen todos los hilos.
//   2. El worker va a insertar mensajes de a uno mientras llegan. Un array
//      embebido obliga a leer, empujar y guardar — y dos mensajes que llegan
//      juntos se pisan.
//   3. `enviado_en` se puede indexar, que es lo que hace que "el ultimo
//      mensaje" sea una consulta y no un recorrido.
//
// Lo que el manual pide se sigue cumpliendo: los dos hilos salen filtrando por
// canal, que es lo mismo que tener dos arrays sin las tres desventajas.
//
// `ack` es solo de WhatsApp: LinkedIn no informa entrega ni lectura. Un ack
// vacio en un mensaje de LinkedIn no es "no llego", es "no se sabe", y por eso
// la pantalla no dibuja nada ahi en vez de dibujar un tilde gris.

migrate(
  (app) => {
    const leadId = app.findCollectionByNameOrId('lead').id;
    const AUTH = '@request.auth.id != ""';

    // El hilo tiene el nombre del lead adentro del texto. El observador no ve
    // leads (migracion 1788602000) y tampoco tiene por que ver sus mensajes.
    const regla = `${AUTH} && @request.auth.rol != "observador"`;

    app.save(
      new Collection({
        type: 'base',
        name: 'mensaje',
        listRule: regla,
        viewRule: regla,
        createRule: regla,
        updateRule: regla,
        deleteRule: regla,
        fields: [
          {
            name: 'id', type: 'text', primaryKey: true, required: true,
            min: 15, max: 15, autogeneratePattern: '[a-z0-9]{15}',
          },
          {
            name: 'lead', type: 'relation', collectionId: leadId,
            maxSelect: 1, required: true, cascadeDelete: true,
          },
          { name: 'canal', type: 'select', maxSelect: 1, required: true, values: ['linkedin', 'whatsapp'] },
          // 'in' es del lead, 'out' es nuestro. Los nombres son los del manual.
          { name: 'quien', type: 'select', maxSelect: 1, required: true, values: ['in', 'out'] },
          { name: 'texto', type: 'text', max: 8000 },
          { name: 'enviado_en', type: 'date' },
          // Solo WhatsApp. Vacio = no se sabe, que no es lo mismo que "no llego".
          { name: 'ack', type: 'select', maxSelect: 1, values: ['enviado', 'entregado', 'leido'] },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        ],
        indexes: ['CREATE INDEX idx_mensaje_lead ON mensaje (lead, canal, enviado_en)'],
      }),
    );
  },

  (app) => {
    app.delete(app.findCollectionByNameOrId('mensaje'));
  },
);
