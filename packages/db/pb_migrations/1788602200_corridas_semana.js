/// <reference path="../pb_data/types.d.ts" />

// La regla cuenta las corridas de la SEMANA, no el total (§3.8, §7.10).
//
// El acumulado no dice nada: una regla que corrio 4.000 veces desde marzo y
// ninguna desde el lunes se ve igual de viva que una que corre todos los dias.
// Lo que se quiere saber mirando el panel es si esta funcionando AHORA.
//
// El campo se renombra en vez de agregarse: dos contadores obligan a decidir
// cual se muestra cada vez, y el que no se muestra se desactualiza.

migrate(
  (app) => {
    const c = app.findCollectionByNameOrId('regla');
    const campo = c.fields.find((f) => f.name === 'corridas');
    if (campo) campo.name = 'corridas_semana';
    app.save(c);
  },

  (app) => {
    const c = app.findCollectionByNameOrId('regla');
    const campo = c.fields.find((f) => f.name === 'corridas_semana');
    if (campo) campo.name = 'corridas';
    app.save(c);
  },
);
