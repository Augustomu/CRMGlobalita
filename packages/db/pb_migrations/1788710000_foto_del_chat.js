/// <reference path="../pb_data/types.d.ts" />

// La foto de perfil de cada chat de WhatsApp (§7.9).
//
// Pedido el 11/09: *«me gustaría que me traiga el nombre de cómo lo tengo
// agendado, la foto y el teléfono abajo del nombre»*. Una lista de chats sin
// fotos se recorre leyendo; con fotos se reconoce de un vistazo, que es la
// diferencia entre buscar a alguien y encontrarlo.
//
// ES UN ARCHIVO, NO UNA URL, y esa es la decisión que importa. WhatsApp da la
// foto como un enlace a su CDN **que vence en unas horas**. Guardar el enlace
// habría sido una línea de código y una lista llena de cuadros rotos al día
// siguiente — de esas fallas que aparecen cuando ya nadie se acuerda de por
// qué. Se guarda el archivo, que no depende de nadie.
//
// Se acepta sólo imagen y hasta 2 MB: una foto de perfil de WhatsApp pesa
// decenas de kilobytes, así que 2 MB es holgado y a la vez impide que algo
// raro llene el disco. La miniatura de 80 px es la que dibuja la lista.

migrate(
  (app) => {
    const c = app.findCollectionByNameOrId('chat_personal');

    if (!c.fields.getByName('foto')) {
      c.fields.add(
        new Field({
          name: 'foto',
          type: 'file',
          required: false,
          maxSelect: 1,
          maxSize: 2097152,
          mimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
          thumbs: ['80x80'],
        }),
      );
      app.save(c);
    }
  },

  (app) => {
    const c = app.findCollectionByNameOrId('chat_personal');
    c.fields.removeByName('foto');
    app.save(c);
  },
);
