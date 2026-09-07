---
tipo: mapa
---

# CRM Globalita

CRM de prospección saliente en LinkedIn y WhatsApp. Equipo de 1 administrador y 3 colaboradores, servicios industriales en LATAM y Brasil.

**Volumen objetivo:** 27.000+ perfiles en la base compartida, 1.500+ leads activos en follow-up, 200 invitaciones por semana por cuenta × 10 cuentas.

## Por dónde entrar

- **Qué hace el sistema** → [[que-es-y-que-no-es]]
- **Las reglas** → carpeta `01-negocio/`. Empezar por [[cadencia-r0-r8]].
- **Los datos** → carpeta `02-modelo/`. Empezar por [[lead]].
- **Las pantallas** → carpeta `03-pantallas/`. Empezar por [[followup]].
- **Lo que falta decidir** → carpeta `04-decisiones/`. Tablero acá abajo.
- **Cómo se opera** → carpeta `05-operacion/`.
- **El prototipo** → `prototipo/Dashboard.dc.html` es la entrada. Es la fuente de verdad **visual**; este vault es la fuente de verdad de las **reglas**.

## Tablero de decisiones abiertas

```dataview
TABLE seccion AS "Manual", impacto AS "Impacto", recomendada AS "Recomendación"
FROM "04-decisiones"
WHERE estado = "abierta"
SORT impacto ASC, file.name ASC
```

## Decisiones cerradas

```dataview
TABLE seccion AS "Manual", resuelta AS "Resolución"
FROM "04-decisiones"
WHERE estado = "cerrada"
SORT file.name ASC
```

## Reglas de negocio y dónde se implementan

```dataview
TABLE seccion AS "Manual", modulo AS "Módulo", etapa AS "Etapa"
FROM "01-negocio"
SORT etapa ASC
```

## Orden de construcción

Cada etapa deja algo usable.

| Etapa | Qué entrega | Notas |
|---|---|---|
| 1 | El lead y su ficha. Reemplaza la planilla. | [[lead]], [[permisos]] |
| 2 | Textos y envío manual. | [[plantilla]], [[envio-de-mensaje]], [[idioma-sugerido]], [[normalizacion-telefono]] |
| 3 | El calendario. | [[reunion-y-avisos]] |
| 4 | La cadencia y la cola. | [[cadencia-r0-r8]], [[reglas-de-fabrica]] |
| 5 | Las invitaciones (mayor riesgo técnico). | [[cupos-y-listas]], [[cancelacion-recontacto]], [[riesgo-linkedin]] |
| 6 | El equipo. | [[permisos]], [[usuario]] |
| 7 | La medición. | [[metricas]] |

Transversal desde el día uno: los tres temas (`design/tokens.css`), los atajos, el aviso de cambios sin guardar, y el renderizado de a 80 de la columna 1. Meterlos al final cuesta el triple.

