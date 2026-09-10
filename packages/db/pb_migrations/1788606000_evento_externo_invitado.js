/// <reference path="../pb_data/types.d.ts" />

// El correo del invitado de un evento de Google (§7.6).
//
// POR QUE HACE FALTA. Augusto, el 09/09: *«cuando quiero conectar un evento,
// primero que me muestre en un hover el correo de la persona que fue invitada
// al evento y un boton para conectarse»*. Y despues, mirando la pantalla:
// *«no me muestra nada, tampoco me muestra el correo. Entonces, si yo quiero
// conectarlo, no se a que lead pertenece»*.
//
// Tiene razon y el problema no era la pantalla: `evento_externo` guardaba
// calendario, titulo, inicio, duracion, zona, dia_entero y el id de Google. El
// correo no estaba en ningun lado, asi que no habia nada que mostrar.
//
// ES EL ERROR 11 DEL REGISTRO otra vez —«no habia donde guardarlo»— y por eso
// esta vez se miro el esquema ANTES de dibujar el hover. Aquella vez costo
// cuatro pedidos.
//
// POR QUE UN SOLO CORREO Y NO LA LISTA. Un evento de prospeccion tiene dos
// personas: el lead y quien lo agendo. El dueno del calendario ya se sabe —es
// `calendario`— asi que de la lista de Google interesa EL OTRO, y con uno
// alcanza para saber a que lead conectarlo, que es para lo que se pidio.
// Guardar la lista entera seria guardar correos de gente que no es el lead
// —los otros de la casa, algun cc— en un CRM cuya base es de terceros.
//
// SE LLENA SOLO, CON LA SINCRONIZACION. No hay backfill: Google devuelve los
// `attendees` en cada vuelta del reloj, asi que los eventos ya guardados se
// completan a medida que se vuelven a tocar. Un backfill de 2.382 eventos
// contra la API seria pedir mil veces lo que el reloj trae gratis.

migrate(
  (app) => {
    const c = app.findCollectionByNameOrId('evento_externo');
    if (!c.fields.getByName('invitado_email')) {
      c.fields.add(
        new Field({
          name: 'invitado_email',
          type: 'text',
          max: 200,
          required: false,
        }),
      );
    }
    app.save(c);
  },

  (app) => {
    const c = app.findCollectionByNameOrId('evento_externo');
    c.fields.removeByName('invitado_email');
    app.save(c);
  },
);
