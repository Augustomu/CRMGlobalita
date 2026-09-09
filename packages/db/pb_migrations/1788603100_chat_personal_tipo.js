/// <reference path="../pb_data/types.d.ts" />

// Personal o de trabajo, en WA Personal (§7.9).
//
// La pantalla junta los dos mundos del mismo telefono: la familia y el contacto
// que escribio por un proyecto. Hasta ahora la unica forma de separarlos era
// mover el de trabajo a Follow-up, que es una decision grande —le crea un lead,
// entra en la cadencia— y no siempre corresponde: hay gente de trabajo con la
// que uno habla y a la que no esta prospectando.
//
// `tipo` es una etiqueta suelta, no un estado: no dispara nada, no mueve nada,
// solo sirve para filtrar. Vacio significa «todavia no lo clasifique», que es
// lo que van a ser todos los chats de hoy y esta bien que se note.

migrate(
  (app) => {
    const c = app.findCollectionByNameOrId('chat_personal');
    if (!c.fields.getByName('tipo')) {
      c.fields.add(
        new Field({ name: 'tipo', type: 'select', maxSelect: 1, values: ['personal', 'trabajo'] }),
      );
      app.save(c);
    }
  },

  (app) => {
    const c = app.findCollectionByNameOrId('chat_personal');
    c.fields.removeByName('tipo');
    app.save(c);
  },
);
