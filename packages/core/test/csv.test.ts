import test from 'node:test';
import assert from 'node:assert/strict';
import { clave, detectarSeparador, leer, marcarDuplicados, partir } from '../src/csv.ts';

test('§7.6 · un CSV normal se lee entero', () => {
  const r = leer('nombre,telefono,empresa\nBruno Kessler,+55 11 98220 3341,Kessler Metais\n');
  assert.equal(r.filas.length, 1);
  assert.deepEqual(
    { n: r.filas[0].nombre, t: r.filas[0].telefono, e: r.filas[0].empresa },
    { n: 'Bruno Kessler', t: '+55 11 98220 3341', e: 'Kessler Metais' },
  );
});

test('las comas ADENTRO de comillas no parten la fila', () => {
  // «"Kessler, S.A."» con un split ingenuo corre todas las columnas una
  // posicion: el telefono termina en empresa y nadie lo nota hasta despues.
  const filas = partir('nombre,empresa,ciudad\nBruno,"Kessler, S.A.",Sao Paulo\n', ',');
  assert.deepEqual(filas[1], ['Bruno', 'Kessler, S.A.', 'Sao Paulo']);
});

test('dos comillas seguidas son una comilla literal', () => {
  const filas = partir('a,b\n1,"el ""mejor"" precio"\n', ',');
  assert.deepEqual(filas[1], ['1', 'el "mejor" precio']);
});

test('un salto de linea adentro de comillas no cierra la fila', () => {
  const filas = partir('a,b\n1,"linea 1\nlinea 2"\n', ',');
  assert.equal(filas.length, 2);
  assert.equal(filas[1][1], 'linea 1\nlinea 2');
});

test('el Excel en espanol exporta con punto y coma', () => {
  assert.equal(detectarSeparador('nombre;telefono;empresa'), ';');
  assert.equal(detectarSeparador('nombre,telefono,empresa'), ',');
  assert.equal(detectarSeparador('nombre\ttelefono\tempresa'), '\t');
  const r = leer('nombre;telefono\nIvana;+54 9 341 555 0192\n');
  assert.equal(r.separador, ';');
  assert.equal(r.filas.length, 1);
});

test('el BOM de Excel no puede comerse el primer encabezado', () => {
  // Sin sacarlo, el encabezado llega como "﻿nombre", no coincide con
  // nada, y el archivo entero sale sin una sola fila valida.
  const r = leer('﻿nombre,telefono\nBruno,+5511982203341\n');
  assert.equal(r.filas.length, 1);
  assert.equal(r.filas[0].nombre, 'Bruno');
});

test('los encabezados se reconocen con acento, sin acento y en ingles', () => {
  const r = leer('Name,Teléfono,Country,Position\nPaulina,+52 81 1234 5678,MX,Jefa de Planta\n');
  assert.equal(r.filas[0].nombre, 'Paulina');
  assert.equal(r.filas[0].cargo, 'Jefa de Planta');
  // El codigo de pais se expande.
  assert.equal(r.filas[0].pais, 'México');
});

test('un pais que no es codigo se deja como vino', () => {
  const r = leer('nombre,telefono,pais\nX,+5411,Brasil\n');
  assert.equal(r.filas[0].pais, 'Brasil');
});

test('sin nombre o sin telefono la fila no entra, y se cuenta', () => {
  // No se puede ni identificar ni contactar: no sirve.
  const r = leer('nombre,telefono\nBruno,+5511982203341\n,+5511999999999\nSinTelefono,\n');
  assert.equal(r.filas.length, 1);
  assert.equal(r.descartadas, 2);
});

test('las columnas que no se usan se avisan, no se pierden en silencio', () => {
  const r = leer('nombre,telefono,cuit,observaciones\nX,+5411,20-1,nota\n');
  assert.deepEqual(r.columnasIgnoradas, ['cuit', 'observaciones']);
});

test('la clave del telefono son los ultimos 8 digitos', () => {
  // El mismo numero escrito de cinco formas tiene que dar la misma clave.
  assert.equal(clave('+55 11 98220-3341'), '82203341');
  assert.equal(clave('5511982203341'), '82203341');
  assert.equal(clave('11 9822 0 3341'), '82203341');
  assert.equal(clave(''), '');
});

test('un duplicado se marca pero NO se descarta: se fusiona', () => {
  // El archivo suele traer el cargo, la ciudad y el mail que la ficha no tiene.
  // Tirarlo por tener el telefono repetido pierde lo que se venia a buscar.
  const filas = leer('nombre,telefono\nBruno,+55 11 98220 3341\nNueva,+54 9 341 555 0192\n').filas;
  const marcadas = marcarDuplicados(filas, ['5511982203341']);
  assert.deepEqual(marcadas.map((f) => f.duplicado), [true, false]);
  assert.equal(marcadas.length, 2);
});

test('un telefono existente demasiado corto no marca a todo el mundo', () => {
  // Con una clave de 3 digitos, un "includes" ingenuo marcaria medio archivo.
  const filas = leer('nombre,telefono\nA,+54 9 341 555 0192\n').filas;
  assert.equal(marcarDuplicados(filas, ['192'])[0].duplicado, false);
});
