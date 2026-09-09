/// <reference path="../pb_data/types.d.ts" />

// En que idioma quedo destacado cada mensaje (§7.2).
//
// EL CAMBIO DE FONDO. La fila de Enviar mensaje dejo de ser «los pasos de la
// cadencia» y paso a ser «los mensajes que YO tengo a mano». Augusto lo dijo
// asi: «todo esto se elimina, yo elijo que es lo que queda guardado».
//
// Y de ahi sale este campo. Antes el idioma se elegia arriba, en el encabezado,
// y el mismo chip servia para los tres: se tocaba R2 y salia en el idioma que
// estuviera puesto. Ahora se elige AL DESTACAR —«quiero este mensaje, en
// portugues»— asi que el idioma es del chip, no de la pantalla. El selector de
// arriba se fue: era una pregunta que ya estaba contestada.
//
// Vacio = el que estaba destacado antes de este cambio. Se cae a `es`, que es
// el idioma que tienen todas las plantillas cargadas.

migrate(
  (app) => {
    const c = app.findCollectionByNameOrId('plantilla');
    if (!c.fields.getByName('destacado_idioma')) {
      c.fields.add(new Field({ name: 'destacado_idioma', type: 'text', max: 5 }));
      app.save(c);
    }
  },

  (app) => {
    const c = app.findCollectionByNameOrId('plantilla');
    c.fields.removeByName('destacado_idioma');
    app.save(c);
  },
);
