/// <reference path="../pb_data/types.d.ts" />

// `confirmado`: los leads que confirmaron interes, SIN datos de contacto.
//
// Es el mismo problema que resolvio `ocupado` con la agenda, y la misma
// solucion. Las reglas de PocketBase filtran FILAS; las columnas solo se
// recortan con una vista.
//
// La regla de la migracion anterior ya deja al partner sin ver la tabla de
// perfiles — y esta bien, no le incumbe— pero eso tambien le rompia el expand
// de la lista de Control: los leads le llegaban sin nombre ni empresa. Esta
// vista le da lo que si tiene que ver:
//
//   quien es (nombre, empresa, cargo), donde esta (pais, ciudad, industria),
//   de que cuenta salio y en que etapa esta.
//
// Y nada mas. Telefono, email, links de LinkedIn y notas no estan en la
// consulta, asi que no hay peticion que los devuelva: no es que se escondan al
// dibujar, no existen del lado del servidor para este pedido.
//
// La casa sale de las etiquetas PROTEGIDAS (migracion 1788601600), que existen
// justamente para poder escribir esto: si el nombre fuera libre, un typo
// dejaria al partner sin ver nada o viendo de mas.

migrate(
  (app) => {
    // Un lead puede estar en las dos casas a la vez —PIV y ademas Inversion—,
    // asi que `casas` es una lista y no un valor. La regla la busca con `~`.
    const etiquetasProtegidas = [
      'SELECT group_concat(e.nombre, ", ")',
      '  FROM json_each(lead.etiquetas) je',
      '  JOIN etiqueta e ON e.id = je.value',
      ' WHERE e.protegida = 1',
    ].join('\n');

    const casas = [
      'SELECT group_concat(CASE WHEN e.nombre = \'Inversion\' THEN \'seng\' ELSE \'globalita\' END, ",")',
      '  FROM json_each(lead.etiquetas) je',
      '  JOIN etiqueta e ON e.id = je.value',
      ' WHERE e.protegida = 1',
    ].join('\n');

    const AUTH = '@request.auth.id != ""';
    const regla = [
      AUTH,
      ' && (',
      '@request.auth.rol != "observador" || @request.auth.linea_control = ""',
      ' || (@request.auth.linea_control = "ia" && casas ~ "globalita")',
      ' || (@request.auth.linea_control = "inversiones" && casas ~ "seng")',
      ')',
    ].join('');

    app.save(
      new Collection({
        type: 'view',
        name: 'confirmado',
        listRule: regla,
        viewRule: regla,
        viewQuery: [
          'SELECT',
          '  lead.id                        AS id,',
          '  perfil.nombre                  AS nombre,',
          "  COALESCE(perfil.empresa, '')   AS empresa,",
          "  COALESCE(perfil.cargo, '')     AS cargo,",
          "  COALESCE(perfil.pais, '')      AS pais,",
          "  COALESCE(perfil.ciudad, '')    AS ciudad,",
          "  COALESCE(perfil.industria, '') AS industria,",
          "  COALESCE(cuenta.abrev, '')     AS cuenta,",
          "  COALESCE(lead.etapa, '')       AS etapa,",
          `  (${etiquetasProtegidas})       AS etiquetas,`,
          `  (${casas})                     AS casas`,
          'FROM lead',
          'JOIN perfil ON perfil.id = lead.perfil',
          'LEFT JOIN cuenta ON cuenta.id = lead.cuenta',
          'WHERE EXISTS (',
          '  SELECT 1 FROM json_each(lead.etiquetas) je',
          '    JOIN etiqueta e ON e.id = je.value',
          '   WHERE e.protegida = 1',
          ')',
        ].join('\n'),
      }),
    );
  },

  (app) => {
    app.delete(app.findCollectionByNameOrId('confirmado'));
  },
);
