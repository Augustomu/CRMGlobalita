// Crea el usuario real de Augusto y deja el resto en limpio.
//
//   node packages/db/recuperacion/mi-usuario.mjs            simulacro
//   node packages/db/recuperacion/mi-usuario.mjs --aplicar  lo crea
//
// La contraseña NO se pone acá. Se emite el mismo enlace de un solo uso que
// manda el alta por correo (§6.7) y se imprime en pantalla: la elige él y nunca
// pasa por ningún archivo, ni por el historial del shell, ni por mí.
//
// El correo no sale porque el SMTP todavía no está configurado (deploy/
// PASO-A-PASO.md, paso 4.5). El enlace es exactamente el mismo que iría adentro.

import crypto from 'node:crypto';
import { entrar } from './entrar.mjs';
import { DIAS_DE_INVITACION, enlaceDeInvitacion, venceEn } from '../../core/src/alta.ts';

const APLICAR = process.argv.includes('--aplicar');
const APP_URL = process.env.APP_URL || 'http://localhost:5176';

const YO = {
  name: 'Augusto Unzaga',
  email: 'augusto.unzaga@outlook.com.ar',
  rol: 'administrador',
};

/** El que se conserva hasta que Augusto confirme que puede entrar. */
const SALVAVIDAS = 'alberto@globalita.test';

const pb = await entrar();
const usuarios = await pb.collection('users').getFullList();

const yaEstoy = usuarios.find((u) => u.email === YO.email);
const aBorrar = usuarios.filter((u) => u.email !== YO.email && u.email !== SALVAVIDAS);

// Los leads asignados a alguien que se va quedarían apuntando a un id muerto.
const leads = await pb.collection('lead').getFullList({ fields: 'id,asignado' });
const idsQueSeVan = new Set(aBorrar.map((u) => u.id));
const huerfanos = leads.filter((l) => l.asignado && idsQueSeVan.has(l.asignado));

console.log('='.repeat(66));
console.log(APLICAR ? 'APLICANDO' : 'SIMULACRO — nada se escribe. Usá --aplicar');
console.log('='.repeat(66));
console.log('\nTu usuario:', yaEstoy ? 'ya existe' : 'se crea');
console.log('  ', YO.name, '·', YO.email, '·', YO.rol);
console.log('\nSe borran', aBorrar.length, 'usuarios de demo:');
for (const u of aBorrar) console.log('  ', (u.name || '').padEnd(22), u.email || '(sin email)');
console.log('\nSe conserva hasta que confirmes que entrás:');
console.log('  ', SALVAVIDAS);
console.log('\nLeads asignados a alguien que se va:', huerfanos.length, '→ quedan sin asignar');

if (!APLICAR) {
  console.log('\nNada se escribió.');
  process.exit(0);
}

// ------------------------------------------------------------- tu usuario
let mio = yaEstoy;
if (!mio) {
  // Nace sin ninguna clave que alguien pueda conocer: una aleatoria de 50 que
  // no se guarda en ningún lado. La real la elegís con el enlace.
  const provisoria = crypto.randomBytes(30).toString('base64url');
  mio = await pb.collection('users').create({
    ...YO,
    emailVisibility: true,
    password: provisoria,
    passwordConfirm: provisoria,
    verified: true,
    estado: 'pendiente',
    permisos: {},
    metodo_invitacion: 'link',
    invitado_en: new Date().toISOString().replace('T', ' '),
    debe_cambiar_clave: true,
  });
  console.log('\nUsuario creado.');
}

// -------------------------------------------------------------- el enlace
const token = crypto.randomBytes(30).toString('base64url').slice(0, 40);
const hash = crypto.createHash('sha256').update(token).digest('hex');

// Se queman las invitaciones abiertas: dos enlaces vivos son dos llaves.
const abiertas = await pb
  .collection('invitacion')
  .getFullList({ filter: `usuario = "${mio.id}" && usada_en = ""` })
  .catch(() => []);
for (const i of abiertas) {
  await pb.collection('invitacion').update(i.id, { usada_en: new Date().toISOString() });
}

await pb.collection('invitacion').create({
  usuario: mio.id,
  token_hash: hash,
  expira: venceEn(new Date().toISOString()),
  motivo: yaEstoy ? 'reinicio' : 'alta',
});

// ------------------------------------------------------------- la limpieza
for (const l of huerfanos) {
  await pb.collection('lead').update(l.id, { asignado: '' });
}
for (const u of aBorrar) {
  await pb.collection('users').delete(u.id);
}
console.log('Usuarios de demo borrados:', aBorrar.length);

console.log('\n' + '='.repeat(66));
console.log('ABRÍ ESTE ENLACE Y ELEGÍ TU CONTRASEÑA:');
console.log('\n  ' + enlaceDeInvitacion(APP_URL, token));
console.log(`\nVale una sola vez y vence en ${DIAS_DE_INVITACION} días.`);
console.log('Cuando confirmes que entrás, se borra ' + SALVAVIDAS + '.');
console.log('='.repeat(66));
