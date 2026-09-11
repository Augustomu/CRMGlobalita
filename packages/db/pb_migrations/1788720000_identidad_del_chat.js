/// <reference path="../pb_data/types.d.ts" />

// Cómo se identifica una conversación de WhatsApp (§7.4).
//
// EL PROBLEMA, encontrado el 11/09 importando dos meses de historial real.
// Un chat se buscaba por teléfono. Pero WhatsApp no siempre da el teléfono: con
// los **LID** —su identificador interno, para no revelar el número de quien
// escribe con la privacidad activada— el teléfono queda vacío, y entonces la
// búsqueda era «teléfono vacío y nombre vacío».
//
// Esa condición la cumplen TODOS los que no tienen ni número ni nombre. Así que
// las conversaciones de personas distintas se fueron acumulando en la misma
// fila: quedó una con 4.468 mensajes que en realidad eran de varias.
//
// LA SOLUCION es guardar lo único que WhatsApp garantiza único: el JID. Es el
// identificador de la conversación —`5491133334444@s.whatsapp.net` o
// `1401664087@lid`— y no cambia.
//
// El teléfono SIGUE EXISTIENDO y sigue siendo lo que cruza con `perfil`: es el
// dato con el que trabaja una persona. El JID es para la máquina, y por eso no
// se muestra en ninguna pantalla.

migrate(
  (app) => {
    const c = app.findCollectionByNameOrId('chat_personal');

    if (!c.fields.getByName('wa_jid')) {
      c.fields.add(new Field({ name: 'wa_jid', type: 'text', max: 120, required: false }));
      app.save(c);
    }

    // El campo de mensajes se queda en 500 KB: con el tope de 400 mensajes que
    // ahora aplica el worker, una conversación pesa ~44 KB. Subirlo sería
    // tratar el síntoma; el tope trata la causa.
  },

  (app) => {
    const c = app.findCollectionByNameOrId('chat_personal');
    c.fields.removeByName('wa_jid');
    app.save(c);
  },
);
