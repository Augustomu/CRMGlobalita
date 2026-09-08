/// <reference path="../../../.pb/pb_data/types.d.ts" />

// Control, puesto al día contra el bundle nuevo de Augusto.
//
// LA CASA PASA AL PROYECTO. Hasta ahora el negocio se heredaba de la cuenta de
// LinkedIn (`cuenta.linea_negocio`): la cuenta de Alberto era SENG y el resto
// Globalita. Funcionaba, pero se rompe en el caso que el propio prototipo trae:
// un proyecto de inversión que entró por una charla, sin lead y sin cuenta, no
// tiene de quién heredar y quedaba fuera de las dos pestañas.
//
// Ahora la casa vive en el proyecto. La cuenta se sigue usando para SUGERIRLA
// cuando el proyecto nace de un lead —que es el 90% de los casos— pero se puede
// corregir, y un proyecto suelto ya no queda huérfano.
//
// SE VA EL TIPO `prototipo`. El bundle nuevo tiene tres tipos: Fabript/PIV,
// Parcería e Inversión. Los tres proyectos que eran "prototipo" pasaron a
// Fabript/PIV en el prototipo de Augusto, y se hace lo mismo acá.
//
// El valor viejo NO se saca de la lista de opciones: si quedara alguna fila con
// `prototipo` en producción, sacarlo la volvería invalida y PocketBase la
// rechazaría en el próximo guardado. Se migran los datos y la opción queda
// muerta, que es más barato que perder una fila.

migrate(
  (app) => {
    const proyecto = app.findCollectionByNameOrId('proyecto');

    proyecto.fields.add(
      new Field({
        name: 'casa',
        type: 'select',
        maxSelect: 1,
        // Los nombres que usa el equipo, que son los del prototipo.
        values: ['globalita', 'seng'],
      }),
    );
    app.save(proyecto);

    // Backfill: la casa sale del tipo cuando alcanza, y si no, de la cuenta.
    // `inversion` es de SENG por definición; los otros dos son de Globalita.
    const casaDeCuenta = {};
    for (const c of app.findAllRecords('cuenta')) {
      casaDeCuenta[c.id] = c.get('linea_negocio') === 'inversiones' ? 'seng' : 'globalita';
    }

    for (const p of app.findAllRecords('proyecto')) {
      if (p.get('tipo') === 'prototipo') p.set('tipo', 'fabript_piv');

      const cuenta = p.get('cuenta');
      const casa =
        p.get('tipo') === 'inversion'
          ? 'seng'
          : cuenta && casaDeCuenta[cuenta]
            ? casaDeCuenta[cuenta]
            : 'globalita';
      p.set('casa', casa);
      app.save(p);
    }
  },

  (app) => {
    const proyecto = app.findCollectionByNameOrId('proyecto');
    proyecto.fields.removeByName('casa');
    app.save(proyecto);
  },
);
