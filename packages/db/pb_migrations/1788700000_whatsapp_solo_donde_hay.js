/// <reference path="../pb_data/types.d.ts" />

// Cuáles de las nueve cuentas usan WhatsApp. Hoy: una (§8.2).
//
// POR QUE HACE FALTA. La pantalla de Cuentas conectadas dibujaba UNA FILA DE
// WHATSAPP POR CUENTA, nueve en total, cada una con su botón «Vincular». Eso
// daba a entender que hay nueve sesiones de WhatsApp por vincular, y no es
// cierto: Augusto lo dijo el 11/09, *«el resto no tiene cuentas de WhatsApp, mi
// cuenta de WhatsApp es la única que voy a utilizar»*.
//
// Ocho filas rojas que nunca se van a poner verdes no son información: son
// ruido que tapa la única fila que importa, y hacen que la pantalla mienta
// sobre lo que falta hacer.
//
// POR QUE UN CAMPO EN `cuenta` Y NO UN VALOR EN `configuracion`. Un valor
// suelto —«la cuenta de WhatsApp es AMU»— alcanza para hoy y se queda corto el
// día que entre una segunda. El dato es de la cuenta, así que vive en la
// cuenta; que hoy haya una sola prendida es un HECHO de los datos y no una
// forma del esquema. Esto es LinkedIn al revés: ahí las nueve cuentas operan,
// acá opera una.
//
// LINKEDIN NO SE TOCA. Las nueve siguen mostrándose en su sección, porque las
// nueve tienen sesión de LinkedIn y las nueve invitan.

migrate(
  (app) => {
    const c = app.findCollectionByNameOrId('cuenta');

    if (!c.fields.getByName('wa_habilitado')) {
      c.fields.add(new Field({ name: 'wa_habilitado', type: 'bool', required: false }));
      app.save(c);
    }

    // AMU es la cuenta de Augusto: la del `Default` de Chrome y la del número
    // que está en WA_NUMERO. Es la única que se prende.
    //
    // Si mañana hay otra, se prende desde la pantalla; no hace falta otra
    // migración. Y si esta base no tiene AMU —una base nueva, por ejemplo—
    // esto no falla: deja todas apagadas y la pantalla lo dice.
    const cuentas = app.findRecordsByFilter('cuenta', 'abrev = "AMU"', '', 1, 0);
    for (const fila of cuentas) {
      fila.set('wa_habilitado', true);
      app.save(fila);
    }
  },

  (app) => {
    const c = app.findCollectionByNameOrId('cuenta');
    c.fields.removeByName('wa_habilitado');
    app.save(c);
  },
);
