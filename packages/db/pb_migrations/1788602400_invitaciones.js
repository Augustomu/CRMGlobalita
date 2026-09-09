/// <reference path="../pb_data/types.d.ts" />

// El alta de un usuario por correo (§6.7, §7.5).
//
// Hasta ahora el administrador escribia una clave temporal a mano y se la
// pasaba por fuera del sistema. Eso tiene dos problemas: la clave viaja por
// donde sea (WhatsApp, un papel) y nadie sabe si la persona llego a entrar.
//
// Ahora se le manda un correo con su usuario y un enlace de un solo uso donde
// ELIGE su contraseña. El correo no lleva la clave. Es la diferencia entre un
// mensaje que caduca en siete dias y uno que queda en esa bandeja de entrada
// para siempre: quien acceda a esa casilla dentro de dos años, con la clave
// escrita, tiene una llave del CRM.
//
// El token vive en su propia coleccion y no en `users` por una razon concreta:
// `users` es una coleccion auth y sus campos se leen segun las reglas de la
// coleccion. Un campo `invitacion_token` ahi seria legible por cualquiera que
// pueda listar usuarios — es decir, por cualquier administrador, y por
// cualquier error futuro en esas reglas. Aca las cinco reglas son `null`, que
// en PocketBase significa "solo el servidor": ni un superusuario logueado por
// la API lo lee. Es el mismo patron que `google_cuenta` con el refresh_token.

migrate(
  (app) => {
    const usersId = app.findCollectionByNameOrId('users').id;

    app.save(
      new Collection({
        type: 'base',
        name: 'invitacion',
        // Las cinco en null: nadie toca esto por la API. Se maneja entero
        // desde los hooks, que corren adentro del servidor.
        listRule: null,
        viewRule: null,
        createRule: null,
        updateRule: null,
        deleteRule: null,
        fields: [
          {
            name: 'id', type: 'text', primaryKey: true, required: true,
            min: 15, max: 15, autogeneratePattern: '[a-z0-9]{15}',
          },
          {
            name: 'usuario', type: 'relation', collectionId: usersId,
            required: true, maxSelect: 1, cascadeDelete: true,
          },
          // El token se guarda HASHEADO, no en claro.
          //
          // Si alguien llega a leer la base —un backup que se filtra, un dump
          // en el disco— con el token en claro entra como cualquiera de los
          // invitados pendientes. Con el hash no: el token solo existe en el
          // correo que ya se mando.
          { name: 'token_hash', type: 'text', required: true, max: 128 },
          { name: 'expira', type: 'text', required: true, max: 40 },
          // Vacio = todavia no se uso. Se guarda la fecha y no un booleano
          // porque saber CUANDO entro alguien por primera vez es justo lo que
          // se pregunta cuando algo sale mal.
          { name: 'usada_en', type: 'text', required: false, max: 40 },
          // `alta` o `reinicio`: cambia el texto del correo, y despues sirve
          // para responder "a esta persona le reiniciaron la clave tres veces".
          {
            name: 'motivo', type: 'select', maxSelect: 1, required: true,
            values: ['alta', 'reinicio'],
          },
          { name: 'creada_por', type: 'relation', collectionId: usersId, maxSelect: 1 },
          { name: 'created', type: 'autodate', onCreate: true },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE INDEX idx_invitacion_token ON invitacion (token_hash)',
          'CREATE INDEX idx_invitacion_usuario ON invitacion (usuario)',
        ],
      }),
    );

    // El usuario que todavia no eligio su clave.
    //
    // `debe_cambiar_clave` no es lo mismo que `estado = pendiente`: pendiente
    // es "nunca entro", y esto es "tiene que cambiarla antes de trabajar".
    // Hacen falta los dos porque un administrador puede reiniciarle la clave a
    // alguien que ya viene usando el CRM hace meses, y esa persona no vuelve a
    // estar pendiente.
    const users = app.findCollectionByNameOrId('users');
    users.fields.add(
      new Field({
        name: 'debe_cambiar_clave',
        type: 'bool',
        required: false,
      }),
    );
    app.save(users);
  },

  (app) => {
    try {
      app.delete(app.findCollectionByNameOrId('invitacion'));
    } catch (_) {}
    try {
      const users = app.findCollectionByNameOrId('users');
      users.fields.removeByName('debe_cambiar_clave');
      app.save(users);
    } catch (_) {}
  },
);
