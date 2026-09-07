# Instrucciones para agentes en este repositorio

## Antes de escribir código

**Leé la nota que corresponde en `docs/`, no el manual entero.** El vault está troceado
justamente para eso. Entrada: `docs/00-Mapa.md`.

Si la tarea toca una regla de negocio, la nota de `docs/01-negocio/` es la especificación.
Si la nota remite a una decisión abierta de `docs/04-decisiones/`, **preguntá antes de asumir**:
esas son las cosas que todavía no están definidas y elegir mal cuesta un refactor.

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
docs/         El vault. La documentación viaja con el código.
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

## Definición de terminado

Una regla está hecha cuando tiene las cuatro: nota en el vault, función en `core/`,
test que cita la sección, y UI conectada. Con tres de cuatro, no está hecha.

## Cosas que ya se decidieron y no hay que rediscutir

Están en `docs/04-decisiones/` con `estado: cerrada`, y en la sección 10 del manual.
Cambiarlas es rediseñar, no corregir.

