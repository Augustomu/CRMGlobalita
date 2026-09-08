/// <reference path="../../../.pb/pb_data/types.d.ts" />

// Los dos partners y los leads que confirmaron interes.
//
// PARA QUE. La vista del partner es la unica pantalla del sistema que se juzga
// entera por lo que NO muestra: si no hay leads etiquetados de las dos casas,
// no se puede ver que el de Globalita no ve los de Seng y al reves, que es lo
// unico que esa pantalla tiene que garantizar.
//
// Se etiquetan leads del relleno de volumen y no los del prototipo, para no
// pisar los casos que ya prueban otras pantallas.

migrate(
  (app) => {
    // ---------- las etiquetas (las crea la migracion 1788601600) ----------
    const idDe = {};
    for (const nombre of ['PIV', 'Parceria', 'Inversion']) {
      try {
        idDe[nombre] = app.findFirstRecordByFilter('etiqueta', 'nombre = {:n}', { n: nombre }).id;
      } catch (_) {}
    }
    if (!idDe['PIV']) return;

    // ---------- los dos usuarios partner ----------
    //
    // El rol es Observador —el tercer rol fijo del manual— y lo que los separa
    // es el ALCANCE: `linea_control`. Sin alcance verian los dos negocios.
    const users = app.findCollectionByNameOrId('users');
    const PARTNERS = [
      ['Alejandro Ruiz', 'alejandro@globalita.test', 'ia'],
      ['Nicolas Serra', 'nicolas@seng.test', 'inversiones'],
    ];
    for (const [name, email, linea] of PARTNERS) {
      let u = null;
      try { u = app.findFirstRecordByFilter('users', 'email = {:e}', { e: email }); } catch (_) {}
      if (!u) {
        u = new Record(users);
        u.set('email', email);
        u.setPassword('demo12345');
        u.set('verified', true);
      }
      u.set('name', name);
      u.set('rol', 'observador');
      u.set('estado', 'activo');
      u.set('linea_control', linea);
      app.save(u);
    }

    const poner = (lead, cual) => {
      const id = idDe[cual];
      if (!id) return;
      const puestas = lead.get('etiquetas') || [];
      if (puestas.indexOf(id) >= 0) return;
      lead.set('etiquetas', puestas.concat([id]));
      app.save(lead);
    };

    // ---------- 1. los leads que YA tienen proyecto ----------
    //
    // Van primero y con la etiqueta que corresponde a la casa del proyecto: un
    // proyecto abierto es la forma mas fuerte de haber confirmado interes, y
    // seria raro que el partner viera el proyecto y no el lead.
    //
    // Ademas es lo que hace que la tarjeta "con proyecto abierto" no de cero.
    const ETIQUETA_DE_CASA = { globalita: 'PIV', seng: 'Inversion' };
    for (const p of app.findAllRecords('proyecto')) {
      const leadId = String(p.get('lead') || '');
      if (!leadId) continue;
      let l = null;
      try { l = app.findRecordById('lead', leadId); } catch (_) { continue; }
      const casa = String(p.get('casa') || 'globalita');
      // La parceria se marca como tal; el resto sigue el tipo por defecto.
      poner(l, String(p.get('tipo')) === 'parceria' ? 'Parceria' : ETIQUETA_DE_CASA[casa] || 'PIV');
    }

    // ---------- 2. los leads con reunion ----------
    //
    // Para que la tarjeta "con reunion" tampoco de cero. Se alternan las dos
    // casas: sin al menos uno de cada lado no se puede ver que el partner de
    // Globalita NO ve los de Seng, que es lo unico que esta vista garantiza.
    let n = 0;
    const yaVistos = {};
    for (const r of app.findAllRecords('reunion')) {
      const leadId = String(r.get('lead') || '');
      if (!leadId || yaVistos[leadId]) continue;
      yaVistos[leadId] = true;
      let l = null;
      try { l = app.findRecordById('lead', leadId); } catch (_) { continue; }
      n++;
      poner(l, n % 3 === 0 ? 'Inversion' : n % 3 === 1 ? 'PIV' : 'Parceria');
    }

    // ---------- 3. relleno, para que las listas tengan volumen ----------
    //
    // Uno de cada cinco. 2 de cada 3 son de Globalita: es la proporcion del
    // negocio, y hace que la vista de Seng no parezca vacia por error.
    let i = 0;
    for (const l of app.findAllRecords('lead')) {
      if (String(l.get('lista')) !== 'Relleno de demo') continue;
      i++;
      if (i % 5 !== 0) continue;
      poner(l, i % 15 === 0 ? 'Inversion' : i % 10 === 0 ? 'Parceria' : 'PIV');
    }

    // La fecha de uso, para que el panel de etiquetas las ordene bien.
    const ahora = new Date();
    const HOY = ahora.getFullYear() + '-' + String(ahora.getMonth() + 1).padStart(2, '0') + '-' + String(ahora.getDate()).padStart(2, '0');
    for (const nombre of ['PIV', 'Parceria', 'Inversion']) {
      if (!idDe[nombre]) continue;
      const e = app.findRecordById('etiqueta', idDe[nombre]);
      e.set('usada_en', HOY);
      app.save(e);
    }
  },

  (app) => {
    for (const email of ['alejandro@globalita.test', 'nicolas@seng.test']) {
      try { app.delete(app.findFirstRecordByFilter('users', 'email = {:e}', { e: email })); } catch (_) {}
    }
  },
);
