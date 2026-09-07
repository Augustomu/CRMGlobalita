/// <reference path="../../../.pb/pb_data/types.d.ts" />

// SEGURIDAD: la coleccion `users` venia con las reglas por defecto de
// PocketBase, y eso dejaba dos agujeros:
//
// 1. createRule = ""  ->  en PocketBase, la cadena vacia significa PUBLICO.
//    Cualquiera desde internet podia crear un usuario, ponerse rol
//    "administrador" y leer todos los leads. Verificado explotandolo contra la
//    instancia local antes de escribir esto.
//
// 2. listRule / viewRule = "id = @request.auth.id"  ->  cada usuario solo se ve
//    a si mismo. Efecto colateral: el `expand: asignado` de los leads volvia
//    vacio, asi que el administrador no veia a quien estaba asignado un lead, y
//    los chips de colaborador de la lista quedaban sin datos.
//
// Las altas de usuarios las hace un administrador desde la pantalla de Usuarios
// (SS7.5), nunca un registro publico: el manual no tiene auto-registro.

migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('users');

    const ES_ADMIN = '@request.auth.rol = "administrador"';

    // Ver el padron: cualquiera con sesion. Hace falta para mostrar "asignado a"
    // y para el selector de asignacion. No expone credenciales: PocketBase no
    // devuelve el hash de la clave, y el email solo si emailVisibility.
    users.listRule = '@request.auth.id != ""';
    users.viewRule = '@request.auth.id != ""';

    // Alta: solo administradores. Esto cierra el agujero.
    users.createRule = ES_ADMIN;

    // Editar: uno mismo (cambiar su clave) o un administrador.
    users.updateRule = `id = @request.auth.id || ${ES_ADMIN}`;

    // Baja: solo administradores, y nunca a uno mismo.
    users.deleteRule = `${ES_ADMIN} && id != @request.auth.id`;

    app.save(users);
  },

  (app) => {
    const users = app.findCollectionByNameOrId('users');
    users.listRule = 'id = @request.auth.id';
    users.viewRule = 'id = @request.auth.id';
    users.createRule = '';
    users.updateRule = 'id = @request.auth.id';
    users.deleteRule = 'id = @request.auth.id';
    app.save(users);
  },
);
