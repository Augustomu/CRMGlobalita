/// <reference path="../pb_data/types.d.ts" />

// De donde saca los perfiles una lista de invitacion (§3.4, §8.1).
//
// POR QUE HACE FALTA. Augusto paso el 10/09 el documento con las 22 busquedas
// guardadas de Sales Navigator de las seis cuentas, cada una con su
// `savedSearchId`. Al cargarlas aparecio que `lista_invitacion` guardaba
// `cuenta, nombre, fuente, orden, pagina, paginas, por_pagina` — y nada mas.
//
// O sea: la lista sabia como se llama, de quien es y por donde iba, pero NO
// sabia donde esta. El worker de invitaciones no tiene a que URL navegar, y el
// dato que lo dice —el savedSearchId— no tenia ningun campo donde entrar.
//
// ES LA FAMILIA 11 DEL REGISTRO —«no habia donde guardarlo»— y esta vez
// aparecio en el momento correcto: al cargar los datos reales, antes de
// escribir el script que los iba a usar. El manual tampoco lo tenia: §3.4
// listaba los mismos siete campos, asi que no era un olvido del esquema sino
// un hueco de la especificacion. Se corrige en los dos lados en el mismo
// commit, que es la regla del final de CLAUDE.md.
//
// POR QUE `origen_id` Y NO `url`. Se guarda el identificador, no la direccion
// entera. Las URLs que copia uno del navegador vienen con `lipi` y `snfl`
// pegados atras —parametros de tracking de la sesion que los genero— que
// cambian cada vez y no identifican nada. Guardar eso es guardar basura que
// ademas envejece: la de ayer apunta a una sesion que ya no existe. Con el id
// la URL se arma sola y siempre limpia.
//
// Y SIRVE PARA LAS DOS FUENTES. Una lista puede venir de Sales Navigator o de
// un CSV importado (§3.4). Para la primera `origen_id` es el savedSearchId;
// para la segunda, el nombre del archivo que se importo. Un campo llamado
// `saved_search_id` habria dejado a los CSV sin donde anotar de donde salieron
// —el mismo hueco, un escalon mas abajo.
//
// NO ES UNICO A PROPOSITO. Dos cuentas distintas trabajan la misma busqueda:
// «Gerente, MC JL QR GJ PB 201/500» aparece en Alejandro, en Edith y en
// Francisco, cada una con su propio id. Y aunque compartieran uno, siguen
// siendo dos listas: cada cuenta lleva su propia pagina.

migrate(
  (app) => {
    const c = app.findCollectionByNameOrId('lista_invitacion');
    if (!c.fields.getByName('origen_id')) {
      c.fields.add(
        new Field({
          name: 'origen_id',
          type: 'text',
          max: 200,
          required: false,
        }),
      );
    }
    app.save(c);
  },

  (app) => {
    const c = app.findCollectionByNameOrId('lista_invitacion');
    c.fields.removeByName('origen_id');
    app.save(c);
  },
);
