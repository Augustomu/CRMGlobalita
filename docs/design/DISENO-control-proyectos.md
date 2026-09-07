# Control de proyectos — diseño de la sección

Complemento visual de `MANUAL-control-proyectos.md`. Las capturas son del prototipo (`Control.dc.html` montado en `Dashboard.dc.html`, tema claro, sesión del rol Observador).

Nada de esta sección introduce color, tipografía ni componentes nuevos: usa los tokens y los patrones que ya tiene el CRM. Lo único nuevo es la composición.

---

## 1. Proyectos

![Vista de proyectos](diseno/01-control.png)

De arriba hacia abajo:

1. **Header de sección**, 44 px, `--surface` con borde inferior de 0.5 px: título, switch de pestañas (Proyectos / Reuniones con su conteo) y la pastilla **Solo lectura** con icono de ojo, en `--info` sobre `--info-light`.
2. **Tarjetas de resumen**, grilla `auto-fit minmax(132px, 1fr)`, gap 9 px. Número en 22 px semibold con el color del estado, etiqueta en 10 px mayúscula `--hint`, y una línea de aclaración en 10 px `--muted`. El color del número es lo que diferencia una tarjeta de otra; el fondo es siempre `--surface`.
3. **Filtros**, dos filas rotuladas (`TIPO`, `ESTADO`) con etiqueta de ancho fijo 48 px para que las dos filas queden alineadas. Cada chip lleva el conteo; el chip activo invierte el color (fondo del color del tipo o estado, texto `--surface`).
4. **Tabla**, dos líneas por fila:
   - Línea 1: grilla de 8 columnas (`2fr 96 118 1fr 1fr 58 78 1.1fr`). El nombre del proyecto va en 12 px semibold con la empresa y el contacto abajo en 10 px `--muted`; a la derecha del nombre, el **icono de notas** (22 px, prendido en `--accent-light` / `--accent-br` cuando hay notas) con la nota de la ficha en el tooltip.
   - Línea 2: **tira de avance**. Etiqueta `AVANCE` a la izquierda y un carrusel horizontal de tarjetas de 250 px. Las próximas acciones van en `--warning-light` con borde del mismo tono; actualizaciones y notas en `--bg` con borde `--border`. La etiqueta de cada tarjeta usa el color de su tipo (ámbar / acento / info).
5. **Leyenda de estados** al pie, en tarjeta propia: cada estado con su pastilla y la regla que lo aplica.

Densidad: filas de 8 px de padding vertical arriba y 9 px abajo, separadas por borde de 0.5 px. Ninguna celda crece: los textos largos se cortan con elipsis y el detalle completo vive en el panel.

---

## 2. Panel del proyecto

![Panel del proyecto](diseno/02-control.png)

Se abre desde cualquier fila, sobre un velo `rgba(20,20,18,.32)`, anclado a la derecha, ancho `min(720px, 96vw)`, con la animación `om-abrir` que ya usa el resto del CRM.

- **Encabezado**: nombre del proyecto en 14 px, empresa y contacto en 11 px, y las dos pastillas (tipo y estado). Cierre con la cruz de 27 px, igual que los demás paneles.
- **Grilla de datos**, `auto-fit minmax(150px, 1fr)`: etiqueta en 9 px mayúscula `--hint`, valor en 12 px. Incluye "Reuniones" con la fecha de la última y "Ficha del lead" para saber si el proyecto tiene lead en el CRM.
- **Tres columnas**: `Notas` · `Actualización del proyecto` · `Próximas acciones`. Cada una con su punto de color (info / acento / ámbar), el conteo a la derecha, y los ítems separados por borde superior de 0.5 px, con la fecha en 9 px arriba del texto. Notas y actualizaciones de la más nueva a la más vieja; acciones por fecha.
- **Reuniones del proyecto**, numeradas, con hora y estado.
- **Nota de la ficha del lead**, textual, en tarjeta `--bg` al final. Es la misma nota "Acerca de" de la columna 2: se lee, no se edita.

---

## 3. Reuniones

![Dashboard de reuniones](diseno/03-control.png)

- **Período** (último mes / 3 meses / 6 meses) como switch segmentado, con el detalle del rango al lado en 10 px.
- **Ocho tarjetas**, misma tarjeta que en Proyectos: reuniones, asistieron (con %), no asistió, reagendadas, con proyecto, conversión, empresas distintas y promedio por semana. Los colores señalan el sentido: verde asistió, rojo no asistió, ámbar reagendadas, acento total y conversión.
- **Gráfico por mes**, dos tercios del ancho: la barra entera es el total del mes, la banda oscura de abajo la porción que derivó en proyecto. El conteo va arriba de la barra y el mes abajo. Al pie, promedio por mes, mejor mes y duración promedio.
- **Agrupar por**, un tercio del ancho: diez chips (país, ciudad, industria, rol, empresa, cuenta, quién la generó, estado, día de la semana, franja horaria) y barras horizontales de 7 px con conteo y porcentaje, ordenadas de mayor a menor. El máximo se pinta en `--accent`, el resto en `--accent-br`.
- **Tabla del período**, numerada, 10 columnas. Igual criterio que la tabla de proyectos: nada se envuelve, todo se corta con elipsis.

---

## 4. Reglas de estilo aplicadas

| | |
|---|---|
| Tipografía | Inter. 22 px números de tarjeta · 14 px título de panel · 12 px nombre de fila · 11 px datos · 10 px etiquetas y detalle · 9 px encabezados de tabla y pastillas |
| Color | Solo tokens existentes. Tipo: `--accent` (Fabript/PIV), `--brand-linkedin` (Parcería), `--warning` (Prototipo). Estado: `--info`, `--badge-await`, `--warning`, `--muted`, `--success`, `--error` |
| Radios | 12 px tarjetas y paneles · 9–11 px tarjetas internas · 6–8 px pastillas y chips |
| Bordes | 0.5 px `--border` en todo; los separadores de tabla son el mismo borde |
| Temas | Claro, oscuro y noche funcionan sin cambios: la sección no define un solo color literal, todo sale de los tokens del Dashboard |
| Densidad | Gap 9 px entre tarjetas, 12–14 px entre bloques, 14 px de padding del contenido |

## 5. Estados de la interfaz

- **Fila seleccionada**: fondo `--info-light` mientras el panel está abierto.
- **Hover de fila**: la fila es clickeable en toda su primera línea; el cursor cambia a pointer.
- **Sin datos**: si un proyecto no tiene notas, actualizaciones o acciones, la columna correspondiente dice "Sin registros"; si no tiene reuniones, "Todavía no hubo reuniones".
- **Reunión futura**: la columna Últ. reunión muestra `—` con el subtítulo `programada DD/MM`.
- **Solo lectura**: no hay ningún control de edición en toda la sección. La pastilla del header lo declara.
