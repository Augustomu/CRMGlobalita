/// <reference path="../../../.pb/pb_data/types.d.ts" />

// Actividad de demo.
//
// La coleccion existia desde 1788600600 y nunca se habia sembrado, asi que la
// pestaña salia vacia y no se podia juzgar ni el orden, ni el filtro por
// persona, ni si las columnas alcanzan para leer la fila de un vistazo.
//
// Estan repartidas entre hoy y hace once dias a proposito: la pestaña tiene
// que distinguir "hoy 09:12" de "03/09 17:20" sin que uno tenga que pensar.

migrate(
  (app) => {
    const ahora = new Date();
    const HOY = ahora.getFullYear() + '-' + String(ahora.getMonth() + 1).padStart(2, '0') + '-' + String(ahora.getDate()).padStart(2, '0');
    const DIA = 86400000;
    const en = (dias, hora) =>
      new Date(Date.parse(HOY) + dias * DIA).toISOString().slice(0, 10) + ' ' + hora + ':00.000Z';

    const usuarios = {};
    for (const u of app.findAllRecords('users')) usuarios[String(u.get('rol'))] = u.id;
    const admin = usuarios['administrador'];
    const colab = usuarios['colaborador'] || admin;
    if (!admin) return;

    // Un lead real, para que la columna "sobre" no diga siempre "—".
    let lead = '';
    let lead2 = '';
    for (const l of app.findAllRecords('lead')) {
      if (String(l.get('lista')) === 'Relleno de demo') continue;
      if (!lead) { lead = l.id; continue; }
      if (!lead2) { lead2 = l.id; break; }
    }

    // usuario, tipo, accion, lead, canal, dias, hora
    const FILAS = [
      [admin, 'sesion', 'Inicio sesion', '', '', 0, '09:12'],
      [admin, 'permiso', 'Asigno 2 leads a Sofia Ferrer', '', '', 0, '09:20'],
      [colab, 'sesion', 'Inicio sesion', '', '', 0, '08:40'],
      [colab, 'envio', 'Respondio un mensaje entrante', lead, 'whatsapp', 0, '08:52'],
      [colab, 'edicion', 'Edito Telefono y Empresa', lead, '', 0, '09:05'],
      [colab, 'reunion', 'Agendo reunion en el calendario del admin', lead2, '', 0, '09:31'],
      [admin, 'permiso', 'Invito a Bruno Etchart como Colaborador', '', '', -5, '17:20'],
      [admin, 'envio', 'Envio R3 desde la cuenta DL', lead, 'linkedin', -5, '16:02'],
      [colab, 'reunion', 'Marco la reunion como asistio', lead2, '', -6, '11:45'],
      [admin, 'permiso', 'Suspendio a Vera Molina', '', '', -11, '11:05'],
      [colab, 'sesion', 'Ultimo ingreso antes de la suspension', '', '', -11, '10:14'],
    ];

    for (const [usuario, tipo, accion, l, canal, dias, hora] of FILAS) {
      const r = new Record(app.findCollectionByNameOrId('actividad'));
      r.set('usuario', usuario);
      r.set('tipo', tipo);
      r.set('accion', accion);
      if (l) r.set('lead', l);
      if (canal) r.set('canal', canal);
      app.save(r);

      // `created` es un autodate: PocketBase lo pisa con la hora del servidor
      // en cada save, y `r.set('created', ...)` se ignora sin avisar. Con eso
      // las once filas salian todas con la misma hora y la pantalla no podia
      // mostrar la diferencia entre "hoy 09:12" y "03/09 17:20", que es
      // justamente lo que hay que poder juzgar.
      //
      // La unica forma de fecharlas hacia atras es por SQL. Es una excepcion
      // de los datos de demo: en produccion nadie reescribe un `created`.
      app
        .db()
        .newQuery('UPDATE actividad SET created = {:cuando} WHERE id = {:id}')
        .bind({ cuando: en(dias, hora), id: r.id })
        .execute();
    }
  },

  (app) => {
    for (const a of app.findAllRecords('actividad')) app.delete(a);
  },
);
