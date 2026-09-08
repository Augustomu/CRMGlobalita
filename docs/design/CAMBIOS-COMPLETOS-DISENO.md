# Globalita CRM — todos los cambios del rediseño

Lista completa de lo pedido hasta ahora. Van 29 cambios, en 6 bloques.
Acompaña a `css-followup-extracto.css`, que trae el CSS y los tokens del dashboard actual.

---

## Contexto

CRM interno de prospección B2B por LinkedIn. Lo usa **una sola persona**, muchas horas por día: lee conversaciones, toma notas, agenda reuniones y programa mensajes.

No es un producto para vender. Es una herramienta de trabajo densa, para un usuario experto. **Densidad de información y velocidad de lectura** por encima de espacios generosos y decoración.

Base real: 6.165 contactos, de los cuales 1.086 son fichas completas.

El dashboard actual tiene **17.393 líneas en un solo archivo**. El rediseño va en **React modular, un archivo por sección**. No repetir el monolito.

---

## Prioridad: qué diseñar primero

Aunque la lista es larga, **arrancar solo por dos cosas**:

1. **El shell** — header, navegación entre secciones, grilla, tipografía.
2. **La columna 2 de Follow-up** — el panel de detalle de un contacto.

Es la pantalla más usada y la más difícil. Una vez resuelta, el resto sale por analogía. Los bloques 2 a 6 de abajo están para que se entienda a dónde va el sistema, no para diseñarlos ahora.

---

## Bloque 1 — Follow-up, columna 2 · **es el cambio fuerte**

Orden final de la columna, de arriba hacia abajo:

```
Cabecera (nombre + log de ediciones)
Etiquetas
Datos                    ← colapsable, cerrado
Contacto                 ← colapsable, cerrado
Fecha de reunión         ← sección hermana, calendario doble
Reunión                  ← confirmar / estado / cambiar fecha
Enviar mensaje
Conversación LinkedIn    ← arriba
Conversación WhatsApp    ← abajo
```

| # | Cambio |
|---|---|
| 1 | **«Datos» y «Contacto» pasan a ser colapsables**, cerrados por defecto. Es lo que permite que la ficha entre en una pantalla |
| 2 | **«Fecha de reunión» es una sección nueva**, hermana y **por fuera** de «Contacto» — no anidada dentro |
| 3 | Esa fecha usa un **calendario doble: dos meses lado a lado**, no un date-picker de un mes. Los días tienen tres estados: libre, ocupado, seleccionado |
| 4 | La disponibilidad de esos días **viene de Google Calendar** |
| 5 | **La conversación de LinkedIn va por encima de la de WhatsApp** |
| 6 | **«Enviar mensaje» va debajo de «Reunión»** |
| 7 | **«Próximo mensaje» se elimina por completo.** No incluirlo |
| 8 | **Etiquetas**: mostrar las **6 usadas más recientemente**, clickeables para aplicar rápido |
| 9 | Cada etiqueta lleva una **×** para borrarla |
| 10 | **Reunión**: botón «Confirmar reunión» |
| 11 | Al lado, el estado: **asistió / no asistió / cancelada** |
| 12 | Marcar asistió o no asistió **archiva la ficha** |
| 13 | Botón **«Cambiar fecha»**, que vuelve al calendario |
| 14 | **Log de ediciones**: un icono junto al nombre que abre el histórico de todo lo editado en ese perfil, con fecha y valor anterior |

También hay que **sumar filtros nuevos** a la sección — todavía sin definir cuáles.

---

## Bloque 2 — Tareas

Rediseño a algo **más simple y compacto**. Hoy ocupa demasiado para lo que hace.

| # | Cambio |
|---|---|
| 15 | Un campo directo para **escribir la tarea** |
| 16 | Un **estado** |
| 17 | **Inicio y fin** |
| 18 | Un **emoji de notas** para dejar un comentario en esa tarea |
| 19 | **Estrellas** para definir la prioridad |

---

## Bloque 3 — Secciones que se eliminan

No hay que diseñarlas. Desaparecen.

| # | Sección |
|---|---|
| 20 | **Obsidian 2D y 3D** |
| 21 | **Clusters** — se elimina el botón de la vista |
| 22 | **OpenClaw** |
| 23 | **Stack** |

---

## Bloque 4 — «Auto-agendar» se reemplaza por tres tabs

| # | Tab |
|---|---|
| 24 | **Repositorio de mensajes** usados frecuentemente |
| 25 | **Calendario**, con tres vistas: **diaria, semanal y lista** |
| 26 | **LinkedIn**: el perfil renderizado con una **réplica de la columna 2 al lado** |

> El 26 tiene una restricción técnica sin resolver: LinkedIn no se puede embeber en un iframe. Está pendiente decidir el camino. Diseñar la disposición —perfil a la izquierda, ficha a la derecha— sin asumir que el contenido de LinkedIn es interactivo.

---

## Bloque 5 — Motor de reglas

| # | Cambio |
|---|---|
| 27 | Automatizaciones dentro del dashboard, como **reglas simples**: si un lead tiene determinada etiqueta, se dispara determinada acción |

La forma es `SI <campo> <operador> <valor> ENTONCES <acción>`. Por ejemplo: *si la etiqueta contiene «Frío», mover al cluster X*.

Hace falta **un editor de reglas**: una tabla donde se listan, se crean y se editan. No es un editor de flujos con nodos y ramas — es deliberadamente más simple que eso.

---

## Bloque 6 — Cuentas de LinkedIn y warmup

| # | Cambio |
|---|---|
| 28 | Se **agregan cuentas nuevas** de LinkedIn |
| 29 | La sección **warmup** cambia poco: solo hay que acomodar las cuentas nuevas |

Hoy son 4 cuentas: alejandro, david, francisco y edith.

---

## Reglas de diseño, sin excepciones

Los tokens están en `css-followup-extracto.css`, en `:root` y `.dark-mode`.

- **Ningún hexadecimal suelto**: siempre `var(--token)`
- **Radios**: 12px cards y modales · 8px botones e inputs · 10px iconos · 50% círculos
- **Spacing**: múltiplos de 4 (4, 8, 12, 16, 20, 24, 32)
- **Font-size**: solo 9, 10, 11, 12, 13, 14, 17px · **Weights**: 400 / 500 / 600 / 700
- **Botones de icono**: 28×28px · **Gaps**: 10px entre cards, 6px internos
- **Hover**: `background: var(--accent)` + `border: .5px solid var(--accent-br)`
- **Emojis**: siempre `filter: grayscale(1)`; el hover restaura el color
- Prohibido `!important`, estilos inline y fallbacks tipo `var(--x, #hex)`
- **Modo claro y oscuro completos**

---

## Los datos reales son feos — diseñar para esto

Un diseño que se ve bien con «Juan Pérez» se rompe con esto.

- Nombres de hasta **153 caracteres**; notas de hasta **366**
- Teléfonos en **5 formatos distintos**: `55 31 8893-xxxx` · `55119517xxxxx` · `55(31) 98512-xxxx` · `52 8125 6782 xx` · `164668xxxxx`
- Acentos y ç: Jordão, Adrián, Gonçalves, Villagrán
- Solo el **12% tiene teléfono** y el **25% email**. **El estado vacío es la norma, no la excepción** — diseñarlo con cuidado

Tres fichas reales para maquetar:

```
Alexandre Jordão          Automotriz | Rio de Janeiro | 55 31 9238-xxxx
                          sin empresa, sin cargo, sin email
                          nota de 366 caracteres

Wellington Abner Simoes   Construccion Manufactura | Sao Paulo | 55119517xxxxx
                          wxxxxxx@opuscm.com.br
                          nota de 194 caracteres

Herik Pires               Automotriz | Belo Horizonte
                          sin teléfono, sin email, sin fecha
                          etiqueta: Periodico
                          ← el caso más común
```

---

## Restricciones

- **React**, componentes reutilizables, un archivo por sección
- Laptop de **14" (1366×768 útil)** — el usuario trabaja ahí todo el día
- Sin librerías de UI pesadas: CSS propio con los tokens
- Entregar **código**, no capturas

---

> Los datos de contacto de los ejemplos están enmascarados: este repositorio es público y son personas reales. Se conserva la forma de cada número, que es lo que el documento usa para razonar sobre el diseño.
