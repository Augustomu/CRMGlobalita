/// <reference path="../../../.pb/pb_data/types.d.ts" />

// Los tres pendientes del bloque 1 del documento de diseño que necesitan
// guardar algo nuevo. Ver §7 del manual.
//
// 1. CAMBIOS 8 Y 9 — `etiqueta.usada_en`.
//    El panel se ordena "por última edición" y la ficha ofrece las seis usadas
//    más recientemente. `updated` no sirve para eso: cambia al renombrar una
//    etiqueta, que no es usarla, y no cambia al aplicarla a un lead, que sí lo
//    es. Hace falta una fecha propia.
//
// 2. CAMBIO 12 — `lead.archivada`.
//    Marcar asistió o no asistió archiva la ficha. Se guarda como un dato y no
//    como una situación más porque son ejes distintos: un lead archivado
//    conserva su situación (contestó, agotado) y la archivada dice otra cosa —
//    que ya no hay nada que hacer con él en la columna de trabajo.
//
// 3. CAMBIO 14 — colección `edicion`.
//    El log de ediciones del perfil, con fecha y valor anterior. Hasta ahora la
//    pila de deshacer vivía solo mientras la ficha estaba abierta: cerrarla
//    perdía el historial, que es justo lo que el log tiene que contestar
//    —"¿quién le cambió la empresa, y qué decía antes?"— cuando alguien lo
//    pregunta tres semanas después.

migrate(
  (app) => {
    // ---------- 1. etiqueta.usada_en ----------
    const etiqueta = app.findCollectionByNameOrId('etiqueta');
    etiqueta.fields.add(new Field({ name: 'usada_en', type: 'date' }));
    app.save(etiqueta);

    // Las que ya están aplicadas a algún lead arrancan con la fecha de ese
    // lead: si no, el catálogo entero queda sin fecha y la fila de recientes
    // sale vacía hasta que alguien vuelva a etiquetar a mano.
    const ultimo = {};
    for (const l of app.findAllRecords('lead')) {
      const cuando = String(l.get('updated') || '').slice(0, 10);
      for (const id of l.get('etiquetas') || []) {
        if (!ultimo[id] || ultimo[id] < cuando) ultimo[id] = cuando;
      }
    }
    for (const e of app.findAllRecords('etiqueta')) {
      if (ultimo[e.id]) {
        e.set('usada_en', ultimo[e.id]);
        app.save(e);
      }
    }

    // ---------- 2. lead.archivada ----------
    const lead = app.findCollectionByNameOrId('lead');
    lead.fields.add(new Field({ name: 'archivada', type: 'bool' }));
    lead.fields.add(new Field({ name: 'archivada_motivo', type: 'text', max: 200 }));
    app.save(lead);

    // ---------- 3. edicion ----------
    const usersId = app.findCollectionByNameOrId('users').id;
    const perfilId = app.findCollectionByNameOrId('perfil').id;
    const leadId = app.findCollectionByNameOrId('lead').id;

    app.save(
      new Collection({
        type: 'base',
        name: 'edicion',
        // Se lee y se escribe con sesión; nadie borra ni edita una entrada del
        // log, porque un historial que se puede reescribir no es un historial.
        listRule: '@request.auth.id != ""',
        viewRule: '@request.auth.id != ""',
        createRule: '@request.auth.id != ""',
        updateRule: null,
        deleteRule: null,
        fields: [
          { name: 'id', type: 'text', primaryKey: true, required: true, min: 15, max: 15, autogeneratePattern: '[a-z0-9]{15}' },
          // Cuelga del PERFIL, no del lead: el log es "todo lo editado en ese
          // perfil" y el mismo perfil puede trabajarse desde dos cuentas (D27).
          { name: 'perfil', type: 'relation', collectionId: perfilId, maxSelect: 1, required: true, cascadeDelete: true },
          // Igual se guarda desde qué lead se editó, que es el contexto.
          { name: 'lead', type: 'relation', collectionId: leadId, maxSelect: 1 },
          { name: 'usuario', type: 'relation', collectionId: usersId, maxSelect: 1 },
          { name: 'campo', type: 'text', required: true, max: 60 },
          { name: 'antes', type: 'text', max: 3000 },
          { name: 'despues', type: 'text', max: 3000 },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        ],
        indexes: ['CREATE INDEX idx_edicion_perfil ON edicion (perfil, created)'],
      }),
    );
  },

  (app) => {
    app.delete(app.findCollectionByNameOrId('edicion'));

    const lead = app.findCollectionByNameOrId('lead');
    lead.fields.removeByName('archivada');
    lead.fields.removeByName('archivada_motivo');
    app.save(lead);

    const etiqueta = app.findCollectionByNameOrId('etiqueta');
    etiqueta.fields.removeByName('usada_en');
    app.save(etiqueta);
  },
);
