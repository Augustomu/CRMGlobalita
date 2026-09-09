/// <reference path="../pb_data/types.d.ts" />

// Los hilos de conversacion de los seis leads del prototipo (§3.2, §7.2).
//
// Salen tal cual de `mensajesLi` y `mensajesWa` de cada contacto en
// `Dashboard.dc.html`. Son los mismos salientes de los que salen los envios del
// seed de demo: ahi se guarda QUE PASO se mando y cuando, aca el texto y el
// lado. Las dos cosas son distintas —un envio es un paso de la cadencia, un
// mensaje es una linea del chat— y el manual las tiene separadas por eso.
//
// Sin esto, el panel de Conversaciones de la ficha decia "el hilo todavia no se
// guarda en el CRM" para todos los leads y no habia forma de ver si el diseño
// de las burbujas, los separadores de dia o los acks funcionaban.
//
// El año es 2026 en todos: el prototipo escribe las horas como "21/08 09:30".

migrate(
  (app) => {
    // clave del perfil, canal, quien, dd/mm HH:MM, ack, texto
    const HILOS = [
      // -------------------------------------------------------------- Alexandre
      ['Alexandre', 'linkedin', 'out', '12/08 10:14', '', 'Alexandre, buenas tardes. Trabajo con plantas del sector automotriz en Brasil y me interesaba tu experiencia en Rio. Tenes 15 minutos esta semana?'],
      ['Alexandre', 'linkedin', 'in', '12/08 18:40', '', 'Buenas. Puede ser, aunque la decision de compras la maneja Sao Paulo. Me pasas algo por escrito primero?'],
      ['Alexandre', 'linkedin', 'out', '13/08 09:02', '', 'Te mando un resumen de una carilla y despues coordinamos. Te sirve el jueves?'],
      ['Alexandre', 'whatsapp', 'out', '18/08 10:20', 'entregado', 'Alexandre, buenas. Te escribo por aca por el resumen que quedamos. Lo pudiste ver?'],
      ['Alexandre', 'whatsapp', 'out', '28/08 11:15', 'enviado', 'Cuando tengas el contacto de compras de Sao Paulo, pasamelo y le escribo directo.'],

      // ------------------------------------------------------------- Wellington
      ['Wellington', 'linkedin', 'out', '21/08 09:30', '', 'Wellington, gracias por aceptar. Estas viendo mejoras de proceso en la planta de Guarulhos este año?'],
      ['Wellington', 'linkedin', 'in', '21/08 14:12', '', 'Si, estamos evaluando. Mandame la propuesta y la veo con el director.'],
      ['Wellington', 'whatsapp', 'out', '02/09 11:40', 'leido', 'Wellington, te escribo por aca para coordinar la reunion. El 17/09 a las 15 te sirve?'],
      ['Wellington', 'whatsapp', 'in', '02/09 12:05', '', 'Perfecto, agendado.'],

      // ------------------------------------------------------------------ Herik
      // Uno solo, y saliente: acepto la invitacion y nunca contesto.
      ['Herik', 'linkedin', 'out', '04/07 08:50', '', 'Herik, buenas. Seguis en el rubro automotriz en Belo Horizonte?'],

      // ------------------------------------------------------------------ Maria
      // Escribio ella primero, a los diez minutos de aceptar.
      ['Maria', 'linkedin', 'out', '25/08 16:32', '', 'Maria, buenos dias. Trabajo con plantas de maquinaria industrial en el norte de Mexico y queria entender como estan resolviendo la cadena de suministro este año.'],
      ['Maria', 'linkedin', 'in', '01/09 08:15', '', 'Buenos dias, recibi su invitacion. Cuenteme brevemente de que se trata.'],
      ['Maria', 'linkedin', 'out', '01/09 09:40', '', 'Claro. Trabajamos sobre tiempos de reposicion y quiebres de stock en planta. En un grupo parecido al suyo bajamos 18% el tiempo de cambio de formato.'],
      ['Maria', 'linkedin', 'in', '02/09 11:05', '', 'Interesante. Tienen algo escrito? Lo veo con el area de compras antes de agendar nada.'],
      ['Maria', 'linkedin', 'out', '02/09 11:20', '', 'Le mando un resumen de una carilla hoy mismo. Le sirve que despues coordinemos 20 minutos?'],

      // ---------------------------------------------------------------- Gonzalo
      // Referido: el hilo ARRANCA con un entrante. Es el caso que hace que la
      // ficha diga "escribio primero" en vez de una demora.
      ['Gonzalo', 'whatsapp', 'in', '28/08 19:20', '', 'Buenas, me pasaron tu contacto. Podemos hablar el miercoles?'],
      ['Gonzalo', 'whatsapp', 'out', '28/08 19:35', 'entregado', 'Si, el 02/09 a las 11 me queda bien. Te mando el link.'],
      ['Gonzalo', 'whatsapp', 'in', '04/09 19:48', '', 'Che, lo del presupuesto lo veo el lunes con el gerente. Me pasas el detalle de los plazos?'],

      // ------------------------------------------------------------------ Lucia
      ['Lucia', 'linkedin', 'out', '10/08 10:00', '', 'Lucia, gracias por aceptar. Estan trabajando con plantas del interior este año?'],
      ['Lucia', 'linkedin', 'out', '19/08 10:00', '', 'Lucia, te retomo el mensaje anterior. Te sirve que te mande un resumen antes de coordinar?'],
      ['Lucia', 'linkedin', 'in', '27/08 09:10', '', 'Perdon, se me cruzo una urgencia. Reagendamos?'],
    ];

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
    const leadDe = (clave) => {
      for (const p of perfiles) {
        if (plano(p.get('nombre')).indexOf(clave) !== 0) continue;
        try {
          return app.findFirstRecordByFilter('lead', 'perfil = {:p}', { p: p.id }).id;
        } catch (e) {
          return null;
        }
      }
      return null;
    };

    // "12/08 10:14" -> "2026-08-12 10:14:00.000Z"
    const cuando = (txt) => {
      const [dm, hm] = String(txt).split(' ');
      const [d, m] = dm.split('/');
      return `2026-${m}-${d} ${hm}:00.000Z`;
    };

    for (const [clave, canal, quien, hora, ack, texto] of HILOS) {
      const lead = leadDe(clave);
      if (!lead) continue;
      const r = new Record(app.findCollectionByNameOrId('mensaje'));
      r.set('lead', lead);
      r.set('canal', canal);
      r.set('quien', quien);
      r.set('texto', texto);
      r.set('enviado_en', cuando(hora));
      if (ack) r.set('ack', ack);
      app.save(r);
    }

    // ------------------------------------------------------------------------
    // Un "sin leer" sin ningun mensaje es un dato imposible.
    //
    // Los flags `sin_leer_li` y `sin_leer_wa` los pone el relleno de demo sobre
    // leads que no tienen hilo sembrado: quedaban 15 de 18 asi. En pantalla eso
    // se ve como una notificacion que al abrirla dice "sin mensajes", que no es
    // un estado que pueda existir — si hay algo sin abrir, hay un entrante.
    //
    // Se siembra ese entrante. El texto es generico a proposito: lo que importa
    // del caso es que el hilo exista y termine del lado del lead.
    const DIA = 86400000;
    const HOY = new Date().toISOString().slice(0, 10);
    const diaAtras = (n) => new Date(Date.parse(HOY) - n * DIA).toISOString().slice(0, 10);

    const ENTRANTES = [
      'Buenas, recien veo tu mensaje. Contame un poco mas.',
      'Hola, gracias por escribir. De que se trata exactamente?',
      'Buen dia. Estoy con poco tiempo esta semana, pero me interesa.',
      'Recibido. Lo veo con el equipo y te confirmo.',
      'Hola! Si, estamos evaluando algo asi. Mandame informacion.',
    ];

    const conHilo = {};
    for (const m of app.findAllRecords('mensaje')) {
      conHilo[String(m.get('lead')) + '-' + String(m.get('canal'))] = true;
    }

    let i = 0;
    for (const l of app.findAllRecords('lead')) {
      const canales = [];
      if (l.get('sin_leer_li')) canales.push('linkedin');
      if (l.get('sin_leer_wa')) canales.push('whatsapp');
      for (const canal of canales) {
        if (conHilo[l.id + '-' + canal]) continue;
        const r = new Record(app.findCollectionByNameOrId('mensaje'));
        r.set('lead', l.id);
        r.set('canal', canal);
        r.set('quien', 'in');
        r.set('texto', ENTRANTES[i % ENTRANTES.length]);
        // Escalonados hacia atras para que no compartan el mismo minuto.
        r.set('enviado_en', diaAtras((i % 9) + 1) + ' ' + String(9 + (i % 8)).padStart(2, '0') + ':' + String((i * 7) % 60).padStart(2, '0') + ':00.000Z');
        app.save(r);
        i++;
      }
    }
  },

  (app) => {
    for (const r of app.findAllRecords('mensaje')) app.delete(r);
  },
);
