// Importa la base de contactos de WhatsApp (export de Google Contacts).
//
//   node packages/db/recuperacion/importar-contactos.mjs            # simulacro
//   node packages/db/recuperacion/importar-contactos.mjs --aplicar
//
// Los contactos entran como PERFILES, no como leads: un lead es la relacion
// entre una cuenta y una persona (D01), y el CSV no dice de que cuenta salio
// cada uno. Los leads se crean despues, al cruzar con el historico del Calendar
// que si trae la cuenta de origen.

import fs from 'node:fs';
import path from 'node:path';
import { entrar, PB_URL } from './entrar.mjs';
import { normalizarTelefono, codigoDePais } from '../../core/src/telefono.ts';
import { huella } from '../../core/src/dedupe.ts';

const APLICAR = process.argv.includes('--aplicar');


/** Prefijo telefonico -> pais. El prefijo no miente; la etiqueta del nombre si. */
const POR_PREFIJO = [
  ['258', 'Mozambique'], ['598', 'Uruguay'], ['595', 'Paraguay'], ['591', 'Bolivia'],
  ['351', 'Portugal'], ['55', 'Brasil'], ['52', 'Mexico'], ['54', 'Argentina'],
  ['56', 'Chile'], ['57', 'Colombia'], ['51', 'Peru'], ['34', 'Espana'],
  ['31', 'Paises Bajos'], ['61', 'Australia'], ['1', 'Estados Unidos'],
];

/** Etiqueta de pais que aparece pegada al nombre. */
const ETIQUETA_PAIS = {
  BR: 'Brasil', BRASIL: 'Brasil', BRAZIL: 'Brasil',
  MX: 'Mexico', MEXICO: 'Mexico', MÉXICO: 'Mexico',
  MZQ: 'Mozambique', MQ: 'Mozambique',
  NL: 'Paises Bajos', AR: 'Argentina', PT: 'Portugal', CDM: 'Brasil',
};

const ROLES = ['Gerente', 'Consultor'];

function paisPorTelefono(e164) {
  for (const [pre, pais] of POR_PREFIJO) if (e164.startsWith(pre)) return pais;
  return '';
}

/** Parsea una linea del CSV de Google Contacts. */
function partirCsv(linea) {
  const campos = [];
  let actual = '';
  let entreComillas = false;
  for (let i = 0; i < linea.length; i++) {
    const c = linea[i];
    if (c === '"') { entreComillas = !entreComillas; continue; }
    if (c === ',' && !entreComillas) { campos.push(actual); actual = ''; continue; }
    actual += c;
  }
  campos.push(actual);
  return campos;
}

/**
 * De "Alexandre Jordao Gerente RJ BR" saca:
 *   nombre = "Alexandre Jordao", cargo = "Gerente", ciudad = "RJ", pais = "Brasil"
 *
 * El nombre puede venir repartido entre First / Middle / Last de cualquier
 * forma, asi que se pegan los tres y se corta en el rol.
 */
function interpretar(entero) {
  const texto = entero.replace(/\s+/g, ' ').trim();
  const rol = ROLES.find((r) => new RegExp(`\\b${r}\\b`, 'i').test(texto));
  if (!rol) return { nombre: texto, cargo: '', ciudad: '', paisEtiqueta: '', extra: '' };

  const i = texto.search(new RegExp(`\\b${rol}\\b`, 'i'));
  const nombre = texto.slice(0, i).trim().replace(/[,\s]+$/, '');
  const cola = texto.slice(i + rol.length).trim().split(/\s+/).filter(Boolean);

  // El pais es el token conocido; lo que queda antes es ciudad/zona, y lo que
  // queda despues suele ser el nombre de la empresa ("Gerente BR Qualimpor").
  let paisEtiqueta = '';
  let corte = -1;
  cola.forEach((t, j) => {
    const k = t.toUpperCase().replace(/[^A-ZÁÉÍÓÚÑ]/g, '');
    if (ETIQUETA_PAIS[k]) { paisEtiqueta = ETIQUETA_PAIS[k]; corte = j; }
  });

  const ciudad = corte >= 0 ? cola.slice(0, corte).join(' ') : cola.join(' ');
  const extra = corte >= 0 ? cola.slice(corte + 1).join(' ') : '';
  return { nombre, cargo: rol, ciudad, paisEtiqueta, extra };
}

function leer(archivo) {
  const bruto = fs.readFileSync(path.join(import.meta.dirname, archivo), 'utf8');
  const lineas = bruto.split(/\r?\n/).filter((l) => l.trim());
  const cab = partirCsv(lineas[0]);
  const iTel = cab.indexOf('Phone 1 - Value');
  const iOrg = cab.indexOf('Organization Name');
  return lineas.slice(1).map((l) => {
    const c = partirCsv(l);
    return {
      entero: [c[0], c[1], c[2]].filter(Boolean).join(' '),
      telefonoCrudo: (c[iTel] ?? '').trim(),
      empresa: (c[iOrg] ?? '').trim(),
    };
  });
}

// ------------------------------------------------------------------ proceso
const filas = [...leer('gerentes.csv'), ...leer('consultores.csv')];

const personas = [];
const problemas = { sinTelefono: [], paisNoCoincide: [], telefonoDudoso: [] };

for (const f of filas) {
  const { nombre, cargo, ciudad, paisEtiqueta, extra } = interpretar(f.entero);
  if (!nombre) continue;

  // El pais se decide por el prefijo del telefono, no por la etiqueta.
  const soloDigitos = f.telefonoCrudo.replace(/[^\d]/g, '');
  const paisReal = paisPorTelefono(soloDigitos) || paisEtiqueta;

  const tel = normalizarTelefono(f.telefonoCrudo, paisReal);
  if (!f.telefonoCrudo) problemas.sinTelefono.push(nombre);
  else if (!tel.valido) problemas.telefonoDudoso.push(`${nombre} (${f.telefonoCrudo})`);

  if (paisEtiqueta && paisReal && paisEtiqueta !== paisReal) {
    problemas.paisNoCoincide.push(`${nombre}: dice ${paisEtiqueta}, el teléfono es de ${paisReal}`);
  }

  personas.push({
    nombre, cargo, ciudad,
    pais: paisReal,
    paisEtiqueta,
    empresa: f.empresa || extra || '',
    telefono: tel.valor,
    telefono_raw: f.telefonoCrudo,
    telefono_valido: tel.valido,
    huella: huella(nombre, f.empresa || ''),
  });
}

// Duplicados: mismo telefono normalizado, o misma huella (D02).
const porTelefono = new Map();
const porHuella = new Map();
for (const p of personas) {
  if (p.telefono) {
    if (!porTelefono.has(p.telefono)) porTelefono.set(p.telefono, []);
    porTelefono.get(p.telefono).push(p);
  }
  if (p.huella) {
    if (!porHuella.has(p.huella)) porHuella.set(p.huella, []);
    porHuella.get(p.huella).push(p);
  }
}
const dupTelefono = [...porTelefono.entries()].filter(([, v]) => v.length > 1);
const dupHuella = [...porHuella.entries()].filter(([, v]) => v.length > 1);

console.log('='.repeat(70));
console.log(APLICAR ? 'IMPORTANDO' : 'SIMULACRO — nada se escribe. Usá --aplicar para escribir');
console.log('destino:', PB_URL);
console.log('='.repeat(70));
console.log('\nContactos leídos:', filas.length);
console.log('Personas interpretadas:', personas.length);

const porCargo = {};
const porPais = {};
for (const p of personas) {
  porCargo[p.cargo || '(sin cargo)'] = (porCargo[p.cargo || '(sin cargo)'] ?? 0) + 1;
  porPais[p.pais || '(sin país)'] = (porPais[p.pais || '(sin país)'] ?? 0) + 1;
}
console.log('\nPor cargo:');
for (const [k, v] of Object.entries(porCargo).sort((a, b) => b[1] - a[1])) console.log(`  ${String(v).padStart(4)}  ${k}`);
console.log('\nPor país (según el prefijo del teléfono):');
for (const [k, v] of Object.entries(porPais).sort((a, b) => b[1] - a[1])) console.log(`  ${String(v).padStart(4)}  ${k}`);

console.log('\nTeléfonos:');
console.log('  válidos:', personas.filter((p) => p.telefono_valido).length);
console.log('  a revisar:', problemas.telefonoDudoso.length);
console.log('  sin teléfono:', problemas.sinTelefono.length);

if (problemas.paisNoCoincide.length) {
  console.log(`\nEl país del nombre NO coincide con el del teléfono (${problemas.paisNoCoincide.length}):`);
  for (const x of problemas.paisNoCoincide.slice(0, 10)) console.log('  ', x);
}

if (dupTelefono.length) {
  console.log(`\nMISMO TELÉFONO, van a verificación manual (${dupTelefono.length}):`);
  for (const [tel, v] of dupTelefono) {
    console.log(`   +${tel}`);
    for (const p of v) console.log(`      ${p.nombre}  ·  ${p.cargo} ${p.ciudad} ${p.pais}`);
  }
}
if (dupHuella.length) {
  console.log(`\nMISMO NOMBRE+EMPRESA (${dupHuella.length}):`);
  for (const [, v] of dupHuella.slice(0, 8)) console.log('  ', v.map((p) => p.nombre).join('  |  '));
}

console.log('\nMuestra de lo que se va a crear:');
for (const p of personas.slice(0, 12)) {
  console.log(
    `   ${p.nombre.slice(0, 30).padEnd(31)} ${(p.cargo || '?').padEnd(10)} ${(p.ciudad || '-').padEnd(8)} ${(p.pais || '?').padEnd(14)} ${p.telefono_valido ? '+' + p.telefono : 'A REVISAR'}`,
  );
}

if (!APLICAR) {
  console.log('\nNada se escribió.');
  process.exit(0);
}

// ---------------------------------------------------------------- escritura
const pb = await entrar();

let creados = 0, actualizados = 0, marcados = 0;
const fallados = [];

for (const p of personas) {
  try {
  // Se busca por telefono normalizado, que es el unico identificador que trae
  // este CSV. Sin link de LinkedIn no hay slug ni urn (D02).
  const ya = p.telefono
    ? await pb.collection('perfil').getFullList({ filter: `telefono = "${p.telefono}"` })
    : [];

  const datos = {
    nombre: p.nombre,
    cargo: p.cargo,
    empresa: p.empresa,
    ciudad: p.ciudad,
    pais: p.pais,
    telefono: p.telefono,
    telefono_raw: p.telefono_raw,
    telefono_valido: p.telefono_valido,
    huella: p.huella,
  };

  // Una coincidencia por telefono NO alcanza para decir que es la misma
  // persona: dos personas distintas pueden compartir un numero —una linea de
  // empresa, un familiar— y el propio README lo advierte.
  //
  // Antes este caso completaba campos sobre el perfil que ya estaba, y como ese
  // perfil ya tenia nombre, el patch no lo pisaba: la segunda persona
  // desaparecia sin dejar rastro. Asi se perdieron Paul Goris (comparte numero
  // con Mauricio Mantovani) y Nicolas Valencia Garcia (con Nicolas Guadalupe
  // Valencia). Dos de 248, y ninguna senal de que faltaban.
  //
  // Ahora manda la HUELLA: mismo nombre normalizado = la misma persona con mas
  // datos; nombre distinto = otra persona, se crea y se marcan las dos para que
  // lo resuelva alguien (D02).
  const mismaPersona = ya.length === 1 && ya[0].huella === p.huella;

  if (mismaPersona) {
    // Ya existe: se completa lo que falte sin pisar lo que ya tiene.
    const v = ya[0];
    const patch = {};
    for (const [k, val] of Object.entries(datos)) if (val && !v[k]) patch[k] = val;
    if (Object.keys(patch).length) { await pb.collection('perfil').update(v.id, patch); actualizados++; }
  } else if (ya.length === 1) {
    // Mismo telefono, otro nombre: entra igual, y las dos quedan marcadas.
    const nuevo = await pb.collection('perfil').create({
      ...datos,
      posible_duplicado_de: [ya[0].id],
    });
    await pb.collection('perfil').update(ya[0].id, {
      posible_duplicado_de: [...(ya[0].posible_duplicado_de ?? []), nuevo.id],
    });
    creados++;
    marcados++;
  } else if (ya.length > 1) {
    // Mas de un perfil con el mismo telefono: NO se toca nada, se marca para
    // que lo resuelva una persona. La fusion nunca es automatica (D02).
    for (const v of ya) {
      await pb.collection('perfil').update(v.id, {
        posible_duplicado_de: ya.filter((o) => o.id !== v.id).map((o) => o.id),
      });
    }
    marcados++;
  } else {
    await pb.collection('perfil').create(datos);
    creados++;
  }
  } catch (e) {
    // Un contacto malo no puede cortar una importación de 248: se anota cuál
    // fue y por qué, y se sigue. Después se revisan los que quedaron afuera.
    const detalle = e?.response?.data
      ? Object.entries(e.response.data).map(([c, v]) => `${c}: ${v?.message ?? v}`).join('; ')
      : (e?.message ?? String(e));
    fallados.push({ nombre: p.nombre, telefono: p.telefono_raw, porque: detalle });
  }
}

console.log('\n' + '='.repeat(70));
console.log('Perfiles creados:', creados);
console.log('Perfiles completados:', actualizados);
console.log('Marcados para verificación manual:', marcados);
if (fallados.length) {
  console.log(`\nQuedaron afuera ${fallados.length}:`);
  for (const f of fallados) console.log(`   ${f.nombre.padEnd(34)} ${String(f.telefono).padEnd(20)} ${f.porque}`);
} else {
  console.log('Sin errores.');
}
console.log('='.repeat(70));
