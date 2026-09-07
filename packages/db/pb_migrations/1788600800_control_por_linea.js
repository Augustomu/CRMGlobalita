/// <reference path="../../../.pb/pb_data/types.d.ts" />

// Control es un permiso especial: no se lo da uno a un colaborador cualquiera,
// se lo da a alguien de AFUERA del equipo de prospeccion. Y hay dos afueras
// distintos, porque hay dos negocios:
//
//   Globalita (ia)          -> producto de IA. David, Alejandro, Edith,
//                              Francisco y Bruno.
//   SENG      (inversiones) -> propuestas de inversion. Hoy, solo Alberto.
//
// El socio de IT de Globalita no tiene por que ver los proyectos de SENG, ni al
// reves. Asi que al permiso `control` se le suma un ALCANCE.
//
// No se resolvio con dos claves de permiso (`controlIa`, `controlInversiones`)
// porque los permisos son si/no y esto es un alcance: con una tercera linea
// habria que tocar el codigo en vez de cargar un dato.

migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('users');
    users.fields.add(
      new Field({
        name: 'linea_control',
        type: 'select',
        maxSelect: 1,
        values: ['ia', 'inversiones'],
      }),
    );
    app.save(users);

    // La linea de la cuenta se cargo en 1788600400, pero las cuentas creadas
    // DESPUES —por el seed y por el importador del Calendar— quedaron sin ella,
    // y sin linea un proyecto no lo ve ningun observador limitado.
    //
    // Alberto es inversiones; el resto, IA. Es la regla que dio Augusto y la
    // unica cuenta de inversiones que existe hoy.
    for (const c of app.findAllRecords('cuenta')) {
      if (c.get('linea_negocio')) continue;
      const nombre = String(c.get('nombre_perfil') || '');
      const abrev = String(c.get('abrev') || '');
      const esAlberto = /alberto/i.test(nombre) || abrev === 'AL';
      c.set('linea_negocio', esAlberto ? 'inversiones' : 'ia');
      app.save(c);
    }
  },

  (app) => {
    const users = app.findCollectionByNameOrId('users');
    users.fields.removeByName('linea_control');
    app.save(users);
  },
);
