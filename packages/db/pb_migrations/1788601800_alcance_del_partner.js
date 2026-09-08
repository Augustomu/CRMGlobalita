/// <reference path="../pb_data/types.d.ts" />

// El alcance del partner se aplica en el SERVIDOR, no al dibujar (§6.3.1, A.2).
//
// Hasta ahora todas las colecciones tenian la misma regla —"cualquiera con
// sesion"— y cada pantalla filtraba despues de recibir todo. Al partner de Seng
// le llegaban los proyectos de Globalita al navegador aunque ninguna pantalla
// se los mostrara: bastaba abrir la pestaña de red para verlos.
//
// Es el mismo agujero que la agenda, y se tapa igual: filtrando ANTES.
//
// Las tres colecciones que ve Control:
//
//   proyecto  el partner ve los de SU casa
//   reunion   las de leads de cuentas de su linea
//   lead      SOLO los que confirmaron interes en su casa — no la prospeccion
//
// Colaboradores y administradores no cambian: §3.6 dice que los leads son
// compartidos y que el administrador siempre ve todos. Lo que se acota es el
// observador, que es el rol del partner.

migrate(
  (app) => {
    const AUTH = '@request.auth.id != ""';

    // Un observador SIN linea no esta acotado: `lineasDeControl` de
    // core/permisos.ts devuelve las dos cuando `linea_control` viene vacia, y
    // la regla del servidor tiene que decir lo mismo que la del cliente.
    const NO_ACOTADO = '@request.auth.rol != "observador" || @request.auth.linea_control = ""';

    // Los dos vocabularios de lo mismo: el permiso usa `ia | inversiones`, el
    // proyecto usa `globalita | seng`. La traduccion vive en useControl.ts
    // (LINEA_DE_CASA) y tiene que repetirse aca porque una regla de PocketBase
    // no puede llamar a codigo.
    const proyectoRule = [
      AUTH,
      ' && (',
      NO_ACOTADO,
      ' || (@request.auth.linea_control = "ia" && casa = "globalita")',
      ' || (@request.auth.linea_control = "inversiones" && casa = "seng")',
      ')',
    ].join('');

    // La reunion no tiene casa propia: la hereda de la linea de negocio de la
    // cuenta del lead.
    const reunionRule = [
      AUTH,
      ' && (',
      NO_ACOTADO,
      ' || lead.cuenta.linea_negocio = @request.auth.linea_control',
      ')',
    ].join('');

    // El lead: solo los que CONFIRMARON interes, y solo en la casa del partner.
    //
    // Las tres etiquetas son las `protegida` de la migracion 1788601600, que
    // existen justamente para que esto se pueda escribir: si el nombre fuera
    // libre, cambiarlo por un typo dejaria al partner sin ver nada o viendo de
    // mas. `?=` es "alguna de la relacion multiple coincide".
    const leadRule = [
      AUTH,
      ' && (',
      NO_ACOTADO,
      ' || (@request.auth.linea_control = "ia" && (etiquetas.nombre ?= "PIV" || etiquetas.nombre ?= "Parceria"))',
      ' || (@request.auth.linea_control = "inversiones" && etiquetas.nombre ?= "Inversion")',
      ')',
    ].join('');

    const poner = (nombre, regla) => {
      const c = app.findCollectionByNameOrId(nombre);
      c.listRule = regla;
      c.viewRule = regla;
      app.save(c);
    };

    poner('proyecto', proyectoRule);
    poner('reunion', reunionRule);
    poner('lead', leadRule);

    // El perfil viaja expandido desde el lead, asi que hereda su alcance por
    // ese lado; pero pedirlo directo lo devolvia entero. El observador no tiene
    // por que leer la tabla de perfiles.
    const perfil = app.findCollectionByNameOrId('perfil');
    perfil.listRule = `${AUTH} && @request.auth.rol != "observador"`;
    perfil.viewRule = perfil.listRule;
    app.save(perfil);
  },

  (app) => {
    const AUTH = '@request.auth.id != ""';
    for (const nombre of ['proyecto', 'reunion', 'lead', 'perfil']) {
      const c = app.findCollectionByNameOrId(nombre);
      c.listRule = AUTH;
      c.viewRule = AUTH;
      app.save(c);
    }
  },
);
