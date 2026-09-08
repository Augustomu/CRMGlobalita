/// <reference path="../../../.pb/pb_data/types.d.ts" />

// Los invitados en copia de una reunion (§5.11).
//
// `invitado_email` ya guardaba al principal. Faltaban los demas: la reunion
// suele sumar gente que NO es el lead —el jefe, el tecnico, el de compras—, y
// esas direcciones existen solo para esa reunion.
//
// Por eso van en `reunion` y no en `lead`: guardarlas en la ficha ensuciaria el
// contacto con mails que no son suyos, y la proxima reunion con esa persona
// arrastraria invitados que ya no tienen nada que ver.

migrate(
  (app) => {
    const reunion = app.findCollectionByNameOrId('reunion');
    reunion.fields.add(new Field({ name: 'invitados_copia', type: 'json', maxSize: 4000 }));
    app.save(reunion);
  },

  (app) => {
    const reunion = app.findCollectionByNameOrId('reunion');
    reunion.fields.removeByName('invitados_copia');
    app.save(reunion);
  },
);
