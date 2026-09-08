/// <reference path="../../../.pb/pb_data/types.d.ts" />

// Las tres etiquetas que marcan interes confirmado, y su proteccion.
//
// POR QUE UNA ETIQUETA Y NO UN ESTADO DEL PROYECTO.
//
// Un partner ve en Control los leads que confirmaron interes. Confirmar es un
// acto liviano —sale de una llamada— y abrir un proyecto es un tramite que
// puede pasar una semana despues. El partner tiene que verlo el dia que pasa,
// no el dia que alguien completa el formulario.
//
// Las etiquetas calzan una a una con los tipos de proyecto (§3.13.1): no son un
// vocabulario nuevo, son el mismo dicho antes.
//
//   PIV, Parceria  -> Globalita
//   Inversion      -> Seng
//
// POR QUE `protegida` Y NO `del_sistema`.
//
// `del_sistema` significa dos cosas a la vez en este modelo: "la pone la
// cadencia sola" y "no se toca". Para estas hace falta solo la segunda: las
// aplica una persona a mano, como cualquier otra etiqueta, pero no se pueden
// renombrar ni borrar.
//
// La razon es concreta: el catalogo es libre (D04), asi que renombrar «PIV» a
// «Piv» vaciaria la vista de un partner y nadie se enteraria hasta que
// preguntara por que no ve nada.

migrate(
  (app) => {
    const etiqueta = app.findCollectionByNameOrId('etiqueta');
    etiqueta.fields.add(new Field({ name: 'protegida', type: 'bool' }));
    app.save(etiqueta);

    // Se crean si no existen, y se protegen si ya estaban. `Parceria` puede
    // haber entrado antes como etiqueta comun.
    for (const nombre of ['PIV', 'Parceria', 'Inversion']) {
      let r = null;
      try {
        r = app.findFirstRecordByFilter('etiqueta', 'nombre = {:n}', { n: nombre });
      } catch (_) {}
      if (!r) {
        r = new Record(etiqueta);
        r.set('nombre', nombre);
        r.set('del_sistema', false);
      }
      r.set('protegida', true);
      app.save(r);
    }
  },

  (app) => {
    for (const nombre of ['PIV', 'Parceria', 'Inversion']) {
      try {
        const r = app.findFirstRecordByFilter('etiqueta', 'nombre = {:n}', { n: nombre });
        // Solo se borran las que no quedaron aplicadas a ningun lead: si
        // alguien ya las uso, borrarlas se llevaria puesto ese dato.
        let enUso = false;
        for (const l of app.findAllRecords('lead')) {
          if ((l.get('etiquetas') || []).indexOf(r.id) >= 0) { enUso = true; break; }
        }
        if (!enUso) app.delete(r);
      } catch (_) {}
    }
    const etiqueta = app.findCollectionByNameOrId('etiqueta');
    etiqueta.fields.removeByName('protegida');
    app.save(etiqueta);
  },
);
