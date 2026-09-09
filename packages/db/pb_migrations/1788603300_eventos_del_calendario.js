/// <reference path="../pb_data/types.d.ts" />

// Los eventos del calendario que NO son reuniones del CRM (§7.6, §8.3).
//
// EL PROBLEMA. La agenda dibuja lo que esta en `reunion`, o sea las reuniones
// con leads. Pero el dia de Augusto tiene ademas todo lo otro: el almuerzo, la
// clase de idiomas, la reunion interna, el evento del equipo. Mirando la agenda
// del CRM el jueves parece libre a las 12 y en realidad no lo esta, asi que
// para agendar hay que abrir Google igual — y entonces la agenda del CRM no
// sirve para lo unico que tiene que servir.
//
// POR QUE UNA TABLA APARTE Y NO FILAS EN `reunion`. Una reunion del CRM tiene
// lead, cuenta, cadencia, estado de asistencia y se sincroniza de ida y vuelta.
// Un almuerzo no es nada de eso. Meterlos en la misma tabla obligaria a que
// cada consulta de reuniones filtre «las que si son reuniones», y el dia que
// alguien se olvide del filtro, el almuerzo entra en las metricas.
//
// LO QUE VE CADA UNO. `evento_externo` es PRIVADO: solo se leen los propios.
// El titulo de una reunion interna, o de un turno medico, no tiene por que
// viajarle a nadie. Para los demas administradores existe `ocupado`, que ahora
// es la union de las reuniones y de estos eventos: horario y nada mas, sin
// titulo. Es la misma regla de D18 que ya regia para las reuniones.

migrate(
  (app) => {
    const usersId = app.findCollectionByNameOrId('users').id;

    app.save(
      new Collection({
        type: 'base',
        name: 'evento_externo',
        // Solo los propios. La regla filtra por el dueno del calendario.
        listRule: '@request.auth.id != "" && calendario = @request.auth.id',
        viewRule: '@request.auth.id != "" && calendario = @request.auth.id',
        // Los escribe el hook de sincronizacion, nadie mas. Si la pantalla
        // pudiera crearlos, un evento inventado se veria igual que uno real.
        createRule: null,
        updateRule: null,
        deleteRule: null,
        fields: [
          { name: 'id', type: 'text', primaryKey: true, required: true, min: 15, max: 15, autogeneratePattern: '[a-z0-9]{15}' },
          { name: 'google_event_id', type: 'text', required: true, max: 300 },
          { name: 'calendario', type: 'relation', collectionId: usersId, maxSelect: 1, required: true, cascadeDelete: true },
          { name: 'titulo', type: 'text', max: 300 },
          // Mismo formato que `reunion.inicio`, para que la agenda no tenga que
          // saber de donde vino cada bloque.
          { name: 'inicio', type: 'text', max: 40 },
          { name: 'duracion_min', type: 'number' },
          { name: 'zona', type: 'text', max: 60 },
          // Los de dia entero no son un horario: no bloquean nada y la agenda
          // no los dibuja en la grilla. Se guardan igual para no perderlos.
          { name: 'dia_entero', type: 'bool' },
          { name: 'created', type: 'autodate', onCreate: true },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE UNIQUE INDEX idx_evento_externo_google ON evento_externo (calendario, google_event_id)',
          'CREATE INDEX idx_evento_externo_inicio ON evento_externo (inicio)',
        ],
      }),
    );

    // ---------- `ocupado` pasa a ser la union de las dos ----------
    //
    // Antes salia solo de `reunion`, asi que la parte «de los demas» de la
    // grilla integrada no mostraba nada de la vida real de la otra persona:
    // solo sus reuniones con leads. Para no pisarle un horario hace falta lo
    // otro tambien.
    const vieja = app.findCollectionByNameOrId('ocupado');
    app.delete(vieja);

    app.save(
      new Collection({
        type: 'view',
        name: 'ocupado',
        listRule: '@request.auth.id != ""',
        viewRule: '@request.auth.id != ""',
        // EL UNION VA ADENTRO DE UNA SUBCONSULTA, y no es cosmetica.
        //
        // PocketBase analiza la consulta de la vista para deducir sus campos,
        // y con un UNION suelto no puede: la migracion muere con «invalid
        // identifier parts» y la base no arranca. Paso de verdad. Envuelto,
        // el SELECT de afuera tiene identificadores claros y los deduce.
        viewQuery: [
          'SELECT',
          '  t.id AS id,',
          '  t.calendario AS calendario,',
          '  t.inicio AS inicio,',
          '  t.duracion_min AS duracion_min,',
          '  t.zona AS zona',
          'FROM (',
          '  SELECT',
          '    reunion.id AS id,',
          '    reunion.calendario AS calendario,',
          '    reunion.inicio AS inicio,',
          '    reunion.duracion_min AS duracion_min,',
          '    reunion.zona AS zona',
          '  FROM reunion',
          "  WHERE reunion.estado != 'cancelada'",
          '  UNION ALL',
          '  SELECT',
          '    evento_externo.id AS id,',
          '    evento_externo.calendario AS calendario,',
          '    evento_externo.inicio AS inicio,',
          '    evento_externo.duracion_min AS duracion_min,',
          '    evento_externo.zona AS zona',
          '  FROM evento_externo',
          // Los de dia entero no ocupan un horario: no bloquean nada.
          '  WHERE evento_externo.dia_entero = 0',
          ') t',
        ].join('\n'),
      }),
    );
  },

  (app) => {
    const nueva = app.findCollectionByNameOrId('ocupado');
    app.delete(nueva);
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
    app.delete(app.findCollectionByNameOrId('evento_externo'));
  },
);
