---
tipo: entidad
seccion: "§3.5, §7.9"
etapa: 2
---

# Mensaje / plantilla (repositorio)

| Campo | Notas |
|---|---|
| `nombre` | `R{n} · …` es lo que ata la plantilla al paso de la cadencia → [[D16-plantilla-por-paso]] |
| `textos` | map idioma → texto (es, pt, en); pueden faltar |
| `destacado` | null / "todas las cuentas" / lista de abreviaturas ("AL, DL") |
| `orden` | reordenable |

## Variables

`{nombre}` (primer nombre), `{empresa}`, `{industria}`, `{ciudad}`, `{tema}`. Si un campo está vacío se usa un genérico según idioma (*su planta* / *sua planta*).

## Regla dura

El repositorio es el **único lugar de verdad de los textos**. Cualquier edición se refleja al instante en Enviar mensaje, en Vencimientos y en Automatizaciones. **Nunca constantes en el código de la automatización.**

