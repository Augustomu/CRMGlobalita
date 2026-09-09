/// <reference path="../pb_data/types.d.ts" />

// Un usuario de demo, para poder VER la pantalla de Usuarios con dos personas.
//
// POR QUE. Augusto lo pidio: con un solo usuario —el suyo— no se ven ni el
// boton de reiniciar contraseña ni el de dar de baja, porque los dos estan
// deshabilitados sobre uno mismo a proposito (nadie se borra ni se resetea a si
// mismo). La pantalla se veia a medias y no habia forma de revisar el diseño.
//
// QUEDA EN `pendiente`, que es el estado real de alguien invitado que todavia
// no entro: no puede iniciar sesion, no ve nada, no toca ningun dato. Es lo mas
// cerca de «existe para mirar» que hay.
//
// LA CLAVE ES ALEATORIA Y NO LA SABE NADIE. Ni queda escrita aca ni se muestra
// en ningun lado. No es un descuido: una clave conocida en el codigo es una
// puerta abierta, y ademas §6.7 dice que las claves las elige su dueño desde el
// enlace del correo, no las fija un administrador.
//
// Se borra desde la propia pantalla cuando ya no haga falta, que es justamente
// el boton que Augusto queria probar.

migrate(
  (app) => {
    const coleccion = app.findCollectionByNameOrId('users');

    try {
      app.findFirstRecordByData('users', 'email', 'demo@globalita.test');
      return; // ya existe: no se duplica
    } catch (_) {
      // No estaba. Se crea.
    }

    const r = new Record(coleccion);
    r.set('name', 'Usuario de demo');
    r.set('email', 'demo@globalita.test');
    r.set('emailVisibility', true);
    r.set('verified', false);
    r.set('rol', 'colaborador');
    r.set('estado', 'pendiente');
    r.set('permisos', {});
    r.setPassword($security.randomString(40));
    app.save(r);

    app.logger().info('usuario-de-demo', 'detalle', 'creado en estado pendiente, sin clave conocida');
  },

  (app) => {
    try {
      app.delete(app.findFirstRecordByData('users', 'email', 'demo@globalita.test'));
    } catch (_) {
      // Ya lo borro alguien desde la pantalla, que es lo esperado.
    }
  },
);
