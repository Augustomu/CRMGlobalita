/// <reference path="../pb_data/types.d.ts" />

// El nombre que manda WhatsApp, separado del que vale (§7.4).
//
// EL PROBLEMA, encontrado el 11/09. Un chat tiene hasta tres nombres posibles:
//
//   1. El de la agenda de Google — como Augusto lo tiene guardado. Es el bueno.
//   2. El `pushName` de WhatsApp — el que la otra persona eligió para sí misma.
//      «Juancito», «Dr. R», o el nombre de su negocio.
//   3. El que escriba una persona a mano en el CRM.
//
// Todos caían en el mismo campo, y la regla de la agenda —correcta— es NO PISAR
// un nombre que ya está, porque puede haberlo puesto una persona. Resultado: de
// 56 chats, 52 tenían el `pushName` puesto por la importación, así que **la
// agenda no podía completar ni uno solo**. Augusto lo reportó tres veces:
// «los contactos de WhatsApp siguen sin agendarse».
//
// LA SOLUCION es que cada nombre viva donde corresponde. `nombre_wa` guarda lo
// que dijo WhatsApp; `nombre` queda para la agenda y para lo que escriba una
// persona. La pantalla muestra `nombre` y, si está vacío, `nombre_wa`.
//
// Así la agenda puede completar sin pisar nada de nadie, que era el punto de la
// regla original.

migrate(
  (app) => {
    const c = app.findCollectionByNameOrId('chat_personal');

    if (!c.fields.getByName('nombre_wa')) {
      c.fields.add(new Field({ name: 'nombre_wa', type: 'text', max: 120, required: false }));
      app.save(c);
    }

    // Lo que ya está guardado en `nombre` vino de WhatsApp: lo puso la
    // importación del 11/09, no una persona. Se MUEVE, no se copia — si
    // quedara en los dos lados, la agenda seguiría sin poder completar nada y
    // esta migración no habría servido para nada.
    for (const fila of app.findAllRecords('chat_personal')) {
      const n = String(fila.getString('nombre') || '').trim();
      if (!n) continue;
      fila.set('nombre_wa', n);
      fila.set('nombre', '');
      app.save(fila);
    }
  },

  (app) => {
    const c = app.findCollectionByNameOrId('chat_personal');
    // Se devuelve lo que se movió, para no perder los nombres al bajar.
    for (const fila of app.findAllRecords('chat_personal')) {
      const wa = String(fila.getString('nombre_wa') || '').trim();
      if (wa && !String(fila.getString('nombre') || '').trim()) {
        fila.set('nombre', wa);
        app.save(fila);
      }
    }
    c.fields.removeByName('nombre_wa');
    app.save(c);
  },
);
