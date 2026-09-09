/// <reference path="../pb_data/types.d.ts" />

// «No me acuerdo»: archivar la confirmacion de una reunion vieja (§7.6).
//
// EL PROBLEMA. De las 288 reuniones importadas, 173 estan en `sin_dato`: la
// reunion consta y el resultado no. La vista Lista ofrece ✓ y ✕ para
// confirmarlas, pero de una reunion de hace ocho meses Augusto no se acuerda —y
// tiene razon en no querer inventar—. Sin una tercera opcion, esas 173 filas
// piden para siempre un dato que nadie va a poder dar.
//
// POR QUE UN CAMPO NUEVO Y NO OTRO ESTADO. `sin_dato` ya significa «ocurrio y
// no se registro el resultado», y eso sigue siendo cierto: la reunion no cambia
// porque alguien deje de buscar el dato. Lo que cambia es que YA NO SE PREGUNTA.
// Son dos cosas distintas y meterlas en el mismo campo perderia la primera: un
// estado «archivada» diria que la reunion es otra cosa, cuando lo unico que
// pasa es que dejamos de insistir.
//
// La fecha sigue viendose en la columna «Ultima» y la reunion sigue en el
// historico. Lo unico que desaparece son los dos botones de esa fila.

migrate(
  (app) => {
    const c = app.findCollectionByNameOrId('reunion');
    if (!c.fields.getByName('confirmacion_archivada')) {
      c.fields.add(new Field({ name: 'confirmacion_archivada', type: 'bool' }));
      app.save(c);
    }
  },

  (app) => {
    const c = app.findCollectionByNameOrId('reunion');
    c.fields.removeByName('confirmacion_archivada');
    app.save(c);
  },
);
