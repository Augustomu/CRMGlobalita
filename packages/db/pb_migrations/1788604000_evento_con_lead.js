/// <reference path="../pb_data/types.d.ts" />

// Conectar un evento del calendario con un lead (§7.6).
//
// EL PROBLEMA. La agenda dibuja 288 reuniones del CRM —que tienen lead— y 1769
// eventos que llegaron del Google Calendar, que no tienen nada. Augusto miro la
// semana y dijo que sus eventos «se ven palidos»: el color decia la verdad,
// esos bloques no son reuniones del CRM, pero la verdad estaba mal. «Brenno -
// Augusto» ES una reunion de prospeccion; lo que falta es el vinculo.
//
// Lo pidio tres veces y hasta hoy no habia DONDE guardarlo: `evento_externo` no
// tenia campo `lead`. Por eso esto es una migracion y no solo una pantalla.
//
// POR QUE UNA RELACION Y NO CONVERTIRLO EN `reunion`. Son dos cosas distintas.
// Una `reunion` la agendo el CRM: se puede mover, avisa al lead por correo y
// tiene estado de asistencia. Un `evento_externo` lo puso Google y el CRM no lo
// controla —moverlo desde aca daria a entender lo contrario—. Convertirlos
// duplicaria 278 reuniones que ya ocurrieron y ensuciaria las metricas de
// cadencia con reuniones que el CRM nunca agendo.
//
// `cascadeDelete: false` A PROPOSITO: si alguien borra el lead, el evento del
// calendario NO se borra. El evento es de Google y ocurrio; el CRM no es quien
// para hacerlo desaparecer. Queda suelto, como estaba antes de vincularlo.
//
// LA REGLA DE ESCRITURA. Hasta ahora `evento_externo` era de solo lectura desde
// la API: lo escribe el hook de sincronizacion con SQL, no la pantalla. Ahora
// hace falta que el DUENO del calendario pueda vincular sus propios eventos, y
// nada mas que los suyos — la misma condicion que ya tenian `listRule` y
// `viewRule`. El hook que trae los cambios de Google no toca `lead`: pisa
// titulo, inicio, duracion, zona y dia_entero, asi que el vinculo sobrevive a
// cada sincronizacion.

migrate(
  (app) => {
    const c = app.findCollectionByNameOrId('evento_externo');
    if (!c.fields.getByName('lead')) {
      const lead = app.findCollectionByNameOrId('lead');
      c.fields.add(
        new Field({
          name: 'lead',
          type: 'relation',
          collectionId: lead.id,
          maxSelect: 1,
          required: false,
          cascadeDelete: false,
        }),
      );
    }
    c.updateRule = '@request.auth.id != "" && calendario = @request.auth.id';
    app.save(c);
  },

  (app) => {
    const c = app.findCollectionByNameOrId('evento_externo');
    c.fields.removeByName('lead');
    c.updateRule = null;
    app.save(c);
  },
);
