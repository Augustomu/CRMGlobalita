/// <reference path="../../../.pb/pb_data/types.d.ts" />

// Las listas de invitación del prototipo, tal cual.
//
// Están copiadas de Automatizaciones.dc.html sin redondear ni "mejorar" los
// números, porque cada uno muestra un caso distinto del panel:
//
//   AL/Automotriz BR (40/40)   -> agotada: el chip ambar y 0 perfiles.
//   FR/Automotriz MG (31/31)   -> agotada siendo la de prioridad 1: la cuenta
//                                 pasa sola a la segunda lista.
//   ED con tres listas         -> la unica con mas de dos, para ver el orden.
//   AMU                        -> sesion caida: sale en cero y marcada.
//
// Con listas todas a medias no se ve ni el paso a la siguiente ni el chip de
// agotada, que son las dos reglas de la pantalla.

migrate(
  (app) => {
    const porAbrev = {};
    for (const c of app.findAllRecords('cuenta')) porAbrev[String(c.get('abrev'))] = c;

    // cuenta, nombre, fuente, pagina, paginas, por_pagina
    const LISTAS = [
      ['AL', 'Gerentes SP', 'sales_navigator', 12, 40, 25],
      ['AL', 'Automotriz BR', 'sales_navigator', 40, 40, 25],

      ['DL', 'Automotriz BR', 'sales_navigator', 28, 60, 25],
      ['DL', 'Logistica SP', 'csv', 3, 18, 25],

      ['FR', 'Automotriz MG', 'sales_navigator', 31, 31, 25],
      ['FR', 'Metalurgica RJ', 'sales_navigator', 7, 44, 25],

      ['ED', 'Maquinaria MX Norte', 'sales_navigator', 19, 52, 25],
      ['ED', 'Alimentos MX', 'sales_navigator', 6, 34, 25],
      ['ED', 'Compras Monterrey', 'csv', 11, 11, 25],

      ['AU', 'Consultoria LATAM', 'sales_navigator', 9, 26, 25],
      ['AU', 'Servicios AR', 'sales_navigator', 2, 29, 25],

      ['AMU', 'Consultoria UY', 'sales_navigator', 14, 22, 25],
      ['AMU', 'Agro UY', 'csv', 4, 16, 25],
    ];

    const orden = {};
    for (const [abrev, nombre, fuente, pagina, paginas, porPagina] of LISTAS) {
      const cuenta = porAbrev[abrev];
      if (!cuenta) continue;
      orden[abrev] = (orden[abrev] || 0) + 1;
      const r = new Record(app.findCollectionByNameOrId('lista_invitacion'));
      r.set('cuenta', cuenta.id);
      r.set('nombre', nombre);
      r.set('fuente', fuente);
      r.set('orden', orden[abrev]);
      r.set('pagina', pagina);
      r.set('paginas', paginas);
      r.set('por_pagina', porPagina);
      app.save(r);
    }

    /*
     * ACA LA SEMILLA PONIA `estado_sesion = caida` en AMU, para que la pantalla
     * de Invitaciones mostrara el caso de la cuenta frenada.
     *
     * Esa columna se fue el 11/09 (migracion 1788750000) y esto era justo el
     * motivo: una sesion «caida» escrita a mano que nada volvia a tocar. El
     * estado ahora se deduce de `ultima_senal_li`, asi que para que AMU aparezca
     * frenada alcanza con NO escribirle senal — que es lo que pasa sola.
     */
  },

  (app) => {
    for (const l of app.findAllRecords('lista_invitacion')) app.delete(l);
  },
);
