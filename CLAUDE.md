# Instrucciones para agentes en este repositorio

## Antes de escribir código

**Leé la nota que corresponde en `docs/`, no el manual entero.** El vault está troceado
justamente para eso. Entrada: `docs/00-Mapa.md`.

Si la tarea toca una regla de negocio, la nota de `docs/01-negocio/` es la especificación.
Si la nota remite a una decisión abierta de `docs/04-decisiones/`, **preguntá antes de asumir**:
esas son las cosas que todavía no están definidas y elegir mal cuesta un refactor.

## Estructura del proyecto

```
pb_public/     EL FRONT-END. Es el prototipo de Design Components servido tal
               cual, no una reescritura. NO se rediseña acá: se rediseña en
               Design Components y se re-exporta. Ver docs/PLAN.md.
packages/
  core/        TODAS las reglas de negocio, como funciones puras, sin I/O.
               cadencia.ts  cancelacion.ts  cupos.ts  telefono.ts  idioma.ts
               permisos.ts  ruteo.ts  envio.ts  reglas.ts  reunion.ts
               metricas.ts  proyecto.ts  etiqueta.ts  dedupe.ts  fusion.ts
  db/          Esquema, migraciones y hooks de PocketBase. Los hooks son el
               lugar donde las reglas de core se aplican del lado del servidor.
docs/          El vault. La documentación viaja con el código.
  _bundle/     El export original del prototipo, tal como llegó.
  prototipo/   Desempaque para LEER (gitignored). node docs/desempacar.mjs
```

## Las reglas que evitan el código de más

1. **Toda regla de negocio vive en `packages/core/`, como función pura y con su test.**
   El test cita la sección del manual que implementa. Si una regla aparece en un componente
   o en un handler, está mal ubicada. Es lo único que impide que la cadencia termine
   implementada en tres lugares con tres resultados distintos.

2. **Configuración, nunca constantes.** Esperas de la cadencia, cupos, días de cancelación:
   todo es configurable por el usuario. Las funciones de `core/` reciben la config como
   argumento; no la leen de ningún lado.

3. **Dependencias en una sola dirección:** `web -> shared -> core` y `api/worker -> db -> core`.
   Jamás al revés. Se verifica en CI con dependency-cruiser.

4. **Prohibido el cajón de sastre.** Nada de `utils.ts`, `helpers.ts` ni `common/`.
   Si algo no encaja en ningún módulo, falta nombrar el módulo.

5. **Ningún color suelto.** Todo pasa por las variables de `docs/design/tokens.css`.
   Tres temas: claro, oscuro, noche.

6. **El prototipo es la fuente de verdad visual, no una referencia vaga.**

   Vive en **un solo archivo**: `docs/_bundle/CRM de prospeccion.html`, que a
   pesar de la extensión es un ZIP. Para leerlo:

   ```
   node docs/desempacar.mjs      # regenera docs/prototipo/ (gitignored)
   ```

   Antes de escribir una pantalla, abrí el `.dc.html` que le corresponde y
   copiá las medidas reales: tamaños de fuente, paddings, bordes (son `.5px`,
   no 1px), radios, y la estructura del layout — varias pantallas usan `grid`
   con filas explícitas, no flex.

   **El texto también sale del prototipo**: los tamaños son 9, 10, 11, 12, 13,
   14 y 17px, sin escalar. El objetivo es una laptop de 14" donde se trabaja
   todo el día; la densidad no es un detalle del diseño, es el diseño.

   Tomar solo los colores y maquetar de cero **no es respetar el diseño**: da
   algo que funciona pero se ve distinto, y la diferencia se nota sobre todo en
   la densidad. Si algo del prototipo no se puede construir todavía (porque
   depende de datos que no existen), se omite y se anota — no se reemplaza por
   una versión inventada.

## Definición de terminado

Una regla está hecha cuando tiene las cuatro: nota en el vault, función en `core/`,
test que cita la sección, y UI conectada. Con tres de cuatro, no está hecha.

## Cosas que ya se decidieron y no hay que rediscutir

Están en `docs/04-decisiones/` con `estado: cerrada`, y en la sección 10 del manual.
Cambiarlas es rediseñar, no corregir.

