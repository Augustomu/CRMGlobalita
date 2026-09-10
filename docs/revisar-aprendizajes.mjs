/**
 * Vuelve a buscar los errores que ya cometimos (docs/APRENDIZAJES.md).
 *
 * POR QUÉ EXISTE. Cinco de los errores del registro son el MISMO error
 * repetido: una regla vieja que sobrevive debajo de la nueva, un control
 * construido a mano en vez del que ya existe, un tamaño fuera de la escala.
 * Buscarlos a ojo no funcionó —el del contraste sobrevivió tres rondas— así
 * que acá están mecanizados los que se pueden mecanizar.
 *
 * No reemplaza mirar la pantalla: los que dependen de los datos reales
 * (familia F del registro) no se pueden automatizar y quedan como práctica.
 *
 *   node docs/revisar-aprendizajes.mjs
 *
 * Sale con código 1 si encuentra algo, para poder colgarlo de un hook.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const leer = (rel) => fs.readFileSync(path.join(raiz, rel), 'utf8').replace(/\r\n/g, '\n');

const hallazgos = [];
const anotar = (familia, texto) => hallazgos.push({ familia, texto });

// ---------------------------------------------------------------------------
// Herramientas
// ---------------------------------------------------------------------------

/** Saca los comentarios pero conserva los saltos, para no perder la línea. */
const sinComentarios = (css) =>
  css.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));

/** Parte una hoja en bloques `selector { ... }` de primer nivel. */
function bloquesDe(css) {
  const s = sinComentarios(css);
  const out = [];
  let i = 0;
  let linea = 1;
  while (i < s.length) {
    const abre = s.indexOf('{', i);
    if (abre < 0) break;
    linea += (s.slice(i, abre).match(/\n/g) || []).length;
    let nivel = 1;
    let j = abre + 1;
    while (j < s.length && nivel > 0) {
      if (s[j] === '{') nivel++;
      else if (s[j] === '}') nivel--;
      j++;
    }
    const sel = s.slice(i, abre).trim();
    const cuerpo = s.slice(abre + 1, j - 1);
    if (!sel.startsWith('@') && !cuerpo.includes('{')) {
      const props = new Map();
      for (const decl of cuerpo.split(';')) {
        const c = decl.indexOf(':');
        if (c < 0) continue;
        const nombre = decl.slice(0, c).trim();
        if (nombre && !nombre.startsWith('--')) props.set(nombre, decl.slice(c + 1).trim());
      }
      out.push({ sel, props, linea });
    }
    linea += (s.slice(abre, j).match(/\n/g) || []).length;
    i = j;
  }
  return out;
}

const aRgb = (hex) => {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  if (h.length !== 6) return null;
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
};

/** Luminancia relativa de WCAG. */
function luz(rgb) {
  const c = rgb.map((v) => {
    const x = v / 255;
    return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}

function contraste(a, b) {
  const la = luz(a);
  const lb = luz(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

// ---------------------------------------------------------------------------
// Los tokens, TEMA POR TEMA.
//
// Hasta el 09/09 esto leía sólo el tema claro, y con bloques sólidos alcanzaba:
// el texto era blanco y el fondo saturado en los tres temas, así que medir uno
// medía los tres. Con bloques de tinte claro dejó de alcanzar — en oscuro y en
// noche esos mismos tokens cambian de rol— y un par que da 6.51 en claro
// perfectamente puede no dar en noche. El agujero se encontró a mano; queda
// tapado acá para no depender de que alguien se acuerde.
// ---------------------------------------------------------------------------
const tokensCss = leer('apps/web/public/design-tokens.css');

/** Los tokens declarados dentro del bloque de un tema. */
function tokensDelTema(selector) {
  const re = new RegExp('(?:^|[,\\s])' + selector.replace('.', '\\.') + '\\s*\\{([^}]*)\\}', 'm');
  const m = re.exec(tokensCss);
  const mapa = new Map();
  if (!m) return mapa;
  for (const d of m[1].matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) mapa.set(d[1], d[2].trim());
  return mapa;
}

const TEMAS = ['claro', 'oscuro', 'noche'];
const porTema = new Map(TEMAS.map((t) => [t, tokensDelTema('.tema-' + t)]));
/** El claro es el de referencia: es el que se mira todo el día. */
const tokens = porTema.get('claro');
const definidos = new Set(tokens.keys());

const estilos = leer('apps/web/src/estilos.css');
// Los tokens locales que declara la propia hoja.
for (const m of sinComentarios(estilos).matchAll(/(--[\w-]+)\s*:/g)) definidos.add(m[1]);

// Y los que pone React desde un `style`, que no aparecen en ninguna hoja:
// `{'--alto-hora': ...}`. No son fantasmas: los define el componente.
function buscarEnJsx(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const completo = path.join(dir, e.name);
    if (e.isDirectory()) { buscarEnJsx(completo); continue; }
    if (!/\.(tsx?|jsx?)$/.test(e.name)) continue;
    const src = fs.readFileSync(completo, 'utf8');
    for (const m of src.matchAll(/['"](--[\w-]+)['"]\s*:/g)) definidos.add(m[1]);
  }
}
buscarEnJsx(path.join(raiz, 'apps/web/src'));

/**
 * Resuelve `var(--x)` hasta llegar a un color, o null.
 *
 * `mapa` es el tema contra el que se resuelve. Por omisión el claro, así que
 * todo lo que llamaba a esto antes sigue midiendo lo mismo.
 */
function comoColor(valor, mapa = tokens, vueltas = 0) {
  if (!valor || vueltas > 5) return null;
  const v = valor.trim();
  const hex = v.match(/^#[0-9a-fA-F]{3,8}$/);
  if (hex) return aRgb(v);
  const usa = v.match(/^var\((--[\w-]+)/);
  if (usa) return comoColor(mapa.get(usa[1]), mapa, vueltas + 1);
  return null;
}

const bloques = bloquesDe(estilos);

// ===========================================================================
// B · Texto ilegible sobre su fondo
//
// EL BUG que esto busca no estaba dentro de una regla: el fondo lo ponía
// `.agenda-evento-asistio` y el color lo ponía `.agenda-evento
// .agenda-evento-nombre`. Casi blanco sobre casi blanco, 1.1:1, en tres de los
// cuatro estados. Sobrevivió tres rondas de «arreglar el contraste».
//
// POR QUÉ ES UNA TABLA A MANO Y NO UNA BÚSQUEDA AUTOMÁTICA. Se intentó
// primero cruzar fondos y colores por familia de clases. Da 83 avisos, casi
// todos falsos: sin un DOM el script no sabe qué elemento está dentro de cuál
// ni qué regla gana por especificidad, así que no puede distinguir un bug de
// un hover legítimo. Un chequeo que grita 83 veces no lo corre nadie, y eso es
// peor que no tenerlo.
//
// Entonces se declaran las parejas que SÍ conviven en pantalla. Son las de la
// agenda, que es donde el color carga significado y donde estuvo el bug. La
// tabla se mantiene a mano: un bloque de color nuevo suma una línea acá. Si un
// selector deja de existir, el chequeo lo avisa en vez de callarse.
// ===========================================================================
const LEGIBLE = 4.5;

/** Parejas (fondo, texto) que de verdad se ven juntas. */
/*
 * 09/09/2026 · La tabla cambió con los bloques claros.
 *
 * Antes el nombre tenía su propia regla de color por estado. Ahora hereda del
 * bloque (`color: inherit`), así que el texto sale de la MISMA regla que el
 * fondo: por eso varias parejas van con `null`, que es como se le dice acá.
 *
 * Y se sumó LA HORA de cada estado, que es la que casi se escapa: iba en
 * `--hint`, y `--hint` sobre `--accent-light` da 2.91:1 y sobre `--info-light`
 * 3.35:1. Un fondo claro perdona menos que uno oscuro, y el texto secundario
 * es donde eso se paga primero.
 */
const PAREJAS = [
  ['.agenda-evento', null, 'reunión programada'],
  ['.agenda-evento-asistio', null, 'reunión que asistió'],
  ['.agenda-evento-no-asistio', null, 'reunión que no asistió'],
  ['.agenda-evento-cancelada', null, 'reunión cancelada'],
  ['.agenda-evento-vinculado', '.agenda-evento-vinculado .agenda-evento-nombre', 'evento de Google con lead'],
  ['.agenda-evento-conectable', '.agenda-evento-conectable .agenda-evento-nombre', 'evento de Google sin lead'],
  // La hora, sobre el tinte de cada estado.
  ['.agenda-evento', '.agenda-evento-hora', 'la hora de una reunión programada'],
  ['.agenda-evento-asistio', '.agenda-evento-hora', 'la hora de una reunión que asistió'],
  ['.agenda-evento-no-asistio', '.agenda-evento-hora', 'la hora de una reunión que no asistió'],
  ['.agenda-evento-cancelada', '.agenda-evento-hora', 'la hora de una reunión cancelada'],
  ['.agenda-evento-vinculado', '.agenda-evento-vinculado .agenda-evento-hora', 'la hora de un evento con lead'],
  ['.agenda-evento-conectable', '.agenda-evento-conectable .agenda-evento-hora', 'la hora de un evento sin lead'],
  ['.agenda-evento', '.agenda-evento-dura', 'la duración de una reunión'],
  ['.agenda-evento-conectar', null, 'la etiqueta «conectar»'],
  ['.agenda-evento-fallo', null, 'el aviso de que no llegó a Google'],
  ['.agenda-hover-fallo', null, 'el aviso de la tarjeta'],
  ['.ctrl-header', '.ctrl-dato', 'el resumen de Control'],
  ['.ctrl-header', '.ctrl-dato-suave', 'el dato suave del resumen'],
  ['.ctrl-chip-abierto', null, 'el chip de proyecto abierto'],
  ['.campo-dia select', '.campo-dia-vacio', 'el día y el mes sin elegir'],
  ['.agenda-cabeza-cuantas', null, 'el contador del día'],
  ['.agenda-ahora-reloj', null, 'el reloj de la línea de ahora'],
  // 10/09 · los dos carteles que dicen lo que falta, y por eso hay que leerlos.
  ['.dup-ciego', null, 'el punto ciego del detector de duplicados'],
  ['.reunion-sin-correo', '.reunion-sin-correo-texto', 'el aviso de que el lead no tiene correo'],
];

{
  /** La ÚLTIMA regla cuyo selector incluye ese selector exacto: la que gana. */
  const reglaDe = (selector) => {
    let encontrada = null;
    for (const b of bloques) {
      const partes = b.sel.split(',').map((x) => x.trim());
      if (partes.includes(selector.trim()) || b.sel.trim() === selector.trim()) encontrada = b;
    }
    return encontrada;
  };

  for (const [claseFondo, claseTexto, donde] of PAREJAS) {
    const rFondo = reglaDe(claseFondo);
    if (!rFondo) {
      anotar('B', `la tabla nombra «${claseFondo}» (${donde}) y esa regla ya no existe: hay que actualizar PAREJAS`);
      continue;
    }
    // Sin regla propia de texto, el color sale de la misma regla del bloque.
    const rTexto = claseTexto ? reglaDe(claseTexto) : rFondo;
    if (!rTexto) {
      anotar('B', `la tabla nombra «${claseTexto}» (${donde}) y esa regla ya no existe: hay que actualizar PAREJAS`);
      continue;
    }

    const crudoFondo = rFondo.props.get('background') || rFondo.props.get('background-color');
    const crudoTexto = rTexto.props.get('color');

    // LOS TRES TEMAS. El mismo par de tokens da números distintos en cada uno.
    for (const tema of TEMAS) {
      const mapa = porTema.get(tema);
      const fondo = comoColor(crudoFondo, mapa);
      const texto = comoColor(crudoTexto, mapa);
      if (!fondo || !texto) continue;

      const r = contraste(fondo, texto);
      if (r < LEGIBLE) {
        anotar(
          'B',
          `${r.toFixed(2)}:1 en ${donde}, tema ${tema} — «${claseFondo}» (línea ${rFondo.linea}) ` +
            `con el color de «${(claseTexto ?? claseFondo).split('\n')[0]}» (línea ${rTexto.linea}). ` +
            `Hace falta ${LEGIBLE}:1.`,
        );
      }
    }
  }
}

// ===========================================================================
// C · Reglas muertas: el mismo selector declarado dos veces con otro valor
// ===========================================================================
{
  const clave = (sel) => sel.split(',').map((x) => x.trim().replace(/\s+/g, ' ')).sort().join(', ');
  const porSelector = new Map();
  for (const b of bloques) {
    const k = clave(b.sel);
    if (!porSelector.has(k)) porSelector.set(k, []);
    porSelector.get(k).push(b);
  }
  for (const [k, lista] of porSelector) {
    if (lista.length < 2) continue;
    for (let a = 0; a < lista.length - 1; a++) {
      for (let c = a + 1; c < lista.length; c++) {
        const chocan = [...lista[a].props.keys()].filter(
          (p) => lista[c].props.has(p) && lista[a].props.get(p) !== lista[c].props.get(p),
        );
        for (const p of chocan) {
          anotar(
            'C',
            `«${k}» declara ${p} dos veces: línea ${lista[a].linea} (${lista[a].props.get(p)}) ` +
              `no se aplica nunca, gana la línea ${lista[c].linea} (${lista[c].props.get(p)})`,
          );
        }
      }
    }
  }
}

// ===========================================================================
// D · Fuera del sistema de diseño
// ===========================================================================
const ESCALA = new Set([9, 10, 11, 12, 13, 14, 17]);
// Sobre el texto SIN comentarios: un comentario que explica un bug de color
// tiene los hex del bug adentro, y contarlos como código es un falso aviso.
sinComentarios(estilos).split('\n').forEach((limpia, i) => {

  for (const m of limpia.matchAll(/font-size:\s*([0-9.]+)px/g)) {
    if (!ESCALA.has(Number(m[1]))) {
      anotar('D', `font-size ${m[1]}px fuera de la escala 9/10/11/12/13/14/17 (línea ${i + 1})`);
    }
  }

  if (!/box-shadow|text-shadow|drop-shadow/.test(limpia)) {
    for (const m of limpia.matchAll(/#[0-9a-fA-F]{3,8}\b/g)) {
      anotar('D', `color literal ${m[0]} fuera de los tokens (línea ${i + 1})`);
    }
    for (const m of limpia.matchAll(/\brgba?\([^)]*\)/g)) {
      if (/^rgba?\(\s*(?:0\s+0\s+0|255\s+255\s+255)\s*\//.test(m[0])) continue;
      anotar('D', `color literal ${m[0]} fuera de los tokens (línea ${i + 1})`);
    }
  }

  // Tokens fantasma: se usan y no están definidos en ningún lado.
  for (const m of limpia.matchAll(/var\((--[\w-]+)/g)) {
    if (!definidos.has(m[1])) {
      anotar('D', `${m[1]} no está definido en ningún lado (línea ${i + 1})`);
    }
  }
});

// ===========================================================================
// E · Los handlers de PocketBase corren aislados y no ven el scope del archivo
// ===========================================================================
for (const archivo of fs.readdirSync(path.join(raiz, 'packages/db/pb_hooks'))) {
  if (!archivo.endsWith('.js')) continue;
  const src = leer(path.join('packages/db/pb_hooks', archivo));
  const limpio = sinComentarios(src);

  // Lo declarado en la primera columna: eso es scope del módulo.
  const deModulo = [...limpio.matchAll(/^(?:const|let|var|function)\s+([A-Za-z_$][\w$]*)/gm)]
    .map((m) => m[1]);
  if (!deModulo.length) continue;

  // Los cuerpos de los handlers: routerAdd, cronAdd, onRecord*, onBootstrap…
  for (const m of limpio.matchAll(/\b(routerAdd|cronAdd|onRecord\w*|onModel\w*|onBootstrap|onMailer\w*)\b/g)) {
    const abre = limpio.indexOf('{', m.index);
    if (abre < 0) continue;
    let nivel = 1;
    let j = abre + 1;
    while (j < limpio.length && nivel > 0) {
      if (limpio[j] === '{') nivel++;
      else if (limpio[j] === '}') nivel--;
      j++;
    }
    const cuerpo = limpio.slice(abre, j);
    for (const nombre of deModulo) {
      // `require` adentro del handler es la forma correcta y no cuenta.
      const usa = new RegExp('(?<![.\\w$])' + nombre + '(?![\\w$])').test(cuerpo);
      const declaraAdentro = new RegExp(
        '(?:const|let|var|function)\\s+' + nombre + '\\b',
      ).test(cuerpo);
      if (usa && !declaraAdentro) {
        const linea = limpio.slice(0, m.index).split('\n').length;
        anotar(
          'E',
          `${archivo}: el handler de ${m[1]} (línea ${linea}) usa «${nombre}», declarado al nivel del archivo. ` +
            `Los handlers corren en un runtime aislado y NO ven ese scope.`,
        );
      }
    }
  }
}

// ---------------------------------------------------------------------------
// El informe
// ---------------------------------------------------------------------------
const FAMILIAS = {
  B: 'Contraste: texto que no se lee sobre su fondo',
  C: 'Reglas muertas que otra pisa más abajo',
  D: 'Fuera del sistema de diseño (escala, tokens)',
  E: 'Scope de los handlers de PocketBase',
};

if (!hallazgos.length) {
  console.log('Ninguno de los errores del registro volvió a aparecer.');
  process.exit(0);
}

console.log('VOLVIERON A APARECER ' + hallazgos.length + ':\n');
for (const [f, titulo] of Object.entries(FAMILIAS)) {
  const dela = hallazgos.filter((h) => h.familia === f);
  if (!dela.length) continue;
  console.log(f + ' · ' + titulo + '  (' + dela.length + ')');
  for (const h of dela) console.log('    ' + h.texto);
  console.log('');
}
process.exit(1);
