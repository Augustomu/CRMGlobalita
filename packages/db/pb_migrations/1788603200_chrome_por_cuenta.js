/// <reference path="../pb_data/types.d.ts" />

// Con que perfil de Chrome se abre cada cuenta (§7.2, §7.6).
//
// EL PROBLEMA. Augusto tiene una ventana de Chrome por cuenta de prospeccion,
// cada una con su sesion de LinkedIn abierta. Al tocar el link de un lead, el
// navegador lo abre con el perfil que este activo — normalmente el personal —
// asi que hay que copiar la URL y pegarla en la ventana correcta. Peor: si uno
// no se da cuenta, ve el perfil desde la cuenta equivocada, y en LinkedIn eso
// deja rastro.
//
// POR QUE ES UN CAMPO Y NO UNA TABLA EN EL CODIGO. Los perfiles de Chrome son
// carpetas («Default», «Profile 1»…) que dependen de la maquina: los de Augusto
// no son los de nadie mas. Escribirlos en el codigo obligaria a un commit cada
// vez que alguien suma una cuenta o reinstala Chrome.
//
// La semilla sale de la maquina de Augusto, leida de Chrome el 09/09/2026 y
// confirmada por el:
//
//   Profile 1 Alejandro · Profile 2 Francisco · Profile 3 Edith
//   Profile 4 Bruno     · Profile 7 David Luna
//   Default   Augusto (AU, AMU y la vista Lista)
//
// Queda vacio para cualquier cuenta que no este en esa lista: sin perfil, el
// link se abre como se abria antes. Es mejor que abrirlo con el perfil de otro.

migrate(
  (app) => {
    const c = app.findCollectionByNameOrId('cuenta');
    if (!c.fields.getByName('chrome_perfil')) {
      c.fields.add(new Field({ name: 'chrome_perfil', type: 'text', max: 40 }));
      app.save(c);
    }

    const porAbrev = {
      AL: 'Profile 1',
      FR: 'Profile 2',
      ED: 'Profile 3',
      BR: 'Profile 4',
      DL: 'Profile 7',
      AU: 'Default',
      AMU: 'Default',
    };

    for (const cuenta of app.findAllRecords('cuenta')) {
      const perfil = porAbrev[String(cuenta.get('abrev'))];
      // No se pisa lo que ya este cargado: si alguien lo configuro a mano, su
      // valor manda sobre esta semilla.
      if (perfil && !String(cuenta.get('chrome_perfil') || '')) {
        cuenta.set('chrome_perfil', perfil);
        app.save(cuenta);
      }
    }

    // El perfil de la vista Lista de la agenda: ahi se abre siempre el mismo,
    // sin importar de que cuenta venga el lead. Augusto: el personal.
    let fila;
    try {
      fila = app.findFirstRecordByFilter('configuracion', 'clave = "navegador"');
    } catch (_) {
      fila = new Record(app.findCollectionByNameOrId('configuracion'));
      fila.set('clave', 'navegador');
    }
    fila.set('descripcion', 'Con que perfil de Chrome se abren los links. Lo usa /api/abrir.');
    fila.set('valor', JSON.stringify({ lista: 'Default' }));
    app.save(fila);
  },

  (app) => {
    const c = app.findCollectionByNameOrId('cuenta');
    c.fields.removeByName('chrome_perfil');
    app.save(c);
    try {
      app.delete(app.findFirstRecordByFilter('configuracion', 'clave = "navegador"'));
    } catch (_) {
      // No estaba: nada que hacer.
    }
  },
);
