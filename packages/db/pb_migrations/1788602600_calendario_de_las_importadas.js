/// <reference path="../pb_data/types.d.ts" />

// De quien es cada reunion importada del Calendar (§7.6, §8.3).
//
// EL PROBLEMA. Las 288 reuniones que entraron del export de Google Calendar
// tienen `calendario` vacio. Ese campo dice en la agenda de QUE usuario del CRM
// cae la reunion, y la vista `ocupado` —la que dibuja los bloques de los demas
// administradores en la grilla integrada— sale justamente de ahi. Mientras este
// vacio, `ocupado` no devuelve una sola fila: la mitad «de los demas» de la
// agenda se ve vacia aunque el codigo este bien, y no hay forma de darse cuenta
// mirando la pantalla.
//
// Hoy no se nota porque hay un solo administrador y el ve todo con detalle. Se
// va a notar el dia que entre el segundo, que es exactamente el dia en que
// nadie se va a acordar de esto.
//
// POR QUE SOLO CUANDO HAY UN ADMINISTRADOR. Las 288 salieron de un unico export
// —el calendario de una sola persona—, asi que con un solo administrador la
// respuesta es la unica posible y no hay nada que adivinar. Con dos o mas, no
// hay dato en la base que diga cual de ellos tuvo cada reunion: el export no
// trae esa columna. Antes que reparta al azar y deje la agenda diciendo algo
// que nadie verifico, esta migracion no hace nada y lo deja anotado. Es la
// misma regla que el estado `sin_dato`: entre inventar y no saber, no saber.
//
// No pisa nada: solo toca las filas que tienen `calendario` vacio.

migrate(
  (app) => {
    const admins = app.findAllRecords(
      'users',
      $dbx.exp("rol = 'administrador' AND estado = 'activo'"),
    );

    if (admins.length !== 1) {
      app
        .logger()
        .warn(
          'calendario-de-las-importadas',
          'admins',
          admins.length,
          'detalle',
          'se salteo: con 0 o mas de 1 administrador no hay forma de saber de quien fue cada reunion importada',
        );
      return;
    }

    const res = app
      .db()
      .newQuery(
        "UPDATE reunion SET calendario = {:u} WHERE (calendario = '' OR calendario IS NULL)",
      )
      .bind({ u: admins[0].id })
      .execute();

    app.logger().info('calendario-de-las-importadas', 'usuario', admins[0].id, 'resultado', String(res));
  },

  (app) => {
    // No se revierte. Volver a dejarlas en blanco perderia el unico dato que
    // dice de quien es cada reunion, y esta migracion no lo guardo en ningun
    // lado porque antes de correr NO habia dato que guardar: estaba vacio.
    app
      .logger()
      .info('calendario-de-las-importadas', 'detalle', 'nada que revertir: la vuelta atras solo borraria');
  },
);
