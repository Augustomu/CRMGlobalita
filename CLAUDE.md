# Instrucciones para agentes en este repositorio

## No se borran datos. Nunca.

**Esta regla está primera porque ya se rompió una vez.** El 08/09/2026 se
corrió `dev.mjs --reset` unas diez veces mientras se trabajaba en otra cosa, y
se perdieron los 248 contactos y las 298 reuniones que Augusto había importado.
Nadie se dio cuenta hasta que él preguntó, dos días después.

1. **Ningún comando destructivo sin que lo pida Augusto en ese momento.**
   `--reset`, `DELETE`, `rm -rf`, `git checkout --` sobre trabajo sin
   commitear, `TRUNCATE`. Que haya dicho «no pares» es permiso para *hacer*,
   no para *borrar*.
2. **Ante la duda, copiar.** `node packages/db/dev.mjs --copia` tarda un
   segundo y ocupa 13 MB. No hay ninguna situación en la que valga la pena
   saltearlo.
3. **Para arrancar de cero se usa OTRA carpeta, no se borra la que hay:**
   `PB_DATOS=.pb/pb_data_limpia node packages/db/dev.mjs --seed`
4. **Si un dato se perdió, se dice de inmediato.** No se espera a que pregunte.

`dev.mjs --reset` ahora se niega solo cuando hay datos que no son de demo, y
copia igual antes de tocar nada. Esa red no es una excusa para volver a
correrlo: es lo que impide que un descuido cueste dos años de contactos.

| Para | Comando |
|---|---|
| Copiar ahora | `node packages/db/dev.mjs --copia` |
| Ver las copias | `node packages/db/dev.mjs --copias` |
| Volver a una | `node packages/db/restaurar.mjs <nombre>` |
| Empezar limpio sin borrar | `PB_DATOS=.pb/pb_data_limpia node packages/db/dev.mjs --seed` |

---

## Antes de escribir código

**La especificación es `docs/MANUAL.md`, y es un solo archivo.** Hasta el
08/09/2026 estaba troceada en un vault de treinta notas más un anexo; se
desincronizaron de verdad, no en teoría, y por eso se unificaron.

**Leé la sección que corresponde, no el archivo entero.** Está numerado para
eso: el índice está arriba de todo, y una sección se abre derecho con
`grep -n "^## 5\." docs/MANUAL.md` y `sed -n`.

| Si la tarea toca… | Leé |
|---|---|
| una regla de negocio | §5 |
| el modelo de datos | §3 |
| permisos, roles o alcances | §6 |
| una pantalla | §7 |
| Control y proyectos | §3.13, §5.12, §7.11 |
| deploy, backups, sesiones | §13 |

**§14 tiene las 38 decisiones.** Las cerradas no se rediscuten: cambiarlas es
rediseñar, no corregir. Las **abiertas** tienen una recomendación aplicada por
defecto — si la tarea depende de una de esas, **preguntá antes de asumir**:
elegir mal cuesta un refactor.

`docs/PENDIENTES.md` es la otra mitad: lo decidido y todavía no hecho. El
manual dice cómo tiene que ser; PENDIENTES dice qué falta.

## Estructura del proyecto

```
apps/
  web/        React + Vite. Carpetas por feature (followup/, agenda/, usuarios/).
              CERO reglas de negocio adentro.
  api/        Backend. Rutas finas: validar -> llamar a core -> responder.
  worker/     Cola de envíos, Playwright (LinkedIn), sesión de WhatsApp.
              Aislado detrás de una interfaz: el resto del sistema no sabe cómo se envía.
packages/
  core/       TODAS las reglas de negocio, como funciones puras, sin I/O.
              cadencia.ts  cancelacion.ts  cupos.ts  telefono.ts  idioma.ts
              permisos.ts  ruteo.ts  envio.ts  reglas.ts  reunion.ts  metricas.ts
  db/         Esquema y migraciones de PocketBase.
  shared/     Tipos y esquemas de validación compartidos.
docs/         MANUAL.md (la especificación entera), PENDIENTES.md (lo que falta)
              y el prototipo. La documentación viaja con el código.
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

5. **Ningún color suelto.** Todo pasa por las variables de
   `apps/web/public/design-tokens.css`, que es el ÚNICO archivo de tokens.
   Hubo una segunda copia en `docs/design/` y se borró: dos archivos idénticos
   se desincronizan en cuanto alguien toca uno.
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

Una regla está hecha cuando tiene las cuatro: sección en el manual, función en `core/`,
test que cita la sección, y UI conectada. Con tres de cuatro, no está hecha.

## Cosas que ya se decidieron y no hay que rediscutir

Están en **§14 del manual** marcadas `cerrada`, y las de fondo también en §10.
Cambiarlas es rediseñar, no corregir.

## Y una regla sobre el manual mismo

Cuando un cambio contradice lo que dice el manual, **se actualiza el manual en
el mismo commit**. No se anota aparte «esto ahora es distinto»: esa nota aparte
es exactamente lo que hubo que venir a limpiar.

