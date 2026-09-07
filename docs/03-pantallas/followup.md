---
tipo: pantalla
seccion: "§7.2"
componente: prototipo/ListaContactos.dc.html, prototipo/FollowupDetalle.dc.html
etapa: 1
---

# Follow-up

Tres columnas; las dos últimas opcionales.

## Columna 1 — lista de contactos

Ancho arrastrable 260–520 px, doble clic alterna 260/340, persistido.

- Buscador por nombre, empresa, teléfono, ciudad.
- Importar CSV (con permiso).
- **Filtros en popover:** próximo contacto (todos / solo vencidos) y orden, WhatsApp (con/sin), reunión (con / sin / asistió / no asistió), rol, país, ciudad, etiquetas. El botón muestra cuántos filtros hay activos y cuántos leads quedan.
- Chips de cuenta (todas, AL, DL, …).
- Chips de colaborador (solo para el administrador). Cada lead asignado muestra un chip chico con el nombre.
- Últimos leads editados, como accesos rápidos.
- La fila: nombre, próximo contacto, fecha de reunión con color según estado (verde asistió, rojo no asistió, neutro pendiente). Los entrantes sin leer salen con **borde ámbar** y etiqueta "nuevo".
- Al pie: cola de envíos con cuenta regresiva del próximo envío (con permiso).

**Escala:** renderiza **80 leads** y suma de 80 en 80 al acercarse al final del scroll. Si se selecciona un lead fuera de la ventana visible, la ventana se expande antes de hacer scroll a él. Con 1.500+ leads **no hay paginado visible**.

## Columna 2 — ficha del lead

Mínimo 440 px.

- **Encabezado:** nombre, cuenta, etapa, links (perfil, chat), botón verde de WhatsApp si hay teléfono, chip "Asignado a" (reasignable, con opción sin asignar), deshacer, acciones rápidas.
- **Bloques colapsables:** Datos · Contacto · Fecha de reunión · Etiquetas · Log de ediciones · Análisis del perfil.
- **Enviar mensaje:** canal, idioma sugerido con chip, chips de mensajes destacados (reemplazan el texto, arrastrables para reordenar), "Destacar mensajes" (checklist sobre el repositorio, guarda para la cuenta activa), "Guardar" (crea el mensaje en el repositorio y después pregunta si cargarlo en otro idioma y si destacarlo), y ↗ Ir al chat.
- **Acciones rápidas (rayo):** todas las acciones del lead agrupadas — ficha, contacto, seguimiento, asignación. Cada una con su atajo.
- **Edición:** los campos se ven en vivo mientras se editan, no se ocultan hasta guardar → [[deshacer-y-revertir]].

## Sidebars

Una a la vez: Agenda (340–900) y Repositorio (300–620). Las dos arrastrables.

