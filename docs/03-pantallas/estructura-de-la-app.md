---
tipo: pantalla
seccion: "§4, §9"
componente: prototipo/Dashboard.dc.html
etapa: 1
---

# Estructura de la aplicación

Una sola aplicación web. Header fijo de 44 px, tres secciones principales y overlays.

```
Header (44 px, siempre visible)
├── Switch de canal: in {n} / wa {n}
├── Tabs: Automatizaciones · Follow-up · WA Personal · Usuarios
├── Subtabs (solo en Follow-up): Follow Up {n} / Sin leer {n}
└── Acciones: ··· · vencimientos · repositorio · tareas ·
    notificaciones · agenda · tema · sesión
```

**Qué tabs e iconos ve cada usuario se calcula desde los permisos, no desde el rol** → [[permisos]].

## Header

Alto fijo 44 px, nada envuelve a una segunda línea (`flex-shrink: 0`, sin `flex-wrap`). Iconos de 28 px.

- **Switch de canal** — elige en qué canal se abre la conversación del lead activo. LinkedIn azul, WhatsApp verde.
- **Sueltos a la derecha** — vencimientos (con badge), repositorio, tareas, notificaciones (badge con el total sin leer entre Follow-up y WA Personal), agenda, tema, chip de sesión.
- **Menú ···** — cuentas conectadas, base compartida, reglas y acciones rápidas, atajos de teclado.
- **Tema** — cicla claro → oscuro → noche. Los tres viven en `design/tokens.css`.

## Atajos de teclado

| Tecla | Acción | Tecla | Acción |
|---|---|---|---|
| A | Guardar la ficha | H | Abrir el chat real del canal |
| S | Enviar el mensaje escrito → [[D30-tecla-s-sin-confirmacion]] | V | Abrir el perfil de LinkedIn |
| D | Fecha de próximo contacto | C / Z / Ctrl+Z | Deshacer |
| R | Fecha de reunión | | |
| F | Cambiar canal de envío | | |
| G | Abrir/cerrar la conversación | | |

Dentro del calendario de próximo contacto, **A S D F** pasan a ser 1, 2, 3 y 4 semanas. Los atajos se ignoran cuando el foco está en un input, textarea, select o campo editable.

## Detalles transversales

- **Anchos arrastrables**, con doble clic para volver al normal y persistencia local: columna 1 (260–520), agenda (340–900), repositorio (300–620).
- **Popovers grandes** posicionados con coordenadas calculadas desde el botón (`position: fixed`), para que no los recorte el scroll de la columna.
- **Estados vacíos:** preferir *deshabilitado con motivo* antes que oculto (WhatsApp sin teléfono se muestra tachado con el title "Sin teléfono cargado"). Los permisos son la excepción: lo que un usuario no puede usar, no se muestra.

