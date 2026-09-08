/// <reference path="../../../.pb/pb_data/types.d.ts" />

// Los datos de Control.dc.html, cargados de verdad. Solo para desarrollo:
//   node packages/db/dev.mjs --reset --seed
//
// PARA QUE. Para poder mirar el diseno con la pantalla llena. Con seis leads y
// ninguna reunion no se ve si la tabla respira, si las pastillas de estado se
// pisan, si el grafico por mes se entiende. Con once proyectos y treinta
// reuniones, si.
//
// LAS FECHAS SE CORREN. El prototipo esta escrito con HOY = 04/09/2026: la
// reunion "de hoy" es ese dia y los congelados son congelados contra ese dia.
// Si se copiaran tal cual, en un mes todo estaria vencido y `estadoEfectivo`
// congelaria proyectos que en el prototipo estan vivos. Asi que cada fecha se
// mueve los mismos dias que hay entre el 04/09/2026 y hoy: la foto es siempre
// la misma, sin importar cuando se corra.
//
// TRES COSAS SE APARTAN DEL PROTOTIPO, Y ES A PROPOSITO:
//
// 1. Los proyectos que ahi dicen "sin ficha en el CRM" aca SI tienen lead. En
//    el prototipo eso es un texto; en el modelo real `reunion.lead` es
//    obligatorio, y ademas las reuniones se cuelgan del proyecto A TRAVES del
//    lead. Sin lead, esos proyectos dirian "sin reuniones" al lado de cuatro
//    reuniones suyas. Las notas que decian "sin ficha" quedaron reescritas.
// 2. Pinheiro tiene las fechas dos meses mas atras. En el prototipo el estado
//    congelado esta escrito a mano; aca se DEDUCE de los 30 dias sin
//    movimiento, y con las fechas originales el proyecto se veia vivo.
// 3. Se suman dos proyectos de SENG tipo `inversion`. El prototipo es anterior
//    a la separacion por negocio y no tiene ninguno, asi que ese tipo y toda
//    la pestana de SENG quedaban vacios.

migrate(
  (app) => {
    // ------------------------------------------------------------ fechas

    const DIA = 86400000;
    const HOY_PROTOTIPO = '2026-09-04';
    // Hoy en la zona del SERVIDOR, no en UTC.
    //
    // Con toISOString() a las 18:00 en Mexico ya es el dia siguiente, y los datos
    // de demo quedan corridos un dia respecto de lo que la pantalla considera hoy:
    // el pico de carga caia en +8 cuando el atajo de "1 semana" apuntaba a +7, y
    // asi el corrimiento no se veia nunca.
    const ahora = new Date();
    const HOY = ahora.getFullYear() + '-' + String(ahora.getMonth() + 1).padStart(2, '0') + '-' + String(ahora.getDate()).padStart(2, '0');
    const CORRIMIENTO = Math.round((Date.parse(HOY) - Date.parse(HOY_PROTOTIPO)) / DIA);

    /**
     * Una fecha del prototipo, movida a la semana en que se corre el seed.
     * El segundo argumento suma dias: `mover(HOY_PROTOTIPO, -3)` es anteayer.
     */
    const mover = (iso, mas) =>
      new Date(Date.parse(iso) + (CORRIMIENTO + (mas || 0)) * DIA).toISOString().slice(0, 10);

    // El campo `date` de PocketBase guarda fecha Y hora; los seeds escribian
    // solo la fecha y todo caia a medianoche. Sin hora, el analisis de "cuando
    // responden" (§5.5) no puede separar la manana de la tarde.
    //
    // La hora se deriva del nombre del contacto en vez de sortearse: el seed
    // tiene que dar siempre lo mismo, y ademas asi las respuestas se reparten
    // sin quedar todas en la misma franja.
    const horaEstable = (semilla, desde, cuantas) => {
      let suma = 0;
      for (let k = 0; k < String(semilla).length; k++) suma += String(semilla).charCodeAt(k);
      const hora = desde + (suma % cuantas);
      const minuto = (suma * 7) % 60;
      return ' ' + String(hora).padStart(2, '0') + ':' + String(minuto).padStart(2, '0') + ':00.000Z';
    };

    /** El prototipo escribe las notas en DD/MM. Todas son de 2026. */
    const dm = (s) => {
      const p = String(s).split('/');
      return mover('2026-' + p[1] + '-' + p[0]);
    };

    // La operacion es Buenos Aires, que es UTC-3 todo el ano: no tiene horario
    // de verano, asi que alcanza con sumar tres horas. La base guarda UTC y la
    // pantalla vuelve a la zona con `enSuZona` (D23) — que es justo el camino
    // que hay que poder mirar.
    const ZONA = 'America/Argentina/Buenos_Aires';
    const instante = (fecha, hora) =>
      new Date(Date.parse(mover(fecha) + 'T' + hora + ':00Z') + 3 * 3600000).toISOString();

    const registros = (items) => items.map((i) => ({ fecha: dm(i[0]), texto: i[1] }));

    // --------------------------------------------------------- ayudantes

    const nuevo = (coleccion, datos) => {
      const r = new Record(app.findCollectionByNameOrId(coleccion));
      for (const [k, v] of Object.entries(datos)) r.set(k, v);
      app.save(r);
      return r.id;
    };

    // El motor JS de PocketBase NO implementa normalize('NFD'): la llamada no
    // falla, simplemente devuelve el texto igual, y las tildes quedan. Con eso
    // 'gonzalo adrian nunez' no reconocia a 'Gonzalo Adrián Núñez' y el seed
    // creaba un segundo perfil de la misma persona. Por eso la tabla a mano.
    const ACENTOS = 'áàäâãÁÀÄÂÃéèëêÉÈËÊíìïîÍÌÏÎóòöôõÓÒÖÔÕúùüûÚÙÜÛñÑçÇ';
    const LLANOS = 'aaaaaAAAAAeeeeEEEEiiiiIIIIoooooOOOOOuuuuUUUUnNcC';
    const sinTilde = (s) => {
      let r = '';
      for (const c of String(s || '')) {
        const i = ACENTOS.indexOf(c);
        r += i >= 0 ? LLANOS[i] : c;
      }
      return r;
    };

    // Igual que packages/core/src/dedupe.ts (D02).
    const compactar = (s) =>
      sinTilde(s)
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, '');

    const plano = (s) => sinTilde(s).toLowerCase().trim();

    const cuentas = {};
    for (const c of app.findAllRecords('cuenta')) cuentas[String(c.get('abrev'))] = c.id;

    const etiquetas = {};
    for (const e of app.findAllRecords('etiqueta')) etiquetas[String(e.get('nombre'))] = e.id;

    const usuarios = {};
    for (const u of app.findAllRecords('users')) usuarios[plano(u.get('name'))] = u.id;

    /** Los nombres del prototipo llevan tilde; los del seed de demo, no. */
    const quien = (nombre) => usuarios[plano(nombre)] || '';

    // --------------------------------------------------- los observadores
    //
    // Control es un permiso de alcance: cada uno ve SU negocio. Hacen falta los
    // dos para poder comprobar que el filtro se nota en la pantalla.

    const observadores = [
      ['Ignacio Peralta', 'ignacio@globalita.test', 'ia'],
      ['Renata Vidal', 'renata@globalita.test', 'inversiones'],
    ];
    for (const [name, email, linea] of observadores) {
      const r = new Record(app.findCollectionByNameOrId('users'));
      r.set('name', name);
      r.set('email', email);
      r.set('emailVisibility', true);
      r.set('verified', true);
      r.setPassword('demo12345');
      r.set('rol', 'observador');
      r.set('estado', 'activo');
      r.set('permisos', {});
      r.set('linea_control', linea);
      r.set('metodo_invitacion', 'clave_temporal');
      app.save(r);
    }

    // ------------------------------------------------------------- gente
    //
    // Cinco ya existen del seed de demo y se REUSAN: dos leads del mismo perfil
    // en la misma cuenta ni siquiera entran (indice unico perfil+cuenta). Pero
    // se les corrigen empresa, cargo y ciudad, porque el prototipo de Control
    // los ubica en otro lado que el de Followup y en pantalla se veria la
    // contradiccion.

    const GENTE = [
      // clave, nombre, cargo, empresa, pais, ciudad, industria, cuenta, duenio, telefono
      ['wellington', 'Wellington Abner Simões', 'Gerente de Operaciones', 'Opus CM', 'Brasil', 'São Paulo', 'Construcción / Manufactura', 'AL', 'Alberto Cordoba', '5511955550101'],
      ['gonzalo', 'Gonzalo Adrián Núñez', 'Jefe de Planta', 'Metalúrgica del Sur', 'Argentina', 'Rosario', 'Metalurgia', 'AU', 'Sofia Ferrer', '5493415550102'],
      // Nombre larguisimo a proposito: es el que prueba el truncado.
      ['largo', 'María de los Ángeles Fernández Villagrán de Gonçalves Sobrinho — Directora de Operaciones y Cadena de Suministro LATAM', 'Directora de Operaciones y Cadena de Suministro LATAM', 'Grupo Industrial Villagrán y Asociados S.A. de C.V.', 'México', 'Monterrey', 'Maquinaria Industrial', 'ED', 'Sofia Ferrer', '528115550103'],
      ['lucia', 'Lucía Gonçalves', 'Consultora Senior', 'Pinheiro & Asoc.', 'Uruguay', 'Montevideo', 'Consultoría', 'AMU', 'Alberto Cordoba', '598995550104'],
      // Ficha a medio cargar: sin empresa y sin cargo. Es el caso que muestra
      // como se ve un campo vacio, que en el prototipo dice "sin dato".
      ['jordao', 'Alexandre Jordão', '', '', 'Brasil', 'Rio de Janeiro', 'Automotriz', 'DL', 'Alberto Cordoba', '5521955550105'],
      ['herik', 'Herik Pires', '', '', 'Brasil', 'Belo Horizonte', 'Automotriz', 'FR', 'Bruno Etchart', ''],

      // Los que entran con esta carga.
      ['rodrigo', 'Rodrigo Vera', 'Director de Operaciones', 'Transportes Andes', 'Chile', 'Santiago', 'Logística', 'AL', 'Alberto Cordoba', '56995550106'],
      ['fabio', 'Fábio Menezes', 'Socio', 'TecnoSul Integradores', 'Brasil', 'São Paulo', 'Tecnología', 'DL', 'Alberto Cordoba', '5511955550107'],
      ['silvina', 'Silvina Duarte', 'Gerente de Producción', 'Alimentos Paraná', 'Argentina', 'Paraná', 'Alimentos', 'AU', 'Alberto Cordoba', '5493435550108'],
      ['ana', 'Ana Lucía Prado', 'Gerente de Compras', 'Cerámica Andina', 'Perú', 'Lima', 'Construcción / Manufactura', 'DL', 'Alberto Cordoba', ''],
      ['emilio', 'Emilio Sosa', 'Jefe de Mantenimiento', 'Minera Cuyo', 'Argentina', 'Mendoza', 'Minería', 'ED', 'Sofia Ferrer', '5492615550109'],
      ['mariana', 'Mariana Kessler', 'Directora Industrial', 'Plásticos Del Litoral', 'Argentina', 'Santa Fe', 'Plásticos', 'AU', 'Sofia Ferrer', ''],
      ['amilcar', 'Amílcar Sitoe', 'Diretor Comercial', 'Beira Log', 'Mozambique', 'Beira', 'Logística', 'FR', 'Alberto Cordoba', ''],
      ['joaquin', 'Joaquín Ferreyra', 'Gerente de Planta', 'Vidriería Central', 'Argentina', 'Córdoba', 'Vidrio', 'AL', 'Alberto Cordoba', ''],
      ['hugo', 'Hugo Benítez', 'Gerente General', 'Frigorífico Norte', 'Paraguay', 'Asunción', 'Alimentos', 'FR', 'Alberto Cordoba', '595985550110'],
      ['carla', 'Carla Ibáñez', 'Gerente de Operaciones', 'Textil Sur', 'Uruguay', 'Montevideo', 'Textil', 'AMU', 'Alberto Cordoba', ''],
      ['nadia', 'Nadia Rocha', 'Jefa de Compras', 'Autopartes Litoral', 'Brasil', 'Curitiba', 'Automotriz', 'DL', 'Alberto Cordoba', ''],

      // SENG. No estan en el prototipo: ver la nota 3 de arriba.
      ['ignacio', 'Ignacio Bertoldi', 'Director Financiero', 'Grupo Alvear', 'Argentina', 'Buenos Aires', 'Inmobiliario', 'AL', 'Alberto Cordoba', '5491155550111'],
      ['camila', 'Camila Restrepo', 'Socia', 'Andina Capital', 'Colombia', 'Medellín', 'Fondos de inversión', 'AL', 'Alberto Cordoba', ''],
    ];

    // Para que la columna de Follow-up no sean veinte filas iguales. Con todos
    // en R0 y sin proximo contacto no se ve nada del diseno: ni las pastillas
    // de etapa, ni la fecha en rojo del vencido, ni el punto de sin leer.
    //
    // clave: [etapa, situacion, dias hasta el proximo contacto, etiquetas, sin leer]
    // Los dias negativos son vencidos; null es sin proximo contacto.
    const AGENDA = {
      rodrigo: ['R3', 'contesto', 2, ['Caliente', 'Decisor'], false],
      fabio: ['R2', 'contesto', -1, ['Tibio'], true],
      silvina: ['R4', 'contesto', 9, ['Caliente', 'Periodico'], false],
      ana: ['R1', 'en_curso', -4, ['Frio'], false],
      emilio: ['R6', 'pausado', 21, ['Frio', 'Reagendar'], false],
      mariana: ['R2', 'en_curso', 5, [], false],
      amilcar: ['R7', 'pausado', 30, ['Frio', 'Fase 2'], false],
      joaquin: ['R1', 'en_curso', 0, ['Tibio', 'Reagendar'], true],
      hugo: ['R8', 'descartado', null, ['No target'], false],
      carla: ['R3', 'contesto', -6, ['Tibio'], false],
      nadia: ['R2', 'agotado', null, ['Frio', 'Recordatorio'], false],
      ignacio: ['R4', 'contesto', 1, ['Caliente', 'Decisor'], false],
      camila: ['R3', 'contesto', 4, ['Caliente'], false],
    };

    /** El lead de cada clave: lo que usan proyectos y reuniones. */
    const leadDe = {};
    /** El perfil de cada clave, para poder mirarlo si hace falta. */
    const perfilDe = {};

    const perfilesExistentes = app.findAllRecords('perfil');

    for (const g of GENTE) {
      const [clave, nombre, cargo, empresa, pais, ciudad, industria, abrev, duenio, telefono] = g;
      const cuentaId = cuentas[abrev];
      const huella = compactar(nombre) + '|' + compactar(empresa);

      // Reusar el perfil del seed de demo si ya esta: los nombres coinciden
      // salvo por las tildes, y el largo tiene el cargo pegado atras.
      const buscado = plano(nombre).slice(0, 20);
      let perfil = null;
      for (const p of perfilesExistentes) {
        if (plano(p.get('nombre')).indexOf(buscado) === 0) {
          perfil = p;
          break;
        }
      }

      if (perfil) {
        // Se le pisa todo, tildes incluidas: el seed de demo los escribio sin
        // acentos y los dos datasets tienen que decir lo mismo en pantalla.
        perfil.set('nombre', nombre);
        perfil.set('cargo', cargo);
        perfil.set('empresa', empresa);
        perfil.set('pais', pais);
        perfil.set('ciudad', ciudad);
        perfil.set('industria', industria);
        perfil.set('huella', huella);
        app.save(perfil);
      } else {
        const id = nuevo('perfil', {
          slug: plano(nombre).replace(/[^a-z0-9]+/g, '-').slice(0, 40),
          urn: '',
          huella,
          nombre,
          cargo,
          empresa,
          pais,
          ciudad,
          industria,
          telefono,
          telefono_raw: telefono,
          telefono_valido: Boolean(telefono),
        });
        perfil = app.findRecordById('perfil', id);
      }
      perfilDe[clave] = perfil.id;

      // El lead: el del demo si existe, o uno nuevo.
      let lead = null;
      try {
        lead = app.findFirstRecordByFilter('lead', 'perfil = {:p} && cuenta = {:c}', {
          p: perfil.id,
          c: cuentaId,
        });
      } catch (_) {
        // findFirstRecordByFilter tira si no hay filas; no es un error.
      }

      if (!lead) {
        const v = AGENDA[clave] || ['R1', 'en_curso', 7, []];
        const id = nuevo('lead', {
          perfil: perfil.id,
          cuenta: cuentaId,
          asignado: quien(duenio),
          nivel_asignacion: 'seguimiento',
          etapa: v[0],
          situacion: v[1],
          proximo_contacto: v[2] === null ? '' : mover(HOY_PROTOTIPO, v[2]),
          etiquetas: (v[3] || []).map((e) => etiquetas[e]).filter(Boolean),
          motivo_descarte: v[1] === 'descartado' ? 'Eligieron un proveedor local' : '',
          sin_leer_li: Boolean(v[4]),
          // Ninguno de estos llego por invitacion: por eso no tienen pagina de
          // origen ni nota de R0 (D26).
          lista: 'Contacto directo',
          nota_r0: false,
          // La hora sale del nombre del contacto, no de un random: asi el mismo
          // seed da siempre lo mismo y las cuatro franjas de §5.5 se pueblan.
          f_respuesta: mover('2026-06-01') + horaEstable(clave, 8, 12),
          f_ultimo_contacto: mover('2026-08-20') + horaEstable(clave, 9, 9),
        });
        lead = app.findRecordById('lead', id);
      } else if (!lead.get('asignado')) {
        lead.set('asignado', quien(duenio));
        lead.set('nivel_asignacion', 'seguimiento');
        app.save(lead);
      }
      leadDe[clave] = lead.id;
    }

    // ---------------------------------------------- cuando se uso cada etiqueta
    //
    // De aca salen las seis que la ficha ofrece a mano (cambio 8). El backfill
    // de la migracion no alcanza: esa corre ANTES del seed, sobre una base
    // vacia, asi que sin esto el catalogo queda sin fechas y la fila de atajos
    // sale vacia hasta que alguien etiquete a mano.
    //
    // Las fechas se escalonan para que el orden se note: la primera etiqueta
    // del lead mas nuevo queda arriba.
    const usoDe = {};
    let dias = 0;
    for (const l of app.findAllRecords('lead')) {
      for (const id of l.get('etiquetas') || []) {
        if (usoDe[id]) continue;
        usoDe[id] = mover(HOY_PROTOTIPO, -dias);
        dias += 1;
      }
    }
    for (const e of app.findAllRecords('etiqueta')) {
      if (!usoDe[e.id]) continue;
      e.set('usada_en', usoDe[e.id]);
      app.save(e);
    }

    // --------------------------------------------------------- proyectos

    // El bundle nuevo tiene tres tipos: se fue «prototipo».
    const TIPO = { pib: 'fabript_piv', parceria: 'parceria', inversion: 'inversion' };

    // Que abreviaturas son de Seng. La casa del proyecto sale de aca cuando el
    // tipo no la decide solo.
    const cuentaSeng = {};
    for (const c of app.findAllRecords('cuenta')) {
      cuentaSeng[String(c.get('abrev'))] = c.get('linea_negocio') === 'inversiones';
    }
    const ESTADO = {
      'sin-hablar': 'sin_hablar',
      conversacion: 'en_conversacion',
      propuesta: 'propuesta_enviada',
      nuestra: 'nuestra_pelota',
      congelado: 'congelado',
      ganado: 'cerrado_ganado',
      perdido: 'cerrado_perdido',
    };

    const PROYECTOS = [
      {
        contacto: 'wellington',
        nombre: 'Planta Guarulhos — control de formato',
        tipo: 'pib', estado: 'conversacion', abierto: '21/08',
        nota_lead:
          'Aceptó la invitación el 21/08 y respondió el mismo día. Interesado para la planta de Guarulhos. Pidió propuesta por email: enviada el 26/08, sin respuesta todavía.',
        notas: [
          ['21/08', 'Decide él sobre operaciones, pero compras revisa el número final.'],
          ['02/09', 'Prefiere WhatsApp para coordinar y email para lo formal.'],
        ],
        updates: [
          ['21/08', 'Aceptó la invitación y respondió el mismo día: le interesa para Guarulhos.'],
          ['26/08', 'Enviada propuesta por email con alcance de una planta.'],
          ['02/09', 'Confirmó reunión para el 17/09 con el gerente de planta.'],
        ],
        acciones: [
          ['17/09', 'Reunión 15:00 con el gerente de planta para revisar la propuesta.'],
          ['10/09', 'Mandar el caso de la planta de Córdoba antes de la reunión.'],
        ],
      },
      {
        contacto: 'gonzalo',
        nombre: 'Fabript/PIV para línea de laminado',
        tipo: 'pib', estado: 'propuesta', abierto: '28/08',
        nota_lead:
          'Referido por contacto en común. Reunión del 02/09 realizada, quedó en revisar presupuesto con el gerente general.',
        notas: [
          ['28/08', 'Llegó por referido, no por invitación: el ciclo va más rápido.'],
          ['02/09', 'Responde a la noche, entre 19 y 20 h.'],
        ],
        updates: [
          ['28/08', 'Escribió él por WhatsApp, referido por un contacto en común.'],
          ['19/08', 'Primera reunión cancelada por él, movida al 02/09.'],
          ['02/09', 'Reunión realizada: le cierra el alcance, revisa presupuesto con el gerente general.'],
        ],
        acciones: [['12/09', 'Si no responde, llamarlo: la propuesta ya lleva 10 días.']],
      },
      {
        contacto: 'largo',
        nombre: 'Fabript/PIV cadena de suministro LATAM',
        tipo: 'pib', estado: 'nuestra', abierto: '01/09',
        nota_lead:
          'Nombre completo tal como figura en LinkedIn, con cargo incluido. Verificar si el teléfono es directo o conmutador.',
        notas: [
          ['01/09', 'Es decisora regional: si avanza, entra por cinco plantas, no una.'],
          ['03/09', 'La demora en responder es nuestra, no de ella.'],
        ],
        updates: [
          ['01/09', 'Aceptó y escribió a los 10 minutos pidiendo material.'],
          ['04/09', 'Reunión de hoy 16:00 para entender el alcance regional.'],
        ],
        acciones: [
          ['05/09', 'Mandar el resumen de una carilla que pidió.'],
          ['08/09', 'Confirmar si el teléfono es directo o conmutador.'],
        ],
      },
      {
        // Corrido dos meses atras para que el congelado se DEDUZCA. Ver la
        // nota 2 de la cabecera.
        contacto: 'lucia',
        nombre: 'Parcería de reventa en Uruguay',
        tipo: 'parceria', estado: 'congelado', abierto: '27/06',
        nota_lead: 'No se conectó a la reunión del 26/06. Escribió al día siguiente pidiendo reagendar.',
        notas: [['27/06', 'Trabaja sola: cualquier parcería depende de su agenda personal.']],
        updates: [
          ['09/06', 'Aceptó la invitación, sin respuesta a los mensajes.'],
          ['26/06', 'No asistió a la reunión.'],
          ['27/06', 'Escribió pidiendo reagendar. No volvió a contestar.'],
        ],
        acciones: [['19/09', 'Último intento de reagendar; si no, se cierra.']],
      },
      {
        contacto: 'jordao',
        nombre: 'Fabript/PIV para flota automotriz',
        tipo: 'pib', estado: 'sin-hablar', abierto: '12/08',
        nota_lead:
          'Contacto inicial por LinkedIn el 12/08. Respondió pidiendo información pero aclaró que la decisión la toma compras en São Paulo. Quedó en pasar el contacto.',
        notas: [['13/08', 'Falta empresa y cargo en la ficha: no se puede evaluar el tamaño.']],
        updates: [
          ['12/08', 'Respondió pidiendo información, aclaró que decide compras SP.'],
          ['13/08', 'Le pedimos el contacto de compras. Sin respuesta.'],
        ],
        acciones: [['08/09', 'Pedirle el contacto de compras en São Paulo por LinkedIn.']],
      },
      {
        contacto: 'rodrigo',
        nombre: 'Prototipo tablero de flota',
        tipo: 'pib', estado: 'conversacion', abierto: '14/07',
        nota_lead: 'Entró por recomendación directa, no por prospección: no hubo invitación ni cadencia.',
        notas: [
          ['14/07', 'El equipo de tráfico es el que va a usarlo todos los días.'],
          ['20/08', 'Buena devolución de la primera demo, quieren el corte por conductor.'],
        ],
        updates: [
          ['14/07', 'Reunión inicial: definieron dos tableros y el corte por ruta.'],
          ['20/08', 'Primera demo. Pidieron agregar corte por conductor.'],
          ['01/09', 'Enviada la versión con el corte nuevo, esperan juntar al equipo de tráfico.'],
        ],
        acciones: [['11/09', 'Segunda demo con el equipo de tráfico completo.']],
      },
      {
        contacto: 'silvina',
        nombre: 'Prototipo control de planta',
        tipo: 'pib', estado: 'ganado', abierto: '05/05',
        nota_lead: 'Viene de un contacto anterior a la prospección.',
        notas: [['18/08', 'Sirve como caso de referencia para el resto del sector alimentos.']],
        updates: [
          ['05/05', 'Primera reunión, pidieron ver el flujo de paradas de línea.'],
          ['11/06', 'Demo del prototipo con datos reales de dos líneas.'],
          ['18/08', 'Aprobado. Pasa a implementación con alcance de planta completa.'],
        ],
        acciones: [['15/09', 'Pedirle permiso para usarlo como caso público.']],
      },
      {
        contacto: 'fabio',
        nombre: 'Parcería con integrador SP',
        tipo: 'parceria', estado: 'conversacion', abierto: '02/06',
        nota_lead: 'La charla arrancó en una feria del sector, no por invitación.',
        notas: [
          ['17/07', 'Tienen equipo de campo propio en tres estados.'],
          ['28/08', 'El punto trabado es quién factura al cliente final.'],
        ],
        updates: [
          ['02/06', 'Primera charla sobre revender con su equipo de campo.'],
          ['17/07', 'Segunda reunión: pidieron material técnico para su equipo.'],
          ['28/08', 'Discusión abierta sobre comisión y quién factura.'],
        ],
        acciones: [['10/09', 'Mandar propuesta de reparto comercial por escrito.']],
      },
      {
        contacto: 'amilcar',
        nombre: 'Parcería logística Mozambique',
        tipo: 'parceria', estado: 'congelado', abierto: '20/04',
        nota_lead: 'Conversaciones en portugués.',
        notas: [['12/06', 'No hay quién lleve el proyecto de su lado.']],
        updates: [
          ['20/04', 'Primera reunión en portugués, interés general sin proyecto concreto.'],
          ['12/06', 'Segunda reunión. Quedaron en definir un responsable interno y no lo hicieron.'],
        ],
        acciones: [],
      },
      {
        contacto: 'emilio',
        nombre: 'Prototipo app de campo',
        tipo: 'pib', estado: 'congelado', abierto: '11/05',
        nota_lead: 'Contacto por LinkedIn de Sofía.',
        notas: [['03/07', 'El prototipo funcionó; lo que se cortó fue el presupuesto.']],
        updates: [
          ['11/05', 'Reunión inicial sobre partes de mantenimiento en papel.'],
          ['25/06', 'Demo del prototipo en el celular del equipo de campo.'],
          ['03/07', 'Frenaron por presupuesto. Retoman el próximo ejercicio.'],
        ],
        acciones: [['01/12', 'Volver a escribir cuando se apruebe el presupuesto del ejercicio.']],
      },
      {
        contacto: 'hugo',
        nombre: 'Fabript/PIV frigorífico',
        tipo: 'pib', estado: 'perdido', abierto: '08/04',
        motivo_cierre: 'Eligieron un proveedor local por el soporte en planta.',
        nota_lead: 'Cerrado. Vale volver en 2027.',
        notas: [['22/05', 'Perdido por soporte en planta, no por precio. Vale volver en 2027.']],
        updates: [
          ['08/04', 'Reunión con el gerente general, interés fuerte.'],
          ['22/05', 'Avisaron que eligieron un proveedor local por el soporte en planta.'],
        ],
        acciones: [],
      },

      // ---- SENG. No estan en el prototipo: ver la nota 3 de la cabecera. ----
      {
        contacto: 'ignacio',
        nombre: 'Ronda semilla — plataforma logística',
        tipo: 'inversion', estado: 'propuesta', abierto: '05/08',
        nota_lead: 'Llegó por Alberto. Busca ticket de entrada chico con opción de seguir en la serie A.',
        notas: [['05/08', 'Invierte con su propio capital: decide él, sin comité.']],
        updates: [
          ['05/08', 'Primera charla sobre la tesis y el tamaño de ticket.'],
          ['27/08', 'Enviado el memo con la estructura y el calendario de la ronda.'],
        ],
        acciones: [['09/09', 'Seguimiento del memo: ya lleva dos semanas sin respuesta.']],
      },
      {
        contacto: 'camila',
        nombre: 'Coinversión en portafolio industrial',
        tipo: 'inversion', estado: 'conversacion', abierto: '18/08',
        nota_lead: 'El fondo coinvierte, no lidera. Pide que haya un lead antes de comprometerse.',
        notas: [['30/08', 'El comité se junta los primeros martes de cada mes.']],
        updates: [
          ['18/08', 'Primera reunión: les interesa el sector, no el vehículo actual.'],
          ['30/08', 'Pidieron el detalle de las tres operaciones cerradas del año pasado.'],
        ],
        acciones: [['12/09', 'Mandar el detalle de las tres operaciones cerradas.']],
      },
    ];

    const proyectoDe = {};

    for (const p of PROYECTOS) {
      const g = GENTE.find((x) => x[0] === p.contacto);
      const notas = registros(p.notas);
      const updates = registros(p.updates);
      const acciones = registros(p.acciones);

      // Lo mismo que calcula core/proyecto.ts al mostrar. Se guarda ademas
      // porque el indice de la coleccion ordena por este campo.
      const movimiento = notas
        .concat(updates)
        .map((r) => r.fecha)
        .concat([dm(p.abierto)])
        .sort()
        .pop();

      proyectoDe[p.contacto] = nuevo('proyecto', {
        lead: leadDe[p.contacto],
        nombre: p.nombre,
        empresa: g[3],
        tipo: TIPO[p.tipo],
        // La casa vive en el proyecto: inversion es Seng, y el resto sale de la
        // cuenta por la que entro el lead.
        casa: p.tipo === 'inversion' || cuentaSeng[g[7]] ? 'seng' : 'globalita',
        estado: ESTADO[p.estado],
        pais: g[4],
        ciudad: g[5],
        industria: g[6],
        rol_contacto: g[2],
        contacto: g[1],
        cuenta: cuentas[g[7]],
        responsable: quien(g[8]),
        abierto: dm(p.abierto),
        nota_lead: p.nota_lead,
        notas,
        updates,
        acciones,
        ultimo_movimiento: movimiento,
        motivo_cierre: p.motivo_cierre || '',
      });
    }

    // ---------------------------------------------------------- reuniones
    //
    // Se cuelgan del proyecto A TRAVES del lead, no por una relacion directa:
    // es la regla del anexo (§6) y es lo que hay que poder mirar en la
    // columna "Reuniones" de la tabla.

    const REUNIONES = [
      ['wellington', '2026-09-17', '15:00', 45, 'pendiente', 'Revisar la propuesta con el gerente de planta.'],
      ['largo', '2026-09-04', '16:00', 45, 'pendiente', 'Alcance regional LATAM.'],
      ['herik', '2026-09-04', '09:30', 30, 'pendiente', 'Primera charla, sin proyecto abierto.'],
      ['gonzalo', '2026-09-02', '11:00', 50, 'asistio', 'Revisa presupuesto con el gerente general.'],
      ['rodrigo', '2026-09-01', '15:30', 40, 'asistio', 'Repaso del corte por conductor.'],
      ['camila', '2026-08-30', '12:00', 45, 'asistio', 'Pidieron el detalle de las operaciones cerradas.'],
      ['fabio', '2026-08-28', '10:00', 55, 'asistio', 'Comisión y facturación sin cerrar.'],
      ['ignacio', '2026-08-27', '09:00', 40, 'asistio', 'Repaso del memo antes de mandarlo.'],
      ['gonzalo', '2026-08-19', '16:00', 30, 'reagendada', 'Cancelada por él, movida al 02/09.'],
      ['silvina', '2026-08-18', '11:30', 45, 'asistio', 'Aprobaron el prototipo, pasa a implementación.'],
      ['camila', '2026-08-18', '17:00', 60, 'asistio', 'Primera reunión con el fondo.'],
      ['rodrigo', '2026-08-20', '14:00', 60, 'asistio', 'Primera demo del tablero.'],
      ['ana', '2026-08-06', '09:00', 35, 'asistio', 'Sin presupuesto este año, no abrió proyecto.'],
      ['ignacio', '2026-08-05', '11:00', 50, 'asistio', 'Tesis y tamaño de ticket.'],
      ['emilio', '2026-07-30', '17:00', 30, 'no-asistio', 'No asistió, ya venía frenado por presupuesto.'],
      ['fabio', '2026-07-17', '10:30', 50, 'asistio', 'Pidieron material técnico para su equipo.'],
      ['rodrigo', '2026-07-14', '15:00', 60, 'asistio', 'Arranque del prototipo, dos tableros.'],
      ['mariana', '2026-07-09', '11:00', 40, 'asistio', 'Derivó a su gerente de planta, sin avance.'],
      ['emilio', '2026-07-03', '09:30', 25, 'asistio', 'Avisó que frenaban por presupuesto.'],
      ['lucia', '2026-06-26', '10:30', 30, 'no-asistio', 'No se conectó. Pidió reagendar al día siguiente.'],
      ['emilio', '2026-06-25', '14:30', 55, 'asistio', 'Demo en el celular del equipo de campo.'],
      ['amilcar', '2026-06-12', '10:00', 45, 'asistio', 'Quedaron en definir un responsable interno.'],
      ['silvina', '2026-06-11', '16:30', 60, 'asistio', 'Demo con datos reales de dos líneas.'],
      ['joaquin', '2026-06-04', '11:00', 30, 'reagendada', 'Reagendada dos veces, nunca se hizo.'],
      ['fabio', '2026-06-02', '15:00', 50, 'asistio', 'Primera charla de parcería.'],
      ['hugo', '2026-05-22', '10:00', 35, 'asistio', 'Avisaron que eligieron un proveedor local.'],
      ['carla', '2026-05-14', '09:00', 40, 'asistio', 'Interesada, no volvió a responder.'],
      ['emilio', '2026-05-11', '16:00', 45, 'asistio', 'Partes de mantenimiento en papel.'],
      ['silvina', '2026-05-05', '11:30', 55, 'asistio', 'Primera reunión: paradas de línea.'],
      ['nadia', '2026-04-23', '10:30', 30, 'no-asistio', 'No se conectó, no volvió a responder.'],
      ['amilcar', '2026-04-20', '09:00', 45, 'asistio', 'Interés general, sin proyecto concreto.'],
      ['hugo', '2026-04-08', '15:30', 50, 'asistio', 'Interés fuerte del gerente general.'],
    ];

    for (const [clave, fecha, hora, dur, estado, nota] of REUNIONES) {
      const g = GENTE.find((x) => x[0] === clave);
      nuevo('reunion', {
        lead: leadDe[clave],
        inicio: instante(fecha, hora),
        zona: ZONA,
        duracion_min: dur,
        estado,
        calendario: quien(g[8]),
        notas: nota,
        // Datos de demo: no se mandan a Google. El hook igual las saltaria por
        // pasadas, pero la de dentro de dos semanas no.
        sync: 'omitida',
        sync_detalle: 'dato de demo',
      });
    }
  },

  (app) => {
    for (const col of ['reunion', 'proyecto']) {
      for (const r of app.findAllRecords(col)) app.delete(r);
    }
    for (const r of app.findAllRecords('users')) {
      const email = String(r.get('email'));
      if (email === 'ignacio@globalita.test' || email === 'renata@globalita.test') app.delete(r);
    }
    // Los perfiles que nacieron aca: los del seed de demo no llevan `lista`
    // "Contacto directo", asi que no se tocan.
    for (const l of app.findAllRecords('lead')) {
      if (String(l.get('lista')) !== 'Contacto directo') continue;
      const perfil = l.get('perfil');
      app.delete(l);
      try {
        app.delete(app.findRecordById('perfil', perfil));
      } catch (_) {
        // Si le queda otro lead, el borrado en cascada ya se ocupo.
      }
    }
  },
);
