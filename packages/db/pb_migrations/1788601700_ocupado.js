/// <reference path="../../../.pb/pb_data/types.d.ts" />

// `ocupado`: cuando esta tomado un calendario, SIN decir por quien ni de que.
//
// EL PROBLEMA QUE RESUELVE (§6.3 y §8.6 del manual).
//
// La agenda de un colaborador tiene que mostrar sus reuniones y, ademas, las
// del administrador como bloques «Ocupado» sin nombre ni detalle — para que no
// agende encima. Hasta ahora la agenda pedia TODAS las reuniones con el perfil
// expandido, asi que cualquier colaborador podia ver con quien se reune el
// administrador, de que empresa y de que cuenta.
//
// Esconderlo al dibujar no alcanza: los datos ya viajaron al navegador. Y una
// regla de PocketBase no sirve, porque las reglas filtran FILAS y lo que hace
// falta es filtrar COLUMNAS — el colaborador tiene que recibir el horario y no
// el nombre.
//
// Una coleccion de vista si puede: expone solo las columnas de la consulta.
// El que pide `ocupado` recibe cuando, cuanto dura y en que calendario. El
// nombre no esta ni en la respuesta.
//
// Las canceladas quedan afuera: un horario cancelado esta libre.

migrate(
  (app) => {
    app.save(
      new Collection({
        type: 'view',
        name: 'ocupado',
        listRule: '@request.auth.id != ""',
        viewRule: '@request.auth.id != ""',
        viewQuery: [
          'SELECT',
          '  reunion.id       AS id,',
          '  reunion.calendario AS calendario,',
          '  reunion.inicio   AS inicio,',
          '  reunion.duracion_min AS duracion_min,',
          '  reunion.zona     AS zona',
          'FROM reunion',
          "WHERE reunion.estado != 'cancelada'",
        ].join('\n'),
      }),
    );
  },

  (app) => {
    app.delete(app.findCollectionByNameOrId('ocupado'));
  },
);
