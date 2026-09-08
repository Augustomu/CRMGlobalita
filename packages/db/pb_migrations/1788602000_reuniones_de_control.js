/// <reference path="../pb_data/types.d.ts" />

// `reunion_control`: las reuniones como las mira Control, sin datos de contacto.
//
// Control necesita de cada reunion quien es y de que cuenta salio, y eso vive en
// el perfil del lead. Pedirlo con `expand=lead.perfil` traia el perfil ENTERO
// —telefono, email, links— y ademas el lead entero, que tiene sus propios tres
// campos de email. Al partner le llegaba todo eso al navegador aunque la
// pantalla solo dibujara el nombre.
//
// Es el tercer caso del mismo problema (agenda, leads confirmados, y este) y la
// tercera vez la misma solucion: una vista con las columnas que si se pueden
// ver. Las reglas de PocketBase filtran filas; las columnas solo se recortan
// asi.
//
// La diferencia con `ocupado` es lo que cada una esconde. `ocupado` esconde DE
// QUIEN es el horario, porque ahi la pregunta es solo cuando esta tomado. Esta
// muestra de quien es —Control existe para eso— y esconde como contactarlo.

migrate(
  (app) => {
    const AUTH = '@request.auth.id != ""';
    const regla = [
      AUTH,
      ' && (',
      '@request.auth.rol != "observador" || @request.auth.linea_control = ""',
      ' || linea = @request.auth.linea_control',
      ')',
    ].join('');

    app.save(
      new Collection({
        type: 'view',
        name: 'reunion_control',
        listRule: regla,
        viewRule: regla,
        viewQuery: [
          'SELECT',
          '  reunion.id                     AS id,',
          '  reunion.inicio                 AS inicio,',
          "  COALESCE(reunion.zona, '')     AS zona,",
          '  reunion.duracion_min           AS duracion_min,',
          "  COALESCE(reunion.estado, '')   AS estado,",
          "  COALESCE(reunion.notas, '')    AS nota,",
          "  COALESCE(reunion.lead, '')     AS lead,",
          "  COALESCE(perfil.nombre, '')    AS nombre,",
          "  COALESCE(perfil.cargo, '')     AS cargo,",
          "  COALESCE(perfil.empresa, '')   AS empresa,",
          "  COALESCE(perfil.pais, '')      AS pais,",
          "  COALESCE(perfil.ciudad, '')    AS ciudad,",
          "  COALESCE(perfil.industria, '') AS industria,",
          "  COALESCE(cuenta.abrev, '')     AS cuenta,",
          // Quien la genero: el nombre, no el usuario entero. Pidiendo el
          // usuario venia su email.
          "  COALESCE(quien.name, '')       AS genero,",
          "  COALESCE(cuenta.linea_negocio, '') AS linea",
          'FROM reunion',
          'LEFT JOIN lead   ON lead.id   = reunion.lead',
          'LEFT JOIN perfil ON perfil.id = lead.perfil',
          'LEFT JOIN cuenta ON cuenta.id = lead.cuenta',
          'LEFT JOIN users  AS quien ON quien.id = lead.asignado',
        ].join('\n'),
      }),
    );

    // Y el lead deja de estar al alcance del observador: para lo que necesita
    // ya tiene `confirmado`, que no lleva sus tres campos de email.
    const lead = app.findCollectionByNameOrId('lead');
    lead.listRule = `${AUTH} && @request.auth.rol != "observador"`;
    lead.viewRule = lead.listRule;
    app.save(lead);
  },

  (app) => {
    app.delete(app.findCollectionByNameOrId('reunion_control'));
    const lead = app.findCollectionByNameOrId('lead');
    lead.listRule = '@request.auth.id != ""';
    lead.viewRule = lead.listRule;
    app.save(lead);
  },
);
