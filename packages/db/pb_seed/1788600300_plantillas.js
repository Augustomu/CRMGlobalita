/// <reference path="../../../.pb/pb_data/types.d.ts" />

// Las 10 plantillas del repositorio (seccion 12 del manual): R0-R8 mas el
// agradecimiento post reunion, en espanol y algunas en portugues.
//
// Variables disponibles (SS3.5): {nombre} {empresa} {industria} {ciudad} {tema}
// Un campo vacio cae al generico del idioma (su planta / sua planta).

migrate(
  (app) => {
    const plantillas = [
      {
        paso: 'R0',
        nombre: 'R0 · Invitación con nota',
        textos: {
          es: 'Hola {nombre}, trabajo con plantas de {industria} en {ciudad}. Me gustaría conectar.',
          pt: 'Olá {nombre}, trabalho com plantas de {industria} em {ciudad}. Gostaria de conectar.',
        },
      },
      {
        paso: 'R0-recontacto',
        nombre: 'R0 · Reinvitación',
        textos: {
          es: 'Hola {nombre}, vuelvo a escribirte por si ahora es mejor momento para {empresa}.',
          pt: 'Olá {nombre}, escrevo de novo caso agora seja um momento melhor para {empresa}.',
        },
      },
      {
        paso: 'R1',
        nombre: 'R1 · Primer contacto',
        textos: {
          es: 'Gracias por conectar, {nombre}. Trabajamos con {industria} resolviendo paradas no programadas. ¿Cómo manejan {tema} en {empresa}?',
          pt: 'Obrigado por conectar, {nombre}. Trabalhamos com {industria} resolvendo paradas não programadas. Como tratam {tema} na {empresa}?',
        },
      },
      {
        paso: 'R2',
        nombre: 'R2 · Seguimiento corto',
        textos: {
          es: '{nombre}, ¿tuviste oportunidad de ver el mensaje anterior? Si el tema no es prioridad ahora, avisame y lo dejo.',
          pt: '{nombre}, teve oportunidade de ver a mensagem anterior? Se não for prioridade agora, me avise que deixo.',
        },
      },
      {
        paso: 'R3',
        nombre: 'R3 · Caso concreto',
        textos: {
          es: 'Te dejo un caso de una planta de {industria} parecida a {empresa}: redujeron las paradas no programadas un 30% en seis meses. ¿Te sirve que te lo pase?',
          pt: 'Deixo um caso de uma planta de {industria} parecida com {empresa}: reduziram as paradas não programadas em 30% em seis meses. Quer que eu envie?',
        },
      },
      {
        paso: 'R4',
        nombre: 'R4 · Pedir el decisor',
        textos: {
          es: '{nombre}, entiendo que no sea tu área. ¿Quién lleva {tema} en {empresa}? Con eso te dejo de molestar.',
          pt: '{nombre}, entendo que não seja sua área. Quem cuida de {tema} na {empresa}? Assim paro de incomodar.',
        },
      },
      {
        paso: 'R5',
        nombre: 'R5 · Reapertura fase 2',
        textos: {
          es: 'Hola {nombre}, pasaron unos meses. ¿Cambió algo con {tema} en {empresa}?',
          pt: 'Olá {nombre}, passaram alguns meses. Mudou algo com {tema} na {empresa}?',
        },
      },
      {
        paso: 'R6',
        nombre: 'R6 · Seguimiento fase 2',
        textos: {
          es: '{nombre}, insisto una vez más por si ahora es mejor momento.',
          pt: '{nombre}, insisto mais uma vez caso agora seja um momento melhor.',
        },
      },
      {
        paso: 'R7',
        nombre: 'R7 · Caso concreto fase 2',
        textos: {
          es: 'Este mes trabajamos con otra planta de {industria}. Te paso el caso por si ahora aplica a {empresa}.',
        },
      },
      {
        paso: 'R8',
        nombre: 'R8 · Último intento',
        textos: {
          es: '{nombre}, es mi último mensaje. Si en algún momento {tema} se vuelve prioridad en {empresa}, quedo a mano.',
          pt: '{nombre}, é minha última mensagem. Se em algum momento {tema} virar prioridade na {empresa}, fico à disposição.',
        },
      },
      {
        paso: 'agradecimiento',
        nombre: 'Agradecimiento post reunión',
        textos: {
          es: 'Gracias por el tiempo, {nombre}. Te dejo por acá lo que hablamos.',
          pt: 'Obrigado pelo tempo, {nombre}. Deixo por aqui o que conversamos.',
        },
      },
    ];

    // Los destacados salen del prototipo (Dashboard.dc.html, DESTACADOS): sin
    // ninguno, la fila de chips de la ficha y el filtro "Favoritos" del
    // repositorio se ven vacios y no hay como saber si funcionan.
    //
    // Los tres alcances tienen que estar representados: todas las cuentas, una
    // sola, y una lista.
    const DESTACADOS = {
      R0: 'todas las cuentas',
      R1: 'todas las cuentas',
      R2: 'DL',
      R4: 'AL, DL',
    };

    plantillas.forEach((p, i) => {
      const r = new Record(app.findCollectionByNameOrId('plantilla'));
      r.set('nombre', p.nombre);
      r.set('paso', p.paso);
      r.set('por_defecto', true); // una sola por paso en la semilla
      r.set('textos', p.textos);
      r.set('destacado', DESTACADOS[p.paso] || '');
      r.set('orden', i + 1);
      app.save(r);
    });

    // Una segunda variante de R3, para que se vea el caso de D16: varias
    // plantillas para el mismo paso, con una sola marcada por defecto.
    const variante = new Record(app.findCollectionByNameOrId('plantilla'));
    variante.set('nombre', 'R3 · Caso concreto (versión corta)');
    variante.set('paso', 'R3');
    variante.set('por_defecto', false);
    variante.set('textos', {
      es: '{nombre}, ¿te sirve un caso de {industria} con números concretos?',
      pt: '{nombre}, te serve um caso de {industria} com números concretos?',
    });
    variante.set('destacado', '');
    variante.set('orden', 99);
    app.save(variante);
  },

  (app) => {
    for (const r of app.findAllRecords('plantilla')) app.delete(r);
  },
);
