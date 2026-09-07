---
tipo: entidad
seccion: "§3.5, §7.9"
modulo: core/plantilla.ts
etapa: 2
---

# Mensaje / plantilla (repositorio)

| Campo | Notas |
|---|---|
| `nombre` | **Libre y editable.** Renombrar no rompe nada (D16) |
| `paso` | R0…R8, `R0-recontacto`, `agradecimiento`. Es lo que la ata a la cadencia |
| `por_defecto` | la que usa la automatización y la que precarga Vencimientos |
| `textos` | map idioma → texto (es, pt, en); pueden faltar |
| `destacado` | null / "todas las cuentas" / lista de abreviaturas ("AL, DL") |
| `orden` | reordenable |

Puede haber **varias plantillas por paso**, con una sola marcada por defecto (índice único parcial en la base). → [[D16-plantilla-por-paso]]

## Variables

`{nombre}` (primer nombre), `{empresa}`, `{industria}`, `{ciudad}`, `{tema}`.

Si un campo está vacío se usa un genérico según idioma: *su planta* / *sua planta* / *your plant*. Y si el nombre viene con el cargo pegado —como llegan de LinkedIn (§3.2)— `{nombre}` corta antes del separador: *"Maria de los Angeles Fernandez - Gerente de Compras"* resuelve a **Maria**.

Sin nombre, el saludo se limpia en vez de quedar como *"Hola , ¿cómo va?"*.

## Regla dura

El repositorio es el **único lugar de verdad de los textos**. Cualquier edición se refleja al instante en Enviar mensaje, en Vencimientos y en Automatizaciones. **Nunca constantes en el código de la automatización.**

Si un paso no tiene plantilla, o la plantilla no tiene ese idioma, **se avisa y no se inventa** (§5.2). No cae a otro idioma en silencio.

→ `packages/core/src/plantilla.ts`, 10 tests en `packages/core/test/plantilla.test.ts`
