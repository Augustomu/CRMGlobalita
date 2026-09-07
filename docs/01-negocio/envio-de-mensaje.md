---
tipo: regla
seccion: "§5.10"
modulo: core/envio.ts
etapa: 2
---

# Al enviar un mensaje desde la ficha

El envío es **una operación compuesta**. Todo esto pasa en un solo paso:

1. Se registra la entrada en `envio` (paso, timestamp, canal, plantilla, idioma, texto).
2. Se agrega la etiqueta **Recordatorio** (regla de fábrica → [[reglas-de-fabrica]]).
3. Si el paso empuja a Fase 2, se agrega la etiqueta **Fase 2**.
4. Se **propone** la próxima fecha de contacto según la cadencia — el usuario la acepta o la carga a mano. **No se fija sola.**
5. Todo lo anterior entra a la pila de deshacer como **una sola edición**.

## Cómo está implementado

`planDeEnvio()` **calcula el plan y no escribe nada**. Devuelve tres cosas separadas a propósito:

- `envio` — la fila del historial.
- `lead` — lo que se aplica solo (situación, último contacto).
- `proximo_contacto_propuesto` — **aparte**, justamente para que quien llame no lo aplique sin que alguien lo acepte. Ese es el punto 4 codificado, no una convención que haya que recordar.

Devolver un plan en vez de aplicarlo hace que la ficha pueda mostrarlo antes de confirmar, que el worker lo aplique derecho, y que **los dos hagan exactamente lo mismo**.

## Casos que respeta

- Un lead que ya **contestó** no vuelve a la cadencia automática por registrar un envío (§5.1).
- Registrar **R8** deja el lead `agotado` y sin próximo contacto.
- El **agradecimiento** post reunión (§5.11) no es un paso de la cadencia: no mueve la etapa ni propone fecha.
- Un texto escrito a mano queda con la plantilla vacía, y eso es un dato válido para la analítica de variantes.

## Hoy se manda a mano

La interfaz arma el texto, te lleva al chat real y registra que lo mandaste (D15). **El CRM no envía nada por su cuenta todavía** — eso llega con el worker en la Etapa 5, y usará esta misma función.

## Pendiente

El punto 5 (la pila de deshacer) todavía no existe. → [[D21-deshacer-un-envio]], [[deshacer-y-revertir]]

→ `packages/core/src/envio.ts`, 8 tests en `packages/core/test/envio.test.ts`
