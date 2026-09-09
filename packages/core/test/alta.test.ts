import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  DIAS_DE_INVITACION,
  LARGO_MINIMO_CLAVE,
  PARAMETRO_INVITACION,
  correoDeInvitacion,
  correoDeReinicio,
  enlaceDeInvitacion,
  estadoDeInvitacion,
  problemaDeClave,
  venceEn,
} from '../src/alta.ts';

const AHORA = '2026-09-08T12:00:00.000Z';

/* --------------------------------------------------------------------------
 * El estado del enlace (§6.7)
 * ----------------------------------------------------------------------- */

test('§6.7 · un enlace emitido hoy sirve', () => {
  assert.equal(estadoDeInvitacion({ expira: venceEn(AHORA) }, AHORA), 'valida');
});

test('§6.7 · vencida y usada se distinguen: no es lo mismo para quien la abre', () => {
  // A quien abre una vencida hay que decirle que pida otra; a quien abre una
  // usada, que entre con su clave. Un solo mensaje manda a las dos personas a
  // escribirle al administrador.
  assert.equal(estadoDeInvitacion({ expira: '2026-09-01T00:00:00.000Z' }, AHORA), 'vencida');
  assert.equal(
    estadoDeInvitacion({ expira: venceEn(AHORA), usada_en: '2026-09-08T09:00:00.000Z' }, AHORA),
    'usada',
  );
});

test('§6.7 · una usada sigue siendo usada aunque además esté vencida', () => {
  // El orden importa: si mandara la fecha, alguien que ya entró vería «pedí
  // otro enlace» cuando en realidad su cuenta funciona.
  assert.equal(
    estadoDeInvitacion({ expira: '2026-09-01T00:00:00.000Z', usada_en: '2026-08-31T10:00:00.000Z' }, AHORA),
    'usada',
  );
});

test('§6.7 · un token que no existe no es lo mismo que uno vencido', () => {
  assert.equal(estadoDeInvitacion(null, AHORA), 'inexistente');
});

test('§6.7 · el enlace justo en el instante en que vence ya no sirve', () => {
  assert.equal(estadoDeInvitacion({ expira: AHORA }, AHORA), 'vencida');
});

test('§6.7 · vence a los siete días', () => {
  assert.equal(venceEn(AHORA), '2026-09-15T12:00:00.000Z');
  assert.equal(venceEn(AHORA, DIAS_DE_INVITACION), '2026-09-15T12:00:00.000Z');
});

/* --------------------------------------------------------------------------
 * La contraseña
 * ----------------------------------------------------------------------- */

test('§6.7 · la contraseña corta se rechaza diciendo por qué', () => {
  const p = problemaDeClave('corta');
  assert.ok(p && p.includes('8'));
});

test('§6.7 · ocho caracteres alcanzan: no se piden símbolos', () => {
  // Pedir mayúsculas y símbolos empuja a «Password1!», que es peor que una
  // frase larga. Lo que importa acá es que no quede la que vino por mail.
  assert.equal(problemaDeClave('caballo de batalla'), null);
  assert.equal(problemaDeClave('12345678'), null);
});

test('§6.7 · las dos escrituras tienen que coincidir', () => {
  assert.equal(problemaDeClave('caballo de batalla', 'caballo de batalla'), null);
  assert.ok(problemaDeClave('caballo de batalla', 'caballo de batallas'));
});

/* --------------------------------------------------------------------------
 * El enlace y el correo
 * ----------------------------------------------------------------------- */

test('§6.7 · el enlace no duplica la barra de la URL base', () => {
  assert.equal(
    enlaceDeInvitacion('https://crm.globalita.tech/', 'abc123'),
    'https://crm.globalita.tech/?invitacion=abc123',
  );
  assert.equal(
    enlaceDeInvitacion('https://crm.globalita.tech', 'abc123'),
    'https://crm.globalita.tech/?invitacion=abc123',
  );
});

test('§6.7 · el token se escapa: puede traer caracteres de URL', () => {
  assert.ok(enlaceDeInvitacion('https://x.test', 'a+b/c').includes('a%2Bb%2Fc'));
});

test('§6.7 · el correo NO lleva la contraseña, lleva el usuario y el enlace', () => {
  const c = correoDeInvitacion({
    nombre: 'Sofía Ferrer',
    email: 'sofia@globalita.test',
    quienInvita: 'Alberto',
    enlace: 'https://crm.globalita.tech/?invitacion=tok',
  });
  assert.ok(c.cuerpo.includes('sofia@globalita.test'));
  assert.ok(c.cuerpo.includes('https://crm.globalita.tech/?invitacion=tok'));
  assert.ok(c.cuerpo.includes('Alberto'));
  // Se saluda por el primer nombre, no por el completo.
  assert.ok(c.cuerpo.startsWith('Hola Sofía,'));
  assert.ok(/una sola vez/.test(c.cuerpo));
});

test('§6.7 · sin nombre cargado el saludo no queda colgado', () => {
  const c = correoDeInvitacion({
    nombre: '   ',
    email: 'x@y.test',
    quienInvita: 'Alberto',
    enlace: 'https://x.test/?invitacion=t',
  });
  assert.ok(c.cuerpo.startsWith('Hola,'));
});

test('§6.7 · el correo de reinicio dice que la clave anterior dejó de servir', () => {
  const c = correoDeReinicio({
    nombre: 'Sofía',
    email: 'sofia@globalita.test',
    quienInvita: 'Alberto',
    enlace: 'https://x.test/?invitacion=t',
  });
  assert.notEqual(c.asunto, correoDeInvitacion({
    nombre: 'Sofía',
    email: 'sofia@globalita.test',
    quienInvita: 'Alberto',
    enlace: 'https://x.test/?invitacion=t',
  }).asunto);
  assert.ok(/ya no sirve/.test(c.cuerpo));
  assert.ok(/no pediste esto/.test(c.cuerpo));
});

/* --------------------------------------------------------------------------
 * El hook de PocketBase tiene que decir lo mismo
 * ----------------------------------------------------------------------- */

/*
 * `packages/db/pb_hooks/invitacion.js` reimplementa estas reglas en JS porque
 * goja no puede importar el core. Es duplicación, y la duplicación se
 * desincroniza sola: alguien cambia los 7 días acá y el correo sigue diciendo
 * otra cosa, o peor, el enlace vence a los 7 y el texto promete 14.
 *
 * Estos tests leen el archivo del hook. No prueban que funcione —eso lo prueba
 * usarlo— sino que los dos lados digan el mismo número y el mismo texto.
 */
const HOOK = readFileSync(
  new URL('../../db/pb_hooks/invitacion.js', import.meta.url),
  'utf8',
);

test('§6.7 · el hook usa los mismos días y el mismo largo mínimo', () => {
  assert.ok(
    HOOK.includes(`const DIAS_DE_INVITACION = ${DIAS_DE_INVITACION};`),
    `El hook no dice ${DIAS_DE_INVITACION} días`,
  );
  assert.ok(
    HOOK.includes(`const LARGO_MINIMO_CLAVE = ${LARGO_MINIMO_CLAVE};`),
    `El hook no exige ${LARGO_MINIMO_CLAVE} caracteres`,
  );
  assert.ok(
    HOOK.includes(`const PARAMETRO_INVITACION = '${PARAMETRO_INVITACION}';`),
    'El hook arma el enlace con otro parámetro que el que lee la web',
  );
});

test('§6.7 · el hook manda el mismo texto de correo que dice el core', () => {
  const datos = {
    nombre: 'Sofía Ferrer',
    email: 'sofia@globalita.test',
    quienInvita: 'Alberto',
    enlace: 'https://crm.globalita.tech/?invitacion=tok',
  };
  // El hook arma el cuerpo concatenando, así que la línea entera no aparece
  // nunca literal. Lo que sí tiene que aparecer es cada tramo FIJO: lo que
  // queda entre los datos variables.
  const variables = [datos.quienInvita, datos.email, datos.enlace, String(DIAS_DE_INVITACION), 'Sofía'];
  const tramos = (linea: string): string[] =>
    variables.reduce<string[]>((acc, v) => acc.flatMap((x) => x.split(v)), [linea]);

  for (const correo of [correoDeInvitacion(datos), correoDeReinicio(datos)]) {
    assert.ok(HOOK.includes("'" + correo.asunto + "'"), 'Falta el asunto: ' + correo.asunto);
    for (const linea of correo.cuerpo.split('\n')) {
      for (const tramo of tramos(linea)) {
        const t = tramo.trim();
        if (t.length < 14) continue;
        assert.ok(HOOK.includes(t), 'El hook no dice: «' + t + '»');
      }
    }
  }
});
