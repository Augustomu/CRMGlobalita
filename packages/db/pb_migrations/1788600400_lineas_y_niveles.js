/// <reference path="../../../.pb/pb_data/types.d.ts" />

// Dos cosas que salieron de hablar con Augusto y no estaban en el manual:
//
// 1. LINEA DE NEGOCIO. Las cuentas estan segmentadas por producto:
//    Alberto prospecta para propuestas de inversion; David, Alejandro, Edith y
//    Francisco venden el producto de IA. Vive en la CUENTA y el lead la hereda,
//    asi que no se puede cargar inconsistente.
//
// 2. NIVEL DE ASIGNACION. Un colaborador puede tener un lead asignado en modo
//    lectura (ve el estado) o seguimiento (edita y escribe). Es un eje distinto
//    de los permisos de visibilidad, que dicen QUE CAMPOS ve.
//
// 3. Rol observador y las claves nuevas de permisos (anexo Control).

migrate(
  (app) => {
    // ---------- cuenta.linea_negocio ----------
    const cuenta = app.findCollectionByNameOrId('cuenta');
    cuenta.fields.add(
      new Field({
        name: 'linea_negocio',
        type: 'select',
        maxSelect: 1,
        values: ['ia', 'inversiones'],
      }),
    );
    app.save(cuenta);

    // Las cuentas que ya existen: todas son de IA salvo la de Alberto.
    for (const c of app.findAllRecords('cuenta')) {
      const nombre = String(c.get('nombre_perfil') || '');
      c.set('linea_negocio', /alberto/i.test(nombre) ? 'inversiones' : 'ia');
      app.save(c);
    }

    // ---------- lead.nivel_asignacion ----------
    const lead = app.findCollectionByNameOrId('lead');
    lead.fields.add(
      new Field({
        name: 'nivel_asignacion',
        type: 'select',
        maxSelect: 1,
        values: ['lectura', 'seguimiento'],
      }),
    );
    app.save(lead);

    // Los leads ya asignados pasan a seguimiento: es como funcionaban antes de
    // que existieran los dos modos. Vacio equivaldria a quitarles la edicion.
    for (const l of app.findAllRecords('lead')) {
      if (l.get('asignado')) {
        l.set('nivel_asignacion', 'seguimiento');
        app.save(l);
      }
    }

    // ---------- users.rol: se suma observador ----------
    const users = app.findCollectionByNameOrId('users');
    users.fields.removeByName('rol');
    users.fields.add(
      new Field({
        name: 'rol',
        type: 'select',
        maxSelect: 1,
        values: ['administrador', 'colaborador', 'observador'],
      }),
    );
    app.save(users);
  },

  (app) => {
    const cuenta = app.findCollectionByNameOrId('cuenta');
    cuenta.fields.removeByName('linea_negocio');
    app.save(cuenta);

    const lead = app.findCollectionByNameOrId('lead');
    lead.fields.removeByName('nivel_asignacion');
    app.save(lead);

    const users = app.findCollectionByNameOrId('users');
    users.fields.removeByName('rol');
    users.fields.add(
      new Field({
        name: 'rol',
        type: 'select',
        maxSelect: 1,
        values: ['administrador', 'colaborador'],
      }),
    );
    app.save(users);
  },
);
