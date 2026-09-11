/// <reference path="../../../.pb/pb_data/types.d.ts" />

// Datos de demo del manual (seccion 12). Solo para desarrollo: se aplican con
//   node packages/db/dev.mjs --seed
// La fecha de referencia del prototipo es el 04/09/2026.

migrate(
  (app) => {
    const nuevo = (coleccion, datos) => {
      const r = new Record(app.findCollectionByNameOrId(coleccion));
      for (const [k, v] of Object.entries(datos)) r.set(k, v);
      app.save(r);
      return r.id;
    };

    // ---------- configuracion ----------
    // Las esperas son configuracion, no constantes (CLAUDE.md regla 2).
    nuevo('configuracion', {
      clave: 'cadencia',
      descripcion: 'Pasos, esperas y Fase 2. Se edita en Automatizaciones > Seguimiento.',
      valor: {
        fase2_dias: 90,
        fase2_activa: true,
        pasos: [
          { paso: 'R0', nombre: 'Invitacion', espera_dias: 0, canal: 'linkedin', activo: true },
          { paso: 'R1', nombre: 'Primer contacto', espera_dias: 15, canal: 'linkedin', activo: true },
          { paso: 'R2', nombre: 'Seguimiento corto', espera_dias: 15, canal: 'linkedin', activo: true },
          { paso: 'R3', nombre: 'Caso concreto', espera_dias: 21, canal: 'linkedin', activo: true },
          { paso: 'R4', nombre: 'Pedir el decisor', espera_dias: 28, canal: 'whatsapp_si_hay_telefono', activo: true },
          { paso: 'R5', nombre: 'Reapertura fase 2', espera_dias: 15, canal: 'linkedin', activo: true },
          { paso: 'R6', nombre: 'Seguimiento fase 2', espera_dias: 15, canal: 'linkedin', activo: true },
          { paso: 'R7', nombre: 'Caso concreto fase 2', espera_dias: 21, canal: 'linkedin', activo: true },
          { paso: 'R8', nombre: 'Ultimo intento fase 2', espera_dias: 28, canal: 'whatsapp_si_hay_telefono', activo: true },
        ],
      },
    });

    nuevo('configuracion', {
      clave: 'cancelacion',
      descripcion: 'Dias sin aceptar, espera de recontacto y tope diario por cuenta.',
      valor: { dias_sin_aceptar: 90, espera_recontacto_dias: 60, tope_diario_por_cuenta: 30 },
    });

    nuevo('configuracion', {
      clave: 'zona_horaria',
      descripcion: 'Zona de operacion: define el corte del dia y el reset semanal. D25 sigue abierta.',
      valor: { zona: 'America/Argentina/Buenos_Aires', reset_semanal: 'lunes 00:01' },
    });

    // ---------- etiquetas ----------
    // "Recordatorio" y "Fase 2" las pone el sistema (D04): del_sistema = true.
    const etiquetas = {};
    const catalogo = [
      ['Caliente', false], ['Tibio', false], ['Frio', false],
      ['Decisor', false], ['Contacto', false], ['Periodico', false],
      ['Reagendar', false], ['No target', false],
      ['MX Norte', false], ['Compras SP', false],
      ['Recordatorio', true], ['Fase 2', true],
    ];
    for (const [nombre, sistema] of catalogo) {
      etiquetas[nombre] = nuevo('etiqueta', { nombre, del_sistema: sistema });
    }

    // ---------- cuentas ----------
    // 6 vinculadas de 10 slots. AMU con la sesion de WhatsApp caida: es el caso
    // que prueba los avisos (seccion 12 del manual).
    const cuentas = {};
    //
    // La linea va en la cuenta y el lead la hereda. Se carga ACA y no en la
    // migracion 1788600800: esa corre ANTES del seed, asi que las cuentas que
    // nacen aca no las alcanza, y una cuenta sin linea no la ve ningun
    // observador limitado a un negocio.
    const slots = [
      ['AL', 'Alberto Cordoba', 'activa', 'activa', 'inversiones'],
      ['DL', 'Diego Lamas', 'ia'],
      ['FR', 'Franco Ruiz', 'ia'],
      ['ED', 'Elena Duarte', 'ia'],
      ['AU', 'Augusto Unzaga', 'ia'],
      ['AMU', 'A. M. Unzaga', 'ia'],
    ];
    // SIN estado de sesion. Estas dos columnas se fueron el 11/09 y la semilla
    // era donde nacio el problema: decian «activa» en cinco cuentas sin que
    // hubiera ninguna sesion viva, y el CRM las creia. Hoy el estado se calcula
    // a partir de la ultima senal real (core/sesion.ts).
    slots.forEach(([abrev, nombre_perfil, linea_negocio], i) => {
      cuentas[abrev] = nuevo('cuenta', {
        abrev,
        nombre_perfil,
        slot: i + 1,
        linea_negocio,
        cupo_diario: 40,
        objetivo_semanal: 200,
      });
    });

    // ---------- usuarios ----------
    const usuarios = {};
    const gente = [
      ['Alberto Cordoba', 'alberto@globalita.test', 'administrador', 'activo', {}],
      ['Sofia Ferrer', 'sofia@globalita.test', 'colaborador', 'activo', { enviarMensajes: true }],
      ['Bruno Etchart', 'bruno@globalita.test', 'colaborador', 'pendiente', {}],
      ['Vera Molina', 'vera@globalita.test', 'colaborador', 'suspendido', {}],
    ];
    for (const [name, email, rol, estado, permisos] of gente) {
      const r = new Record(app.findCollectionByNameOrId('users'));
      r.set('name', name);
      r.set('email', email);
      r.set('emailVisibility', true);
      r.set('verified', true);
      r.setPassword('demo12345');
      r.set('rol', rol);
      r.set('estado', estado);
      r.set('permisos', permisos);
      r.set('metodo_invitacion', estado === 'pendiente' ? 'link' : 'clave_temporal');
      app.save(r);
      usuarios[rol === 'administrador' ? 'admin' : name.split(' ')[0].toLowerCase()] = r.id;
    }

    // ---------- perfiles y leads ----------
    // Cada uno cubre un caso distinto de los dos ejes de D17.
    const gente_demo = [
      {
        // Respondio rapido y freno por el area de compras.
        perfil: {
          // Ficha a medio cargar: sin cargo ni empresa. Es el caso que muestra
          // cómo se ve un campo vacío.
          slug: 'alexandre-jordao', nombre: 'Alexandre Jordao',
          cargo: '', empresa: '',
          industria: 'Automotriz', pais: 'Brasil', ciudad: 'Rio de Janeiro',
          telefono: '5511987654321', telefono_raw: '5511987654321', telefono_valido: true,
        },
        lead: {
          cuenta: 'DL', etapa: 'R3', situacion: 'contesto',
          lista: 'Sales Navigator · Lista Automotriz BR', pagina_origen: 26, nota_r0: false,
          proximo_contacto: '2026-09-08',
          f_invitacion: '2026-08-05 09:40:00.000Z', f_aceptacion: '2026-08-12 10:02:00.000Z',
          f_respuesta: '2026-08-12 18:40:00.000Z',
          f_ultimo_contacto: '2026-08-18 10:20:00.000Z',
          sin_leer_li: true,
          etiquetas: ['Tibio', 'Compras SP'],
        },
      },
      {
        // El mas avanzado: con reunion agendada (la coleccion reunion llega en la etapa 3).
        perfil: {
          slug: 'wellington-abner-simoes', nombre: 'Wellington Abner Simoes',
          cargo: 'Gerente de Operaciones', empresa: 'Opus CM',
          industria: 'Construccion / Manufactura', pais: 'Brasil', ciudad: 'Sao Paulo',
          telefono: '5519998877665', telefono_raw: '5519998877665', telefono_valido: true,
        },
        lead: {
          cuenta: 'AL', etapa: 'R2', situacion: 'contesto',
          lista: 'Sales Navigator · Gerentes SP', pagina_origen: 9, nota_r0: true,
          proximo_contacto: '2026-09-16',
          f_invitacion: '2026-08-14 11:15:00.000Z', f_aceptacion: '2026-08-21 09:12:00.000Z',
          f_respuesta: '2026-08-21 14:12:00.000Z',
          f_ultimo_contacto: '2026-09-02 11:40:00.000Z',
          etiquetas: ['Caliente'],
        },
      },
      {
        // Acepto y nunca respondio: agoto la cadencia entera.
        perfil: {
          // Sin cargo ni empresa y sin teléfono: el único canal es LinkedIn.
          urn: 'ACwAAAB7x2sBb', nombre: 'Herik Pires',
          cargo: '', empresa: '',
          industria: 'Automotriz', pais: 'Brasil', ciudad: 'Belo Horizonte',
        },
        lead: {
          cuenta: 'FR', etapa: 'R8', situacion: 'agotado',
          lista: 'Sales Navigator · Automotriz MG', pagina_origen: 21, nota_r0: false,
          // Fase 2: el próximo contacto se corre tres meses, no se borra.
          proximo_contacto: '2026-10-04',
          f_invitacion: '2026-06-28 08:20:00.000Z', f_aceptacion: '2026-07-04 08:44:00.000Z',
          f_ultimo_contacto: '2026-07-04 08:50:00.000Z',
          etiquetas: ['Periodico', 'Fase 2'],
        },
      },
      {
        // Nombre deliberadamente larguisimo, para probar el truncado en la vista.
        perfil: {
          slug: 'maria-villagran',
          nombre: 'Maria de los Angeles Fernandez Villagran de Goncalves Sobrinho - Directora de Operaciones y Cadena de Suministro LATAM',
          cargo: 'Directora de Operaciones y Cadena de Suministro LATAM',
          empresa: 'Grupo Industrial Villagran y Asociados S.A. de C.V.',
          industria: 'Maquinaria Industrial', pais: 'Mexico', ciudad: 'Monterrey',
          telefono: '528112345678', telefono_raw: '528112345678', telefono_valido: true,
        },
        lead: {
          cuenta: 'ED', etapa: 'R1', situacion: 'contesto', asignado: 'sofia',
          lista: 'Sales Navigator · Maquinaria MX Norte', pagina_origen: 13, nota_r0: true,
          proximo_contacto: '2026-09-05',
          f_invitacion: '2026-08-25 16:30:00.000Z', f_aceptacion: '2026-09-01 08:05:00.000Z',
          // Contestó a los diez minutos de aceptar, antes de que le
          // escribiéramos: es el caso que muestra el escalón «min».
          f_respuesta: '2026-09-01 08:15:00.000Z',
          f_ultimo_contacto: '2026-09-01 09:40:00.000Z',
          sin_leer_li: true,
          etiquetas: ['Caliente', 'Decisor', 'MX Norte'],
        },
      },
      {
        // Referido que llego por WhatsApp: nunca hubo invitacion, no tiene pagina_origen (D26).
        perfil: {
          nombre: 'Gonzalo Adrian Nunez', cargo: 'Jefe de Planta',
          empresa: 'Metalurgica del Sur', industria: 'Metalurgia',
          pais: 'Argentina', ciudad: 'Rosario',
          telefono: '5493411234567', telefono_raw: '5493411234567', telefono_valido: true,
        },
        lead: {
          cuenta: 'AU', etapa: 'R4', situacion: 'contesto',
          lista: 'Referido · WhatsApp directo', nota_r0: false,
          proximo_contacto: '2026-09-12',
          // Escribió él primero: no hay invitación ni aceptación de las que
          // restar, y la ficha lo dice con esas palabras.
          f_respuesta: '2026-08-28 19:20:00.000Z',
          f_ultimo_contacto: '2026-08-28 19:35:00.000Z',
          sin_leer_wa: true,
          etiquetas: ['Caliente'],
        },
      },
      {
        // Respondio tarde y no asistio a la reunion. Vencido: le toca hoy.
        perfil: {
          slug: 'lucia-goncalves', nombre: 'Lucia Goncalves',
          cargo: 'Consultora Senior', empresa: 'Pinheiro & Asoc.',
          industria: 'Consultoria', pais: 'Uruguay', ciudad: 'Montevideo',
          telefono: '5531988776655', telefono_raw: '5531988776655', telefono_valido: true,
        },
        lead: {
          cuenta: 'AMU', etapa: 'R5', situacion: 'en_curso',
          lista: 'Sales Navigator · Consultoría LATAM', pagina_origen: 6, nota_r0: false,
          proximo_contacto: '2026-09-19',
          f_invitacion: '2026-08-02 10:00:00.000Z', f_aceptacion: '2026-08-09 12:30:00.000Z',
          f_respuesta: '2026-08-27 09:10:00.000Z',
          f_ultimo_contacto: '2026-08-19 10:00:00.000Z',
          etiquetas: ['Reagendar'],
        },
      },
      {
        // Invitacion cancelada a los 90 dias, esperando los 60 para volver (D03, D17).
        perfil: {
          slug: 'ricardo-almeida-8b12', nombre: 'Ricardo Almeida',
          cargo: 'Gerente de Operacoes', empresa: 'Cimentos Uniao',
          industria: 'Cemento', pais: 'Brasil', ciudad: 'Curitiba',
        },
        lead: {
          cuenta: 'DL', etapa: 'R0', situacion: 'esperando_recontacto',
          lista: 'Sales Navigator - Operacoes PR', pagina_origen: 4, nota_r0: false,
          f_invitacion: '2026-05-01 08:20:00.000Z', f_cancelada: '2026-07-30 03:00:00.000Z',
          f_ultimo_contacto: '2026-05-01 08:20:00.000Z',
          proximo_contacto: '2026-09-28',
          etiquetas: [],
        },
      },
    ];

    const perfiles = {};
    for (const g of gente_demo) {
      const datosPerfil = Object.assign({ slug: '', urn: '' }, g.perfil);
      // La huella se calcula igual que en packages/core/src/dedupe.ts (D02).
      //
      // Las tildes se sacan con una tabla y no con normalize('NFD'): el motor
      // JS de PocketBase no implementa esa normalizacion —no falla, devuelve el
      // texto igual— y la huella quedaba con acentos, asi que nunca iba a
      // coincidir con la que calcula core al importar un CSV.
      const ACENTOS = 'áàäâãÁÀÄÂÃéèëêÉÈËÊíìïîÍÌÏÎóòöôõÓÒÖÔÕúùüûÚÙÜÛñÑçÇ';
      const LLANOS = 'aaaaaAAAAAeeeeEEEEiiiiIIIIoooooOOOOOuuuuUUUUnNcC';
      const compactar = (s) => {
        let r = '';
        for (const c of String(s || '')) {
          const i = ACENTOS.indexOf(c);
          r += i >= 0 ? LLANOS[i] : c;
        }
        return r.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, '');
      };
      datosPerfil.huella = `${compactar(g.perfil.nombre)}|${compactar(g.perfil.empresa)}`;
      const perfilId = nuevo('perfil', datosPerfil);
      perfiles[g.perfil.nombre] = perfilId;

      const datosLead = Object.assign({}, g.lead, {
        perfil: perfilId,
        cuenta: cuentas[g.lead.cuenta],
        etiquetas: (g.lead.etiquetas || []).map((e) => etiquetas[e]).filter(Boolean),
        // Sin asignar = del pool, lo ven todos los administradores (D07).
        asignado: g.lead.asignado ? usuarios[g.lead.asignado] : '',
      });
      nuevo('lead', datosLead);
    }

    // D27: el mismo perfil trabajado por una segunda cuenta. Un perfil, dos leads.
    nuevo('lead', {
      perfil: perfiles['Wellington Abner Simoes'],
      cuenta: cuentas['DL'],
      etapa: 'R0',
      situacion: 'descartado',
      motivo_descarte: 'Ya lo trabaja AL',
      lista: 'Sales Navigator · Construccion BR',
      pagina_origen: 14,
      f_invitacion: '2026-07-03 10:40:00.000Z',
      etiquetas: [],
    });

    // ---------- envios ----------
    // Historial minimo para que la analitica tenga de donde leer.
    const leadDe = (nombre) =>
      app.findFirstRecordByFilter('lead', `perfil.nombre = {:n}`, { n: nombre }).id;

    const envios = [
      ['Alexandre Jordao', 'R1', '2026-08-12 10:14:00.000Z', 'linkedin', 'pt'],
      ['Alexandre Jordao', 'R2', '2026-08-13 09:02:00.000Z', 'linkedin', 'pt'],
      ['Alexandre Jordao', 'R3', '2026-08-18 10:20:00.000Z', 'whatsapp', 'pt'],
      ['Wellington Abner Simoes', 'R1', '2026-08-21 09:30:00.000Z', 'linkedin', 'pt'],
      ['Wellington Abner Simoes', 'R2', '2026-09-02 11:40:00.000Z', 'whatsapp', 'pt'],
      ['Herik Pires', 'R1', '2026-07-04 08:50:00.000Z', 'linkedin', 'pt'],
      // Contestó ella a los diez minutos de aceptar: el R1 salió DESPUÉS de la
      // respuesta, y por eso la ficha no le atribuye ningún paso.
      [
        'Maria de los Angeles Fernandez Villagran de Goncalves Sobrinho - Directora de Operaciones y Cadena de Suministro LATAM',
        'R1',
        '2026-09-01 09:40:00.000Z',
        'linkedin',
        'es',
      ],
      // El referido escribió primero; lo único nuestro es la respuesta.
      ['Gonzalo Adrian Nunez', 'R4', '2026-08-28 19:35:00.000Z', 'whatsapp', 'es'],
      ['Lucia Goncalves', 'R1', '2026-08-10 10:00:00.000Z', 'linkedin', 'es'],
      ['Lucia Goncalves', 'R2', '2026-08-19 10:00:00.000Z', 'linkedin', 'es'],
    ];
    for (const [nombre, paso, fecha, canal, idioma] of envios) {
      nuevo('envio', {
        lead: leadDe(nombre),
        paso,
        enviado_en: fecha,
        canal,
        idioma,
        a_mano: true,
        texto: `[demo] Texto enviado en ${paso}`,
      });
    }
  },

  (app) => {
    for (const col of ['envio', 'lead', 'perfil', 'cuenta', 'etiqueta', 'configuracion']) {
      for (const r of app.findAllRecords(col)) app.delete(r);
    }
    for (const r of app.findAllRecords('users')) {
      if (String(r.get('email')).endsWith('@globalita.test')) app.delete(r);
    }
  },
);
