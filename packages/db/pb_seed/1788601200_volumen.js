/// <reference path="../../../.pb/pb_data/types.d.ts" />

// Relleno para que la pantalla se vea como se va a ver de verdad.
//
// PARA QUE. Con 21 leads no se puede juzgar el diseño de la columna 1: no se
// nota el scroll, ningún día llega al 60% del tope —así que el calendario de
// proximo contacto sale todo verde— y el buscador siempre devuelve todo. La
// base real tiene 6.165 contactos y el manual habla de 1.500+ leads activos.
//
// Son 160, no 6.000, a proposito: alcanza para que la lista scrollee, para que
// haya dias en ambar y en rojo, y para que los filtros de pais y ciudad tengan
// varias opciones. Medir el volumen de verdad es otra cosa y va aparte.
//
// SE BORRA FACIL. Es un archivo suelto: sacarlo y correr
//   node packages/db/dev.mjs --reset --seed
// deja el CRM con los datos del prototipo nada mas.

migrate(
  (app) => {
    const DIA = 86400000;
    // Hoy en la zona del SERVIDOR, no en UTC.
    //
    // Con toISOString() a las 18:00 en Mexico ya es el dia siguiente, y los datos
    // de demo quedan corridos un dia respecto de lo que la pantalla considera hoy:
    // el pico de carga caia en +8 cuando el atajo de "1 semana" apuntaba a +7, y
    // asi el corrimiento no se veia nunca.
    const ahora = new Date();
    const HOY = ahora.getFullYear() + '-' + String(ahora.getMonth() + 1).padStart(2, '0') + '-' + String(ahora.getDate()).padStart(2, '0');
    const mover = (dias) => new Date(Date.parse(HOY) + dias * DIA).toISOString().slice(0, 10);

    const NOMBRES = [
      'Adriana', 'Bruno', 'Carla', 'Diego', 'Elena', 'Fabio', 'Gabriela', 'Hernan',
      'Ines', 'Joaquin', 'Karina', 'Leandro', 'Marisa', 'Nicolas', 'Olga', 'Pablo',
      'Rocio', 'Sergio', 'Tamara', 'Ulises', 'Valeria', 'Walter', 'Ximena', 'Yamil',
    ];
    const APELLIDOS = [
      'Alvarez', 'Bonetto', 'Cabrera', 'Duarte', 'Espinoza', 'Ferreira', 'Gimenez',
      'Herrera', 'Ibarra', 'Juarez', 'Klein', 'Ledesma', 'Moreira', 'Navarro',
      'Ortega', 'Paz', 'Quiroga', 'Ramos', 'Sosa', 'Toledo',
    ];
    const EMPRESAS = [
      'Aceros Patagonia', 'Bombas del Sur', 'Cementos Andinos', 'Delta Plasticos',
      'Envases Litoral', 'Ferreteria Industrial', 'Grupo Maderero', 'Hidraulica Norte',
      'Industrias Vega', 'Juntas y Sellos', 'Laminados SA', 'Maquinarias Rio',
    ];
    const LUGARES = [
      ['Argentina', 'Rosario'], ['Argentina', 'Cordoba'], ['Argentina', 'Mendoza'],
      ['Brasil', 'Curitiba'], ['Brasil', 'Porto Alegre'], ['Brasil', 'Salvador'],
      ['Mexico', 'Guadalajara'], ['Mexico', 'Puebla'],
      ['Chile', 'Concepcion'], ['Uruguay', 'Salto'], ['Peru', 'Arequipa'],
      ['Colombia', 'Cali'], ['Paraguay', 'Encarnacion'],
    ];
    const CARGOS = [
      'Jefe de Compras', 'Gerente de Planta', 'Director Industrial', 'Supervisor',
      'Jefe de Mantenimiento', 'Gerente de Operaciones', 'Comprador', '',
    ];
    const INDUSTRIAS = [
      'Metalurgia', 'Alimentos', 'Automotriz', 'Plasticos', 'Quimica',
      'Construccion', 'Textil', 'Logistica',
    ];
    const ETAPAS = ['R0', 'R1', 'R2', 'R3', 'R4', 'R5', 'R6', 'R7', 'R8'];
    const SITUACIONES = ['en_curso', 'contesto', 'pausado', 'agotado'];

    const cuentas = [];
    for (const c of app.findAllRecords('cuenta')) cuentas.push(c.id);
    if (!cuentas.length) return;

    const usuarios = [];
    for (const u of app.findAllRecords('users')) {
      if (String(u.get('rol')) !== 'observador') usuarios.push(u.id);
    }

    const etiquetas = [];
    for (const e of app.findAllRecords('etiqueta')) {
      if (!e.get('del_sistema')) etiquetas.push(e.id);
    }

    // El reparto por dia esta armado a mano y no con aritmetica modular, para
    // que el calendario muestre los TRES colores con seguridad. Con un sesgo
    // aproximado quedaba un solo dia en ambar y ninguno en rojo, y asi el
    // atajo de 1 semana nunca mostraba el corrimiento — que es justamente la
    // regla que hay que poder ver funcionando.
    //
    //   dia +7   -> 45 leads, pasa el tope de 40: ROJO, y el atajo "1 semana"
    //               tiene que correrse solo hasta el primer dia con lugar.
    //   dia +14  -> 30 leads, entre el 60% y el tope: AMBAR.
    //   el resto -> repartido entre los 10 dias pasados y los 35 futuros.
    const EN_ROJO = 45;
    const EN_AMBAR = 30;
    const diaDe = (i) => {
      if (i < EN_ROJO) return mover(7);
      if (i < EN_ROJO + EN_AMBAR) return mover(14);
      return mover(((i - EN_ROJO - EN_AMBAR) % 45) - 10);
    };

    const CUANTOS = 160;
    for (let i = 0; i < CUANTOS; i++) {
      const nombre = `${NOMBRES[i % NOMBRES.length]} ${APELLIDOS[(i * 7) % APELLIDOS.length]}`;
      const empresa = EMPRESAS[(i * 3) % EMPRESAS.length];
      const lugar = LUGARES[(i * 5) % LUGARES.length];
      const tieneTel = i % 8 !== 0; // ~12% sin telefono, como la base real
      const tel = tieneTel ? `549341555${String(1000 + i).slice(-4)}` : '';

      const perfil = new Record(app.findCollectionByNameOrId('perfil'));
      perfil.set('nombre', `${nombre} (demo ${i + 1})`);
      perfil.set('cargo', CARGOS[(i * 3) % CARGOS.length]);
      perfil.set('empresa', empresa);
      perfil.set('pais', lugar[0]);
      perfil.set('ciudad', lugar[1]);
      perfil.set('industria', INDUSTRIAS[(i * 5) % INDUSTRIAS.length]);
      perfil.set('telefono', tel);
      perfil.set('telefono_raw', tel);
      perfil.set('telefono_valido', tieneTel);
      perfil.set('slug', `demo-${i + 1}-${APELLIDOS[(i * 7) % APELLIDOS.length].toLowerCase()}`);
      app.save(perfil);

      const lead = new Record(app.findCollectionByNameOrId('lead'));
      lead.set('perfil', perfil.id);
      lead.set('cuenta', cuentas[i % cuentas.length]);
      lead.set('asignado', usuarios.length ? usuarios[i % usuarios.length] : '');
      lead.set('nivel_asignacion', 'seguimiento');
      lead.set('etapa', ETAPAS[i % ETAPAS.length]);
      lead.set('situacion', SITUACIONES[i % SITUACIONES.length]);
      lead.set('proximo_contacto', diaDe(i));
      lead.set('lista', 'Relleno de demo');
      lead.set('etiquetas', etiquetas.length ? [etiquetas[i % etiquetas.length]] : []);
      lead.set('sin_leer_li', i % 11 === 0);
      lead.set('f_ultimo_contacto', mover(-((i % 30) + 1)));
      app.save(lead);
    }
  },

  (app) => {
    for (const l of app.findAllRecords('lead')) {
      if (String(l.get('lista')) !== 'Relleno de demo') continue;
      const perfil = l.get('perfil');
      app.delete(l);
      try {
        app.delete(app.findRecordById('perfil', perfil));
      } catch (_) {
        // Si le quedaba otro lead, el borrado en cascada ya se ocupo.
      }
    }
  },
);
