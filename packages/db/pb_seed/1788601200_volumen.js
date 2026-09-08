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

    // Cuantos dias lleva corriendo la semana. Hace falta para poder meter
    // invitaciones DENTRO de la semana en curso: un martes son dos dias, y si
    // se reparte a ciegas casi todo cae en la semana anterior.
    const dow = new Date(Date.parse(HOY)).getUTCDay(); // 0 = domingo
    const desdeLunes = dow === 0 ? 6 : dow - 1;

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

      // El ciclo de la invitacion, que es lo que mide Automatizaciones (§7.3).
      //
      // Sin estas cuatro fechas el panel sale entero en cero: no hay enviadas
      // ni aceptadas de la semana, la conversion no existe y la tabla de
      // "vuelven a la cola" queda vacia. Las fechas se reparten sobre las
      // ultimas ocho semanas para que la semana en curso y la anterior tengan
      // las dos volumen — la conversion que se muestra es la de la ya cerrada.
      //
      // NO SUMAN 187/200 COMO EL PROTOTIPO, y esta bien: para eso harian falta
      // ~1.200 invitaciones en una semana y aca hay 181 leads en total. El
      // numero sale de los datos; inflarlo seria mostrar un tablero que miente.
      // El reparto NO es uniforme, y esa es la gracia. Con las fechas
      // repartidas parejo sobre ocho semanas, la semana en curso —que un
      // martes son dos dias— se queda con un lead por cuenta, la conversion de
      // la semana cerrada no tiene con que calcularse, y ninguna invitacion es
      // mas vieja que los 90 dias, asi que la columna "Cancel." sale toda en
      // cero. Cada tramo esta puesto para que se vea un caso distinto.
      const b = i % 20;
      let diasAtras;
      let esVieja = false;
      let yaCancelada = false;
      if (b < 8) {
        diasAtras = i % (desdeLunes + 1); // 40% esta semana: da volumen a "Enviadas"
      } else if (b < 13) {
        diasAtras = desdeLunes + 1 + (i % 7); // 25% la semana cerrada: da la conversion
      } else if (b < 17) {
        diasAtras = desdeLunes + 8 + ((i * 3) % 40); // 20% mas atras
      } else if (b < 19) {
        diasAtras = 100 + ((i * 7) % 60); // 10% ya canceladas: vuelven a la cola
        yaCancelada = true;
      } else {
        diasAtras = 95 + ((i * 11) % 70); // 5% pasadas de los 90 sin aceptar
        esVieja = true;
      }
      lead.set('f_invitacion', mover(-diasAtras));

      // ~60% acepta, entre 1 y 9 dias despues. Las viejas y las canceladas no:
      // son justamente las que nadie acepto.
      const acepta = !esVieja && !yaCancelada && i % 5 !== 0 && i % 7 !== 0;
      if (acepta) lead.set('f_aceptacion', mover(-diasAtras + 1 + (i % 9)));

      // Los envios de la cadencia hasta la etapa donde esta parado.
      //
      // SIN ESTO la tabla "Rendimiento por R" sale entera en cero: mide envios
      // reales, y la base de demo no tenia ninguno. Un lead parado en R4 tuvo
      // que pasar por R1, R2 y R3 — inventar la etapa sin los envios que la
      // explican deja la etapa contando una historia que no ocurrio.
      const etapaIdx = i % ETAPAS.length; // R0 = 0, R1 = 1, ...
      const enviosDelLead = [];
      if (acepta) {
        for (let k = 1; k <= etapaIdx; k++) {
          const cuando = -diasAtras + 1 + (i % 9) + k * 3;
          if (cuando > 0) break; // no se manda en el futuro
          enviosDelLead.push([`R${k}`, mover(cuando)]);
        }
      }

      // ~25% de los que aceptaron contesta, y contesta DESPUES de un envio
      // concreto: asi la respuesta se le atribuye al paso que la provoco y no
      // a un promedio. El desfase reparte las respuestas entre los dias de la
      // semana; si no, "cuando responden" sale como una sola barra al 100%.
      if (acepta && i % 4 === 0 && enviosDelLead.length) {
        const cual = enviosDelLead[i % enviosDelLead.length];
        lead.set('f_respuesta', mover(Math.min(0, Math.round((Date.parse(cual[1]) - Date.parse(HOY)) / DIA) + 1 + (i % 5))));
      }

      // Las ya canceladas vuelven como Recontacto cuando cumplen la espera de
      // 60 dias. La fecha esta elegida para que el +60 caiga en los tres tramos
      // que la tabla distingue: hoy, esta semana y la proxima.
      if (yaCancelada) {
        lead.set('f_cancelada', mover(-60 + (i % 3) * 5));
        lead.set('situacion', 'agotado');
      }

      app.save(lead);

      for (const [paso, cuando] of enviosDelLead) {
        const e = new Record(app.findCollectionByNameOrId('envio'));
        e.set('lead', lead.id);
        e.set('paso', paso);
        e.set('enviado_en', cuando);
        // R4 y R8 van por WhatsApp cuando hay telefono (config de cadencia).
        e.set('canal', (paso === 'R4' || paso === 'R8') && tieneTel ? 'whatsapp' : 'linkedin');
        e.set('idioma', lugar[0] === 'Brasil' ? 'pt' : 'es');
        e.set('texto', `Mensaje ${paso} de demo.`);
        e.set('a_mano', true); // D15: hoy los R se mandan a mano
        app.save(e);
      }
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
