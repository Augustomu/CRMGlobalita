/// <reference path="../pb_data/types.d.ts" />

// Ningun mensaje viene destacado de fabrica.
//
// El seed de demo dejo diez plantillas destacadas, cada una con un alcance
// distinto que nadie eligio: R1 en «todas las cuentas», R2 solo en DL, R5 y R6
// y R8 en BR, R0 en toda la casa Globalita. La fila de Enviar mensaje aparecia
// llena de chips que Augusto no habia puesto y que no significaban nada.
//
// Un destacado es una decision: «este texto lo uso seguido para esta cuenta».
// Precargarlos es adivinar esa decision, y encima mal — el alcance salio de un
// seed de ejemplo. Que arranque vacio y que cada uno ponga los suyos con el «+»
// es la unica version honesta.
//
// No se borra ninguna plantilla: los textos quedan enteros en el Repositorio de
// mensajes. Lo unico que se vacia es el campo que dice donde aparecen como
// chip.

migrate(
  (app) => {
    const res = app
      .db()
      .newQuery("UPDATE plantilla SET destacado = '' WHERE destacado != '' AND destacado IS NOT NULL")
      .execute();

    app.logger().info('sin-destacados-de-fabrica', 'resultado', String(res));
  },

  (app) => {
    // No se revierte. Devolver los destacados del seed seria volver a poner
    // chips que nadie eligio, que es justo lo que esto vino a sacar.
    app
      .logger()
      .info('sin-destacados-de-fabrica', 'detalle', 'nada que revertir: eran chips que nadie eligio');
  },
);
