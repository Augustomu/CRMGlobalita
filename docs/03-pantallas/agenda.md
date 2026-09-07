---
tipo: pantalla
seccion: "§7.6"
componente: prototipo/Agenda.dc.html, prototipo/EventoAgenda.dc.html
etapa: 3
---

# Agenda

Tres vistas.

## Semanal (default)

Lunes a sábado (**domingo no se muestra**), 8 a 20 h. La columna de hoy en color de acento, sábado en gris. Arrastre y resize sobre bloques de **15 minutos**; el evento se desplaza dentro de la celda según los minutos, así un movimiento a :15 / :30 / :45 se ve. Al arrastrar se pintan todos los cuadros que abarca la duración y el header muestra "soltar en HH:MM".

## Diaria

La misma grilla en un día, en filas de 15 minutos.

## Lista

Una fila por lead con seguimiento: check de control, última reunión, próximo contacto editable, foto (se pega del portapapeles), cuenta y nombre, nueva reunión, notas, links, etiquetas. El filtro de check es una caja sin texto en **tres estados**: vacía (todos), con check, con cruz (sin check).

## Interacción

**Hover del evento:** nombre, empresa, cuenta, hora y duración, estado, asistió / no asistió, pegar foto, notas, links, y dos campos para cambiar hora y fecha.

**No hay popup del evento:** clic en el evento abre la ficha del lead.

Los bloqueos de Google Calendar se muestran con el nombre del evento → conflicto con la privacidad entre usuarios, [[D18-ocupado-vs-nombre-del-evento]].

