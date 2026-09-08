# Plan de trabajo

Decidido el 07/09/2026.

## Qué es cada cosa

> **El prototipo es la especificación, no el código de producción.**

`docs/_bundle/CRM de prospeccion.html` contiene las 29 pantallas en Design
Components. `support.js` es el runtime **compilado** que viene adentro: existe
para que los `.dc.html` se abran y se puedan revisar en un navegador, y nada
más. No es la base de la app y no se parchea — si una parte del runtime no
alcanza, esa parte ya la estamos reimplementando nativa.

La app se escribe en **nuestro stack**: React + TypeScript en `apps/web`,
PocketBase en `packages/db`, las reglas en `packages/core` con sus tests.

### La jerarquía de fuentes

| Fuente | Manda en |
|---|---|
| `docs/MANUAL.md` | las **reglas**: modelo, cadencia, permisos, integraciones |
| `docs/MANUAL-control-proyectos.md` | el anexo: Proyecto, Control, rol Observador |
| `docs/prototipo/ESTRUCTURA-Y-DECISIONES.md` | por qué cada cosa es como es |
| El prototipo (`.dc.html`) | lo **visual y el comportamiento**: medidas, densidad, flujos |

Para leer el prototipo: `node docs/desempacar.mjs` regenera `docs/prototipo/`
(gitignored) desde el bundle.

---

## El shell, cerrado

`Dashboard.dc.html` es el único header vigente. Las capturas con marca
«Globalita» y pestañas Tareas / Agenda / Reglas / Cuentas **se descartan**:
«Globalita» es una de las dos empresas propias dentro de Control —la otra es
Seng— no la marca del producto; y Tareas, Agenda y Reglas son paneles del
header, no pestañas de navegación.

**Pestañas**, armadas según los permisos del usuario:
`Automatizaciones · Control · Follow-up · WA Personal · Usuarios`

**A la derecha, sueltos:** notificaciones · tareas · agenda · tema · chip de
sesión.
**En el menú `···`:** cuentas conectadas · vencimientos · base compartida ·
repositorio · reglas · atajos.

---

## Estado

Lo medido está en `docs/AUDITORIA.md`, hecha leyendo el bundle entero.
Resumen: de 29 pantallas, **9 al día, 4 a medias, 16 sin construir**.

---

## El orden

Primero lo que puede hacer perder datos, después lo que se rompe con volumen, y
recién ahí pantallas nuevas.

### Fase 1 — Follow-up, que es la pantalla de todos los días

**1.1 · Aviso de cambios sin guardar** (§9.3) — ✅ **hecho**
Tres salidas: seguir editando / descartar / guardar y salir. Frena al cambiar
de lead y de sección. «Guardar y salir» espera a que el guardado termine, porque
puede fallar.

**1.2 · Aguantar el volumen real** (§7.2) — *siguiente*
Hoy `useLeads` hace `getFullList`: **trae los 6.165 leads del servidor y los
dibuja todos**. Son dos problemas distintos y el prototipo solo resuelve el
segundo, porque ahí los datos ya están en memoria.

El algoritmo del prototipo, exacto: arranca en 80 · suma 80 al llegar a 400px
del final · vuelve a 80 cuando cambia un filtro · si el lead elegido cae fuera
de la ventana, la expande a `índice + 80` antes de hacer scroll.

Antes de elegir cómo se traen los datos hay que **medirlo con volumen de
verdad**: sembrar ~6.000 leads y ver cuánto pesa la respuesta y cuánto tarda.
Con el número en la mano se decide si alcanza con traer todo una vez —que es lo
que el prototipo asume, y lo que hace que el buscador y los filtros sean
instantáneos— o si hay que mover el filtrado al servidor, que cambia ese
comportamiento.

**1.3 · Los seis filtros que faltan**
Hoy hay dos de ocho: próximo contacto y WhatsApp. Faltan **orden, reunión, rol,
país, ciudad y etiquetas**. Los cuatro últimos son listas que salen de los
datos, no fijas.

**1.4 · El header, corregido**
Sueltos van: notificaciones · tareas · agenda · tema · sesión.
Al menú `···` van: cuentas conectadas · vencimientos · base compartida ·
repositorio · reglas · atajos.
Hoy vencimientos y repositorio están sueltos, y faltan los tres primeros.
Tareas y Agenda todavía no existen: van **deshabilitados con el motivo**, que es
lo que pide §9.7, no ocultos.

**1.5 · El calendario de próximo contacto, por carga**
Pinta cada día contra el tope diario —verde el elegido, ámbar los que se
acercan, rojo los pasados— y ofrece los atajos `A S D F` de 1 a 4 semanas,
mostrando el corrimiento cuando el día ideal está lleno (`14/09 +2d`).
Es una regla, así que va a `core/` con sus tests.

### Fase 2 — Completar lo que ya tiene backend

Usuarios (pestaña Actividad, asignación en lote) · Repositorio (destacados con
alcance, orden arrastrable) · Vencimientos (idioma detectado) · el panel de
etiquetas completo · Editar links · Confirmar reunión · Análisis del perfil.

### Fase 3 — Lo que necesita modelo nuevo

Agenda · Tareas · WA Personal · Automatizaciones · Base compartida · Cola de
envíos · Importar CSV · Reglas.

Y los módulos de `core/` que el manual especifica y todavía no existen:
`cupos`, `cancelacion`, `reglas`, `tarea`, `agenda`, `actividad`.

### Fase 4 — Lo que no depende de mí

- El cliente OAuth en Google Cloud, para que la disponibilidad del calendario
  salga de la agenda real.
- La decisión sobre el repositorio público y el histórico ya expuesto.
- Baileys: WhatsApp y LinkedIn.

---

## Nota sobre un rodeo que se dio

Durante unas horas se probó servir el prototipo como front-end y se borró
`apps/web`. Augusto lo aclaró: el prototipo es la especificación. Se restauró
todo desde el historial sin pérdida. Queda anotado porque la prueba dejó dos
cosas útiles:

- El prototipo **corre** servido como estático, con cero errores de consola.
  Sirve para mirarlo al lado de lo construido, que es para lo que está.
- Los datos de demo del prototipo están en 304 renglones de constantes al medio
  de `Dashboard.dc.html`: son la mejor referencia de qué forma tiene cada cosa.
