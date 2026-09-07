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
    const slots = [
      ['AL', 'Alberto Cordoba', 'activa', 'activa'],
      ['DL', 'Diego Lamas', 'activa', 'activa'],
      ['FR', 'Franco Ruiz', 'activa', 'activa'],
      ['ED', 'Elena Duarte', 'activa', 'activa'],
      ['AU', 'Augusto Unzaga', 'activa', 'activa'],
      ['AMU', 'A. M. Unzaga', 'activa', 'caida'],
    ];
    slots.forEach(([abrev, nombre_perfil, estado_sesion, sesion_wa], i) => {
      cuentas[abrev] = nuevo('cuenta', {
        abrev,
        nombre_perfil,
        slot: i + 1,
        estado_sesion,
        sesion_wa,
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
          slug: 'alexandre-jordao-9f21', nombre: 'Alexandre Jordao',
          cargo: 'Gerente de Manutencao', empresa: 'Metalurgica Jordao',
          industria: 'Metalurgia', pais: 'Brasil', ciudad: 'Sao Paulo',
          telefono: '5511987654321', telefono_raw: '5511987654321', telefono_valido: true,
        },
        lead: {
          cuenta: 'DL', etapa: 'R3', situacion: 'contesto', asignado: 'sofia',
          lista: 'Sales Navigator - Gerentes SP', pagina_origen: 3, nota_r0: true,
          proximo_contacto: '2026-09-08',
          f_invitacion: '2026-05-12', f_aceptacion: '2026-05-20', f_respuesta: '2026-05-20',
          f_ultimo_contacto: '2026-08-14',
          etiquetas: ['Tibio', 'Contacto', 'Compras SP'],
        },
      },
      {
        // El mas avanzado: con reunion agendada (la coleccion reunion llega en la etapa 3).
        perfil: {
          slug: 'wellington-abner-simoes-4a2b91', nombre: 'Wellington Abner Simoes',
          cargo: 'Diretor Industrial', empresa: 'GlobalTec',
          industria: 'Alimentos', pais: 'Brasil', ciudad: 'Campinas',
          telefono: '5519998877665', telefono_raw: '5519998877665', telefono_valido: true,
        },
        lead: {
          cuenta: 'AL', etapa: 'R2', situacion: 'contesto',
          lista: 'Sales Navigator - Diretores industriais', pagina_origen: 1, nota_r0: true,
          proximo_contacto: '2026-09-09',
          f_invitacion: '2026-07-01', f_aceptacion: '2026-07-02', f_respuesta: '2026-07-02',
          f_ultimo_contacto: '2026-08-28',
          etiquetas: ['Caliente', 'Decisor'],
        },
      },
      {
        // Acepto y nunca respondio: agoto la cadencia entera.
        perfil: {
          urn: 'ACwAAAB7x2sBb', nombre: 'Herik Pires',
          cargo: 'Coordenador de Suprimentos', empresa: 'Braskem',
          industria: 'Quimica', pais: 'Brasil', ciudad: 'Salvador',
        },
        lead: {
          cuenta: 'FR', etapa: 'R8', situacion: 'agotado',
          lista: 'Sales Navigator - Suprimentos BA', pagina_origen: 7, nota_r0: false,
          proximo_contacto: null,
          f_invitacion: '2025-06-10', f_aceptacion: '2025-06-18',
          f_ultimo_contacto: '2026-08-02',
          etiquetas: ['Frio', 'Fase 2', 'Recordatorio'],
        },
      },
      {
        // Nombre deliberadamente larguisimo, para probar el truncado en la vista.
        perfil: {
          slug: 'maria-de-los-angeles-fernandez-villagran',
          nombre: 'Maria de los Angeles Fernandez Villagran de Echeverria - Gerente de Compras y Abastecimiento',
          cargo: 'Gerente de Compras', empresa: 'Industrias del Norte',
          industria: 'Manufactura', pais: 'Mexico', ciudad: 'Monterrey',
          telefono: '528112345678', telefono_raw: '528112345678', telefono_valido: true,
        },
        lead: {
          cuenta: 'ED', etapa: 'R1', situacion: 'contesto', asignado: 'sofia',
          lista: 'Sales Navigator - Compras MX', pagina_origen: 2, nota_r0: true,
          proximo_contacto: '2026-09-05',
          f_invitacion: '2026-08-20', f_aceptacion: '2026-08-21', f_respuesta: '2026-08-22',
          f_ultimo_contacto: '2026-08-21',
          sin_leer_li: true,
          etiquetas: ['Caliente', 'Decisor', 'MX Norte'],
        },
      },
      {
        // Referido que llego por WhatsApp: nunca hubo invitacion, no tiene pagina_origen (D26).
        perfil: {
          nombre: 'Gonzalo Adrian Nunez', cargo: 'Jefe de Planta',
          empresa: 'Aceros del Plata', industria: 'Siderurgia',
          pais: 'Argentina', ciudad: 'Rosario',
          telefono: '5493411234567', telefono_raw: '5493411234567', telefono_valido: true,
        },
        lead: {
          cuenta: 'AU', etapa: 'R4', situacion: 'contesto',
          lista: 'Referido - WhatsApp directo', nota_r0: false,
          proximo_contacto: '2026-09-11',
          f_respuesta: '2026-06-30', f_ultimo_contacto: '2026-08-30',
          etiquetas: ['Caliente', 'Contacto'],
        },
      },
      {
        // Respondio tarde y no asistio a la reunion. Vencido: le toca hoy.
        perfil: {
          slug: 'lucia-goncalves-3d77', nombre: 'Lucia Goncalves',
          cargo: 'Compradora Senior', empresa: 'Vale S.A.',
          industria: 'Mineria', pais: 'Brasil', ciudad: 'Belo Horizonte',
          telefono: '5531988776655', telefono_raw: '5531988776655', telefono_valido: true,
        },
        lead: {
          cuenta: 'AMU', etapa: 'R5', situacion: 'en_curso',
          lista: 'Sales Navigator - Mineria MG', pagina_origen: 5, nota_r0: false,
          proximo_contacto: '2026-09-01',
          f_invitacion: '2025-11-03', f_aceptacion: '2025-11-25', f_respuesta: '2026-01-14',
          f_ultimo_contacto: '2026-08-17',
          sin_leer_wa: true,
          etiquetas: ['Tibio', 'Reagendar', 'Recordatorio'],
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
          f_invitacion: '2026-05-01', f_cancelada: '2026-07-30',
          proximo_contacto: '2026-09-28',
          etiquetas: [],
        },
      },
    ];

    const perfiles = {};
    for (const g of gente_demo) {
      const datosPerfil = Object.assign({ slug: '', urn: '' }, g.perfil);
      // La huella se calcula igual que en packages/core/src/dedupe.ts (D02).
      const compactar = (s) =>
        (s || '')
          .normalize('NFD')
          .replace(/\p{M}/gu, '')
          .toLowerCase()
          .replace(/[^a-z0-9\s]/g, ' ')
          .replace(/\s+/g, '');
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
      lista: 'Sales Navigator - Diretores industriais',
      pagina_origen: 1,
      f_invitacion: '2026-07-03',
      etiquetas: [],
    });

    // ---------- envios ----------
    // Historial minimo para que la analitica tenga de donde leer.
    const leadDe = (nombre) =>
      app.findFirstRecordByFilter('lead', `perfil.nombre = {:n}`, { n: nombre }).id;

    const envios = [
      ['Alexandre Jordao', 'R1', '2026-05-21', 'linkedin', 'pt'],
      ['Alexandre Jordao', 'R2', '2026-06-08', 'linkedin', 'pt'],
      ['Alexandre Jordao', 'R3', '2026-08-14', 'linkedin', 'pt'],
      ['Wellington Abner Simoes', 'R1', '2026-07-03', 'linkedin', 'pt'],
      ['Wellington Abner Simoes', 'R2', '2026-08-28', 'linkedin', 'pt'],
      ['Lucia Goncalves', 'R4', '2026-05-19', 'whatsapp', 'pt'],
      ['Lucia Goncalves', 'R5', '2026-08-17', 'linkedin', 'pt'],
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
