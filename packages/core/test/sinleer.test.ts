import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CAMPO_SIN_LEER,
  laCorridaEsCreible,
  losQueYaNoAparecen,
  marcasDelEscaneo,
  puedeSacarDeSinLeer,
  type LeadSinLeer,
} from '../src/sinleer.ts';

// §7.6 · «Sin leer»: el escaneo prende, sólo una persona apaga.
//
// Pedido por Augusto el 11/09: «lo que no quiero es que luego de hacer otro
// scan, como no encontró ese lead en sin leer, lo borre de sin leer».
//
// El escáner de globalita-automation hace hoy lo contrario y por diseño: cada
// corrida reemplaza la lista entera de la cuenta, y al que se cayó lo promueve
// solo a «respondido». Estos tests son lo que impide que eso vuelva.

const LEADS: LeadSinLeer[] = [
  { id: 'a', sin_leer_li: true },
  { id: 'b', sin_leer_li: false, sin_leer_wa: false },
  { id: 'c' },
  { id: 'd', sin_leer_wa: true },
];

// ------------------------------------------------ lo único que puede escribir

test('§7.6 · el escaneo marca a los que vio y no estaban marcados', () => {
  const marcas = marcasDelEscaneo(LEADS, [
    { lead_id: 'b', canal: 'linkedin' },
    { lead_id: 'c', canal: 'whatsapp' },
  ]);

  assert.deepEqual(marcas, [
    { lead_id: 'b', campo: 'sin_leer_li', valor: true },
    { lead_id: 'c', campo: 'sin_leer_wa', valor: true },
  ]);
});

test('§7.6 · EL ESCANEO NUNCA APAGA UNA MARCA, aunque no haya visto al lead', () => {
  // El test que existe por el pedido de Augusto. «a» y «d» están marcados y el
  // escaneo no los vio: no puede salir NADA sobre ellos.
  const marcas = marcasDelEscaneo(LEADS, [{ lead_id: 'b', canal: 'linkedin' }]);

  assert.equal(
    marcas.some((m) => m.lead_id === 'a' || m.lead_id === 'd'),
    false,
    'un lead que el escaneo no vio no se toca',
  );
  // Y por si alguien cambia el tipo: ningún valor puede ser falso.
  assert.equal(
    marcas.every((m) => m.valor === true),
    true,
    'este módulo no puede producir un apagado',
  );
});

test('§7.6 · un escaneo que no vio NADA no produce ningún cambio', () => {
  // El caso peligroso de verdad: LinkedIn cambió su HTML, el escaneo leyó cero
  // filas, y «cero» se ve igual que «ninguno tiene mensajes sin leer». El
  // escáner viejo, acá, vaciaba la lista y marcaba todo como respondido.
  assert.deepEqual(marcasDelEscaneo(LEADS, []), []);
});

test('§7.6 · marcar lo ya marcado no genera una escritura', () => {
  // Escribir true sobre true mueve el `updated` de la fila, y con eso el lead
  // sube en cualquier lista ordenada por fecha sin que haya pasado nada.
  assert.deepEqual(marcasDelEscaneo(LEADS, [{ lead_id: 'a', canal: 'linkedin' }]), []);
});

test('§7.6 · el mismo lead dos veces en una corrida se escribe una sola vez', () => {
  // Pasa de verdad: dos conversaciones del mismo canal, o un scroll que volvió
  // a recorrer filas ya leídas.
  const marcas = marcasDelEscaneo(LEADS, [
    { lead_id: 'b', canal: 'linkedin' },
    { lead_id: 'b', canal: 'linkedin' },
  ]);
  assert.equal(marcas.length, 1);
});

test('§7.6 · un lead que no está en la base no se inventa', () => {
  assert.deepEqual(marcasDelEscaneo(LEADS, [{ lead_id: 'no-existe', canal: 'linkedin' }]), []);
});

test('§7.6 · los dos canales son dos marcas distintas', () => {
  // Un lead puede tener un LinkedIn sin leer Y un WhatsApp sin leer, y atender
  // uno no atiende el otro (§D05).
  assert.equal(CAMPO_SIN_LEER.linkedin, 'sin_leer_li');
  assert.equal(CAMPO_SIN_LEER.whatsapp, 'sin_leer_wa');

  const marcas = marcasDelEscaneo([{ id: 'z' }], [
    { lead_id: 'z', canal: 'linkedin' },
    { lead_id: 'z', canal: 'whatsapp' },
  ]);
  assert.equal(marcas.length, 2);
});

// ------------------------------------------------------------ quién saca

test('§7.6 · sacar de «sin leer» lo hace una persona, nunca el escaneo', () => {
  assert.equal(puedeSacarDeSinLeer('persona'), true);
  assert.equal(puedeSacarDeSinLeer('escaneo'), false);
});

// --------------------------------------------- lo que ya no aparece

test('§7.6 · los que ya no aparecen se listan para mirar, no para borrar', () => {
  // Es la diferencia entre «avisale a alguien» y «decidilo solo». El escáner
  // viejo decidía solo.
  const ids = losQueYaNoAparecen(LEADS, [{ lead_id: 'a', canal: 'linkedin' }]);
  assert.deepEqual(ids, ['d']);
});

test('§7.6 · los que nunca estuvieron marcados no figuran como desaparecidos', () => {
  const ids = losQueYaNoAparecen(LEADS, []);
  assert.deepEqual(ids.sort(), ['a', 'd']);
  assert.equal(ids.includes('b'), false);
  assert.equal(ids.includes('c'), false);
});

// ------------------------------------------------ si la corrida vale

test('§7.6 · una corrida con cero filas no es creíble', () => {
  // No es que la bandeja esté vacía: es que no se pudo leer la página. Cambio
  // de HTML, sesión caída y captcha se ven exactamente igual desde afuera.
  assert.equal(laCorridaEsCreible(0), false);
  assert.equal(laCorridaEsCreible(-1), false);
  assert.equal(laCorridaEsCreible(NaN), false);

  assert.equal(laCorridaEsCreible(1), true);
  assert.equal(laCorridaEsCreible(40), true);
});
