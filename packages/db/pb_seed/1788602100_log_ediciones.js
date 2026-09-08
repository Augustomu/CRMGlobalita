/// <reference path="../pb_data/types.d.ts" />

// El log de ediciones de los seis leads del prototipo (§7.2, cambio 14).
//
// Los cambios salen tal cual del array `log` de cada contacto en
// `Dashboard.dc.html`. Sin esto el bloque de la ficha decia siempre "sin
// ediciones registradas en este perfil" y no habia forma de ver si funcionaba
// —ni el formato de las filas, ni el boton de revertir, ni el tope de alto.
//
// `created` es un campo autodate: PocketBase lo pisa al guardar y `r.set()` no
// lo cambia. La fecha real se escribe despues, con SQL crudo. Sin eso las once
// entradas quedan todas con la hora del seed y el log no muestra ningun orden.

migrate(
  (app) => {
    // clave del perfil (prefijo del nombre sin tildes), fecha, campo, antes, despues
    const LOG = [
      ['Alexandre', '2026-08-12 10:12:00', 'Ciudad', '', 'Rio de Janeiro'],
      ['Alexandre', '2026-08-13 09:10:00', 'Resumen del perfil', 'Respondió, pedir escrito', 'Resumen extendido (366 caracteres)'],
      ['Alexandre', '2026-08-21 16:05:00', 'Teléfono', '', '55 31 9238-8716'],
      ['Alexandre', '2026-08-28 11:20:00', 'Etiquetas', 'Frío', 'Tibio, Compras SP'],

      ['Wellington', '2026-08-21 14:15:00', 'Email', '', 'wellingtonsimoes@opuscm.com.br'],
      ['Wellington', '2026-08-26 10:00:00', 'Etiquetas', 'Tibio', 'Caliente'],
      ['Wellington', '2026-09-02 12:06:00', 'Fecha de reunión', '', '17/09/2026 15:00'],

      ['Herik', '2026-07-04 08:48:00', 'Etiquetas', '', 'Periodico'],
      ['Maria', '2026-09-01 08:20:00', 'Etiquetas', 'Frío', 'Caliente, Decisor, MX Norte'],
      ['Gonzalo', '2026-09-02 11:52:00', 'Estado de reunión', 'pendiente', 'asistió'],
      ['Lucia', '2026-08-26 11:05:00', 'Estado de reunión', 'pendiente', 'no asistió'],
    ];

    // Los perfiles se buscan sin tildes: el seed de demo los escribe sin
    // acentos y `control_demo` se los pone despues, asi que el nombre en base
    // depende de cual corrio ultimo.
    const ACENTOS = 'áàäâãÁÀÄÂÃéèëêÉÈËÊíìïîÍÌÏÎóòöôõÓÒÖÔÕúùüûÚÙÜÛñÑçÇ';
    const LLANOS = 'aaaaaAAAAAeeeeEEEEiiiiIIIIoooooOOOOOuuuuUUUUnNcC';
    const plano = (s) => {
      let r = '';
      for (const c of String(s || '')) {
        const i = ACENTOS.indexOf(c);
        r += i >= 0 ? LLANOS[i] : c;
      }
      return r;
    };

    const perfiles = app.findAllRecords('perfil');
    const buscar = (clave) => {
      for (const p of perfiles) if (plano(p.get('nombre')).indexOf(clave) === 0) return p;
      return null;
    };

    // Quien edito. Alberto es el administrador de la demo.
    let quien = '';
    for (const u of app.findAllRecords('users')) {
      if (String(u.get('email')) === 'alberto@globalita.test') quien = u.id;
    }

    for (const [clave, cuando, campo, antes, despues] of LOG) {
      const perfil = buscar(clave);
      if (!perfil) continue;

      // El lead desde el que se edito: el primero de ese perfil.
      let lead = null;
      try {
        lead = app.findFirstRecordByFilter('lead', 'perfil = {:p}', { p: perfil.id });
      } catch (e) {
        lead = null;
      }

      const r = new Record(app.findCollectionByNameOrId('edicion'));
      r.set('perfil', perfil.id);
      if (lead) r.set('lead', lead.id);
      if (quien) r.set('usuario', quien);
      r.set('campo', campo);
      r.set('antes', antes);
      r.set('despues', despues);
      app.save(r);

      app
        .db()
        .newQuery('UPDATE edicion SET created = {:cuando} WHERE id = {:id}')
        .bind({ cuando: cuando + '.000Z', id: r.id })
        .execute();
    }
  },

  (app) => {
    for (const r of app.findAllRecords('edicion')) app.delete(r);
  },
);
