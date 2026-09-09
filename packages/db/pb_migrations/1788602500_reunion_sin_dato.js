/// <reference path="../pb_data/types.d.ts" />

// El estado `sin_dato` de una reunion (§7.11.2).
//
// Los cuatro estados de antes —pendiente, asistio, no-asistio, cancelada—
// alcanzaban para una reunion que agenda el CRM: alguien la marca despues.
// No alcanzan para el historico recuperado.
//
// De los 298 eventos de Google Calendar, 110 tienen la invitacion aceptada y 7
// rechazada. Los otros 181 el invitado nunca los toco. Eso NO quiere decir que
// no fue: mucha gente va a reuniones sin apretar nunca el boton de aceptar.
//
// Sin este estado hay que elegir entre dos mentiras. Marcarlas "no asistio"
// inventa 181 ausencias y deja el tablero diciendo 41% de asistencia. Marcarlas
// "asistio" inventa 181 presencias. Las dos hacen que un tablero que existe
// para decidir sobre el negocio diga algo que nadie verifico.
//
// Con `sin_dato` la reunion consta —que la hubo es un hecho— y el resultado
// queda declarado como lo que es: desconocido. Los porcentajes se calculan
// sobre las que constan, no sobre el total.

migrate(
  (app) => {
    const c = app.findCollectionByNameOrId('reunion');
    const campo = c.fields.getByName('estado');
    if (campo && campo.values.indexOf('sin_dato') < 0) {
      campo.values.push('sin_dato');
      app.save(c);
    }
  },

  (app) => {
    const c = app.findCollectionByNameOrId('reunion');
    const campo = c.fields.getByName('estado');
    if (!campo) return;
    // Las que quedaron en sin_dato vuelven a pendiente: es el unico de los
    // otros cuatro que no afirma nada sobre si la persona fue.
    for (const r of app.findAllRecords('reunion')) {
      if (String(r.get('estado')) === 'sin_dato') {
        r.set('estado', 'pendiente');
        app.save(r);
      }
    }
    campo.values = campo.values.filter((v) => v !== 'sin_dato');
    app.save(c);
  },
);
