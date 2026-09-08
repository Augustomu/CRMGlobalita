/// <reference path="../../../.pb/pb_data/types.d.ts" />

// El resto del modelo: reunion, lista, tarea, proyecto, actividad,
// chat_personal y entrante.
//
// Decisiones que se cierran aca, con las recomendaciones que ya estaban
// escritas en §14 del manual:
//
//   D10  la reunion guarda google_event_id + google_calendar_id + etag, asi
//        reagendar ACTUALIZA el evento en vez de crear uno nuevo. El historico
//        del Calendar confirmo que es la via: cada evento traia su id.
//   D23  el inicio se guarda como fecha-hora CON zona, mas la zona en que se
//        agendo. Con leads en Brasil, Mexico y Argentina, sin eso la reunion se
//        agenda mal apenas el lead no esta en tu huso.
//   D18  se resuelve en la capa de consulta, no en el esquema: el nombre del
//        evento solo se manda al cliente cuando el calendario es propio.

migrate(
  (app) => {
    const id = () => ({
      name: 'id', type: 'text', system: true, primaryKey: true, required: true,
      min: 15, max: 15, pattern: '^[a-z0-9]+$', autogeneratePattern: '[a-z0-9]{15}',
    });
    const txt = (name, extra) => Object.assign({ name, type: 'text', max: 0, min: 0 }, extra);
    const num = (name, extra) => Object.assign({ name, type: 'number', onlyInt: true }, extra);
    const bool = (name) => ({ name, type: 'bool' });
    const fecha = (name) => ({ name, type: 'date' });
    const sel = (name, values) => ({ name, type: 'select', maxSelect: 1, values });
    const rel = (name, collectionId, extra) =>
      Object.assign({ name, type: 'relation', collectionId, cascadeDelete: false, maxSelect: 1 }, extra);
    const creado = () => ({ name: 'created', type: 'autodate', onCreate: true, onUpdate: false });
    const editado = () => ({ name: 'updated', type: 'autodate', onCreate: true, onUpdate: true });

    const AUTH = '@request.auth.id != ""';
    const reglas = { listRule: AUTH, viewRule: AUTH, createRule: AUTH, updateRule: AUTH, deleteRule: AUTH };

    const leadId = app.findCollectionByNameOrId('lead').id;
    const cuentaId = app.findCollectionByNameOrId('cuenta').id;
    const usersId = app.findCollectionByNameOrId('users').id;

    // ---------------------------------------------------------- reunion
    app.save(new Collection(Object.assign({
      type: 'base', name: 'reunion',
      fields: [
        id(),
        rel('lead', leadId, { required: true, cascadeDelete: true }),
        // D23: instante con zona, mas la zona en que se agendo, para poder
        // mostrar "15:00 tu hora / 14:00 la de el".
        { name: 'inicio', type: 'date', required: true },
        txt('zona'),
        num('duracion_min'),
        sel('estado', ['pendiente', 'asistio', 'no-asistio', 'cancelada', 'reagendada']),
        rel('calendario', usersId),
        txt('notas'),
        // D10: identidad del evento en Google, para actualizar en vez de duplicar.
        txt('google_event_id'),
        txt('google_calendar_id'),
        txt('etag'),
        // Una reagendada apunta a la anterior: asi queda el historial (SS3.2).
        txt('reagendada_de'),
        creado(), editado(),
      ],
      indexes: [
        'CREATE INDEX idx_reunion_lead ON reunion (lead, inicio)',
        "CREATE UNIQUE INDEX idx_reunion_gid ON reunion (google_event_id) WHERE google_event_id != ''",
      ],
    }, reglas)));

    // ---------------------------------------------------------- lista
    // Las listas de invitacion de cada cuenta (SS3.4).
    app.save(new Collection(Object.assign({
      type: 'base', name: 'lista',
      fields: [
        id(),
        txt('nombre', { required: true }),
        rel('cuenta', cuentaId, { required: true }),
        sel('fuente', ['sales_navigator', 'csv']),
        num('prioridad'),
        num('paginas_total'),
        // Dato de la automatizacion: se muestra, no se edita a mano (SS10).
        num('pagina_actual'),
        num('perfiles_por_pagina'),
        creado(), editado(),
      ],
      indexes: ['CREATE INDEX idx_lista_cuenta ON lista (cuenta, prioridad)'],
    }, reglas)));

    // ---------------------------------------------------------- tarea
    app.save(new Collection(Object.assign({
      type: 'base', name: 'tarea',
      fields: [
        id(),
        txt('nombre', { required: true }),
        txt('etiquetas'),
        num('prioridad'),
        fecha('inicio'), fecha('fin'),
        txt('notas'),
        bool('notificar'),
        bool('hecha'),
        rel('usuario', usersId),
        // Independiente del lead: no hay FK obligatoria (SS3.7).
        rel('lead', leadId),
        creado(), editado(),
      ],
      indexes: ['CREATE INDEX idx_tarea_usuario ON tarea (usuario, hecha, fin)'],
    }, reglas)));

    // ---------------------------------------------------------- proyecto
    // Anexo de Control de proyectos.
    app.save(new Collection(Object.assign({
      type: 'base', name: 'proyecto',
      fields: [
        id(),
        // Puede existir SIN lead: contactos anteriores, referidos, ferias.
        rel('lead', leadId),
        txt('nombre', { required: true }),
        txt('empresa'),
        sel('tipo', ['fabript_piv', 'parceria', 'prototipo', 'inversion']),
        sel('estado', [
          'sin_hablar', 'en_conversacion', 'propuesta_enviada', 'nuestra_pelota',
          'congelado', 'cerrado_ganado', 'cerrado_perdido',
        ]),
        txt('pais'), txt('ciudad'), txt('industria'),
        txt('rol_contacto'), txt('contacto'),
        rel('cuenta', cuentaId),
        rel('responsable', usersId),
        fecha('abierto'),
        txt('nota_lead'),
        // {fecha, texto, autor_id} y {..., hecha} para acciones.
        { name: 'notas', type: 'json', maxSize: 200000 },
        { name: 'updates', type: 'json', maxSize: 200000 },
        { name: 'acciones', type: 'json', maxSize: 200000 },
        // Para el congelado automatico a los 30 dias sin movimiento.
        fecha('ultimo_movimiento'),
        txt('motivo_cierre'),
        creado(), editado(),
      ],
      indexes: [
        'CREATE INDEX idx_proyecto_estado ON proyecto (estado, ultimo_movimiento)',
        'CREATE INDEX idx_proyecto_lead ON proyecto (lead)',
      ],
    }, reglas)));

    // ---------------------------------------------------------- actividad
    // Registro de actividad, retencion 90 dias (SS3.10).
    app.save(new Collection(Object.assign({
      type: 'base', name: 'actividad',
      fields: [
        id(),
        rel('usuario', usersId),
        sel('tipo', ['sesion', 'envio', 'edicion', 'reunion', 'permiso']),
        txt('accion'),
        rel('lead', leadId),
        sel('canal', ['linkedin', 'whatsapp']),
        creado(),
      ],
      indexes: ['CREATE INDEX idx_actividad_fecha ON actividad (created)'],
    }, reglas)));

    // ---------------------------------------------------------- chat_personal
    // D19: pertenece a la CUENTA de WhatsApp que lo recibio, no es global.
    app.save(new Collection(Object.assign({
      type: 'base', name: 'chat_personal',
      fields: [
        id(),
        rel('cuenta', cuentaId, { required: true }),
        txt('nombre'),
        txt('telefono'),
        { name: 'mensajes', type: 'json', maxSize: 500000 },
        bool('no_leido'),
        creado(), editado(),
      ],
      indexes: ['CREATE INDEX idx_chat_cuenta ON chat_personal (cuenta)'],
    }, reglas)));

    // ---------------------------------------------------------- entrante
    app.save(new Collection(Object.assign({
      type: 'base', name: 'entrante',
      fields: [
        id(),
        rel('cuenta', cuentaId, { required: true }),
        txt('telefono'),
        txt('texto'),
        { name: 'recibido_en', type: 'date' },
        // Resultado del ruteo de D08, para no recalcularlo en cada render.
        sel('ruteo', ['desconocido', 'conocido_en_esta_cuenta', 'conocido_otra_cuenta', 'ambiguo']),
        { name: 'candidatos', type: 'json', maxSize: 4000 },
        bool('resuelto'),
        creado(),
      ],
      indexes: ['CREATE INDEX idx_entrante_cuenta ON entrante (cuenta, resuelto)'],
    }, reglas)));
  },

  (app) => {
    for (const n of ['entrante', 'chat_personal', 'actividad', 'proyecto', 'tarea', 'lista', 'reunion']) {
      try { app.delete(app.findCollectionByNameOrId(n)); } catch (e) { /* ya no existe */ }
    }
  },
);
