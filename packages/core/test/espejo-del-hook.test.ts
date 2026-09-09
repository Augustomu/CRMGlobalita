import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { cambioDeGoogle, type EventoDeGoogle, type ReunionGuardada } from '../src/sincronizar.ts';

/**
 * La regla de la vuelta de Google está escrita DOS VECES, y este test es lo
 * único que impide que se separen.
 *
 * La versión buena es `cambioDeGoogle()` de `core/sincronizar.ts`. El hook de
 * PocketBase (`pb_hooks/google.js`) tiene un espejo en JavaScript plano porque
 * el motor JS de PocketBase no puede cargar TypeScript y los hooks no tienen
 * paso de build.
 *
 * Una regla duplicada sin nada que la ate se separa: alguien arregla un caso
 * en core, el hook sigue con el viejo, y el que corre en producción es el
 * hook. Acá se carga el archivo del hook DE VERDAD —no una copia— y se le pasan
 * los mismos casos que a la de core, exigiendo la misma respuesta.
 *
 * Si alguien toca una sola de las dos, esto se pone rojo.
 */
function espejoDelHook(): (crm: ReunionGuardada, ev: EventoDeGoogle) => unknown {
  const ruta = path.resolve(import.meta.dirname, '../../db/pb_hooks/google.js');
  const fuente = fs.readFileSync(ruta, 'utf8');

  // PocketBase corre los hooks como CommonJS. Node no puede requerirlos porque
  // el repositorio es ESM (`"type": "module"`), así que se envuelve a mano. Los
  // `$app`, `$http` y `$os` de PocketBase quedan sin definir a propósito: si
  // esta parte del archivo llegara a usarlos, el test rompe, que es justo lo
  // que hay que saber.
  const correr = new Function(
    'module',
    'exports',
    'require',
    `${fuente}\nreturn typeof cambioDeGoogle === 'function' ? cambioDeGoogle : null;`,
  );

  const modulo = { exports: {} };
  const fn = correr(modulo, modulo.exports, () => ({})) as
    | ((crm: ReunionGuardada, ev: EventoDeGoogle) => unknown)
    | null;

  assert.ok(fn, 'el hook ya no define cambioDeGoogle: el espejo desapareció o cambió de nombre');
  return fn;
}

const GUARDADA: ReunionGuardada = {
  inicio: '2026-09-15 16:00:00.000Z',
  duracion_min: 30,
  estado: 'pendiente',
};

/** Los mismos casos que prueba `sincronizar.test.ts`, más los bordes. */
const CASOS: { que: string; crm: ReunionGuardada; ev: EventoDeGoogle }[] = [
  {
    que: 'el mismo horario con otro offset',
    crm: GUARDADA,
    ev: { inicio: '2026-09-15T10:00:00-06:00', fin: '2026-09-15T10:30:00-06:00' },
  },
  { que: 'evento de día entero', crm: GUARDADA, ev: { inicio: null, fin: null } },
  {
    que: 'termina antes de empezar',
    crm: GUARDADA,
    ev: { inicio: '2026-09-15T10:00:00-06:00', fin: '2026-09-15T09:00:00-06:00' },
  },
  {
    que: 'movida un día',
    crm: GUARDADA,
    ev: { inicio: '2026-09-16T10:00:00-06:00', fin: '2026-09-16T10:30:00-06:00' },
  },
  {
    que: 'estirada a una hora',
    crm: GUARDADA,
    ev: { inicio: '2026-09-15T10:00:00-06:00', fin: '2026-09-15T11:00:00-06:00' },
  },
  {
    que: 'movida Y estirada',
    crm: GUARDADA,
    ev: { inicio: '2026-09-20T08:15:00-06:00', fin: '2026-09-20T09:30:00-06:00' },
  },
  { que: 'cancelada en Google', crm: GUARDADA, ev: { cancelado: true } },
  {
    que: 'cancelada en Google y ya cancelada acá',
    crm: { ...GUARDADA, estado: 'cancelada' },
    ev: { cancelado: true },
  },
  {
    que: 'fecha ilegible',
    crm: GUARDADA,
    ev: { inicio: 'cualquier cosa', fin: 'otra cosa' },
  },
  {
    que: 'duración de 15 minutos',
    crm: { ...GUARDADA, duracion_min: 15 },
    ev: { inicio: '2026-09-15T10:00:00-06:00', fin: '2026-09-15T10:15:00-06:00' },
  },
];

test('el espejo del hook contesta exactamente lo mismo que la regla de core', () => {
  const espejo = espejoDelHook();
  for (const c of CASOS) {
    assert.deepEqual(
      espejo(c.crm, c.ev),
      cambioDeGoogle(c.crm, c.ev),
      `se separaron en el caso: ${c.que}`,
    );
  }
});
