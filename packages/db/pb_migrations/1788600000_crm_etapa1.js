/// <reference path="../../../.pb/pb_data/types.d.ts" />

// Etapa 1 del CRM: perfil, lead, cuenta, etiqueta, envio, configuracion.
//
// Modelo decidido en §14 del manual:
//   D01  perfil (identidad, una fila por persona) + lead (trabajo, una por cuenta)
//   D02  slug y urn como claves unicas nullable; huella solo sugiere duplicados
//   D16  la plantilla se ata al paso por campo, no por el nombre
//   D17  dos ejes: etapa (donde esta) y situacion (que hacer con el)
//   D19  el chat personal pertenece a la cuenta que lo recibio
//   D33  descartar, no borrar; no_contactar vive en el perfil
//
// Las reglas de acceso quedan en "usuario autenticado". El filtrado fino por
// permisos (verTodosLeads y companiaa) vive en la capa de API, segun D34.

migrate(
  (app) => {
    // ---------- helpers ----------
    const id = () => ({
      name: 'id',
      type: 'text',
      system: true,
      primaryKey: true,
      required: true,
      min: 15,
      max: 15,
      pattern: '^[a-z0-9]+$',
      autogeneratePattern: '[a-z0-9]{15}',
    });
    const txt = (name, extra) => Object.assign({ name, type: 'text', max: 0, min: 0 }, extra);
    const num = (name, extra) => Object.assign({ name, type: 'number' }, extra);
    const bool = (name) => ({ name, type: 'bool' });
    const fecha = (name) => ({ name, type: 'date' });
    const sel = (name, values, extra) =>
      Object.assign({ name, type: 'select', maxSelect: 1, values }, extra);
    const rel = (name, collectionId, extra) =>
      Object.assign(
        { name, type: 'relation', collectionId, cascadeDelete: false, maxSelect: 1 },
        extra,
      );
    const creado = () => ({ name: 'created', type: 'autodate', onCreate: true, onUpdate: false });
    const editado = () => ({ name: 'updated', type: 'autodate', onCreate: true, onUpdate: true });

    const AUTH = '@request.auth.id != ""';
    const reglas = {
      listRule: AUTH,
      viewRule: AUTH,
      createRule: AUTH,
      updateRule: AUTH,
      deleteRule: AUTH,
    };

    // ---------- cuenta ----------
    // Perfil de LinkedIn desde el que se invita. 10 slots fijos (§3.3 del manual).
    app.save(
      new Collection(
        Object.assign(
          {
            type: 'base',
            name: 'cuenta',
            fields: [
              id(),
              txt('abrev', { required: true, max: 3 }),
              txt('nombre_perfil'),
              num('slot', { min: 1, max: 10, onlyInt: true }),
              sel('estado_sesion', ['activa', 'caida', 'sin_vincular']),
              sel('sesion_wa', ['activa', 'caida', 'sin_vincular']),
              num('cupo_diario', { onlyInt: true }),
              num('objetivo_semanal', { onlyInt: true }),
              creado(),
              editado(),
            ],
            indexes: [
              'CREATE UNIQUE INDEX idx_cuenta_abrev ON cuenta (abrev)',
              'CREATE UNIQUE INDEX idx_cuenta_slot ON cuenta (slot)',
            ],
          },
          reglas,
        ),
      ),
    );

    // ---------- etiqueta ----------
    app.save(
      new Collection(
        Object.assign(
          {
            type: 'base',
            name: 'etiqueta',
            fields: [id(), txt('nombre', { required: true }), bool('del_sistema'), creado(), editado()],
            indexes: ['CREATE UNIQUE INDEX idx_etiqueta_nombre ON etiqueta (nombre)'],
          },
          reglas,
        ),
      ),
    );

    // ---------- perfil ----------
    // La persona. Una fila por ser humano, compartida por las 10 cuentas (D01).
    app.save(
      new Collection(
        Object.assign(
          {
            type: 'base',
            name: 'perfil',
            fields: [
              id(),
              // Identificadores (D02). Los dos primeros son unicos pero pueden faltar.
              txt('slug'),
              txt('urn'),
              txt('huella'),
              // Identidad
              txt('nombre', { required: true }),
              txt('cargo'),
              txt('empresa'),
              txt('web'),
              txt('industria'),
              txt('pais'),
              txt('ciudad'),
              txt('resumen'),
              { name: 'foto', type: 'file', maxSelect: 1, maxSize: 5242880 },
              // Telefono: identidad de la persona, no de la relacion (D08/D29).
              // Un WhatsApp entrante se busca UNA vez aca, no por cada lead.
              txt('telefono'),
              txt('telefono_raw'),
              bool('telefono_valido'),
              // Freno global: ninguna cuenta lo contacta nunca mas (D33).
              bool('no_contactar'),
              txt('no_contactar_motivo'),
              // Marca de posible duplicado sin fusionar (D02).
              { name: 'posible_duplicado_de', type: 'json', maxSize: 2000 },
              creado(),
              editado(),
            ],
            indexes: [
              "CREATE UNIQUE INDEX idx_perfil_slug ON perfil (slug) WHERE slug != ''",
              "CREATE UNIQUE INDEX idx_perfil_urn ON perfil (urn) WHERE urn != ''",
              'CREATE INDEX idx_perfil_huella ON perfil (huella)',
              // NO unico: dos perfiles pueden compartir un telefono por error de
              // carga (linea de recepcion, celular compartido). Sugiere, no fusiona.
              "CREATE INDEX idx_perfil_telefono ON perfil (telefono) WHERE telefono != ''",
            ],
          },
          reglas,
        ),
      ),
    );

    // ---------- lead ----------
    // La relacion de trabajo entre una cuenta y un perfil. Una fila por par (D01).
    const perfilId = app.findCollectionByNameOrId('perfil').id;
    const cuentaId = app.findCollectionByNameOrId('cuenta').id;
    const etiquetaId = app.findCollectionByNameOrId('etiqueta').id;
    const usersId = app.findCollectionByNameOrId('users').id;

    app.save(
      new Collection(
        Object.assign(
          {
            type: 'base',
            name: 'lead',
            fields: [
              id(),
              rel('perfil', perfilId, { required: true, cascadeDelete: true }),
              rel('cuenta', cuentaId, { required: true }),
              rel('asignado', usersId),
              // Los dos ejes de D17.
              sel('etapa', ['R0', 'R0-recontacto', 'R1', 'R2', 'R3', 'R4', 'R5', 'R6', 'R7', 'R8']),
              sel('situacion', [
                'en_curso',
                'contesto',
                'pausado',
                'agotado',
                'esperando_recontacto',
                'descartado',
              ]),
              txt('motivo_descarte'),
              fecha('proximo_contacto'),
              // Origen
              txt('lista'),
              num('pagina_origen', { onlyInt: true }),
              bool('nota_r0'),
              // Contacto propio de esta relacion. El telefono vive en perfil (D08/D29):
              // es identidad de la persona, no de esta cuenta.
              txt('email'),
              txt('email2'),
              txt('email3'),
              txt('link_chat'),
              // Estado de bandeja, uno por canal (D05 propuesto)
              bool('sin_leer_li'),
              bool('sin_leer_wa'),
              rel('etiquetas', etiquetaId, { maxSelect: 30 }),
              { name: 'nota', type: 'editor' },
              // Fechas medidas. Se guardan crudas; los "8 h" se calculan al leer (§3.2).
              { name: 'f_invitacion', type: 'date' },
              { name: 'f_aceptacion', type: 'date' },
              { name: 'f_respuesta', type: 'date' },
              { name: 'f_ultimo_contacto', type: 'date' },
              { name: 'f_cancelada', type: 'date' },
              creado(),
              editado(),
            ],
            indexes: [
              'CREATE UNIQUE INDEX idx_lead_perfil_cuenta ON lead (perfil, cuenta)',
              'CREATE INDEX idx_lead_trabajo ON lead (situacion, proximo_contacto)',
              'CREATE INDEX idx_lead_asignado ON lead (asignado)',
              'CREATE INDEX idx_lead_cuenta ON lead (cuenta)',
            ],
          },
          reglas,
        ),
      ),
    );

    // ---------- envio ----------
    // historial_envios de §3.2: la base de toda la analitica.
    const leadId = app.findCollectionByNameOrId('lead').id;
    app.save(
      new Collection(
        Object.assign(
          {
            type: 'base',
            name: 'envio',
            fields: [
              id(),
              rel('lead', leadId, { required: true, cascadeDelete: true }),
              sel('paso', [
                'R0',
                'R0-recontacto',
                'R1',
                'R2',
                'R3',
                'R4',
                'R5',
                'R6',
                'R7',
                'R8',
                'agradecimiento',
              ]),
              { name: 'enviado_en', type: 'date', required: true },
              sel('canal', ['linkedin', 'whatsapp']),
              txt('plantilla'),
              sel('idioma', ['es', 'pt', 'en']),
              { name: 'texto', type: 'text', max: 0, min: 0 },
              bool('a_mano'),
              creado(),
            ],
            indexes: [
              'CREATE INDEX idx_envio_lead ON envio (lead, enviado_en)',
              'CREATE INDEX idx_envio_analitica ON envio (paso, enviado_en)',
            ],
          },
          reglas,
        ),
      ),
    );

    // ---------- configuracion ----------
    // Esperas de la cadencia, cupos, dias de cancelacion, zona horaria.
    // Regla 2 del CLAUDE.md: configuracion, nunca constantes.
    app.save(
      new Collection(
        Object.assign(
          {
            type: 'base',
            name: 'configuracion',
            fields: [
              id(),
              txt('clave', { required: true }),
              { name: 'valor', type: 'json', maxSize: 200000 },
              txt('descripcion'),
              editado(),
            ],
            indexes: ['CREATE UNIQUE INDEX idx_config_clave ON configuracion (clave)'],
          },
          reglas,
        ),
      ),
    );

    // ---------- users ----------
    const users = app.findCollectionByNameOrId('users');
    users.fields.add(new Field(sel('rol', ['administrador', 'colaborador'])));
    users.fields.add(new Field(sel('estado', ['activo', 'pendiente', 'suspendido'])));
    users.fields.add(new Field({ name: 'permisos', type: 'json', maxSize: 5000 }));
    users.fields.add(new Field(sel('metodo_invitacion', ['link', 'clave_temporal'])));
    users.fields.add(new Field({ name: 'invitado_en', type: 'date' }));
    users.fields.add(new Field({ name: 'ultimo_acceso', type: 'date' }));
    app.save(users);
  },

  (app) => {
    for (const nombre of ['envio', 'lead', 'perfil', 'etiqueta', 'cuenta', 'configuracion']) {
      try {
        app.delete(app.findCollectionByNameOrId(nombre));
      } catch (e) {
        // ya no existe
      }
    }
    const users = app.findCollectionByNameOrId('users');
    for (const campo of ['rol', 'estado', 'permisos', 'metodo_invitacion', 'invitado_en', 'ultimo_acceso']) {
      users.fields.removeByName(campo);
    }
    app.save(users);
  },
);
