/// <reference path="../../../.pb/pb_data/types.d.ts" />

// Las reglas de fabrica, mas dos de ejemplo.
//
// Las dos de fabrica no son datos de demo: describen algo que el sistema HACE
// hoy, implementado en core/cadencia.ts y core/envio.ts. Se cargan como filas
// para que el panel muestre todas las automatizaciones que existen, sin que el
// usuario tenga que saber cuales estan cableadas y cuales no.
//
// Las dos de ejemplo si son demo, y estan elegidas para que se vea una regla
// con condicion y una sin ella.

migrate(
  (app) => {
    // id fijo, nombre, disparador, condicion, accion, activa, de_fabrica, corridas
    const REGLAS = [
      [
        'Etiqueta «Contacto» sugiere el proximo R',
        'el lead tiene la etiqueta Contacto',
        'sin Reunion, Esperando confirmacion ni Aprobacion del equipo',
        'muestra en el chat el proximo R que toca enviar (todas las cuentas)',
        true, true, 0,
      ],
      [
        'Enviar un R agrega «Recordatorio»',
        'se envia cualquiera de los R0-R8',
        '',
        'agrega la etiqueta Recordatorio si todavia no la tiene',
        true, true, 0,
      ],
      [
        'El que no asistio vuelve en una semana',
        'la reunion queda en no asistio',
        // Sin condicion es cadena VACIA, no el texto "sin condicion": el
        // catalogo ofrece esa opcion para poder elegir "ninguna", pero lo que
        // se guarda es la ausencia. Guardando el texto, la frase queda como
        // "...y sin condicion, entonces...", que no se lee.
        '',
        'fijar proximo contacto',
        true, false, 4,
      ],
      [
        'Lead nuevo de Brasil a Francisco',
        'entra un lead nuevo',
        'de un pais',
        'asignar a un colaborador',
        false, false, 0,
      ],
    ];

    for (const [nombre, disparador, condicion, accion, activa, fabrica, corridas] of REGLAS) {
      const r = new Record(app.findCollectionByNameOrId('regla'));
      r.set('nombre', nombre);
      r.set('disparador', disparador);
      r.set('condicion', condicion);
      r.set('accion', accion);
      r.set('activa', activa);
      r.set('de_fabrica', fabrica);
      r.set('corridas', corridas);
      app.save(r);
    }
  },

  (app) => {
    for (const r of app.findAllRecords('regla')) app.delete(r);
  },
);
