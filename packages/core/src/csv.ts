// Importar leads desde un CSV (§7.6).
//
// El prototipo parte cada línea por comas y con eso alcanza para la demo. Con
// archivos de verdad no: los CSV que salen de Excel traen tres cosas que ese
// atajo no aguanta, y las tres hacen que la importación falle entera o —peor—
// que entre corrida una columna sin que nadie lo note.
//
//   1. Campos entrecomillados con comas adentro: «"Kessler, S.A."».
//   2. Punto y coma como separador. Excel en español exporta con `;`.
//   3. BOM al principio. Excel escribe UTF-8 con BOM, así que el primer
//      encabezado llega como «﻿nombre» y no coincide con nada: el archivo
//      se lee entero y sale sin una sola fila válida.

/** Los códigos de país que aparecen en los archivos que ya se usaron. */
export const PAISES: Record<string, string> = {
  BR: 'Brasil',
  MX: 'México',
  MZ: 'Mozambique',
  AR: 'Argentina',
  UY: 'Uruguay',
  CL: 'Chile',
  PE: 'Perú',
  CO: 'Colombia',
  PY: 'Paraguay',
};

/**
 * Cómo se llama cada columna en los archivos reales.
 *
 * Con acento y sin acento, en español y en el inglés que salen de LinkedIn: el
 * usuario no debería tener que renombrar encabezados para que el CRM lo lea.
 */
const COLUMNAS: Record<string, string[]> = {
  nombre: ['nombre', 'name', 'nome', 'full name', 'contacto'],
  telefono: ['telefono', 'teléfono', 'phone', 'celular', 'movil', 'móvil', 'whatsapp'],
  empresa: ['empresa', 'company', 'organizacion', 'organización'],
  cargo: ['cargo', 'rol', 'puesto', 'title', 'position'],
  ciudad: ['ciudad', 'city', 'localidad'],
  pais: ['pais', 'país', 'country', 'region', 'región'],
  email: ['email', 'e-mail', 'correo', 'mail'],
  link_perfil: ['link', 'linkedin', 'perfil', 'profile url', 'url'],
};

export interface FilaCsv {
  nombre: string;
  telefono: string;
  empresa: string;
  cargo: string;
  ciudad: string;
  pais: string;
  email: string;
  link_perfil: string;
}

export interface LecturaCsv {
  filas: FilaCsv[];
  /** Filas que se leyeron pero no entran: sin nombre o sin teléfono. */
  descartadas: number;
  /** Los encabezados que el archivo trae y no se usan. Se avisan, no se pierden en silencio. */
  columnasIgnoradas: string[];
  /** Qué separador se detectó. Se muestra: si eligió mal, se nota enseguida. */
  separador: ',' | ';' | '\t';
}

/**
 * Qué separa las columnas.
 *
 * Se decide contando en la PRIMERA línea, no en todo el archivo: el encabezado
 * no tiene comas dentro de los valores, así que es la línea donde el conteo no
 * miente. Un archivo con «Apellido, Nombre» en los datos y `;` como separador
 * tendría más comas que puntos y coma si se contara todo.
 */
export function detectarSeparador(primeraLinea: string): ',' | ';' | '\t' {
  const cuantos = (c: string) => primeraLinea.split(c).length - 1;
  const tab = cuantos('\t');
  const puntoYComa = cuantos(';');
  const coma = cuantos(',');
  if (tab > puntoYComa && tab > coma) return '\t';
  return puntoYComa > coma ? ';' : ',';
}

/**
 * Parte un CSV en filas de celdas, respetando las comillas.
 *
 * Dentro de comillas, el separador y el salto de línea son texto. Dos comillas
 * seguidas son una comilla literal — es como el formato escapa las comillas, y
 * sin eso un campo como «el "mejor" precio» corta la fila al medio.
 */
export function partir(texto: string, separador: string): string[][] {
  // El BOM de Excel: si no se saca acá, se pega al primer encabezado.
  const t = texto.replace(/^﻿/, '');
  const filas: string[][] = [];
  let fila: string[] = [];
  let celda = '';
  let entreComillas = false;

  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (entreComillas) {
      if (c === '"') {
        if (t[i + 1] === '"') {
          celda += '"';
          i++;
        } else {
          entreComillas = false;
        }
      } else {
        celda += c;
      }
      continue;
    }
    if (c === '"') {
      entreComillas = true;
    } else if (c === separador) {
      fila.push(celda);
      celda = '';
    } else if (c === '\n') {
      fila.push(celda);
      filas.push(fila);
      fila = [];
      celda = '';
    } else if (c !== '\r') {
      celda += c;
    }
  }
  if (celda.length > 0 || fila.length > 0) {
    fila.push(celda);
    filas.push(fila);
  }
  return filas.filter((f) => f.some((x) => x.trim().length > 0));
}

function normalizarEncabezado(h: string): string {
  return h.trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Lee el archivo entero y devuelve las filas utilizables. */
export function leer(texto: string): LecturaCsv {
  const primeraLinea = texto.replace(/^﻿/, '').split(/\r?\n/)[0] ?? '';
  const separador = detectarSeparador(primeraLinea);
  const crudo = partir(texto, separador);
  if (!crudo.length) {
    return { filas: [], descartadas: 0, columnasIgnoradas: [], separador };
  }

  const encabezado = crudo[0].map(normalizarEncabezado);
  const indice: Partial<Record<keyof FilaCsv, number>> = {};
  const usadas = new Set<number>();
  for (const [campo, alias] of Object.entries(COLUMNAS)) {
    const i = encabezado.findIndex((h) => alias.includes(h));
    if (i >= 0) {
      indice[campo as keyof FilaCsv] = i;
      usadas.add(i);
    }
  }
  const columnasIgnoradas = encabezado.filter((h, i) => h && !usadas.has(i));

  const filas: FilaCsv[] = [];
  let descartadas = 0;
  for (const linea of crudo.slice(1)) {
    const dame = (campo: keyof FilaCsv) => {
      const i = indice[campo];
      return i === undefined ? '' : (linea[i] ?? '').trim();
    };
    const nombre = dame('nombre');
    const telefono = dame('telefono');
    // Sin nombre o sin teléfono el lead no sirve: no se puede ni identificar ni
    // contactar. Se cuentan aparte para poder decir cuántas quedaron afuera.
    if (!nombre || !telefono) {
      descartadas++;
      continue;
    }
    const paisCrudo = dame('pais');
    filas.push({
      nombre,
      telefono,
      empresa: dame('empresa'),
      cargo: dame('cargo'),
      ciudad: dame('ciudad'),
      pais: PAISES[paisCrudo.toUpperCase()] ?? paisCrudo,
      email: dame('email'),
      link_perfil: dame('link_perfil'),
    });
  }

  return { filas, descartadas, columnasIgnoradas, separador };
}

/**
 * La clave con la que se busca si un teléfono ya está en la base: los últimos
 * 8 dígitos.
 *
 * Ocho y no el número entero porque el mismo teléfono viene escrito de cinco
 * formas —con y sin país, con y sin el 9 de Argentina, con espacios, con
 * guiones— y comparar el texto no encuentra ninguna. Ocho tampoco es
 * arbitrario: es lo que mide un número local en la región sin el prefijo.
 */
export function clave(telefono: string): string {
  return String(telefono ?? '').replace(/\D/g, '').slice(-8);
}

export interface FilaImportable extends FilaCsv {
  id: string;
  /** Ya hay un lead con ese teléfono: se fusiona, no se duplica. */
  duplicado: boolean;
}

/**
 * Marca cuáles ya están en la base.
 *
 * Un duplicado NO se descarta: se fusiona. El archivo suele traer datos que la
 * ficha no tiene —el cargo, la ciudad, el mail— y tirarlo entero por tener el
 * teléfono repetido pierde justamente lo que se venía a buscar.
 */
export function marcarDuplicados(filas: FilaCsv[], telefonosExistentes: string[]): FilaImportable[] {
  const conocidos = new Set(telefonosExistentes.map(clave).filter((k) => k.length >= 6));
  return filas.map((f, i) => ({
    ...f,
    id: `imp-${i}`,
    duplicado: conocidos.has(clave(f.telefono)),
  }));
}
